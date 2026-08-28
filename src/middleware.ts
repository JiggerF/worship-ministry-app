import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { WCC_TENANT_ID, isMultiTenantEnabled } from "@/lib/server/tenant";
import { hasPermission } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the authenticated user's email from request cookies using two
 * fallback strategies, matching the pattern in lib/server/platform-auth.ts:
 *  1. Decode the sb-access-token JWT payload directly.
 *  2. Parse the JSON in the sb:token cookie.
 *
 * Used when createServerClient.auth.getUser() fails because our custom cookie
 * names (sb-access-token) don't match the @supabase/ssr expected format.
 */
function getEmailFromCookiesFallback(request: NextRequest): string | null {
  // Strategy 1: decode JWT in sb-access-token
  const access = request.cookies.get("sb-access-token")?.value;
  if (access) {
    try {
      const parts = access.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload?.email) return payload.email as string;
      }
    } catch { /* ignore */ }
  }

  // Strategy 2: parse sb:token JSON cookie
  const sbToken = request.cookies.get("sb:token")?.value;
  if (sbToken) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sbToken));
      if (parsed?.user?.email) return parsed.user.email as string;
    } catch { /* ignore */ }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route helpers
// ─────────────────────────────────────────────────────────────────────────────

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

function isAdminLogin(pathname: string) {
  return pathname === "/admin/login";
}

function isPlatformPath(pathname: string) {
  return pathname.startsWith("/platform");
}

function isPlatformApiPath(pathname: string) {
  return pathname.startsWith("/api/platform/");
}

/**
 * Routes that are accessibly publicly (no session required).
 * The tenant header is still injected, but auth is not enforced here.
 */
function isPublicApiRoute(pathname: string) {
  // Availability magic-token routes are public (token-based auth only)
  // /api/admin/member is middleware-internal: middleware calls it from the cookie
  // fallback path (no cookies on internal fetch → no tenant context → guard would 404).
  // The route validates org membership itself via the ?orgId= param.
  return (
    pathname.startsWith("/api/availability/") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/admin/member"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the tenant_id and tenant_name for the request.
 *
 * - Kill switch off (default): always returns { id: WCC_TENANT_ID, name: "" } — no DB round-trip.
 * - Kill switch on: reads subdomain in production or ?org= query param in dev,
 *   then looks up the organizations table. Returns null if the org is not found
 *   or inactive.
 */
async function resolveTenantId(
  request: NextRequest
): Promise<{ id: string; name: string } | null> {
  if (!isMultiTenantEnabled()) {
    return { id: WCC_TENANT_ID, name: "" };
  }

  const hostname = request.headers.get("host") ?? "";
  let slug: string | null = null;

  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && hostname.includes(".")) {
    // Production: wcc.worshipapp.com → "wcc"
    slug = hostname.split(".")[0] ?? null;
  } else if (isDev) {
    // Dev: ?org=<slug> query param (e.g. ?org=wcc, ?org=tenant2)
    slug = request.nextUrl.searchParams.get("org");
    // NOTE: No default fallback to "wcc" here. In multi-tenant mode every tenant
    // must be explicit. If no ?org= is supplied the session cookie fallback below
    // is used (set at login time). Defaulting to "wcc" here was the root cause of
    // the cross-tenant data leak: all admins silently resolved to Tenant 1.
  }

  if (!slug) {
    // Session cookie fallback: at login time /api/auth/login validates org membership
    // and stamps this cookie with the verified tenant UUID. Reading it here lets
    // subsequent requests work without a subdomain or ?org= param.
    const tenantCookie = request.cookies.get("sb-tenant-id")?.value;
    if (
      tenantCookie &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantCookie)
    ) {
      return { id: tenantCookie, name: "" };
    }
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    // Inline fetch to avoid importing the createClient helper
    // (middleware runs in Edge Runtime — keep deps minimal)
    const url = `${supabaseUrl}/rest/v1/organizations?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id,name&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      // DB unreachable — fall through to cookie fallback below
    } else {
      const rows = await res.json() as { id: string; name?: string }[];
      if (rows[0]) return { id: rows[0].id, name: rows[0].name ?? "" };
      // slug was present but matched no org row — fall through to cookie fallback.
      // This handles the case where the production subdomain (e.g. "worship" from
      // worship.gracetoyou.com.au) does not match the slug stored in the DB (e.g.
      // "wcc"). The sb-tenant-id cookie stamped at login time is the authoritative
      // fallback — the user's org membership was already validated at login.
    }
  } catch {
    // network error — fall through to cookie fallback
  }

  // Cookie fallback: use the tenant UUID stamped by /api/auth/login even when the
  // subdomain slug lookup failed (unrecognised slug or network error).
  const tenantCookie = request.cookies.get("sb-tenant-id")?.value;
  if (
    tenantCookie &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantCookie)
  ) {
    return { id: tenantCookie, name: "" };
  }

  return null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    console.log("MIDDLEWARE RUNNING:", request.nextUrl.pathname);
    try {
      const all = request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      console.log('MIDDLEWARE: incoming cookies ->', all);
      console.log('MIDDLEWARE: raw Cookie header ->', request.headers.get('cookie'));
    } catch (e) {
      console.log('MIDDLEWARE: error reading cookies', e);
    }
  } else {
    console.log("MIDDLEWARE: access to", request.nextUrl.pathname);
  }

  // ─── Step 1: Security — always strip any client-supplied x-tenant-id ───────
  // Then resolve the correct tenant and inject it server-side.
  // This prevents tenancy spoofing from any client.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-tenant-name");

  const tenantResult = await resolveTenantId(request);
  const tenantId = tenantResult?.id ?? null;
  const tenantName = tenantResult?.name ?? null;
  if (tenantId) {
    requestHeaders.set("x-tenant-id", tenantId);
  }
  if (tenantName) {
    requestHeaders.set("x-tenant-name", tenantName);
  }


  // Guard: unknown org slug → reject API calls immediately with a clean 404.
  // Without this, getTenantId() inside route handlers would throw an unhandled 500.
  if (!tenantId && isMultiTenantEnabled()) {
    const path = request.nextUrl.pathname;
    // Block all /admin/* (except login) and /api/* (except public API) if tenant context is missing.
    // /admin/login is intentionally allowed through — it doesn't need tenant context.
    // Tenant resolution happens inside /api/auth/login from the user's credentials.
    if ((path.startsWith("/admin/") && !isAdminLogin(path)) || (path.startsWith("/api/") && !isPublicApiRoute(path))) {
      // Show a clear error for admin UI, JSON for API
      if (path.startsWith("/admin/")) {
        return new NextResponse(
          '<html><body><h1>Organization Not Found</h1><p>This admin portal must be accessed from your church\'s subdomain URL. Please check your link or contact your administrator.</p></body></html>',
          { status: 404, headers: { "Content-Type": "text/html" } }
        );
      } else {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }
    }
  }

  // Rebuild the request/response with the modified headers
  response = NextResponse.next({ request: { headers: requestHeaders } });

  // ─── Step 2: Dev auth bypass ──────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    const devCookie = request.cookies.get("dev_auth");
    if (devCookie && devCookie.value === "1") {
      return response;
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env not set, don't hard-break dev server; just allow through.
  if (!url || !anon) return response;

  // ─── Step 3: Public API routes — skip auth, tenant header already set ─────
  if (isPublicApiRoute(request.nextUrl.pathname)) {
    return response;
  }

  // ─── Step 3b: /api/platform/* — auth handled by individual route handlers ─
  // getPlatformAdmin() in each route verifies the caller is in platform_admins.
  // Tenant injection is skipped for platform routes (they're cross-tenant).
  if (isPlatformApiPath(request.nextUrl.pathname)) {
    return response;
  }

  // ─── Step 3c: /platform/* page routes ─────────────────────────────────────
  // The platform login page is public. All other platform pages redirect to
  // /platform/login if the user has no session. The platform_admins table
  // check is handled client-side via /api/platform/me in the platform layout.
  if (isPlatformPath(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname === "/platform/login") {
      return response;
    }

    // Require any Supabase session to access platform pages.
    // Primary: @supabase/ssr createServerClient (works when Supabase sets its
    //   own cookie format, e.g. after OAuth flows).
    // Fallback: decode our custom sb-access-token / sb:token cookies directly,
    //   which is the format set by our /api/auth/login route.
    const platformClient = createServerClient(url, anon, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });
    const { data: platformSession } = await platformClient.auth.getUser();
    const hasSession =
      !!platformSession?.user || !!getEmailFromCookiesFallback(request);

    if (!hasSession) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/platform/login";
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // ─── Step 4: /api/* and /portal/* — no session-level block in middleware ──
  // Individual routes use getActorFromRequest() for their own auth checks.
  // Middleware's job here is purely tenant injection (done above).
  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname.startsWith("/portal/")
  ) {
    return response;
  }

  // ─── Step 5: /admin/* — full session + role check ─────────────────────────
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Protect all /admin routes except /admin/login
  if (isAdminPath(request.nextUrl.pathname) && !isAdminLogin(request.nextUrl.pathname)) {
    const { data, error } = await supabase.auth.getUser();
    if (isDev) {
      console.log('MIDDLEWARE: supabase.auth.getUser ->', {
        user: data?.user ?? null,
        error: error ?? null,
      });
    }

    let email: string | null = null;

    // If getUser failed due to missing session, try a best-effort cookie fallback.
    if (error || !data?.user) {
      if (isDev) console.log('MIDDLEWARE: getUser failed, attempting cookie fallback');
      try {
        const sbTokenCookie = request.cookies.get('sb:token')?.value;
        if (sbTokenCookie) {
          try {
            const parsed = JSON.parse(decodeURIComponent(sbTokenCookie));
            email = parsed?.user?.email ?? null;
            if (isDev) console.log('MIDDLEWARE: parsed sb:token ->', { email });
          } catch (e) {
            if (isDev) console.log('MIDDLEWARE: failed parsing sb:token JSON', e);
          }
        }

        // If we didn't get an email from the JSON token, try the access token JWT payload.
        if (!email) {
          const access = request.cookies.get('sb-access-token')?.value;
          if (access) {
            try {
              const parts = access.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                email = payload?.email ?? null;
                if (isDev) console.log('MIDDLEWARE: decoded sb-access-token ->', { email });
              }
            } catch (e) {
              if (isDev) console.log('MIDDLEWARE: failed decoding sb-access-token', e);
            }
          }
        }
      } catch (e) {
        if (isDev) console.log('MIDDLEWARE: cookie fallback error', e);
      }

      if (!email) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
        if (isDev) console.log('MIDDLEWARE: redirecting to /admin/login (not logged in)');
        return NextResponse.redirect(loginUrl);
      }

      // Use service role key for server-side member lookup to avoid auth restrictions.
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        if (isDev) console.log('MIDDLEWARE: SUPABASE_SERVICE_ROLE_KEY not set; denying access');
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.searchParams.set("reason", "no_service_key");
        return NextResponse.redirect(loginUrl);
      }

      // Direct Supabase REST API lookup — replaces the previous self-fetch to
      // /api/admin/member. The self-fetch was fragile because it went through
      // middleware again (no cookies on server-side fetch → tenantId = null →
      // tenant guard blocked it with 404 → outer middleware saw !res.ok →
      // redirected to reason=not_admin). The compiled Edge Runtime chunk also
      // cached stale versions of isPublicApiRoute, making the bypass unreliable.
      // Direct REST calls are simpler, faster, and immune to that problem.
      try {
        const sbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!sbUrl) throw new Error('missing SUPABASE_URL');

        // 1. Look up the member by email (global members table)
        const memberRes = await fetch(
          `${sbUrl}/rest/v1/members?email=eq.${encodeURIComponent(email)}&select=id,app_role,is_active&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' } }
        );
        if (!memberRes.ok) {
          if (isDev) console.log('MIDDLEWARE: member DB lookup failed ->', memberRes.status);
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }
        const memberRows = await memberRes.json() as { id: string; app_role: string; is_active: boolean }[];
        const member = memberRows[0] ?? null;
        if (isDev) console.log('MIDDLEWARE: member DB lookup (fallback) ->', { member });

        if (!member || member.is_active !== true) {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }

        const ALLOWED_ROLES = ['Admin', 'Coordinator', 'WorshipLeader', 'MusicCoordinator'];
        let effectiveRole = member.app_role;

        // 2. In multi-tenant mode, verify org membership and use per-tenant role
        if (isMultiTenantEnabled() && tenantId) {
          const orgRes = await fetch(
            `${sbUrl}/rest/v1/organization_members?member_id=eq.${encodeURIComponent(member.id)}&organization_id=eq.${encodeURIComponent(tenantId)}&select=app_role,is_active&limit=1`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' } }
          );
          if (!orgRes.ok) {
            if (isDev) console.log('MIDDLEWARE: org membership lookup failed ->', orgRes.status);
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/admin/login';
            loginUrl.searchParams.set('reason', 'not_admin');
            return NextResponse.redirect(loginUrl);
          }
          const orgRows = await orgRes.json() as { app_role: string; is_active: boolean }[];
          const orgMember = orgRows[0] ?? null;
          if (isDev) console.log('MIDDLEWARE: org membership (fallback) ->', { orgMember, tenantId });

          if (!orgMember || orgMember.is_active !== true) {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/admin/login';
            loginUrl.searchParams.set('reason', 'not_member_of_org');
            return NextResponse.redirect(loginUrl);
          }
          effectiveRole = orgMember.app_role;
        }

        if (!ALLOWED_ROLES.includes(effectiveRole)) {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }

        // Passed fallback check — allow through
        return response;
      } catch (e) {
        if (isDev) console.log('MIDDLEWARE: DB lookup error', e);
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/admin/login';
        loginUrl.searchParams.set('reason', 'not_admin');
        return NextResponse.redirect(loginUrl);
      }
    }

    // If getUser succeeded, proceed with the original flow
    email = data.user.email ?? null;
    if (!email) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("reason", "missing_email");
      return NextResponse.redirect(loginUrl);
    }

    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, app_role, is_active")
      .eq("email", email)
      .single();

    if (isDev) console.log('MIDDLEWARE: members query ->', { member: member ?? null, memberErr: memberErr ?? null });

    const ALLOWED_ROLES = ["Admin", "Coordinator", "WorshipLeader", "MusicCoordinator"];
    if (
      memberErr ||
      !member ||
      member.is_active !== true ||
      !ALLOWED_ROLES.includes(member.app_role)
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("reason", "not_admin");
      return NextResponse.redirect(loginUrl);
    }

    // In multi-tenant mode, enforce org boundary: verify the authenticated user
    // is an active member of the RESOLVED TENANT's organization.
    // Without this check, a WCC admin with a valid session could access
    // tenant2.worshipapp.com because their global members.app_role is Admin.
    let effectiveRole = member.app_role;
    if (isMultiTenantEnabled() && tenantId) {
      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("app_role, is_active")
        .eq("member_id", member.id)
        .eq("organization_id", tenantId)
        .maybeSingle();

      if (isDev) console.log('MIDDLEWARE: org membership check ->', { orgMember, tenantId });

      if (!orgMember || orgMember.is_active !== true || !ALLOWED_ROLES.includes(orgMember.app_role)) {
        if (isDev) console.log('MIDDLEWARE: user is not a member of resolved tenant → redirecting to login');
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.searchParams.set("reason", "not_member_of_org");
        return NextResponse.redirect(loginUrl);
      }
      effectiveRole = orgMember.app_role;
    }

    // Route restrictions based on centralized permission map
    const role = effectiveRole as AppRole;
    const path = request.nextUrl.pathname;

    // Block /admin/settings if role lacks settings view
    if (path.startsWith("/admin/settings") && !hasPermission(role, "settings", "view")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/roster";
      redirectUrl.searchParams.set("reason", "no_settings_access");
      return NextResponse.redirect(redirectUrl);
    }
    // Block /admin/audit if role lacks audit view
    if (path.startsWith("/admin/audit") && !hasPermission(role, "audit", "view")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/roster";
      redirectUrl.searchParams.set("reason", "no_audit_access");
      return NextResponse.redirect(redirectUrl);
    }
    // Block write-action URL patterns on people
    if (path.startsWith("/admin/people") && /add|edit|delete|deactivate/.test(path) && !hasPermission(role, "people", "write")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = path.replace(/(add|edit|delete|deactivate).*/, "");
      redirectUrl.searchParams.set("reason", "readonly");
      return NextResponse.redirect(redirectUrl);
    }
    // Block write-action URL patterns on songs
    if (path.startsWith("/admin/songs")) {
      if (/add|delete/.test(path) && !hasPermission(role, "songs", "delete")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = path.replace(/(add|delete).*/, "");
        redirectUrl.searchParams.set("reason", "readonly");
        return NextResponse.redirect(redirectUrl);
      }
      if (/edit/.test(path) && !hasPermission(role, "songs", "write")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = path.replace(/edit.*/, "");
        redirectUrl.searchParams.set("reason", "readonly");
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal/:path*", "/platform/:path*"],
};
