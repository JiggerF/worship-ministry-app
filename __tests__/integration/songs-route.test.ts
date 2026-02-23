// @vitest-environment node
/**
 * Integration tests — GET /api/songs & POST /api/songs
 * src/app/api/songs/route.ts
 *
 * Tests portal scope filtering, Coordinator block, title validation,
 * and DB error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Build mock via vi.hoisted so references are valid inside vi.mock factory ──
const { mockQuery, mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "insert", "order", "neq", "eq", "single"] as const;
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

import { GET, POST } from "@/app/api/songs/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SONGS_DATA = [
  {
    id: "s1",
    title: "Amazing Grace",
    status: "published",
    chord_charts: [],
  },
  {
    id: "s2",
    title: "Review Song",
    status: "internal_approved",
    chord_charts: [],
  },
];

function setupSuccessMock(data: unknown[] = SONGS_DATA) {
  (mockQuery as Record<string, unknown>).then = (
    resolve: (v: unknown) => unknown
  ) => Promise.resolve({ data, error: null }).then(resolve);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-attach chainable behaviour after clearAllMocks
  const methods = ["select", "insert", "order", "neq", "eq", "single"] as const;
  methods.forEach((m) => {
    (mockQuery as Record<string, unknown>)[m] = vi.fn().mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);
  setupSuccessMock();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/songs
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/songs", () => {
  it("returns 200 with an array of songs", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/songs" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("calls .neq() to filter out internal_approved when scope=portal", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/songs?scope=portal",
    });
    await GET(req);
    // The route adds .neq("status", "internal_approved") for portal scope
    expect(mockQuery.neq).toHaveBeenCalledWith("status", "internal_approved");
  });

  it("does NOT call .neq() when scope is not provided", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/songs" });
    await GET(req);
    expect(mockQuery.neq).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase returns an error", async () => {
    mockQuery.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: "DB error" } }).then(
        resolve
      );
    const req = makeNextRequest({ url: "http://localhost/api/songs" });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/songs
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/songs — authorisation", () => {
  it("returns 403 for Coordinator role", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      headers: { "x-app-role": "Coordinator" },
      body: { title: "New Song" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/coordinator/i);
  });
});

describe("POST /api/songs — validation", () => {
  it("returns 400 when title is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { artist: "John Newton" }, // no title
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      // no body
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/songs — success path", () => {
  it("returns 200 with created song", async () => {
    const createdSong = { id: "s-new", title: "New Song", status: "published" };
    mockQuery.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: createdSong, error: null }).then(resolve);

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { title: "New Song", artist: "Test Artist" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.song.title).toBe("New Song");
  });
});

describe("POST /api/songs — DB error propagation", () => {
  it("returns 500 when Supabase insert fails", async () => {
    mockQuery.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: null,
        error: { message: "unique constraint violated" },
      }).then(resolve);

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/songs",
      body: { title: "Duplicate Song" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
