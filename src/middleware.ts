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

    // Not logged in
    if (error || !data?.user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin authorization check (email -> members.app_role)
    const email = data.user.email;
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

    // Not in members table OR not active OR not admin
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