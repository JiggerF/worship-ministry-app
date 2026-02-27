// @vitest-environment node
/**
 * Integration tests — GET /api/availability/periods  &  POST /api/availability/periods
 * src/app/api/availability/periods/route.ts
 *
 * Mocks getActorFromRequest and availability-periods DB helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock getActorFromRequest ──
const mockGetActor = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "admin-1", name: "Admin User", role: "Admin" })
);
vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

// ── Mock DB helpers ──
const { mockListPeriodsWithCounts, mockCreatePeriod } = vi.hoisted(() => ({
  mockListPeriodsWithCounts: vi.fn(),
  mockCreatePeriod: vi.fn(),
}));
vi.mock("@/lib/db/availability-periods", () => ({
  listPeriodsWithCounts: mockListPeriodsWithCounts,
  createPeriod: mockCreatePeriod,
}));

const { GET, POST } = await import("@/app/api/availability/periods/route");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD = {
  id: "p-001",
  created_at: "2026-02-27T00:00:00Z",
  created_by: "admin-1",
  label: "April–May 2026",
  starts_on: "2026-04-05",
  ends_on: "2026-05-31",
  deadline: "2026-03-20",
  closed_at: null,
  response_count: 3,
  total_musicians: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue({ id: "admin-1", name: "Admin User", role: "Admin" });
  mockListPeriodsWithCounts.mockResolvedValue([PERIOD]);
  mockCreatePeriod.mockResolvedValue(PERIOD);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/availability/periods
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/availability/periods", () => {
  it("returns 200 with periods list for Admin", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([PERIOD]);
    expect(mockListPeriodsWithCounts).toHaveBeenCalledOnce();
  });

  it("returns 200 with periods list for Coordinator", async () => {
    mockGetActor.mockResolvedValue({ id: "c-1", name: "Coordinator", role: "Coordinator" });
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods" });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-Admin non-Coordinator role", async () => {
    mockGetActor.mockResolvedValue({ id: "m-1", name: "Musician", role: "Musician" });
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods" });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 500 when DB throws", async () => {
    mockListPeriodsWithCounts.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods" });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/availability/periods
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/availability/periods", () => {
  const VALID_BODY = {
    label: "April–May 2026",
    starts_on: "2026-04-05",
    ends_on: "2026-05-31",
    deadline: "2026-03-20",
  };

  beforeEach(() => {
    // Default for POST tests: no existing open periods so overlap check passes
    mockListPeriodsWithCounts.mockResolvedValue([]);
  });

  it("returns 201 with created period for Admin", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/availability/periods",
      body: VALID_BODY,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("p-001");
    expect(mockCreatePeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "April–May 2026",
        starts_on: "2026-04-05",
        ends_on: "2026-05-31",
        deadline: "2026-03-20",
        created_by: "admin-1",
      })
    );
  });

  it("returns 201 with created period for Coordinator", async () => {
    mockGetActor.mockResolvedValue({ id: "c-1", name: "Coordinator", role: "Coordinator" });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/availability/periods",
      body: VALID_BODY,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "POST", body: VALID_BODY });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue({ id: "m-1", role: "Musician" });
    const req = makeNextRequest({ method: "POST", body: VALID_BODY });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when label is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: { starts_on: "2026-04-05", ends_on: "2026-05-31" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/label/);
  });

  it("returns 400 when starts_on is after ends_on", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: { label: "Test", starts_on: "2026-06-01", ends_on: "2026-04-01" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when dates are not YYYY-MM-DD format", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: { label: "Test", starts_on: "05-04-2026", ends_on: "31-05-2026" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = makeNextRequest({ method: "POST" }); // no body
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("trims whitespace from label", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: { ...VALID_BODY, label: "  April–May 2026  " },
    });
    await POST(req);
    expect(mockCreatePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ label: "April–May 2026" })
    );
  });

  it("sets deadline to null when not provided", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: { label: "Test", starts_on: "2026-04-05", ends_on: "2026-05-31" },
    });
    await POST(req);
    expect(mockCreatePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ deadline: null })
    );
  });

  it("returns 500 when DB throws", async () => {
    mockCreatePeriod.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ method: "POST", body: VALID_BODY });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  // ── Overlap guard ──

  it("returns 409 when dates exactly match an existing open period", async () => {
    mockListPeriodsWithCounts.mockResolvedValue([PERIOD]); // open, same dates
    const req = makeNextRequest({ method: "POST", body: VALID_BODY });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/overlap/i);
  });

  it("returns 409 when new period partially overlaps an open period", async () => {
    mockListPeriodsWithCounts.mockResolvedValue([PERIOD]); // open 2026-04-05 to 2026-05-31
    const req = makeNextRequest({
      method: "POST",
      body: { label: "Overlap Test", starts_on: "2026-05-01", ends_on: "2026-06-30" },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 201 when existing open period does NOT overlap (different months)", async () => {
    mockListPeriodsWithCounts.mockResolvedValue([PERIOD]); // open 2026-04-05 to 2026-05-31
    const req = makeNextRequest({
      method: "POST",
      body: { label: "Jun–Jul 2026", starts_on: "2026-06-01", ends_on: "2026-07-31" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 201 when only CLOSED periods overlap the new dates", async () => {
    const closedPeriod = { ...PERIOD, closed_at: "2026-02-01T00:00:00Z" };
    mockListPeriodsWithCounts.mockResolvedValue([closedPeriod]);
    const req = makeNextRequest({ method: "POST", body: VALID_BODY });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
