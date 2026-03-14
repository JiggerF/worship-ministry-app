// @vitest-environment node
/**
 * Integration tests — GET /api/members & POST /api/members
 * src/app/api/members/route.ts
 *
 * Tests authorisation, input validation, and response shaping.
 * getActorFromRequest and DB helpers are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock getActorFromRequest ──────────────────────────────────────────────────
const { mockGetActor } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
}));

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

// ── Mock DB helpers ───────────────────────────────────────────────────────────
const { mockGetMembers, mockCreateMember } = vi.hoisted(() => ({
  mockGetMembers: vi.fn(),
  mockCreateMember: vi.fn(),
}));

vi.mock("@/lib/db/members", () => ({
  getMembers: mockGetMembers,
  createMember: mockCreateMember,
}));

// Import AFTER mocking
import { GET, POST } from "@/app/api/members/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

const ADMIN_ACTOR = {
  id: "m-001",
  name: "Admin User",
  role: "Admin",
  tenantId: TENANT_ID,
};

const COORDINATOR_ACTOR = {
  id: "m-002",
  name: "Coord User",
  role: "Coordinator",
  tenantId: TENANT_ID,
};

const MOCK_MEMBER = {
  id: "m-001",
  name: "Alice",
  email: "alice@test.com",
  phone: null,
  app_role: "Musician",
  magic_token: "tok-abc",
  is_active: true,
  created_at: "2026-01-01",
  roles: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);
  mockGetMembers.mockResolvedValue([MOCK_MEMBER]);
  mockCreateMember.mockResolvedValue(MOCK_MEMBER);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/members
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/members", () => {
  it("returns 200 with an array of members", async () => {
    const res = await GET(makeNextRequest({ method: "GET", url: "http://localhost/api/members" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("merges roles onto each member result", async () => {
    const res = await GET(makeNextRequest({ method: "GET", url: "http://localhost/api/members" }));
    const body = await res.json();
    // Each member should have a roles array (even if empty)
    body.forEach((m: unknown) => {
      expect((m as { roles: unknown[] }).roles).toBeDefined();
      expect(Array.isArray((m as { roles: unknown[] }).roles)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/members
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/members — authorisation", () => {
  it("returns 403 when actor role is Coordinator", async () => {
    mockGetActor.mockResolvedValue(COORDINATOR_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      body: { name: "New User", email: "new@test.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not authorized/i);
  });
});

describe("POST /api/members — validation", () => {
  it("returns 400 when name is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      body: { email: "test@test.com" }, // no name
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      body: { name: "Test User" }, // no email
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty/unparseable", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      // no body
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/members — success path", () => {
  it("returns 200 with the created member when DB succeeds", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      body: { name: "Alice", email: "alice@test.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("alice@test.com");
  });
});

describe("POST /api/members — DB error propagation", () => {
  it("returns 500 when DB insert fails", async () => {
    mockCreateMember.mockRejectedValue(new Error("DB constraint violation"));

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      body: { name: "Alice", email: "alice@test.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
