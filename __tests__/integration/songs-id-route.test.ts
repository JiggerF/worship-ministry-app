// @vitest-environment node
/**
 * Integration tests — PATCH /api/songs/[id]  &  DELETE /api/songs/[id]
 * src/app/api/songs/[id]/route.ts
 *
 * Tests role-based authorisation, song update (with chord chart replacement),
 * and deletion.
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

// ── Build mock via vi.hoisted ──
const { mockQuery, mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = [
    "update",
    "delete",
    "insert",
    "select",
    "eq",
    "single",
  ] as const;
  methods.forEach((m) => {
    query[m] = vi.fn().mockReturnValue(query);
  });
  query.then = vi.fn();
  const from = vi.fn().mockReturnValue(query);
  const client = { from };
  return { mockQuery: query, mockFrom: from, mockClient: client };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

import { PATCH, DELETE } from "@/app/api/songs/[id]/route";

const SONG_ID = "song-abc-123";

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-attach chainable methods
  const methods = ["update", "delete", "insert", "select", "eq", "single"] as const;
  methods.forEach((m) => {
    (mockQuery[m] as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);

  // Default success
  (mockQuery.then as (cb: (v: unknown) => void) => Promise<unknown>) = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({
      data: { id: SONG_ID, title: "Updated Song" },
      error: null,
    }).then(resolve)
  );

  // Default: Admin actor
  mockGetActor.mockResolvedValue({ id: "admin-1", name: "Admin User", role: "Admin" });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/songs/[id] — authorisation
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/songs/[id] — authorisation", () => {
  it("allows Admin to edit songs", async () => {
    mockGetActor.mockResolvedValue({ id: "admin-1", name: "Admin", role: "Admin" });
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
  });

  it("allows MusicCoordinator to edit songs", async () => {
    mockGetActor.mockResolvedValue({ id: "mc-1", name: "Music Coord", role: "MusicCoordinator" });
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
  });

  it("allows Coordinator to edit songs", async () => {
    mockGetActor.mockResolvedValue({ id: "coord-1", name: "Coordinator", role: "Coordinator" });
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
  });

  it("returns 403 for WorshipLeader role", async () => {
    mockGetActor.mockResolvedValue({ id: "wl-1", name: "Worship Leader", role: "WorshipLeader" });
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated (no actor)", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/songs/[id] — functional
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/songs/[id]", () => {
  it("returns 400 when body is missing or invalid", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      // no body
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(400);
  });

  it("returns 200 with updated song on success", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song", status: "published" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("replaces chord charts when chord_charts array is provided", async () => {
    // Track which tables were accessed
    const tablesCalled: string[] = [];
    mockFrom.mockImplementation((table: string) => {
      tablesCalled.push(table);
      return {
        ...mockQuery,
        update: vi.fn().mockReturnValue(mockQuery),
        delete: vi.fn().mockReturnValue(mockQuery),
        insert: vi.fn().mockReturnValue(mockQuery),
        select: vi.fn().mockReturnValue(mockQuery),
        eq: vi.fn().mockReturnValue(mockQuery),
        single: vi.fn().mockReturnValue(mockQuery),
        then: vi.fn((resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data: { id: SONG_ID, title: "Updated" },
            error: null,
          }).then(resolve)
        ),
      };
    });

    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: {
        title: "Updated",
        chord_charts: [{ key: "G", file_url: null }],
      },
    });
    await PATCH(req, makeContext(SONG_ID));
    // Both songs and chord_charts tables must be accessed
    expect(tablesCalled).toContain("songs");
    expect(tablesCalled).toContain("chord_charts");
  });

  it("returns 500 when Supabase update fails", async () => {
    (mockQuery.then as typeof mockQuery.then) = vi.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: null,
        error: { message: "update failed" },
      }).then(resolve)
    );

    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/songs/[id] — authorisation
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/songs/[id] — authorisation", () => {
  it("allows Admin to delete songs", async () => {
    mockGetActor.mockResolvedValue({ id: "admin-1", name: "Admin", role: "Admin" });
    (mockQuery.then as typeof mockQuery.then) = vi.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );
    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
  });

  it("returns 403 for MusicCoordinator role (cannot delete songs)", async () => {
    mockGetActor.mockResolvedValue({ id: "mc-1", name: "Music Coord", role: "MusicCoordinator" });
    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(403);
  });

  it("allows Coordinator to delete songs", async () => {
    mockGetActor.mockResolvedValue({ id: "coord-1", name: "Coordinator", role: "Coordinator" });
    (mockQuery.then as typeof mockQuery.then) = vi.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );
    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
  });

  it("returns 403 for WorshipLeader role", async () => {
    mockGetActor.mockResolvedValue({ id: "wl-1", name: "Worship Leader", role: "WorshipLeader" });
    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated (no actor)", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/songs/[id] — functional
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/songs/[id]", () => {
  it("returns 200 with success:true on deletion", async () => {
    (mockQuery.then as typeof mockQuery.then) = vi.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when Supabase delete fails", async () => {
    // First call (select title) succeeds, second call (delete) fails
    let callCount = 0;
    (mockQuery.then as typeof mockQuery.then) = vi.fn((resolve: (v: unknown) => unknown) => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({ data: { title: "Song" }, error: null }).then(resolve);
      }
      return Promise.resolve({
        data: null,
        error: { message: "deletion failed" },
      }).then(resolve);
    });

    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));
    expect(res.status).toBe(500);
  });
});
