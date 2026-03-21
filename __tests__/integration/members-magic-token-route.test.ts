// @vitest-environment node
/**
 * Integration tests for POST /api/members/[id]/magic-token
 *
 * GAP 2 fix: Route now requires Admin or Coordinator role AND
 * verifies the target member belongs to the caller's tenant before
 * regenerating the magic token.
 *
 * Security scenarios covered:
 * - Unauthenticated request → 403 (no token regeneration)
 * - Insufficient role (Musician) → 403
 * - Admin for wrong tenant → 404 (member not in their org)
 * - Admin for correct tenant → 200
 * - Coordinator for correct tenant → 200
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── hoisted mocks ──────────────────────────────────────────────────────────
const { mockGetActor, mockGenerateMagicToken, mockFrom } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
  mockGenerateMagicToken: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/members", () => ({
  generateMagicToken: mockGenerateMagicToken,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// Env vars must be set before the route module is imported so the
// `if (supabaseUrl && serviceKey)` tenant-membership check executes.
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

const { POST } = await import("@/app/api/members/[id]/magic-token/route");

// ── fixtures ──────────────────────────────────────────────────────────────
const TENANT1_ID = "00000000-0000-0000-0000-000000000001";
const TENANT2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MEMBER_ID = "mem-uuid-001";

const ADMIN_ACTOR  = { id: "actor-001", name: "Admin",       role: "Admin",       tenantId: TENANT1_ID };
const COORD_ACTOR  = { id: "actor-002", name: "Coordinator", role: "Coordinator", tenantId: TENANT1_ID };
const MUSICIAN     = { id: "actor-003", name: "Musician",    role: "Musician",    tenantId: TENANT1_ID };
const T2_ADMIN     = { id: "actor-004", name: "T2 Admin",    role: "Admin",       tenantId: TENANT2_ID };

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Minimal Supabase query chain that resolves `.then()` with { data, error }. */
function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  ["select", "eq", "maybeSingle", "single", "limit", "in", "order"].forEach(
    (m) => { chain[m] = vi.fn().mockReturnValue(chain); }
  );
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue(null);
  mockGenerateMagicToken.mockResolvedValue("abc123token");
  // Default: member IS in caller's tenant
  mockFrom.mockReturnValue(makeChain({ member_id: MEMBER_ID }));
});

// ─────────────────────────────────────────────────────────────────────────────
// GAP 2: Authentication enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/members/[id]/magic-token — authentication (GAP 2)", () => {
  it("returns 403 for unauthenticated request — no token regenerated", async () => {
    mockGetActor.mockResolvedValue(null);

    const req = makeNextRequest({ method: "POST" });
    const res = await POST(req, makeContext(MEMBER_ID));

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Forbidden");
    expect(mockGenerateMagicToken).not.toHaveBeenCalled();
  });

  it("returns 403 for Musician role (insufficient privileges)", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN);

    const req = makeNextRequest({ method: "POST" });
    const res = await POST(req, makeContext(MEMBER_ID));

    expect(res.status).toBe(403);
    expect(mockGenerateMagicToken).not.toHaveBeenCalled();
  });

  it("returns 200 for Admin role when member is in same tenant", async () => {
    mockGetActor.mockResolvedValue(ADMIN_ACTOR);

    const req = makeNextRequest({ method: "POST" });
    const res = await POST(req, makeContext(MEMBER_ID));

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    expect(body.token).toBe("abc123token");
    expect(mockGenerateMagicToken).toHaveBeenCalledWith(MEMBER_ID);
  });

  it("returns 200 for Coordinator role when member is in same tenant", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);

    const req = makeNextRequest({ method: "POST" });
    const res = await POST(req, makeContext(MEMBER_ID));

    expect(res.status).toBe(200);
    expect(mockGenerateMagicToken).toHaveBeenCalledWith(MEMBER_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GAP 2: Cross-tenant IDOR prevention
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/members/[id]/magic-token — tenant isolation (GAP 2)", () => {
  it("returns 404 when target member does NOT belong to caller's tenant", async () => {
    // T2 admin tries to regenerate token for a Tenant1 member
    mockGetActor.mockResolvedValue(T2_ADMIN);
    mockFrom.mockReturnValue(makeChain(null)); // org membership check → not found

    const req = makeNextRequest({ method: "POST" });
    const res = await POST(req, makeContext(MEMBER_ID));

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Member not found");
    expect(mockGenerateMagicToken).not.toHaveBeenCalled();
  });

  it("succeeds when target member DOES belong to caller's tenant", async () => {
    mockGetActor.mockResolvedValue(ADMIN_ACTOR);
    mockFrom.mockReturnValue(makeChain({ member_id: MEMBER_ID })); // org membership found

    const req = makeNextRequest({ method: "POST" });
    const res = await POST(req, makeContext(MEMBER_ID));

    expect(res.status).toBe(200);
    expect(mockGenerateMagicToken).toHaveBeenCalledWith(MEMBER_ID);
  });

  it("queries organization_members scoped to caller's tenantId", async () => {
    mockGetActor.mockResolvedValue(ADMIN_ACTOR);

    const orgChain = makeChain({ member_id: MEMBER_ID });
    mockFrom.mockReturnValue(orgChain);

    const req = makeNextRequest({ method: "POST" });
    await POST(req, makeContext(MEMBER_ID));

    expect(mockFrom).toHaveBeenCalledWith("organization_members");
    // Verify the chain was filtered by organization_id (caller's tenantId)
    const eqCalls = (orgChain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual(["organization_id", TENANT1_ID]);
    expect(eqCalls).toContainEqual(["member_id", MEMBER_ID]);
  });

  it("different tenant admins get different org-scoped checks", async () => {
    // Tenant 2 admin — member NOT found in Tenant2
    mockGetActor.mockResolvedValue(T2_ADMIN);
    const t2Chain = makeChain(null);
    mockFrom.mockReturnValue(t2Chain);

    const req = makeNextRequest({ method: "POST" });
    await POST(req, makeContext(MEMBER_ID));

    // The org check must use T2's tenant ID, not T1's
    const eqCalls = (t2Chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual(["organization_id", TENANT2_ID]);
  });
});
