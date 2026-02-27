// @vitest-environment node
/**
 * Integration tests — GET /api/availability/periods/[id]  &  PATCH /api/availability/periods/[id]
 * src/app/api/availability/periods/[id]/route.ts
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
const { mockGetPeriodDetail, mockClosePeriod } = vi.hoisted(() => ({
  mockGetPeriodDetail: vi.fn(),
  mockClosePeriod: vi.fn(),
}));
vi.mock("@/lib/db/availability-periods", () => ({
  getPeriodDetailWithAllMembers: mockGetPeriodDetail,
  closePeriod: mockClosePeriod,
}));

const { GET, PATCH } = await import(
  "@/app/api/availability/periods/[id]/route"
);

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
};

const MEMBER_DETAIL = {
  period: PERIOD,
  members: [
    {
      member_id: "m-001",
      member_name: "Alice",
      member_magic_token: "tok-alice",
      responded: true,
      response: {
        id: "r-001",
        submitted_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
        period_id: "p-001",
        member_id: "m-001",
        notes: null,
      },
      dates: [
        { id: "d-1", response_id: "r-001", date: "2026-04-05", available: true },
        { id: "d-2", response_id: "r-001", date: "2026-04-12", available: false },
      ],
    },
    {
      member_id: "m-002",
      member_name: "Bob",
      member_magic_token: "tok-bob",
      responded: false,
      response: null,
      dates: [],
    },
  ],
};

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue({ id: "admin-1", name: "Admin User", role: "Admin" });
  mockGetPeriodDetail.mockResolvedValue(MEMBER_DETAIL);
  mockClosePeriod.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/availability/periods/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/availability/periods/[id]", () => {
  it("returns 200 with period detail for Admin", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/p-001" });
    const res = await GET(req, makeContext("p-001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period.id).toBe("p-001");
    expect(body.members).toHaveLength(2);
    expect(mockGetPeriodDetail).toHaveBeenCalledWith("p-001");
  });

  it("returns 200 for Coordinator role", async () => {
    mockGetActor.mockResolvedValue({ id: "c-1", role: "Coordinator" });
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/p-001" });
    const res = await GET(req, makeContext("p-001"));
    expect(res.status).toBe(200);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/p-001" });
    const res = await GET(req, makeContext("p-001"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue({ id: "m-1", role: "Musician" });
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/p-001" });
    const res = await GET(req, makeContext("p-001"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when period does not exist", async () => {
    mockGetPeriodDetail.mockResolvedValue(null);
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/missing" });
    const res = await GET(req, makeContext("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when DB throws", async () => {
    mockGetPeriodDetail.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/p-001" });
    const res = await GET(req, makeContext("p-001"));
    expect(res.status).toBe(500);
  });

  it("includes responded and non-responded members", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/availability/periods/p-001" });
    const res = await GET(req, makeContext("p-001"));
    const body = await res.json();
    const responded = body.members.filter((m: { responded: boolean }) => m.responded);
    const pending = body.members.filter((m: { responded: boolean }) => !m.responded);
    expect(responded).toHaveLength(1);
    expect(pending).toHaveLength(1);
    expect(pending[0].member_name).toBe("Bob");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/availability/periods/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/availability/periods/[id]", () => {
  it("returns 200 with closed: true for Admin", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/availability/periods/p-001",
      body: { action: "close" },
    });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.closed).toBe(true);
    expect(mockClosePeriod).toHaveBeenCalledWith("p-001");
  });

  it("returns 200 for Coordinator role", async () => {
    mockGetActor.mockResolvedValue({ id: "c-1", role: "Coordinator" });
    const req = makeNextRequest({
      method: "PATCH",
      body: { action: "close" },
    });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(200);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "PATCH", body: { action: "close" } });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue({ id: "m-1", role: "Musician" });
    const req = makeNextRequest({ method: "PATCH", body: { action: "close" } });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when action is missing", async () => {
    const req = makeNextRequest({ method: "PATCH", body: {} });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when action is not 'close'", async () => {
    const req = makeNextRequest({ method: "PATCH", body: { action: "open" } });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = makeNextRequest({ method: "PATCH" }); // no body
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when DB throws", async () => {
    mockClosePeriod.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ method: "PATCH", body: { action: "close" } });
    const res = await PATCH(req, makeContext("p-001"));
    expect(res.status).toBe(500);
  });
});
