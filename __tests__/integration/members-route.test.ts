// @vitest-environment node
/**
 * Integration tests — GET /api/members & POST /api/members
 * src/app/api/members/route.ts
 *
 * Tests authorisation, input validation, and response shaping.
 * Supabase is fully mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── mock supabase BEFORE the route module loads ──
// vi.hoisted ensures mockDb is initialised before the hoisted vi.mock factory runs.
// We cannot use imports inside vi.hoisted, so we build the mock inline.
const { mockDb } = vi.hoisted(() => {
  const db = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  };
  return { mockDb: db };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockDb),
}));

// Import AFTER mocking
import { GET, POST } from "@/app/api/members/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_MEMBER = {
  id: "m-001",
  name: "Alice",
  email: "alice@test.com",
  phone: null,
  app_role: "Musician",
  magic_token: "tok-abc",
  is_active: true,
  created_at: "2026-01-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return empty arrays for all tables
  mockDb.from.mockImplementation((table: string) => {
    const map: Record<string, unknown[]> = {
      members: [MOCK_MEMBER],
      member_roles: [],
      roles: [{ id: 1, name: "worship_lead" }],
    };
    const data = map[table] ?? [];
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/members
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/members", () => {
  it("returns 200 with an array of members", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("merges roles onto each member result", async () => {
    const res = await GET();
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
  it("returns 403 when x-app-role is Coordinator", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      headers: { "x-app-role": "Coordinator" },
      body: { name: "New User", email: "new@test.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/coordinator/i);
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
  it("returns 200 with the created member when Supabase succeeds", async () => {
    // Re-wire the insert chain to return a created member
    mockDb.from.mockImplementation((table: string) => {
      if (table === "members") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: MOCK_MEMBER, error: null }).then(resolve),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
    });

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
  it("returns 500 when Supabase insert fails", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "members") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({
              data: null,
              error: { message: "DB constraint violation" },
            }).then(resolve),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
    });

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/members",
      body: { name: "Alice", email: "alice@test.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
