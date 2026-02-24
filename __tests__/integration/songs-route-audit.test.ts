// @vitest-environment node
/**
 * Audit instrumentation tests — songs API routes
 *
 * Verifies that createAuditLogEntry is called with the correct arguments
 * after each successful song mutation, and is NOT called when:
 *   - the actor is null (unauthenticated / cookie missing)
 *   - the primary DB operation fails (route returns early before audit block)
 *   - access is denied (Coordinator 403)
 *
 * Both get-actor and audit-log are mocked so these tests are pure route-layer
 * checks and do not require a real Supabase connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── All mocks combined in one vi.hoisted call so factory references are valid ──
const {
  mockGetActor,
  mockCreateAuditLogEntry,
  mockQuery,
  mockFrom,
  mockClient,
} = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "single",
    "upsert",
    "gte",
    "lte",
  ] as const;
  methods.forEach((m) => {
    query[m] = vi.fn().mockReturnValue(query);
  });
  query.then = vi.fn();
  const from = vi.fn().mockReturnValue(query);
  return {
    mockGetActor: vi.fn(),
    mockCreateAuditLogEntry: vi.fn(),
    mockQuery: query,
    mockFrom: from,
    mockClient: { from },
  };
});

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/audit-log", () => ({
  createAuditLogEntry: mockCreateAuditLogEntry,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

import { POST } from "@/app/api/songs/route";
import { PATCH, DELETE } from "@/app/api/songs/[id]/route";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SONG_ID = "song-uuid-abc123";
const ADMIN_ACTOR = { id: "actor-1", name: "Test Admin", role: "Admin" };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Set a single resolved value for ALL subsequent supabase query awaits. */
function resolveWith(data: unknown, error: unknown = null) {
  (mockQuery.then as ReturnType<typeof vi.fn>).mockImplementation(
    (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve)
  );
}

/**
 * Set resolved values for two sequential awaited supabase calls.
 * Used by DELETE which first fetches the title, then performs the delete.
 */
function resolveSequence(
  first: { data: unknown; error?: unknown },
  second: { data: unknown; error?: unknown }
) {
  (mockQuery.then as ReturnType<typeof vi.fn>)
    .mockImplementationOnce((resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: first.data, error: first.error ?? null }).then(resolve)
    )
    .mockImplementationOnce((resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: second.data, error: second.error ?? null }).then(resolve)
    );
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Re-attach chainable methods after clearAllMocks wipes them
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "single",
    "upsert",
    "gte",
    "lte",
  ] as const;
  methods.forEach((m) => {
    (mockQuery[m] as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);

  // Default: authenticated Admin actor, successful DB op
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);
  mockCreateAuditLogEntry.mockResolvedValue(undefined);
  resolveWith({ id: SONG_ID, title: "Amazing Grace", status: "published" });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/songs — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/songs — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'create_song' on success", async () => {
    const createdSong = { id: "new-song-id", title: "New Song", status: "published" };
    resolveWith(createdSong);

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { title: "New Song", artist: "Test Artist" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create_song",
        entity_type: "song",
        entity_id: "new-song-id",
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the created song title", async () => {
    const createdSong = { id: "s-1", title: "How Great Thou Art", status: "published" };
    resolveWith(createdSong);

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { title: "How Great Thou Art" },
    });
    await POST(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("How Great Thou Art");
  });

  it("does NOT call createAuditLogEntry when actor is null (unauthenticated)", async () => {
    mockGetActor.mockResolvedValue(null);
    const createdSong = { id: "s-2", title: "New Song", status: "published" };
    resolveWith(createdSong);

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { title: "New Song" },
    });
    await POST(req);

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB insert fails (500 returned first)", async () => {
    resolveWith(null, { message: "unique constraint violated" });

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { title: "Duplicate Song" },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when Coordinator role is denied (403)", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      headers: { "x-app-role": "Coordinator" },
      body: { title: "New Song" },
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when body is invalid (400 returned first)", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { artist: "No Title Song" }, // missing title
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/songs/[id] — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/songs/[id] — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'update_song' on success", async () => {
    const updatedSong = { id: SONG_ID, title: "Updated Song", status: "published" };
    resolveWith(updatedSong);

    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    await PATCH(req, makeContext(SONG_ID));

    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_song",
        entity_type: "song",
        entity_id: SONG_ID,
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the updated song title", async () => {
    const updatedSong = { id: SONG_ID, title: "Great Is Thy Faithfulness" };
    resolveWith(updatedSong);

    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Great Is Thy Faithfulness" },
    });
    await PATCH(req, makeContext(SONG_ID));

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("Great Is Thy Faithfulness");
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    resolveWith({ id: SONG_ID, title: "Updated Song" });

    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    await PATCH(req, makeContext(SONG_ID));

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB update fails (500 returned first)", async () => {
    resolveWith(null, { message: "update failed" });

    const req = makeNextRequest({
      method: "PATCH",
      url: `http://localhost/api/songs/${SONG_ID}`,
      body: { title: "Updated Song" },
    });
    const res = await PATCH(req, makeContext(SONG_ID));

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/songs/[id] — audit instrumentation
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/songs/[id] — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'delete_song' on success", async () => {
    // DELETE makes two supabase calls: title fetch then the actual delete
    resolveSequence(
      { data: { title: "Amazing Grace" } },
      { data: null }
    );

    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    await DELETE(req, makeContext(SONG_ID));

    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete_song",
        entity_type: "song",
        entity_id: SONG_ID,
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the deleted song title", async () => {
    resolveSequence(
      { data: { title: "Amazing Grace" } },
      { data: null }
    );

    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    await DELETE(req, makeContext(SONG_ID));

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("Amazing Grace");
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    resolveSequence(
      { data: { title: "Old Song" } },
      { data: null }
    );

    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    await DELETE(req, makeContext(SONG_ID));

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB delete fails (500 returned first)", async () => {
    resolveSequence(
      { data: { title: "Old Song" } },
      { data: null, error: { message: "delete failed" } }
    );

    const req = makeNextRequest({
      method: "DELETE",
      url: `http://localhost/api/songs/${SONG_ID}`,
    });
    const res = await DELETE(req, makeContext(SONG_ID));

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});
