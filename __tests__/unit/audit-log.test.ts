// @vitest-environment node
/**
 * Unit tests — createAuditLogEntry & getAuditLog
 * src/lib/db/audit-log.ts
 *
 * Verifies write behaviour (silent error swallowing), paginated read logic,
 * sort direction mapping, and error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateAuditLogEntry } from "@/lib/db/audit-log";

// ── Build mock via vi.hoisted ──
const { mockQuery, mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "insert", "order", "range"] as const;
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

import { createAuditLogEntry, getAuditLog } from "@/lib/db/audit-log";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setQueryResult(data: unknown, error: unknown = null, count = 0) {
  (mockQuery.then as (resolve: (v: unknown) => unknown) => unknown) = vi.fn(
    (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error, count }).then(resolve)
  );
}

const SAMPLE_ENTRY: CreateAuditLogEntry = {
  actor_id: "member-uuid-1",
  actor_name: "Test Admin",
  actor_role: "Admin",
  action: "create_song",
  entity_type: "song",
  entity_id: "song-uuid-1",
  summary: "Created song 'Amazing Grace'",
};

const SAMPLE_ROWS = [
  {
    id: "row-1",
    created_at: "2026-01-15T08:00:00Z",
    actor_id: "member-uuid-1",
    actor_name: "Test Admin",
    actor_role: "Admin",
    action: "create_song",
    entity_type: "song",
    entity_id: "song-uuid-1",
    summary: "Created song 'Amazing Grace'",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  const methods = ["select", "insert", "order", "range"] as const;
  methods.forEach((m) => {
    (mockQuery[m] as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);
  setQueryResult(SAMPLE_ROWS, null, SAMPLE_ROWS.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// createAuditLogEntry
// ─────────────────────────────────────────────────────────────────────────────

describe("createAuditLogEntry", () => {
  it("inserts the entry into the audit_log table", async () => {
    setQueryResult(null, null);
    await createAuditLogEntry(SAMPLE_ENTRY);
    expect(mockFrom).toHaveBeenCalledWith("audit_log");
    expect(mockQuery.insert).toHaveBeenCalledWith(SAMPLE_ENTRY);
  });

  it("returns void without throwing when Supabase insert returns an error", async () => {
    setQueryResult(null, { message: "foreign key violation" });
    await expect(createAuditLogEntry(SAMPLE_ENTRY)).resolves.toBeUndefined();
  });

  it("returns void without throwing when the query promise rejects", async () => {
    (mockQuery.then as ReturnType<typeof vi.fn>) = vi.fn(
      (resolve: unknown, reject?: (e: unknown) => void) =>
        Promise.reject(new Error("network error")).then(
          resolve as never,
          reject
        )
    );
    await expect(createAuditLogEntry(SAMPLE_ENTRY)).resolves.toBeUndefined();
  });

  it("does not throw when entity_id is omitted (optional field)", async () => {
    setQueryResult(null, null);
    const entryNoId: CreateAuditLogEntry = {
      actor_id: "actor-1",
      actor_name: "Actor",
      actor_role: "Admin",
      action: "delete_song",
      entity_type: "song",
      summary: "Deleted song 'unknown'",
    };
    await expect(createAuditLogEntry(entryNoId)).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAuditLog
// ─────────────────────────────────────────────────────────────────────────────

describe("getAuditLog — pagination", () => {
  it("uses range(0, 49) for page 1", async () => {
    setQueryResult(SAMPLE_ROWS, null, 1);
    await getAuditLog(1);
    expect(mockQuery.range).toHaveBeenCalledWith(0, 49);
  });

  it("uses range(50, 99) for page 2", async () => {
    setQueryResult(SAMPLE_ROWS, null, 51);
    await getAuditLog(2);
    expect(mockQuery.range).toHaveBeenCalledWith(50, 99);
  });

  it("uses range(100, 149) for page 3", async () => {
    setQueryResult(SAMPLE_ROWS, null, 101);
    await getAuditLog(3);
    expect(mockQuery.range).toHaveBeenCalledWith(100, 149);
  });

  it("returns pageSize of 50 always", async () => {
    setQueryResult(SAMPLE_ROWS, null, 5);
    const result = await getAuditLog(1);
    expect(result.pageSize).toBe(50);
  });

  it("returns the entries array from Supabase data", async () => {
    setQueryResult(SAMPLE_ROWS, null, 1);
    const result = await getAuditLog(1);
    expect(result.entries).toEqual(SAMPLE_ROWS);
  });

  it("returns total from the count field", async () => {
    setQueryResult(SAMPLE_ROWS, null, 42);
    const result = await getAuditLog(1);
    expect(result.total).toBe(42);
  });

  it("returns total=0 when count is null", async () => {
    (mockQuery.then as (resolve: (v: unknown) => unknown) => unknown) = vi.fn(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null, count: null }).then(resolve)
    );
    const result = await getAuditLog(1);
    expect(result.total).toBe(0);
  });

  it("returns entries=[] when data is null", async () => {
    (mockQuery.then as (resolve: (v: unknown) => unknown) => unknown) = vi.fn(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve)
    );
    const result = await getAuditLog(1);
    expect(result.entries).toEqual([]);
  });
});

describe("getAuditLog — sort direction", () => {
  it("orders descending (ascending: false) when sortDir is 'desc' (default)", async () => {
    setQueryResult(SAMPLE_ROWS, null, 1);
    await getAuditLog(1, "desc");
    expect(mockQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("orders ascending (ascending: true) when sortDir is 'asc'", async () => {
    setQueryResult(SAMPLE_ROWS, null, 1);
    await getAuditLog(1, "asc");
    expect(mockQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });

  it("queries with count: 'exact'", async () => {
    setQueryResult(SAMPLE_ROWS, null, 1);
    await getAuditLog(1);
    expect(mockQuery.select).toHaveBeenCalledWith("*", { count: "exact" });
  });
});

describe("getAuditLog — error handling", () => {
  it("throws when Supabase returns an error", async () => {
    const supabaseError = { message: "query failed", code: "42P01" };
    setQueryResult(null, supabaseError);
    await expect(getAuditLog(1)).rejects.toMatchObject({
      message: "query failed",
    });
  });
});
