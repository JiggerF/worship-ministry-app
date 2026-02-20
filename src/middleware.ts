import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

function isAdminLogin(pathname: string) {
  return pathname === "/admin/login";
}

export async function middleware(request: NextRequest) {
  console.log("MIDDLEWARE RUNNING:", request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  // Debug: log incoming cookies and raw Cookie header to diagnose session propagation
  try {
    const all = request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
    console.log('MIDDLEWARE: incoming cookies ->', all);
    console.log('MIDDLEWARE: raw Cookie header ->', request.headers.get('cookie'));
  } catch (e) {
    console.log('MIDDLEWARE: error reading cookies', e);
  }

  // Allow a simple dev bypass when running locally with the mock auth client.
  // The mock client sets `dev_auth=1` cookie on successful sign-in.
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

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Important: refresh response so downstream sees new cookies
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Protect all /admin routes except /admin/login
  if (isAdminPath(request.nextUrl.pathname) && !isAdminLogin(request.nextUrl.pathname)) {
    const { data, error } = await supabase.auth.getUser();
    console.log('MIDDLEWARE: supabase.auth.getUser ->', {
      user: data?.user ?? null,
      error: error ?? null,
    });

    let email: string | null = null;

    // If getUser failed due to missing session, try a best-effort cookie fallback.
    if (error || !data?.user) {
      console.log('MIDDLEWARE: getUser failed, attempting cookie fallback');
      try {
        const sbTokenCookie = request.cookies.get('sb:token')?.value;
        if (sbTokenCookie) {
          try {
            const parsed = JSON.parse(sbTokenCookie);
            email = parsed?.user?.email ?? null;
            console.log('MIDDLEWARE: parsed sb:token ->', { email });
          } catch (e) {
            console.log('MIDDLEWARE: failed parsing sb:token JSON', e);
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
                console.log('MIDDLEWARE: decoded sb-access-token ->', { email });
              }
            } catch (e) {
              console.log('MIDDLEWARE: failed decoding sb-access-token', e);
            }
          }
        }
      } catch (e) {
        console.log('MIDDLEWARE: cookie fallback error', e);
      }

      if (!email) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
        console.log('MIDDLEWARE: redirecting to /admin/login (not logged in)');
        return NextResponse.redirect(loginUrl);
      }

      // Use service role key for server-side member lookup to avoid auth restrictions.
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        console.log('MIDDLEWARE: SUPABASE_SERVICE_ROLE_KEY not set; denying access');
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.searchParams.set("reason", "no_service_key");
        return NextResponse.redirect(loginUrl);
      }

      // For the admin fallback, call PostgREST directly with the service role key
      // to avoid sending any user JWT or cookies along with the request.
      try {
        // Call our internal server API which uses the service role key server-side
        const adminApi = new URL('/api/admin/member', request.url);
        adminApi.searchParams.set('email', email);
        const res = await fetch(adminApi.toString(), { method: 'GET' });

        if (!res.ok) {
          const text = await res.text();
          console.log('MIDDLEWARE: members fetch failed ->', res.status, text);
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }

        const members = await res.json();
        const member = Array.isArray(members) ? members[0] ?? null : members;
        console.log('MIDDLEWARE: members fetch (fallback) ->', { member });

        if (!member || member.is_active !== true || member.app_role !== 'Admin') {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = '/admin/login';
          loginUrl.searchParams.set('reason', 'not_admin');
          return NextResponse.redirect(loginUrl);
        }

        // Passed fallback check — allow through
        return response;
      } catch (e) {
        console.log('MIDDLEWARE: members fetch error', e);
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

    console.log('MIDDLEWARE: members query ->', { member: member ?? null, memberErr: memberErr ?? null });

    if (
      memberErr ||
      !member ||
      member.is_active !== true ||
      member.app_role !== "Admin"
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("reason", "not_admin");
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};