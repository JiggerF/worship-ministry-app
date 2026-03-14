import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { WCC_TENANT_ID, isMultiTenantEnabled } from "@/lib/server/tenant";

// ─────────────────────────────────────────────────────────────────────────────
// Route helpers
// ─────────────────────────────────────────────────────────────────────────────

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

function isAdminLogin(pathname: string) {
  return pathname === "/admin/login";
}

/**
 * Routes that are accessibly publicly (no session required).
 * The tenant header is still injected, but auth is not enforced here.
 */
function isPublicApiRoute(pathname: string) {
  // Availability magic-token routes are public (token-based auth only)
  return (
    pathname.startsWith("/api/availability/") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the tenant_id for the request.
 *
 * - Kill switch off (default): always returns WCC_TENANT_ID — no DB round-trip.
 * - Kill switch on: reads subdomain in production or ?org= query param in dev,
 *   then looks up the organizations table. Returns null if the org is not found
 *   or inactive.
 */
async function resolveTenantId(
  request: NextRequest
): Promise<string | null> {
  if (!isMultiTenantEnabled()) {
    return WCC_TENANT_ID;
  }

  const hostname = request.headers.get("host") ?? "";
  let slug: string | null = null;

  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && hostname.includes(".")) {
    // Production: wcc.worshipapp.com → "wcc"
    slug = hostname.split(".")[0] ?? null;
  } else if (isDev) {
    // Dev: ?org=wcc query param
    slug = request.nextUrl.searchParams.get("org");
    if (!slug) slug = "wcc"; // local fallback so dev always works
  }

  if (!slug) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    // Inline fetch to avoid importing the createClient helper
    // (middleware runs in Edge Runtime — keep deps minimal)
    const url = `${supabaseUrl}/rest/v1/organizations?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = await res.json() as { id: string }[];
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
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

  const tenantId = await resolveTenantId(request);
  if (tenantId) {
    requestHeaders.set("x-tenant-id", tenantId);
  }

  // Guard: unknown org slug → reject API calls immediately with a clean 404.
  // Without this, getTenantId() inside route handlers would throw an unhandled 500.
  if (!tenantId && isMultiTenantEnabled()) {
    const path = request.nextUrl.pathname;
    if (path.startsWith("/api/") && !isPublicApiRoute(path)) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
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

      try {
        const adminApi = new URL('/api/admin/member', request.url);
        adminApi.searchParams.set('email', email);
        const res = await fetch(adminApi.toString(), { method: 'GET' });

        if (!res.ok) {
          const text = await res.text();
          if (isDev) console.log('MIDDLEWARE: members fetch failed ->', res.status, text);
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }

        const members = await res.json();
        const member = Array.isArray(members) ? members[0] ?? null : members;
        if (isDev) console.log('MIDDLEWARE: members fetch (fallback) ->', { member });

        const ALLOWED_ROLES = ['Admin', 'Coordinator', 'WorshipLeader', 'MusicCoordinator'];
        if (!member || member.is_active !== true || !ALLOWED_ROLES.includes(member.app_role)) {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }

        // Passed fallback check — allow through
        return response;
      } catch (e) {
        if (isDev) console.log('MIDDLEWARE: members fetch error', e);
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
      .select("app_role, is_active")
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

    // Route restrictions for Coordinator, WorshipLeader, and MusicCoordinator
    const RESTRICTED_ROLES = ["Coordinator", "WorshipLeader", "MusicCoordinator"] as const;
    if (RESTRICTED_ROLES.includes(member.app_role as typeof RESTRICTED_ROLES[number])) {
      const path = request.nextUrl.pathname;

      // Block /admin/settings for all restricted roles
      if (path.startsWith("/admin/settings")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/admin/roster";
        redirectUrl.searchParams.set("reason", "no_settings_access");
        return NextResponse.redirect(redirectUrl);
      }
      // Block /admin/audit for all restricted roles
      if (path.startsWith("/admin/audit")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/admin/roster";
        redirectUrl.searchParams.set("reason", "no_audit_access");
        return NextResponse.redirect(redirectUrl);
      }
      // Block write-action URL patterns on people
      if (path.startsWith("/admin/people") && /add|edit|delete|deactivate/.test(path)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = path.replace(/(add|edit|delete|deactivate).*/, "");
        redirectUrl.searchParams.set("reason", "readonly");
        return NextResponse.redirect(redirectUrl);
      }
      // Block write-action URL patterns on songs
      // Coordinator has full songs access (add/edit/delete) — skip song blocks
      // MusicCoordinator can edit songs but not add/delete
      // WorshipLeader is fully blocked from song write actions
      if (path.startsWith("/admin/songs") && member.app_role !== "Coordinator") {
        const isMusicCoordinator = member.app_role === "MusicCoordinator";
        if (isMusicCoordinator && /add|delete/.test(path)) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = path.replace(/(add|delete).*/, "");
          redirectUrl.searchParams.set("reason", "readonly");
          return NextResponse.redirect(redirectUrl);
        }
        if (!isMusicCoordinator && /add|edit|delete/.test(path)) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = path.replace(/(add|edit|delete).*/, "");
          redirectUrl.searchParams.set("reason", "readonly");
          return NextResponse.redirect(redirectUrl);
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal/:path*"],
};
