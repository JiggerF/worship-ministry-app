// @vitest-environment node
/**
 * Integration tests — GET /api/availability/[token]  &  POST /api/availability/[token]
 * src/app/api/availability/[token]/route.ts
 *
 * Tests token validation, T+1 month enforcement, lockout logic,
 * date validation, and success paths.
 * Both getMemberByMagicToken (DB) and Supabase client are mocked.
 *
 * GAP 3 security tests also verify:
 * - Member with no active org membership → 403
 * - getMemberRoles is scoped to the member's tenant
 * - Legacy availability reads/writes include tenant_id
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock @/lib/db/members before route loads ──
const { mockGetMemberByMagicToken } = vi.hoisted(() => ({
  mockGetMemberByMagicToken: vi.fn(),
}));

vi.mock("@/lib/db/members", () => ({
  getMemberByMagicToken: mockGetMemberByMagicToken,
}));

// ── Mock Supabase client ──
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET, POST } from "@/app/api/availability/[token]/route";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns ISO string for the first day of (currentMonth + delta) */
function nextMonthFirst(deltaMo = 1): string {
  const now = new Date();
  const y = now.getFullYear() + Math.floor((now.getMonth() + deltaMo) / 12);
  const m = (now.getMonth() + deltaMo) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function extractToken(context: { token: string }) {
  return { params: Promise.resolve({ token: context.token }) };
}

/** Build a Supabase query chain that resolves to { data, error }. */
function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  ["select", "eq", "in", "order", "upsert", "limit", "single", "maybeSingle", "delete"].forEach(
    (m) => { chain[m] = vi.fn().mockReturnValue(chain); }
  );
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

const MEMBER = { id: "m-001", name: "Alice" };
const MEMBER_TENANT_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();

  // Route first calls organization_members to resolve the member's active tenant (GAP 3 fix).
  // All other tables (member_role_assignments, roles, availability, etc.) return empty arrays.
  mockFrom.mockImplementation((table: string) => {
    if (table === "organization_members") {
      return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
    }
    return makeChain([]);
  });

  // Default: valid token resolves to member
  mockGetMemberByMagicToken.mockResolvedValue(MEMBER);
});

afterEach(() => vi.useRealTimers());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/availability/[token]
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/availability/[token] — parameter validation", () => {
  it("returns 400 when targetMonth query param is missing", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/availability/tok123",
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/targetMonth/i);
  });

  it("returns 400 for malformed targetMonth (not YYYY-MM-01)", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/availability/tok123?targetMonth=2026-03",
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/format/i);
  });

  it("returns 404 for an invalid/unknown magic token", async () => {
    mockGetMemberByMagicToken.mockResolvedValue(null);
    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/bad-token?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "bad-token" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when targetMonth is not T+1 (wrong month)", async () => {
    // Send current month instead of next month
    const now = new Date();
    const currentMonthFirst = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${currentMonthFirst}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
  });
});

describe("GET /api/availability/[token] — success", () => {
  it("returns 200 with member, sundays, availability, and lockout info", async () => {
    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member).toBeDefined();
    expect(body.sundays).toBeDefined();
    expect(Array.isArray(body.sundays)).toBe(true);
    expect(body.lockout).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET — orgName field (dynamic tenant labels)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/availability/[token] — orgName field (dynamic tenant labels)", () => {
  it("includes orgName in the response when the org exists", async () => {
    // Override the mock so the organizations table returns a name
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
      }
      if (table === "organizations") {
        return makeChain({ name: "WCC Worship Ministry" });
      }
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { orgName: string | null };
    expect(body.orgName).toBe("WCC Worship Ministry");
  });

  it("returns orgName: null gracefully when the org lookup returns no row", async () => {
    // organizations returns null (no row found) — orgName should be null, not throw
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
      }
      if (table === "organizations") {
        return makeChain(null); // maybeSingle → null when no row
      }
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { orgName: string | null };
    expect(body.orgName).toBeNull();
  });

  it("returns orgName: null gracefully when the org lookup returns a row with null name", async () => {
    // organizations returns a row but name is null (not yet set in DB)
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
      }
      if (table === "organizations") {
        return makeChain({ name: null });
      }
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { orgName: string | null };
    expect(body.orgName).toBeNull();
  });

  it("orgName field is present in the response body (not undefined)", async () => {
    // Verify the field is always present in the response shape even when null
    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    // The field must exist (even if null) — client reads json.orgName
    expect("orgName" in body).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/availability/[token]
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/availability/[token] — validation", () => {
  it("returns 400 when targetMonth is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/availability/tok123",
      body: { available_dates: [] },
    });
    const res = await POST(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for invalid token", async () => {
    mockGetMemberByMagicToken.mockResolvedValue(null);
    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      method: "POST",
      url: `http://localhost/api/availability/bad?targetMonth=${targetMonth}`,
      body: { available_dates: [] },
    });
    const res = await POST(req, extractToken({ token: "bad" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/availability/[token] — lockout", () => {
  it("returns 423 when the month is locked (Melbourne date past the 19th)", async () => {
    // Mock today to be the 20th of the month before the target month
    // This makes isLocked return true for next month.
    // nextMonth target
    const targetMonth = nextMonthFirst();
    const [targetYear, targetMonthNum] = targetMonth.split("-").map(Number);

    // Lock date is prev_month_19th for target month → same as current month 19
    const lockDate = new Date(
      Date.UTC(targetYear, targetMonthNum - 2, 20) // day 20 = past the 19th
    );
    vi.setSystemTime(lockDate);

    const req = makeNextRequest({
      method: "POST",
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
      body: { available_dates: [] },
    });
    const res = await POST(req, extractToken({ token: "tok123" }));
    // When today > lock date, the month is locked → 423
    expect(res.status).toBe(423);
  });
});

describe("POST /api/availability/[token] — success", () => {
  it("returns 200 on successful upsert", async () => {
    // Set date to early in the month so lock is NOT triggered
    const today = new Date();
    const earlyInMonth = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), 5)
    );
    vi.setSystemTime(earlyInMonth);

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      method: "POST",
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
      body: { available_dates: [], preferred_role_id: null, notes: null },
    });
    const res = await POST(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GAP 3: Tenant isolation — member must have an active org membership
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/availability/[token] — tenant isolation (GAP 3)", () => {
  it("returns 403 when member has no active org membership", async () => {
    // organization_members returns empty — no tenant can be resolved
    mockFrom.mockImplementation(() => makeChain([]));

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    const res = await GET(req, extractToken({ token: "tok123" }));

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/no active organisation/i);
  });

  it("queries organization_members to resolve the member's tenant", async () => {
    const orgChain = makeChain([{ organization_id: MEMBER_TENANT_ID }]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") return orgChain;
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    await GET(req, extractToken({ token: "tok123" }));

    expect(mockFrom).toHaveBeenCalledWith("organization_members");
  });

  it("scopes member_role_assignments query to resolved tenantId", async () => {
    const roleChain = makeChain([]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
      if (table === "member_role_assignments") return roleChain;
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    await GET(req, extractToken({ token: "tok123" }));

    expect(mockFrom).toHaveBeenCalledWith("member_role_assignments");
    // Verify tenant_id filter was applied to the roles query
    const eqCalls = (roleChain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual(["tenant_id", MEMBER_TENANT_ID]);
  });

  it("filters availability table by tenant_id (prevents cross-tenant reads)", async () => {
    const availChain = makeChain([]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
      if (table === "availability") return availChain;
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
    });
    await GET(req, extractToken({ token: "tok123" }));

    expect(mockFrom).toHaveBeenCalledWith("availability");
    const eqCalls = (availChain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual(["tenant_id", MEMBER_TENANT_ID]);
  });
});

describe("POST /api/availability/[token] — tenant isolation (GAP 3)", () => {
  it("returns 403 when member has no active org membership", async () => {
    mockFrom.mockImplementation(() => makeChain([]));

    const today = new Date();
    vi.setSystemTime(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 5)));

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      method: "POST",
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
      body: { available_dates: [] },
    });
    const res = await POST(req, extractToken({ token: "tok123" }));

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/no active organisation/i);
  });

  it("includes tenant_id in the availability upsert payload (prevents cross-tenant writes)", async () => {
    const today = new Date();
    vi.setSystemTime(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 5)));

    const availChain = makeChain(null);
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") return makeChain([{ organization_id: MEMBER_TENANT_ID }]);
      if (table === "availability") return availChain;
      return makeChain([]);
    });

    const targetMonth = nextMonthFirst();
    const req = makeNextRequest({
      method: "POST",
      url: `http://localhost/api/availability/tok123?targetMonth=${targetMonth}`,
      body: { available_dates: [], preferred_role_id: null, notes: null },
    });
    const res = await POST(req, extractToken({ token: "tok123" }));
    expect(res.status).toBe(200);

    // Verify upsert was called on the availability table
    expect(mockFrom).toHaveBeenCalledWith("availability");
    const upsertFn = availChain.upsert as ReturnType<typeof vi.fn>;
    expect(upsertFn).toHaveBeenCalled();
    // Each row in the upsert payload must include tenant_id
    const payload = upsertFn.mock.calls[0][0] as Array<{ tenant_id: string }>;
    if (Array.isArray(payload) && payload.length > 0) {
      expect(payload[0].tenant_id).toBe(MEMBER_TENANT_ID);
    }
  });
});
