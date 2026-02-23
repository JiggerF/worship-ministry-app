// @vitest-environment node
/**
 * Integration tests — /api/setlist (all routes)
 *
 * GET  /api/setlist?date=               — public (PUBLISHED only) vs. authed (all)
 * POST /api/setlist                     — upsert; SETLIST_ROLES only
 * DELETE /api/setlist/[id]              — remove; SETLIST_ROLES only
 * PATCH  /api/setlist/[date]/publish    — publish; SETLIST_ROLES only
 * PATCH  /api/setlist/[date]/revert     — revert to DRAFT; SETLIST_ROLES only
 *
 * get-actor and setlist DB helpers are mocked to exercise route logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock get-actor and setlist DB module ──────────────────────────────────────
const { mockGetActor, mockGetSetlist, mockUpsert, mockDelete, mockPublish, mockRevert } =
  vi.hoisted(() => ({
    mockGetActor: vi.fn(),
    mockGetSetlist: vi.fn(),
    mockUpsert: vi.fn(),
    mockDelete: vi.fn(),
    mockPublish: vi.fn(),
    mockRevert: vi.fn(),
  }));

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/setlist", () => ({
  getSetlist: mockGetSetlist,
  upsertSetlistSong: mockUpsert,
  deleteSetlistSong: mockDelete,
  publishSetlist: mockPublish,
  revertSetlist: mockRevert,
}));

import { GET, POST } from "@/app/api/setlist/route";
import { DELETE } from "@/app/api/setlist/[id]/route";
import { PATCH } from "@/app/api/setlist/[id]/publish/route";
import { PATCH as PATCH_REVERT } from "@/app/api/setlist/[id]/revert/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ACTOR = { id: "aaaaaaaa-0000-0000-0000-000000000001", name: "Test Admin", role: "Admin" };
const COORD_ACTOR = { id: "aaaaaaaa-0000-0000-0000-000000000002", name: "Test Coord", role: "Coordinator" };
const MC_ACTOR    = { id: "aaaaaaaa-0000-0000-0000-000000000003", name: "Music Coord", role: "MusicCoordinator" };
const WL_ACTOR    = { id: "aaaaaaaa-0000-0000-0000-000000000004", name: "Worship Lead", role: "WorshipLeader" };
const MUSICIAN_ACTOR = { id: "aaaaaaaa-0000-0000-0000-000000000005", name: "Musician", role: "Musician" };

const DATE = "2026-03-01";
const SONG_ID = "song-uuid-111";
const ENTRY_ID = "entry-uuid-222";

const SETLIST_ROWS = [
  {
    id: ENTRY_ID,
    sunday_date: DATE,
    song_id: SONG_ID,
    position: 1,
    chosen_key: "G",
    status: "PUBLISHED",
    created_by: COORD_ACTOR.id,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    song: { id: SONG_ID, title: "Amazing Grace", chord_charts: [] },
  },
];

function makeIdContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeDateContext(date: string) {
  return { params: Promise.resolve({ id: date }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue(null);
  mockGetSetlist.mockResolvedValue(SETLIST_ROWS);
  mockUpsert.mockResolvedValue(SETLIST_ROWS[0]);
  mockDelete.mockResolvedValue(undefined);
  mockPublish.mockResolvedValue(undefined);
  mockRevert.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/setlist?date=
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/setlist", () => {
  it("returns 400 when date is missing", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/setlist" });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/date/i);
  });

  it("returns 400 when date format is invalid", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/setlist?date=1-Mar-2026" });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("calls getSetlist with publishedOnly=true for unauthenticated caller", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ url: `http://localhost/api/setlist?date=${DATE}` });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetSetlist).toHaveBeenCalledWith(DATE, true);
  });

  it("calls getSetlist with publishedOnly=true for Musician", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({ url: `http://localhost/api/setlist?date=${DATE}` });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetSetlist).toHaveBeenCalledWith(DATE, true);
  });

  it.each([
    ["Admin", ADMIN_ACTOR],
    ["Coordinator", COORD_ACTOR],
    ["MusicCoordinator", MC_ACTOR],
    ["WorshipLeader", WL_ACTOR],
  ])("calls getSetlist with publishedOnly=false for %s", async (_, actor) => {
    mockGetActor.mockResolvedValue(actor);
    const req = makeNextRequest({ url: `http://localhost/api/setlist?date=${DATE}` });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetSetlist).toHaveBeenCalledWith(DATE, false);
  });

  it("returns 200 array of rows", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({ url: `http://localhost/api/setlist?date=${DATE}` });
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("returns 500 when DB throws", async () => {
    mockGetSetlist.mockRejectedValue(new Error("DB down"));
    const req = makeNextRequest({ url: `http://localhost/api/setlist?date=${DATE}` });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/setlist
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/setlist", () => {
  it("returns 403 for unauthenticated caller", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, song_id: SONG_ID, position: 1 },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, song_id: SONG_ID, position: 1 },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when sunday_date is missing", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { song_id: SONG_ID, position: 1 },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sunday_date/i);
  });

  it("returns 400 when song_id is missing", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, position: 2 },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/song_id/i);
  });

  it("returns 400 when position is out of range", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, song_id: SONG_ID, position: 5 },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/position/i);
  });

  it.each([
    ["Admin", ADMIN_ACTOR],
    ["Coordinator", COORD_ACTOR],
    ["MusicCoordinator", MC_ACTOR],
    ["WorshipLeader", WL_ACTOR],
  ])("returns 201 for %s role", async (_, actor) => {
    mockGetActor.mockResolvedValue(actor);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, song_id: SONG_ID, position: 1, chosen_key: "G" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sunday_date: DATE,
        song_id: SONG_ID,
        position: 1,
        chosen_key: "G",
        created_by: actor.id,
      })
    );
  });

  it("saves chosen_key as null when not provided", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, song_id: SONG_ID, position: 2 },
    });
    await POST(req);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ chosen_key: null })
    );
  });

  it("returns 500 when DB throws", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    mockUpsert.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/setlist",
      body: { sunday_date: DATE, song_id: SONG_ID, position: 1 },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/setlist/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/setlist/[id]", () => {
  it("returns 403 for unauthenticated caller", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));
    expect(res.status).toBe(403);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));
    expect(res.status).toBe(403);
  });

  it.each([
    ["Admin", ADMIN_ACTOR],
    ["Coordinator", COORD_ACTOR],
    ["MusicCoordinator", MC_ACTOR],
    ["WorshipLeader", WL_ACTOR],
  ])("returns 204 for %s role", async (_, actor) => {
    mockGetActor.mockResolvedValue(actor);
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(ENTRY_ID);
  });

  it("returns 500 when DB throws", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    mockDelete.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/setlist/[date]/publish
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/setlist/[date]/publish", () => {
  it("returns 403 for unauthenticated caller", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));
    expect(res.status).toBe(403);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));
    expect(res.status).toBe(403);
  });

  it("returns 400 when date param format is invalid", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({ method: "PATCH", url: "http://localhost/api/setlist/bad-date/publish" });
    const res = await PATCH(req, makeDateContext("bad-date"));
    expect(res.status).toBe(400);
  });

  it.each([
    ["Admin", ADMIN_ACTOR],
    ["Coordinator", COORD_ACTOR],
    ["MusicCoordinator", MC_ACTOR],
    ["WorshipLeader", WL_ACTOR],
  ])("returns 200 with published=true for %s role", async (_, actor) => {
    mockGetActor.mockResolvedValue(actor);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(true);
    expect(body.date).toBe(DATE);
    expect(mockPublish).toHaveBeenCalledWith(DATE);
  });

  it("returns 500 when DB throws", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    mockPublish.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/setlist/[date]/revert
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/setlist/[date]/revert", () => {
  it("returns 403 for unauthenticated caller", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));
    expect(res.status).toBe(403);
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));
    expect(res.status).toBe(403);
  });

  it("returns 400 when date param format is invalid", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({ method: "PATCH", url: "http://localhost/api/setlist/bad-date/revert" });
    const res = await PATCH_REVERT(req, makeDateContext("bad-date"));
    expect(res.status).toBe(400);
  });

  it.each([
    ["Admin", ADMIN_ACTOR],
    ["Coordinator", COORD_ACTOR],
    ["MusicCoordinator", MC_ACTOR],
    ["WorshipLeader", WL_ACTOR],
  ])("returns 200 with reverted=true for %s role", async (_, actor) => {
    mockGetActor.mockResolvedValue(actor);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reverted).toBe(true);
    expect(body.date).toBe(DATE);
    expect(mockRevert).toHaveBeenCalledWith(DATE);
  });

  it("returns 500 when DB throws", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    mockRevert.mockRejectedValue(new Error("DB error"));
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));
    expect(res.status).toBe(500);
  });
});
