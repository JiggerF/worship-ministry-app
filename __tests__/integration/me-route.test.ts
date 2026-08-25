/**
 * Integration tests for GET /api/me
 *
 * Route reads the authenticated user's email (via @supabase/ssr or cookie
 * fallback) and delegates to getMemberByEmail.
 *
 * In multi-tenant mode (MULTI_TENANT_ENABLED=true) the route also:
 *   - Requires x-tenant-id header (injected by middleware in real traffic)
 *   - Validates org membership via organization_members table
 *   - Returns 403 when member is not in the requested org
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── hoisted mock refs ──────────────────────────────────────────────────────
const { mockGetUser, mockGetMemberByEmail, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetMemberByEmail: vi.fn(),
  mockFrom: vi.fn(),
}));

// Mock @supabase/ssr — createServerClient returns a stub auth object
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// Mock the DB helper
vi.mock("@/lib/db/members", () => ({
  getMemberByEmail: mockGetMemberByEmail,
}));

// Mock feature flags so we don't need to set up org table queries for it
vi.mock("@/lib/server/feature-flags", () => ({
  getEnabledFeatures: vi.fn().mockResolvedValue([]),
}));

// Mock supabase-js for the org membership + org name queries
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// Import route AFTER mocks are registered
const { GET } = await import("@/app/api/me/route");

// ── constants ───────────────────────────────────────────────────────────────
const WCC_TENANT_ID = "00000000-0000-0000-0000-000000000001";

// ── helpers ────────────────────────────────────────────────────────────────
const MEMBER = {
  id: "member-1",
  name: "Alice",
  email: "alice@example.com",
  app_role: "Admin",
};

/** Build a fresh thenable chain that resolves with `data`. */
function makeChain(data: unknown) {
  const c: Record<string, unknown> = {};
  ["select", "eq", "single", "maybeSingle"].forEach((m) => {
    c[m] = vi.fn().mockReturnValue(c);
  });
  c.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve)
  );
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: authenticated via supabase ssr
  mockGetUser.mockResolvedValue({
    data: { user: { email: "alice@example.com" } },
    error: null,
  });
  mockGetMemberByEmail.mockResolvedValue(MEMBER);

  // Default: org membership check passes (Admin), then org name query
  let fromCount = 0;
  mockFrom.mockImplementation(() => {
    fromCount++;
    if (fromCount === 1) return makeChain({ app_role: "Admin", is_active: true, permission_overrides: null }); // org_members
    return makeChain({ name: "WCC Worship" });                                     // organizations
  });
});

// ── tests ──────────────────────────────────────────────────────────────────
describe("GET /api/me", () => {
  describe("happy path", () => {
    it("returns 200 with member data when supabase ssr resolves email", async () => {
      // x-tenant-id is required by getTenantId() when MULTI_TENANT_ENABLED=true.
      // In real traffic this header is injected by middleware; in tests we set it directly.
      const req = makeNextRequest({
        url: "http://localhost:3000/api/me",
        headers: { "x-tenant-id": WCC_TENANT_ID },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ id: "member-1", email: "alice@example.com" });
      expect(body).toHaveProperty("permissions");
      // Admin should have all actions on all resources
      expect(body.permissions.people).toEqual(expect.arrayContaining(["view", "write", "delete"]));
      expect(body.permissions.songs).toEqual(expect.arrayContaining(["view", "write", "delete"]));
      expect(mockGetMemberByEmail).toHaveBeenCalledWith("alice@example.com");
    });
  });

  describe("auth failures", () => {
    it("returns 401 when supabase ssr finds no user and no cookie fallback", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });

      const req = makeNextRequest({
        url: "http://localhost:3000/api/me",
        headers: { "x-tenant-id": WCC_TENANT_ID },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body).toHaveProperty("error");
      expect(mockGetMemberByEmail).not.toHaveBeenCalled();
    });

    it("returns 401 when supabase returns user with no email", async () => {
      mockGetUser.mockResolvedValue({ data: { user: {} }, error: null });

      const req = makeNextRequest({
        url: "http://localhost:3000/api/me",
        headers: { "x-tenant-id": WCC_TENANT_ID },
      });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe("DB errors", () => {
    it("returns 500 when getMemberByEmail throws", async () => {
      mockGetMemberByEmail.mockRejectedValue(new Error("DB connection error"));

      const req = makeNextRequest({
        url: "http://localhost:3000/api/me",
        headers: { "x-tenant-id": WCC_TENANT_ID },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("DB connection error");
    });
  });
});
