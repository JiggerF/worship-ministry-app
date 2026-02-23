// @vitest-environment node
/**
 * Integration tests for PUT /api/members/[id]
 * src/app/api/members/[id]/route.ts
 *
 * Tests body validation, supabase update chains, and role assignment.
 * Supabase is fully mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest, makeChain } from "./_helpers";

// ── hoisted mock refs ──────────────────────────────────────────────────────
const { mockDb } = vi.hoisted(() => {
  const db = { from: vi.fn() };
  return { mockDb: db };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockDb),
}));

const { PUT } = await import("@/app/api/members/[id]/route");

// ── fixtures ───────────────────────────────────────────────────────────────
const MEMBER = {
  id: "m-1",
  name: "Bob",
  email: "bob@test.com",
  phone: null,
  app_role: "Musician",
  is_active: true,
  created_at: "2026-01-01",
};

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── setup ──────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Default: successful update returning the member
  mockDb.from.mockImplementation((table: string) => {
    if (table === "members") {
      return makeChain({ data: MEMBER, error: null });
    }
    if (table === "roles") {
      return makeChain({ data: [{ id: 1, name: "Guitar" }], error: null });
    }
    if (table === "member_roles") {
      return makeChain({ data: [], error: null });
    }
    return makeChain({ data: null, error: null });
  });
});

// ── tests ──────────────────────────────────────────────────────────────────
describe("PUT /api/members/[id]", () => {
  describe("input validation", () => {
    it("returns 400 when body is missing", async () => {
      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        // no body — req.json() rejects → route returns 400
      });

      const res = await PUT(req, makeContext("m-1"));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toHaveProperty("error");
    });
  });

  describe("successful update", () => {
    it("returns 200 with updated member when no roles provided", async () => {
      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        body: { name: "Robert" },
      });

      const res = await PUT(req, makeContext("m-1"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ id: "m-1", name: "Bob" });
    });

    it("returns 200 with updated member and roles when roles array provided", async () => {
      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        body: { name: "Robert", roles: ["Guitar"] },
      });

      const res = await PUT(req, makeContext("m-1"));

      expect(res.status).toBe(200);
      // Confirm multiple tables were queried for role assignment
      expect(mockDb.from).toHaveBeenCalledWith("roles");
      expect(mockDb.from).toHaveBeenCalledWith("member_roles");
    });
  });

  describe("DB error propagation", () => {
    it("returns 500 when member update fails", async () => {
      mockDb.from.mockImplementation((table: string) => {
        if (table === "members") {
          return makeChain({ data: null, error: { message: "Update failed" } });
        }
        return makeChain({ data: null, error: null });
      });

      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        body: { name: "Robert" },
      });

      const res = await PUT(req, makeContext("m-1"));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Update failed");
    });
  });
});
