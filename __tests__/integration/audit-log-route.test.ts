// @vitest-environment node
/**
 * Integration tests — GET /api/audit-log
 * src/app/api/audit-log/route.ts
 *
 * Tests Admin-only access control, query param forwarding, and error handling.
 * get-actor and audit-log DB module are mocked so these tests exercise only
 * the route layer's logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock the two dependencies the route delegates to ──────────────────────────
const { mockGetActor, mockGetAuditLog } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
  mockGetAuditLog: vi.fn(),
}));

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/audit-log", () => ({
  getAuditLog: mockGetAuditLog,
}));

import { GET } from "@/app/api/audit-log/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ACTOR = { id: "actor-1", name: "Test Admin", role: "Admin" };
const COORD_ACTOR = { id: "actor-2", name: "Test Coord", role: "Coordinator" };

const DEFAULT_LOG_RESULT = {
  entries: [
    {
      id: "row-1",
      created_at: "2026-01-15T08:00:00Z",
      actor_id: "actor-1",
      actor_name: "Test Admin",
      actor_role: "Admin",
      action: "create_song",
      entity_type: "song",
      entity_id: "song-1",
      summary: "Created song 'Amazing Grace'",
    },
  ],
  total: 1,
  pageSize: 50,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);
  mockGetAuditLog.mockResolvedValue(DEFAULT_LOG_RESULT);
});

// ─────────────────────────────────────────────────────────────────────────────
// Access control
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/audit-log — access control", () => {
  it("returns 403 when getActorFromRequest returns null (unauthenticated)", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 when actor role is Coordinator", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 when actor role is Musician", async () => {
    mockGetActor.mockResolvedValue({
      id: "m-1",
      name: "Musician",
      role: "Musician",
    });
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 when actor role is Admin", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Success response shape
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/audit-log — response shape", () => {
  it("includes entries, total, pageSize, and page in response body", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.entries).toEqual(DEFAULT_LOG_RESULT.entries);
    expect(body.total).toBe(DEFAULT_LOG_RESULT.total);
    expect(body.pageSize).toBe(DEFAULT_LOG_RESULT.pageSize);
    expect(body.page).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Query param forwarding
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/audit-log — query params", () => {
  it("forwards page=2 to getAuditLog and returns page:2 in response", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?page=2",
    });
    const res = await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(2, "desc");
    const body = await res.json();
    expect(body.page).toBe(2);
  });

  it("forwards sort=asc to getAuditLog", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?sort=asc",
    });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "asc");
  });

  it("defaults sort to 'desc' when sort param is absent", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "desc");
  });

  it("defaults sort to 'desc' when sort param is an unknown value", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?sort=random",
    });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "desc");
  });

  it("defaults page to 1 when page param is absent", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "desc");
  });

  it("defaults page to 1 when page param is non-numeric", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?page=invalid",
    });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "desc");
  });

  it("defaults page to 1 when page param is zero (clamps to min 1)", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?page=0",
    });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "desc");
  });

  it("defaults page to 1 when page param is negative", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?page=-5",
    });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(1, "desc");
  });

  it("forwards page=5 and sort=asc together", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/audit-log?page=5&sort=asc",
    });
    await GET(req);
    expect(mockGetAuditLog).toHaveBeenCalledWith(5, "asc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/audit-log — error handling", () => {
  it("returns 500 when getAuditLog throws an Error", async () => {
    mockGetAuditLog.mockRejectedValue(new Error("DB connection failed"));
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB connection failed");
  });

  it("returns 500 with a generic message when a non-Error is thrown", async () => {
    mockGetAuditLog.mockRejectedValue("raw string error");
    const req = makeNextRequest({ url: "http://localhost/api/audit-log" });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
