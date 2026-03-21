// @vitest-environment node
/**
 * Integration tests — Tenant isolation / context leak prevention
 *
 * Covers the bugs fixed in this session:
 *
 * BUG 1: Cross-tenant context leak via /api/me
 *   A user who belongs to Tenant1 (WCC) must NOT be able to call /api/me
 *   with x-tenant-id=tenant2 and receive a 200 — it must return 403.
 *
 * BUG 2: /api/admin/member?orgId= must enforce org boundary
 *   The middleware fallback path calls this route with orgId in multi-tenant
 *   mode. It must return 403 when the user is not a member of that org,
 *   and must return the per-tenant app_role (not the global one) when they are.
 *
 * BUG 3: Provisioned tenant admin has Admin role in organization_members
 *   When provision_tenant() is called, the founding admin must have
 *   organization_members.app_role = 'Admin'.  The /api/me route must expose
 *   that Admin role, not fall through to a Musician default.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { makeNextRequest } from "./_helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TENANT1_ID = "00000000-0000-0000-0000-000000000001"; // WCC
const TENANT2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // Tenant2

const WCC_MEMBER = {
  id: "mem-wcc-001",
  email: "admin@wcc.com",
  name: "WCC Admin",
  app_role: "Admin",
  is_active: true,
};

const TENANT2_MEMBER = {
  id: "mem-t2-001",
  email: "admin@tenant2.com",
  name: "Tenant2 Admin",
  app_role: "Admin", // global members.app_role
  is_active: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────────────────────

const { mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    mockSupabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({}) } },
    },
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

const { mockGetMemberByEmail } = vi.hoisted(() => ({
  mockGetMemberByEmail: vi.fn(),
}));

vi.mock("@/lib/db/members", () => ({
  getMemberByEmail: mockGetMemberByEmail,
}));

vi.mock("@/lib/server/feature-flags", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue(["roster", "songs"]),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: "no session" }) },
  }),
}));

vi.mock("server-only", () => ({}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.MULTI_TENANT_ENABLED = "true";

// Import AFTER mocks and env setup
const { GET: meRoute } = await import("@/app/api/me/route");
const { GET: adminMemberRoute } = await import("@/app/api/admin/member/route");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a thenable Supabase query chain that resolves with the given payload */
function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "single", "maybeSingle", "order", "limit", "upsert", "update"] as const;
  methods.forEach((m) => { chain[m] = vi.fn().mockReturnValue(chain); });
  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve)
  );
  return chain;
}

/** Build a JWT-shaped cookie value whose payload contains the given email */
function makeJwt(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return `header.${payload}.sig`;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: from() returns empty (null) chain — overridden per-test
  mockSupabase.from.mockReturnValue(makeChain(null));

  // Default: getMemberByEmail returns null — overridden per-test
  mockGetMemberByEmail.mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG 1: /api/me cross-tenant access is blocked
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/me — tenant boundary enforcement (multi-tenant mode)", () => {
  it("returns 403 when the authenticated user is NOT a member of the requested tenant", async () => {
    // WCC Admin calls /api/me with x-tenant-id = TENANT2 (not their org)
    mockGetMemberByEmail.mockResolvedValue(WCC_MEMBER);

    // organization_members lookup for WCC Admin in TENANT2 → null (not a member)
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain(null); // org check → not found → 403
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      headers: { "x-tenant-id": TENANT2_ID },
      cookies: { "sb-access-token": makeJwt(WCC_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not a member/i);
  });

  it("returns 200 when the authenticated user IS a member of the requested tenant", async () => {
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ app_role: "Admin", is_active: true }); // org membership
      if (callCount === 2) return makeChain({ name: "Tenant2 Church" }); // org name
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      headers: { "x-tenant-id": TENANT2_ID },
      cookies: { "sb-access-token": makeJwt(TENANT2_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string; tenant_id: string; tenant_name: string };
    expect(body.app_role).toBe("Admin");
    expect(body.tenant_id).toBe(TENANT2_ID);
    expect(body.tenant_name).toBe("Tenant2 Church");
  });

  it("returns the org-specific role even when the global members.app_role differs", async () => {
    // Simulates a provisioned admin whose global members.app_role is 'Musician'
    // but organization_members.app_role = 'Admin' (set by provision_tenant)
    const memberWithWrongGlobalRole = { ...TENANT2_MEMBER, app_role: "Musician" };
    mockGetMemberByEmail.mockResolvedValue(memberWithWrongGlobalRole);

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ app_role: "Admin", is_active: true }); // org: correct role
      if (callCount === 2) return makeChain({ name: "Tenant2 Church" });
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      headers: { "x-tenant-id": TENANT2_ID },
      cookies: { "sb-access-token": makeJwt(TENANT2_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string };
    // Must return the org-specific Admin, not the global Musician
    expect(body.app_role).toBe("Admin");
  });

  it("returns 403 when org membership is inactive (deactivated tenant member)", async () => {
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ app_role: "Admin", is_active: false }); // inactive
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      headers: { "x-tenant-id": TENANT2_ID },
      cookies: { "sb-access-token": makeJwt(TENANT2_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(403);
  });

  it("does NOT leak Tenant1 data when resolved tenant is Tenant1 but user belongs to Tenant2", async () => {
    // Tenant2 admin navigates to WCC tenant context — must be blocked
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      // Org membership lookup: Tenant2 member is NOT in Tenant1 (WCC)
      if (callCount === 1) return makeChain(null);
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      // x-tenant-id = Tenant1 (WCC) — wrong tenant for this user
      headers: { "x-tenant-id": TENANT1_ID },
      cookies: { "sb-access-token": makeJwt(TENANT2_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG 2: /api/admin/member?orgId= org boundary enforcement
// (middleware cookie-fallback auth path)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/member — org membership enforcement", () => {
  it("returns 403 when user is not a member of the requested org", async () => {
    mockGetMemberByEmail.mockResolvedValue(WCC_MEMBER);

    // organization_members lookup → null (WCC Admin not in Tenant2)
    mockSupabase.from.mockReturnValue(makeChain(null));

    const req = makeNextRequest({
      url: `http://localhost/api/admin/member?email=${encodeURIComponent(WCC_MEMBER.email)}&orgId=${TENANT2_ID}`,
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("not_member_of_org");
  });

  it("returns 200 with org-specific Admin role when user IS a member", async () => {
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    // organization_members → Admin role for Tenant2
    mockSupabase.from.mockReturnValue(makeChain({ app_role: "Admin", is_active: true }));

    const req = makeNextRequest({
      url: `http://localhost/api/admin/member?email=${encodeURIComponent(TENANT2_MEMBER.email)}&orgId=${TENANT2_ID}`,
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string };
    expect(body.app_role).toBe("Admin");
  });

  it("returns org-specific Coordinator role even when global members.app_role is Admin", async () => {
    const memberGlobalAdmin = { ...TENANT2_MEMBER, app_role: "Admin" };
    mockGetMemberByEmail.mockResolvedValue(memberGlobalAdmin);

    // Their org role is Coordinator (not Admin)
    mockSupabase.from.mockReturnValue(makeChain({ app_role: "Coordinator", is_active: true }));

    const req = makeNextRequest({
      url: `http://localhost/api/admin/member?email=${encodeURIComponent(TENANT2_MEMBER.email)}&orgId=${TENANT2_ID}`,
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string };
    expect(body.app_role).toBe("Coordinator");
  });

  it("returns global role when orgId is NOT provided (single-tenant backward compat)", async () => {
    mockGetMemberByEmail.mockResolvedValue(WCC_MEMBER);

    const req = makeNextRequest({
      url: `http://localhost/api/admin/member?email=${encodeURIComponent(WCC_MEMBER.email)}`,
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string };
    // No orgId → returns global role from members table (no org check performed)
    expect(body.app_role).toBe("Admin");
  });

  it("returns 404 when the member does not exist globally", async () => {
    mockGetMemberByEmail.mockResolvedValue(null);

    const req = makeNextRequest({
      url: "http://localhost/api/admin/member?email=nobody@nowhere.com&orgId=some-org-id",
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when org membership is inactive", async () => {
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    // organization_members → is_active: false
    mockSupabase.from.mockReturnValue(makeChain({ app_role: "Admin", is_active: false }));

    const req = makeNextRequest({
      url: `http://localhost/api/admin/member?email=${encodeURIComponent(TENANT2_MEMBER.email)}&orgId=${TENANT2_ID}`,
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3: Provisioned tenant admin — correct Admin role accessible via /api/me
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/me — provisioned tenant admin role", () => {
  it("provisioned admin (org role=Admin) receives Admin role from /api/me", async () => {
    // provision_tenant() sets members.app_role = 'Admin'
    // AND organization_members.app_role = 'Admin'
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ app_role: "Admin", is_active: true }); // org membership
      if (callCount === 2) return makeChain({ name: "Tenant2 Church" }); // org name
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      headers: { "x-tenant-id": TENANT2_ID },
      cookies: { "sb-access-token": makeJwt(TENANT2_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string; tenant_id: string };
    expect(body.app_role).toBe("Admin");
    expect(body.tenant_id).toBe(TENANT2_ID);
  });

  it("provisioned admin can be verified via /api/admin/member?orgId= (middleware fallback path)", async () => {
    // This is what the middleware's cookie-fallback path does:
    // calls /api/admin/member?email=...&orgId=tenant2-uuid
    // expects Admin role back so the user can access /admin/*
    mockGetMemberByEmail.mockResolvedValue(TENANT2_MEMBER);

    mockSupabase.from.mockReturnValue(makeChain({ app_role: "Admin", is_active: true }));

    const req = makeNextRequest({
      url: `http://localhost/api/admin/member?email=${encodeURIComponent(TENANT2_MEMBER.email)}&orgId=${TENANT2_ID}`,
    });

    const res = await adminMemberRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string };
    expect(body.app_role).toBe("Admin");
  });

  it("provisioned admin with global Musician role (trigger interference scenario) is still blocked by org Admin", async () => {
    // Scenario: a DB trigger incorrectly sets members.app_role = 'Musician' after the invite
    // But provision_tenant() correctly set organization_members.app_role = 'Admin'.
    // /api/me should return 200 Admin (not 403 or Musician).
    const memberWithBadGlobalRole = { ...TENANT2_MEMBER, app_role: "Musician" };
    mockGetMemberByEmail.mockResolvedValue(memberWithBadGlobalRole);

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ app_role: "Admin", is_active: true }); // org: Admin
      if (callCount === 2) return makeChain({ name: "Tenant2 Church" });
      return makeChain(null);
    });

    const req = makeNextRequest({
      url: "http://localhost/api/me",
      headers: { "x-tenant-id": TENANT2_ID },
      cookies: { "sb-access-token": makeJwt(TENANT2_MEMBER.email) },
    });

    const res = await meRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { app_role: string };
    // Org role wins — not the corrupted global role
    expect(body.app_role).toBe("Admin");
  });
});
