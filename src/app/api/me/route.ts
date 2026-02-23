import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getMemberByEmail } from "@/lib/db/members";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  let email: string | null = null;

  // Primary: use createServerClient (works when @supabase/ssr manages cookies)
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (!error && data?.user?.email) {
    email = data.user.email;
  }

  // Fallback: decode email from manually-set cookies (login page sets these directly)
  if (!email) {
    // Try sb-access-token (JWT — email is in the payload)
    const access = req.cookies.get("sb-access-token")?.value;
    if (access) {
      try {
        const parts = access.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          email = payload?.email ?? null;
        }
      } catch {
        // ignore malformed JWT
      }
    }
  }

  if (!email) {
    // Try sb:token (serialized session object set by the login page)
    const sbToken = req.cookies.get("sb:token")?.value;
    if (sbToken) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sbToken));
        email = parsed?.user?.email ?? null;
      } catch {
        // ignore
      }
    }
  }

  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const member = await getMemberByEmail(email);
    return NextResponse.json(member);
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
