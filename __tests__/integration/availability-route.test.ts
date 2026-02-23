// @vitest-environment node
/**
 * Integration tests — GET /api/availability/[token]  &  POST /api/availability/[token]
 * src/app/api/availability/[token]/route.ts
 *
 * Tests token validation, T+1 month enforcement, lockout logic,
 * date validation, and success paths.
 * Both getMemberByMagicToken (DB) and Supabase client are mocked.
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
const { mockQuery, mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "eq", "in", "order", "upsert"] as const;
  methods.forEach((m) => {
    query[m] = vi.fn().mockReturnValue(query);
  });
  query.then = vi.fn();
  const from = vi.fn().mockReturnValue(query);
  const client = { from };
  return { mockQuery: query, mockFrom: from, mockClient: client };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
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

const MEMBER = { id: "m-001", name: "Alice" };

beforeEach(() => {
  vi.clearAllMocks();

  // Re-attach chain after clearAllMocks
  const methods = ["select", "eq", "in", "order", "upsert"] as const;
  methods.forEach((m) => {
    (mockQuery as Record<string, unknown>)[m] = vi.fn().mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);

  // Default: Supabase returns empty arrays
  (mockQuery as Record<string, unknown>).then = (
    resolve: (v: unknown) => unknown
  ) => Promise.resolve({ data: [], error: null }).then(resolve);

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
