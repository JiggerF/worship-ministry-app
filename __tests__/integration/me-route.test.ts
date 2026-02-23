/**
 * Integration tests for GET /api/me
 *
 * Route reads the authenticated user's email (via @supabase/ssr or cookie
 * fallback) and delegates to getMemberByEmail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── hoisted mock refs ──────────────────────────────────────────────────────
const { mockGetUser, mockGetMemberByEmail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetMemberByEmail: vi.fn(),
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

// Import route AFTER mocks are registered
const { GET } = await import("@/app/api/me/route");

// ── helpers ────────────────────────────────────────────────────────────────
const MEMBER = {
  id: "member-1",
  name: "Alice",
  email: "alice@example.com",
  app_role: "Admin",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated via supabase ssr
  mockGetUser.mockResolvedValue({
    data: { user: { email: "alice@example.com" } },
    error: null,
  });
  mockGetMemberByEmail.mockResolvedValue(MEMBER);
});

// ── tests ──────────────────────────────────────────────────────────────────
describe("GET /api/me", () => {
  describe("happy path", () => {
    it("returns 200 with member data when supabase ssr resolves email", async () => {
      const req = makeNextRequest({ url: "http://localhost:3000/api/me" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ id: "member-1", email: "alice@example.com" });
      expect(mockGetMemberByEmail).toHaveBeenCalledWith("alice@example.com");
    });
  });

  describe("auth failures", () => {
    it("returns 401 when supabase ssr finds no user and no cookie fallback", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });

      const req = makeNextRequest({ url: "http://localhost:3000/api/me" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body).toHaveProperty("error");
      expect(mockGetMemberByEmail).not.toHaveBeenCalled();
    });

    it("returns 401 when supabase returns user with no email", async () => {
      mockGetUser.mockResolvedValue({ data: { user: {} }, error: null });

      const req = makeNextRequest({ url: "http://localhost:3000/api/me" });
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  describe("DB errors", () => {
    it("returns 500 when getMemberByEmail throws", async () => {
      mockGetMemberByEmail.mockRejectedValue(new Error("DB connection error"));

      const req = makeNextRequest({ url: "http://localhost:3000/api/me" });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("DB connection error");
    });
  });
});
