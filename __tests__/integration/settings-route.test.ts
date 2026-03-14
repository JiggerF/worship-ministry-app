// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests — GET /api/settings  &  PATCH /api/settings
 * src/app/api/settings/route.ts
 *
 * Verifies default fallback, PATCH update, and payload validation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Build mock via vi.hoisted ──
const { mockQuery, mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "upsert", "eq", "in", "limit", "single"] as const;
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

import { GET, PATCH } from "@/app/api/settings/route";

beforeEach(() => {
  vi.clearAllMocks();
  // Reattach chain after clearAllMocks
  const methods = ["select", "upsert", "eq", "in", "limit", "single"] as const;
  methods.forEach((m) => {
    (mockQuery as any)[m] = vi.fn().mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/settings", () => {
  it("returns default values when no DB records exist", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) =>
      Promise.resolve({
        data: [],
        error: null,
      }).then(resolve);

    const res = await GET(makeNextRequest({ method: "GET", url: "http://localhost/api/settings" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.future_months).toBe(2);
    expect(body.history_months).toBe(6);
  });

  it("returns stored values when record exists", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) =>
      Promise.resolve({
        data: [{ key: "roster_pagination", value: { future_months: 3, history_months: 9 } }],
        error: null,
      }).then(resolve);

    const res = await GET(makeNextRequest({ method: "GET", url: "http://localhost/api/settings" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.future_months).toBe(3);
    expect(body.history_months).toBe(9);
  });

  it("returns 500 when Supabase returns an error", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) =>
      Promise.resolve({
        data: null,
        error: { code: "PGRST999", message: "Unknown error" },
      }).then(resolve);

    const res = await GET(makeNextRequest({ method: "GET", url: "http://localhost/api/settings" }));
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/settings
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/settings", () => {
  it("returns 200 with success on valid update", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(resolve);

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/settings",
      body: { future_months: 3, history_months: 12 },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 200 when future_months is string but history_months is valid number (partial update)", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(resolve);

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/settings",
      body: { future_months: "three", history_months: 6 },
    });
    const res = await PATCH(req);
    // future_months is invalid but history_months is valid — route does a partial update
    expect(res.status).toBe(200);
  });

  it("returns 200 when only future_months is provided (partial update allowed)", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(resolve);

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/settings",
      body: { future_months: 2 },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 when body is empty", async () => {
    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/settings",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when Supabase upsert fails", async () => {
    (mockQuery as any).then = (
      resolve: (v: unknown) => unknown
    ) =>
      Promise.resolve({ data: null, error: { message: "upsert failed" } }).then(
        resolve
      );

    const req = makeNextRequest({
      method: "PATCH",
      url: "http://localhost/api/settings",
      body: { future_months: 2, history_months: 6 },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
  });
});
