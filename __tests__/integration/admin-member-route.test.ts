// @vitest-environment node
/**
 * Integration tests — GET /api/admin/member?email=...
 * src/app/api/admin/member/route.ts
 *
 * Tests missing email param, member-not-found (404), and success path.
 * getMemberByEmail is mocked to avoid a real Supabase connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

const { mockGetMemberByEmail } = vi.hoisted(() => ({
  mockGetMemberByEmail: vi.fn(),
}));

vi.mock("@/lib/db/members", () => ({
  getMemberByEmail: mockGetMemberByEmail,
  // stub other named exports that module might re-export
  generateMagicToken: vi.fn(),
}));

import { GET } from "@/app/api/admin/member/route";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/admin/member", () => {
  it("returns 400 when email query param is missing", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/admin/member",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_email");
  });

  it("returns 404 when member is not found (PGRST116)", async () => {
    const pgrst116 = new Error("0 rows") as Error & { code: string };
    pgrst116.code = "PGRST116";
    mockGetMemberByEmail.mockRejectedValue(pgrst116);

    const req = makeNextRequest({
      url: "http://localhost/api/admin/member?email=unknown@test.com",
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  it("returns 500 for unexpected DB errors", async () => {
    mockGetMemberByEmail.mockRejectedValue(new Error("Connection refused"));

    const req = makeNextRequest({
      url: "http://localhost/api/admin/member?email=test@test.com",
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns 200 with member data when member is found", async () => {
    const member = {
      id: "m-001",
      name: "Alice",
      email: "alice@test.com",
      app_role: "Musician",
    };
    mockGetMemberByEmail.mockResolvedValue(member);

    const req = makeNextRequest({
      url: "http://localhost/api/admin/member?email=alice@test.com",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("alice@test.com");
    expect(body.name).toBe("Alice");
  });
});
