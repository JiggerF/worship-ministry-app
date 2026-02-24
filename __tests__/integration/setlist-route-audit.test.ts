// @vitest-environment node
/**
 * Audit instrumentation tests — setlist API routes
 *
 * Verifies that createAuditLogEntry is called with the correct arguments
 * after each successful setlist mutation, and is NOT called when:
 *   - the actor is null (unauthenticated)
 *   - the primary DB operation throws (route returns 500 before audit block)
 *   - access is denied (Musician 403)
 *
 * get-actor, audit-log, and setlist DB helpers are all mocked so these tests
 * run without a real Supabase connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── All mocks in one vi.hoisted call ─────────────────────────────────────────
const { mockGetActor, mockCreateAuditLogEntry, mockUpsert, mockDelete, mockPublish, mockRevert } =
  vi.hoisted(() => ({
    mockGetActor: vi.fn(),
    mockCreateAuditLogEntry: vi.fn(),
    mockUpsert: vi.fn(),
    mockDelete: vi.fn(),
    mockPublish: vi.fn(),
    mockRevert: vi.fn(),
  }));

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/audit-log", () => ({
  createAuditLogEntry: mockCreateAuditLogEntry,
}));

vi.mock("@/lib/db/setlist", () => ({
  getSetlist: vi.fn().mockResolvedValue([]),
  upsertSetlistSong: mockUpsert,
  deleteSetlistSong: mockDelete,
  publishSetlist: mockPublish,
  revertSetlist: mockRevert,
}));

import { POST } from "@/app/api/setlist/route";
import { DELETE } from "@/app/api/setlist/[id]/route";
import { PATCH } from "@/app/api/setlist/[id]/publish/route";
import { PATCH as PATCH_REVERT } from "@/app/api/setlist/[id]/revert/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ACTOR  = { id: "aaaaaaaa-0000-0000-0000-000000000001", name: "Test Admin",  role: "Admin" };
const MUSICIAN_ACTOR = { id: "aaaaaaaa-0000-0000-0000-000000000099", name: "Musician",   role: "Musician" };

const DATE     = "2026-03-01";
const SONG_ID  = "bbbbbbbb-0000-0000-0000-000000000001";
const ENTRY_ID = "cccccccc-0000-0000-0000-000000000001";

const UPSERT_RESULT = {
  id: ENTRY_ID,
  sunday_date: DATE,
  song_id: SONG_ID,
  position: 1,
  chosen_key: "G",
  status: "DRAFT",
};

function makeDateContext(date: string) {
  return { params: Promise.resolve({ id: date }) };
}

function makeIdContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);
  mockCreateAuditLogEntry.mockResolvedValue(undefined);
  mockUpsert.mockResolvedValue(UPSERT_RESULT);
  mockDelete.mockResolvedValue(undefined);
  mockPublish.mockResolvedValue(undefined);
  mockRevert.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/setlist — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/setlist — audit instrumentation", () => {
  const validBody = { sunday_date: DATE, song_id: SONG_ID, position: 1, chosen_key: "G" };

  it("calls createAuditLogEntry with action 'update_setlist' on success", async () => {
    const req = makeNextRequest({ method: "POST", url: "http://localhost/api/setlist", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_setlist",
        entity_type: "setlist",
        entity_id: DATE,
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the sunday date", async () => {
    const req = makeNextRequest({ method: "POST", url: "http://localhost/api/setlist", body: validBody });
    await POST(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain(DATE);
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "POST", url: "http://localhost/api/setlist", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when role is Musician (403)", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({ method: "POST", url: "http://localhost/api/setlist", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when upsert throws (500 returned first)", async () => {
    mockUpsert.mockRejectedValue(new Error("DB constraint violation"));
    const req = makeNextRequest({ method: "POST", url: "http://localhost/api/setlist", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when body is missing required fields (400)", async () => {
    const req = makeNextRequest({ method: "POST", url: "http://localhost/api/setlist", body: { song_id: SONG_ID } });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/setlist/[id] — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/setlist/[id] — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'delete_setlist_song' on success", async () => {
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));

    expect(res.status).toBe(204);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete_setlist_song",
        entity_type: "setlist",
        entity_id: ENTRY_ID,
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary references the row id", async () => {
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    await DELETE(req, makeIdContext(ENTRY_ID));

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain(ENTRY_ID);
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));

    expect(res.status).toBe(403);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when delete throws (500 returned first)", async () => {
    mockDelete.mockRejectedValue(new Error("delete failed"));
    const req = makeNextRequest({ method: "DELETE", url: `http://localhost/api/setlist/${ENTRY_ID}` });
    const res = await DELETE(req, makeIdContext(ENTRY_ID));

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/setlist/[date]/publish — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/setlist/[date]/publish — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'publish_setlist' on success", async () => {
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "publish_setlist",
        entity_type: "setlist",
        entity_id: DATE,
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the published date", async () => {
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    await PATCH(req, makeDateContext(DATE));

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain(DATE);
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));

    expect(res.status).toBe(403);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when publishSetlist throws (500 returned first)", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/publish` });
    const res = await PATCH(req, makeDateContext(DATE));

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry for invalid date param (400)", async () => {
    const req = makeNextRequest({ method: "PATCH", url: "http://localhost/api/setlist/not-a-date/publish" });
    const res = await PATCH(req, makeDateContext("not-a-date"));

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/setlist/[date]/revert — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/setlist/[date]/revert — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'revert_setlist' on success", async () => {
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "revert_setlist",
        entity_type: "setlist",
        entity_id: DATE,
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the reverted date", async () => {
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    await PATCH_REVERT(req, makeDateContext(DATE));

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain(DATE);
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));

    expect(res.status).toBe(403);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when revertSetlist throws (500 returned first)", async () => {
    mockRevert.mockRejectedValue(new Error("revert failed"));
    const req = makeNextRequest({ method: "PATCH", url: `http://localhost/api/setlist/${DATE}/revert` });
    const res = await PATCH_REVERT(req, makeDateContext(DATE));

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry for invalid date param (400)", async () => {
    const req = makeNextRequest({ method: "PATCH", url: "http://localhost/api/setlist/bad-date/revert" });
    const res = await PATCH_REVERT(req, makeDateContext("bad-date"));

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});
