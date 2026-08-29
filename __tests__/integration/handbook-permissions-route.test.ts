// @vitest-environment node
/**
 * Integration tests — GET/PUT /api/settings/handbook-permissions
 *
 * Tests role-based access control using hasPermission().
 * Mocks resolveEmail via cookie-based auth and getMemberByEmail for member lookup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest, makeChain } from "./_helpers";

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockGetMemberByEmail } = vi.hoisted(() => ({
  mockGetMemberByEmail: vi.fn(),
}));

vi.mock("@/lib/db/members", () => ({
  getMemberByEmail: mockGetMemberByEmail,
}));

// Mock @supabase/ssr to resolve email from cookies
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: "admin@test.com" } },
        error: null,
      }),
    },
  })),
}));

// Mock @supabase/supabase-js (service client used for app_settings reads/writes)
const mockUpsertChain = makeChain({ data: null, error: null });
const mockSelectChain = makeChain({
  data: { value: { editor_roles: ["Admin", "Coordinator"], editor_member_ids: [] } },
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "app_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue(mockSelectChain),
              }),
            }),
          }),
          upsert: vi.fn().mockReturnValue(mockUpsertChain),
        };
      }
      return makeChain();
    }),
  })),
}));

vi.mock("@/lib/server/tenant", () => ({
  getTenantId: vi.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

import { GET, PUT } from "@/app/api/settings/handbook-permissions/route";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_MEMBER = { id: "m-1", name: "Admin User", app_role: "Admin", email: "admin@test.com" };
const COORD_MEMBER = { id: "m-2", name: "Coord User", app_role: "Coordinator", email: "coord@test.com" };
const WL_MEMBER = { id: "m-3", name: "WL User", app_role: "WorshipLeader", email: "wl@test.com" };
const MUSICIAN_MEMBER = { id: "m-4", name: "Musician User", app_role: "Musician", email: "musician@test.com" };

const VALID_BODY = {
  editor_roles: ["Admin", "Coordinator"],
  editor_member_ids: ["00000000-0000-0000-0000-000000000099"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMemberByEmail.mockResolvedValue(ADMIN_MEMBER);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET — open to any authenticated member
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/settings/handbook-permissions", () => {
  it("returns 200 with editor config", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/settings/handbook-permissions" });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT — access control
// ─────────────────────────────────────────────────────────────────────────────

describe("PUT /api/settings/handbook-permissions — access control", () => {
  it("returns 200 when caller is Admin", async () => {
    mockGetMemberByEmail.mockResolvedValue(ADMIN_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: VALID_BODY,
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("returns 403 when caller is Coordinator", async () => {
    mockGetMemberByEmail.mockResolvedValue(COORD_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: VALID_BODY,
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Forbidden/);
  });

  it("returns 403 when caller is WorshipLeader", async () => {
    mockGetMemberByEmail.mockResolvedValue(WL_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: VALID_BODY,
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is Musician", async () => {
    mockGetMemberByEmail.mockResolvedValue(MUSICIAN_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: VALID_BODY,
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when member not found", async () => {
    mockGetMemberByEmail.mockResolvedValue(null);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: VALID_BODY,
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Member not found/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT — payload validation
// ─────────────────────────────────────────────────────────────────────────────

describe("PUT /api/settings/handbook-permissions — validation", () => {
  it("returns 400 when editor_roles is not an array", async () => {
    mockGetMemberByEmail.mockResolvedValue(ADMIN_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: { editor_roles: "Admin", editor_member_ids: [] },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when editor_member_ids contains invalid UUIDs", async () => {
    mockGetMemberByEmail.mockResolvedValue(ADMIN_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: { editor_roles: ["Admin"], editor_member_ids: ["not-a-uuid"] },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid UUIDs/i);
  });

  it("returns 400 when editor_roles contains invalid role names", async () => {
    mockGetMemberByEmail.mockResolvedValue(ADMIN_MEMBER);
    const req = makeNextRequest({
      method: "PUT",
      url: "http://localhost/api/settings/handbook-permissions",
      body: { editor_roles: ["Admin", "FakeRole"], editor_member_ids: [] },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid roles.*FakeRole/);
  });
});
