// @vitest-environment node
/**
 * Audit instrumentation tests — roster API route
 *
 * Verifies that createAuditLogEntry is called with the correct action and
 * summary for every successful roster mutation:
 *   POST   → save_roster_draft
 *   PATCH  (notes body)         → save_roster_note
 *   PATCH  (action: "revert")   → revert_roster
 *   PATCH  (default / finalize) → finalize_roster
 *
 * Also verifies that audit is NOT called when:
 *   - actor is null (unauthenticated / cookie missing)
 *   - the primary DB operation fails (route exits before audit block)
 *   - body is invalid (route returns 400 before reaching audit)
 *
 * Both get-actor and audit-log are mocked; supabase is mocked so no real
 * DB connection is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── All mocks in one vi.hoisted block so factory closures are valid ──────────
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
    "limit",
    "order",
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

import { POST, PATCH } from "@/app/api/roster/route";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ACTOR = { id: "actor-uuid-1", name: "Test Admin", role: "Admin" };

// Typical roster POST body — three assignments for a Sunday
const DRAFT_ASSIGNMENTS = [
  { date: "2026-03-01", role_id: 1, member_id: "member-uuid-1" },
  { date: "2026-03-01", role_id: 2, member_id: "member-uuid-2" },
  { date: "2026-03-01", role_id: 3, member_id: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Set a single resolved result for all subsequent supabase awaits. */
function resolveWith(data: unknown, error: unknown = null) {
  (mockQuery.then as ReturnType<typeof vi.fn>).mockImplementation(
    (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Re-attach all chainable methods after clearAllMocks wipes spy state
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
    "limit",
    "order",
  ] as const;
  methods.forEach((m) => {
    (mockQuery[m] as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);

  // Default: authenticated Admin actor, DB op succeeds
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);
  mockCreateAuditLogEntry.mockResolvedValue(undefined);
  resolveWith(null); // most roster mutations only check error, not data
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/roster — save_roster_draft
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/roster — audit instrumentation", () => {
  it("calls createAuditLogEntry with action 'save_roster_draft' on success", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/roster",
      body: { assignments: DRAFT_ASSIGNMENTS },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "save_roster_draft",
        entity_type: "roster",
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary mentions the number of assignments", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/roster",
      body: { assignments: DRAFT_ASSIGNMENTS },
    });
    await POST(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    // "3 assignments" or "1 assignment" — plural form
    expect(entry.summary).toMatch(/\b3\b.*assignment/);
  });

  it("audit summary uses singular 'assignment' when count is 1", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/roster",
      body: { assignments: [DRAFT_ASSIGNMENTS[0]] },
    });
    await POST(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("1 assignment");
    expect(entry.summary).not.toContain("assignments");
  });

  it("does NOT call createAuditLogEntry when actor is null (unauthenticated)", async () => {
    mockGetActor.mockResolvedValue(null);

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/roster",
      body: { assignments: DRAFT_ASSIGNMENTS },
    });
    await POST(req);

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB upsert fails (500 returned first)", async () => {
    resolveWith(null, { message: "upsert failed" });

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/roster",
      body: { assignments: DRAFT_ASSIGNMENTS },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when body has no assignments array (400)", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/roster",
      body: { month: "2026-03" }, // wrong shape
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/roster (notes) — save_roster_note
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/roster — save_roster_note (notes body)", () => {
  it("calls createAuditLogEntry with action 'save_roster_note' on success", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", notes: "Focus on worship this month" },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "save_roster_note",
        entity_type: "roster",
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the target month", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", notes: "Some notes" },
    });
    await PATCH(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("2026-03");
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", notes: "Notes text" },
    });
    await PATCH(req);

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB upsert fails (500 returned first)", async () => {
    resolveWith(null, { message: "upsert failed" });

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", notes: "Notes text" },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/roster (revert) — revert_roster
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/roster — revert_roster (action: 'revert')", () => {
  it("calls createAuditLogEntry with action 'revert_roster' on success", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", action: "revert" },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "revert_roster",
        entity_type: "roster",
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the target month for revert", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-04", action: "revert" },
    });
    await PATCH(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("2026-04");
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", action: "revert" },
    });
    await PATCH(req);

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB update fails (500 returned first)", async () => {
    resolveWith(null, { message: "update failed" });

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03", action: "revert" },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/roster (finalize) — finalize_roster
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/roster — finalize_roster (default)", () => {
  it("calls createAuditLogEntry with action 'finalize_roster' on success", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03" }, // no notes, no action → finalize
    });
    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "finalize_roster",
        entity_type: "roster",
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("audit summary contains the finalized month", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-05" },
    });
    await PATCH(req);

    const [entry] = mockCreateAuditLogEntry.mock.calls[0];
    expect(entry.summary).toContain("2026-05");
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03" },
    });
    await PATCH(req);

    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("does NOT call createAuditLogEntry when DB update fails (500 returned first)", async () => {
    resolveWith(null, { message: "update failed" });

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "2026-03" },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(500);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("returns 400 when month is missing (no audit)", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { action: "something" }, // no month
    });
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("returns 400 when month format is invalid (no audit)", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/roster",
      body: { month: "March 2026" }, // wrong format
    });
    const res = await PATCH(req);

    expect(res.status).toBe(400);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});
