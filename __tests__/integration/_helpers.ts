/**
 * Shared helpers for API route integration tests.
 *
 * makeNextRequest — creates a minimal NextRequest-like object that satisfies
 *   what our route handlers read (json(), nextUrl.searchParams, headers, cookies).
 *
 * makeChain — creates a thenable Supabase query builder mock that lets each
 *   query method return `this` (for chaining) and resolves via `await` with
 *   a pre-configured { data, error } payload.
 */

import { vi } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// NextRequest factory
// ─────────────────────────────────────────────────────────────────────────────

interface MockRequestOptions {
  method?: string;
  /** e.g. "http://localhost/api/members?month=2026-03" */
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

export function makeNextRequest(options: MockRequestOptions = {}): NextRequest {
  const url = options.url ?? "http://localhost:3000/api/test";

  const headers: Record<string, string> = { ...(options.headers ?? {}) };

  const initOptions: RequestInit & { signal?: AbortSignal } = {
    method: options.method ?? "GET",
    headers,
  };

  if (options.body !== undefined) {
    initOptions.body = JSON.stringify(options.body);
    headers["content-type"] = "application/json";
  }

  const req = new NextRequest(url, initOptions);

  // Attach cookies manually (NextRequest reads from cookie header)
  if (options.cookies && Object.keys(options.cookies).length > 0) {
    const cookieStr = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    // Override the cookie header on the request
    const cookieHeaders: Record<string, string> = {
      ...(options.headers ?? {}),
      cookie: cookieStr,
    };
    return new NextRequest(url, {
      method: options.method ?? "GET",
      headers: cookieHeaders,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }

  return req;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase query-chain mock factory
// ─────────────────────────────────────────────────────────────────────────────

type ChainResult = { data?: unknown; error?: { message: string; code?: string } | null };

/**
 * Returns an object whose every known query-builder method returns itself
 * so that chains like `.from().select().order().eq()` resolve correctly.
 * `await chain` resolves to `{ data, error }`.
 */
export function makeChain(result: ChainResult = {}) {
  const chain: Record<string, unknown> = {};

  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "in",
    "gte",
    "lte",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ] as const;

  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });

  // Make awaitable — `await supabase.from().select()` calls .then
  chain.then = (
    resolve: (v: ChainResult) => unknown,
    reject?: (e: unknown) => unknown
  ) =>
    Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
    }).then(resolve, reject);

  return chain;
}

/**
 * Build a mock Supabase client whose `from()` dispatches to per-table chains.
 * tableMap: { tableName: { data, error } }
 * Any table NOT in the map returns an empty chain ({ data: null, error: null }).
 */
export function makeSupabaseMock(
  tableMap: Record<string, ChainResult> = {}
) {
  const client = {
    from: vi.fn((table: string) => makeChain(tableMap[table] ?? {})),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  };
  return client;
}
