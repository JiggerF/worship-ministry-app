// @vitest-environment node
/**
 * Integration tests for PUT /api/members/[id] and DELETE /api/members/[id]
 * src/app/api/members/[id]/route.ts
 *
 * Tests auth, body validation, member update, and delete.
 * getActorFromRequest and DB helpers are fully mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── hoisted mock refs ──────────────────────────────────────────────────────
const { mockGetActor, mockUpdateMember, mockDeleteMember } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
  mockUpdateMember: vi.fn(),
  mockDeleteMember: vi.fn(),
}));

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/members", () => ({
  updateMember: mockUpdateMember,
  deleteMember: mockDeleteMember,
}));

const { PUT, DELETE } = await import("@/app/api/members/[id]/route");

// ── fixtures ───────────────────────────────────────────────────────────────
const ADMIN_ACTOR = {
  id: "m-001",
  name: "Admin User",
  role: "Admin" as const,
  tenantId: "00000000-0000-0000-0000-000000000001",
};

const COORDINATOR_ACTOR = {
  id: "m-002",
  name: "Coord User",
  role: "Coordinator" as const,
  tenantId: "00000000-0000-0000-0000-000000000001",
};

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
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);
  mockUpdateMember.mockResolvedValue(MEMBER);
  mockDeleteMember.mockResolvedValue(undefined);
});

// ── tests ──────────────────────────────────────────────────────────────────
describe("PUT /api/members/[id]", () => {
  describe("auth", () => {
    it("returns 401 when actor cannot be resolved", async () => {
      mockGetActor.mockResolvedValue(null);

      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        body: { name: "Robert" },
      });

      const res = await PUT(req, makeContext("m-1"));
      expect(res.status).toBe(401);
    });

    it("returns 403 when Coordinator attempts update", async () => {
      mockGetActor.mockResolvedValue(COORDINATOR_ACTOR);

      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        body: { name: "Robert" },
      });

      const res = await PUT(req, makeContext("m-1"));
      expect(res.status).toBe(403);
    });
  });

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
      expect(mockUpdateMember).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "m-1",
        expect.objectContaining({ name: "Robert" })
      );
    });

    it("returns 200 with updated member and passes roles in changes", async () => {
      const req = makeNextRequest({
        method: "PUT",
        url: "http://localhost:3000/api/members/m-1",
        body: { name: "Robert", roles: ["Guitar"] },
      });

      const res = await PUT(req, makeContext("m-1"));

      expect(res.status).toBe(200);
      expect(mockUpdateMember).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "m-1",
        expect.objectContaining({ roles: ["Guitar"] })
      );
    });
  });

  describe("DB error propagation", () => {
    it("returns 500 when member update fails", async () => {
      mockUpdateMember.mockRejectedValue(new Error("Update failed"));

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

describe("DELETE /api/members/[id]", () => {
  describe("auth", () => {
    it("returns 401 when actor cannot be resolved", async () => {
      mockGetActor.mockResolvedValue(null);

      const req = makeNextRequest({
        method: "DELETE",
        url: "http://localhost:3000/api/members/m-1",
      });

      const res = await DELETE(req, makeContext("m-1"));
      expect(res.status).toBe(401);
    });

    it("returns 403 when non-Admin attempts delete", async () => {
      mockGetActor.mockResolvedValue(COORDINATOR_ACTOR);

      const req = makeNextRequest({
        method: "DELETE",
        url: "http://localhost:3000/api/members/m-1",
      });

      const res = await DELETE(req, makeContext("m-1"));
      expect(res.status).toBe(403);
    });
  });

  describe("successful delete", () => {
    it("returns 200 with success when Admin deletes member", async () => {
      const req = makeNextRequest({
        method: "DELETE",
        url: "http://localhost:3000/api/members/m-1",
      });

      const res = await DELETE(req, makeContext("m-1"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDeleteMember).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "m-1"
      );
    });
  });

  describe("DB error propagation", () => {
    it("returns 500 when delete fails", async () => {
      mockDeleteMember.mockRejectedValue(new Error("Delete failed"));

      const req = makeNextRequest({
        method: "DELETE",
        url: "http://localhost:3000/api/members/m-1",
      });

      const res = await DELETE(req, makeContext("m-1"));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Delete failed");
    });
  });
});
