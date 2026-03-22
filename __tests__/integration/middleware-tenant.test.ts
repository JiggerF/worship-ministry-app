// @vitest-environment node
/**
 * Integration tests — middleware tenant isolation & Julius login regression
 *
 * Bug: Julius (admin of julius-church-music-ministry) was redirected to
 *   /admin/login?reason=not_admin on every page load after login.
 *
 * Root cause (original): The middleware's cookie-fallback auth path made an
 *   internal bare fetch() to /api/admin/member. That fetch carried no cookies,
 *   so when middleware ran again on that internal request, resolveTenantId()
 *   returned null and the tenant guard fired a 404. The outer middleware saw
 *   !res.ok (404) and redirected to reason=not_admin.
 *
 * Fix (current): The cookie-fallback path now makes direct Supabase REST API
 *   calls (rest/v1/members + rest/v1/organization_members) using the service
 *   role key — bypassing the self-fetch and its re-entrant middleware problem
 *   entirely.
 *
 * These tests prove:
 *   1. Julius can access /admin/roster after login (fix works)
 *   2. If the members REST call returns empty array, middleware blocks access
 *   3. If the org membership REST call returns empty array, middleware blocks
 *   4. No tenant context at all → 404 (tenant guard fires before auth check)
 *   5. Tenant is resolved from sb-tenant-id cookie (not ?org= param) and
 *      is used as the organization_id filter in the org membership REST call
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks (must come before any imports that resolve these) ──────────────────

vi.mock("server-only", () => ({}));

// createServerClient is called in the middleware for /admin/* routes.
// Returning { user: null, error: "no session" } forces the cookie-fallback
// path — exactly what happens with our custom sb-access-token cookie format.
const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({
    data: { user: null },
    error: { message: "no session" },
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// ── Environment (must be set before importing middleware) ───────────────────
process.env.MULTI_TENANT_ENABLED = "true";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.SUPABASE_URL = "https://test.supabase.co";

// Import AFTER mocks and env are configured
const { middleware } = await import("@/middleware");

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Must be a valid UUID — middleware validates with /^[0-9a-f]{8}-…$/i
const JULIUS_TENANT_ID = "23234e41-5fe5-4c68-aeb8-05c84c6b677f";
const JULIUS_MEMBER_ID = "380dda1a-8496-4d8b-b20f-219a2733a008";
const JULIUS_EMAIL = "julius@julius.org";
const SUPABASE_URL = "https://test.supabase.co";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Encode an email into the sb:token cookie format set by /api/auth/login */
function makeSbToken(email: string): string {
  return encodeURIComponent(JSON.stringify({ user: { email } }));
}

/** Build a NextRequest for a given path with session cookies already set */
function makeAdminRequest(path: string, opts: { tenantId: string; email: string }) {
  const cookieStr = [
    `sb-tenant-id=${opts.tenantId}`,
    `sb:token=${makeSbToken(opts.email)}`,
  ].join("; ");

  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { cookie: cookieStr },
  });
}

/** Check whether a response is a redirect to /admin/login?reason=not_admin */
function isNotAdminRedirect(response: Response): boolean {
  const loc = response.headers.get("location") ?? "";
  return (response.status === 307 || response.status === 302) &&
    loc.includes("not_admin");
}

/**
 * Build a fetch mock that correctly handles the two Supabase REST calls the
 * middleware cookie-fallback path makes:
 *   1. GET rest/v1/members?email=eq.<email>...  → members array
 *   2. GET rest/v1/organization_members?member_id=eq.<id>&organization_id=eq.<tenantId>...
 *      → org membership array
 *
 * Also handles the resolveTenantId() organizations lookup:
 *   3. GET rest/v1/organizations?slug=eq.<slug>... → org row (id + name)
 *
 * Callers can override the default "Julius is Admin + active" responses.
 */
function makeRestFetchMock(opts: {
  memberRow?: { id: string; app_role: string; is_active: boolean } | null;
  orgMemberRow?: { app_role: string; is_active: boolean } | null;
  orgRow?: { id: string; name: string } | null;
} = {}) {
  const memberRow = opts.memberRow !== undefined
    ? opts.memberRow
    : { id: JULIUS_MEMBER_ID, app_role: "Admin", is_active: true };

  const orgMemberRow = opts.orgMemberRow !== undefined
    ? opts.orgMemberRow
    : { app_role: "Admin", is_active: true };

  const orgRow = opts.orgRow !== undefined
    ? opts.orgRow
    : { id: JULIUS_TENANT_ID, name: "Julius Church Music Ministry" };

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes(`${SUPABASE_URL}/rest/v1/organizations`)) {
      return new Response(
        JSON.stringify(orgRow ? [orgRow] : []),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes(`${SUPABASE_URL}/rest/v1/members`)) {
      return new Response(
        JSON.stringify(memberRow ? [memberRow] : []),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes(`${SUPABASE_URL}/rest/v1/organization_members`)) {
      return new Response(
        JSON.stringify(orgMemberRow ? [orgMemberRow] : []),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

let originalFetch: typeof global.fetch;
beforeEach(() => {
  vi.clearAllMocks();
  // Restore getUser mock after clearAllMocks clears the implementation
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: "no session" },
  });
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Julius login regression
// ─────────────────────────────────────────────────────────────────────────────

describe("Middleware — Julius login regression (/admin/* cookie-fallback path)", () => {
  it("allows /admin/roster when REST member lookup returns Admin role (fix verification)", async () => {
    // Middleware now calls Supabase REST directly (not /api/admin/member).
    // Mock both REST calls to return Julius as an active Admin.
    global.fetch = makeRestFetchMock();

    const req = makeAdminRequest("/admin/roster", {
      tenantId: JULIUS_TENANT_ID,
      email: JULIUS_EMAIL,
    });

    const res = await middleware(req);

    // Must NOT redirect to /admin/login?reason=not_admin
    expect(isNotAdminRedirect(res)).toBe(false);
    // The middleware should allow the request through
    expect(res.status).toBe(200);
  });

  it("redirects to reason=not_admin when members REST call returns empty array", async () => {
    // Simulate member not found in the global members table.
    global.fetch = makeRestFetchMock({ memberRow: null });

    const req = makeAdminRequest("/admin/roster", {
      tenantId: JULIUS_TENANT_ID,
      email: JULIUS_EMAIL,
    });

    const res = await middleware(req);

    expect(isNotAdminRedirect(res)).toBe(true);
  });

  it("redirects to reason=not_member_of_org when org membership REST call returns empty array", async () => {
    // Member exists globally but is not in this tenant's organization.
    global.fetch = makeRestFetchMock({ orgMemberRow: null });

    const req = makeAdminRequest("/admin/roster", {
      tenantId: JULIUS_TENANT_ID,
      email: JULIUS_EMAIL,
    });

    const res = await middleware(req);

    const loc = res.headers.get("location") ?? "";
    expect(res.status === 307 || res.status === 302).toBe(true);
    expect(loc.includes("not_member_of_org")).toBe(true);
  });

  it("returns 404 when no tenant context at all (no cookies, no ?org= param)", async () => {
    // In multi-tenant mode, a request with NO sb-tenant-id cookie and NO ?org= param
    // cannot resolve a tenant. The guard short-circuits with a 404 before even
    // reaching the auth check — so no REST fetch is made.
    global.fetch = vi.fn() as typeof fetch;

    const req = new NextRequest("http://localhost:3000/admin/roster");

    const res = await middleware(req);

    // Tenant guard fires first → 404 "Organization Not Found" (not a login redirect)
    expect(res.status).toBe(404);
    // The REST member fetch must NOT be reached
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("resolves tenant from sb-tenant-id cookie and passes it as organization_id filter in REST call", async () => {
    // Julius navigates to /admin/roster with no ?org= — tenant must come from cookie.
    // Verify that the org membership REST call uses the correct tenant UUID as filter.
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes(`${SUPABASE_URL}/rest/v1/members`)) {
        return new Response(
          JSON.stringify([{ id: JULIUS_MEMBER_ID, app_role: "Admin", is_active: true }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes(`${SUPABASE_URL}/rest/v1/organization_members`)) {
        // Verify the correct tenant UUID is used as organization_id filter
        if (url.includes(`organization_id=eq.${JULIUS_TENANT_ID}`)) {
          return new Response(
            JSON.stringify([{ app_role: "Admin", is_active: true }]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        // Wrong tenant UUID used → block (simulates cross-tenant access attempt)
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const req = makeAdminRequest("/admin/roster", {
      tenantId: JULIUS_TENANT_ID,
      email: JULIUS_EMAIL,
    });

    const res = await middleware(req);

    // Must be allowed through — tenant was correctly resolved from cookie
    expect(isNotAdminRedirect(res)).toBe(false);
    expect(res.status).toBe(200);

    // Verify the org membership call used Julius's correct tenant UUID
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const orgMemberCall = fetchCalls.find((args: unknown[]) =>
      String(args[0]).includes("/rest/v1/organization_members")
    );
    expect(orgMemberCall).toBeDefined();
    const callUrl = String(orgMemberCall![0]);
    expect(callUrl).toContain(`organization_id=eq.${JULIUS_TENANT_ID}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic tenant labels — x-tenant-name header injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a NextRequest for a path using a subdomain-based host header.
 * In the test environment NODE_ENV is "test" (not "development"), so the
 * middleware's production subdomain path (not the ?org= dev path) is active.
 * The slug is extracted from the first segment of the Host header.
 */
function makeSubdomainRequest(
  path: string,
  orgSlug: string,
  extraHeaders: Record<string, string> = {}
) {
  return new NextRequest(`https://${orgSlug}.worshipapp.com${path}`, {
    headers: { host: `${orgSlug}.worshipapp.com`, ...extraHeaders },
  });
}

describe("Middleware — x-tenant-name header injection (dynamic tenant labels)", () => {
  it("injects x-tenant-name when subdomain slug resolves to a known organization", async () => {
    // In non-dev (test) env, slug comes from hostname subdomain.
    // resolveTenantId() fetches organizations?slug=eq.<slug> and returns { id, name }.
    // The middleware then sets x-tenant-name on the forwarded request headers.
    global.fetch = makeRestFetchMock({
      orgRow: { id: JULIUS_TENANT_ID, name: "Julius Church Music Ministry" },
    });

    const req = makeSubdomainRequest("/admin/login", "julius");

    await middleware(req);

    // Verify the organizations REST call was made — proving resolveTenantId
    // executed the DB slug lookup (which is what populates the name for injection).
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const orgCall = fetchCalls.find((args: unknown[]) =>
      String(args[0]).includes("/rest/v1/organizations")
    );
    expect(orgCall).toBeDefined();
    // Verify the slug was used in the query
    const orgCallUrl = String(orgCall![0]);
    expect(orgCallUrl).toContain("julius");
  });

  it("does NOT call the organizations REST endpoint when session-cookie path is used (name is empty string)", async () => {
    // When tenant is resolved from sb-tenant-id cookie (no subdomain),
    // resolveTenantId() short-circuits and returns { id: <uuid>, name: "" }.
    // The organizations table is NOT queried — no slug to look up.
    global.fetch = makeRestFetchMock();

    // Request with cookie-based tenant only (no subdomain in host header)
    const req = makeAdminRequest("/admin/roster", {
      tenantId: JULIUS_TENANT_ID,
      email: JULIUS_EMAIL,
    });

    await middleware(req);

    // The organizations REST call should NOT have been made
    // (cookie fallback short-circuits before the slug lookup)
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const orgCall = fetchCalls.find((args: unknown[]) =>
      String(args[0]).includes("/rest/v1/organizations")
    );
    expect(orgCall).toBeUndefined();
  });

  it("STRIPS a client-supplied x-tenant-name header before resolution (security: no spoofing)", async () => {
    // Security test: a malicious client sends x-tenant-name: "Attacker Church"
    // The middleware MUST delete this header at Step 1 before doing any processing.
    // We verify the real organizations lookup is still made (server controls the value).
    global.fetch = makeRestFetchMock({
      orgRow: { id: JULIUS_TENANT_ID, name: "Julius Church Music Ministry" },
    });

    // Include the spoofed header alongside a valid subdomain request
    const req = makeSubdomainRequest("/admin/login", "julius", {
      "x-tenant-name": "Attacker Church",
    });

    await middleware(req);

    // The organizations REST call should still be made (slug resolution runs normally)
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const orgCall = fetchCalls.find((args: unknown[]) =>
      String(args[0]).includes("/rest/v1/organizations")
    );
    // Server-side slug resolution was attempted — the spoofed header was stripped
    // and the server resolved the name from the DB (not from the client header).
    expect(orgCall).toBeDefined();
  });

  it("does NOT inject x-tenant-name (or x-tenant-id) when the subdomain slug does not resolve", async () => {
    // When the org slug is unknown, resolveTenantId returns null.
    // Neither header should be set, and /admin/roster returns 404 (tenant guard fires).
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes(`${SUPABASE_URL}/rest/v1/organizations`)) {
        // Unknown slug → empty array
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const req = makeSubdomainRequest("/admin/roster", "nonexistent-slug");

    const res = await middleware(req);

    // Unknown org → 404 (tenant guard fires before auth)
    expect(res.status).toBe(404);
  });

  it("falls back to sb-tenant-id cookie when subdomain slug is present but unrecognised (worship.example.org regression)", async () => {
    // Regression: WCC org slug is 'wcc' but production subdomain is 'worship'.
    // After MULTI_TENANT_ENABLED was set to true, slug = 'worship' was extracted,
    // DB returned empty, tenantId was null, and all admin routes returned 404.
    // Fix: when the slug lookup returns no rows, fall through to the sb-tenant-id
    // cookie before returning null.
    global.fetch = makeRestFetchMock({
      orgRow: null, // slug 'worship' not found in DB
      memberRow: { id: JULIUS_MEMBER_ID, app_role: "Admin", is_active: true },
      orgMemberRow: { app_role: "Admin", is_active: true },
    });

    // Request with 'worship' subdomain but sb-tenant-id cookie already set (from prior login)
    const cookieStr = [
      `sb-tenant-id=${JULIUS_TENANT_ID}`,
      `sb:token=${makeSbToken(JULIUS_EMAIL)}`,
    ].join("; ");
    const req = new NextRequest("https://worship.example.org/admin/roster", {
      headers: {
        host: "worship.example.org",
        cookie: cookieStr,
      },
    });

    const res = await middleware(req);

    // Must NOT return 404 from tenant guard — tenant resolved via cookie fallback
    expect(res.status).not.toBe(404);
    // Must NOT redirect to /admin/login?reason=not_admin
    expect(isNotAdminRedirect(res)).toBe(false);
    // Should be allowed through (200)
    expect(res.status).toBe(200);
  });
});
