import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuditLogEntry } from "@/lib/db/audit-log";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");

/**
 * POST /api/auth/login
 *
 * Accepts { email, password }, authenticates via Supabase, sets auth cookies
 * server-side, and writes a login audit event. All app_roles are tracked.
 *
 * Returns:
 *   200 { success: true }   — authenticated, cookies set
 *   400 { error: string }   — missing body / credentials
 *   401 { error: string }   — invalid credentials from Supabase
 *   500 { error: string }   — unexpected failure
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  // Use the anon key for auth — Supabase auth API requires it.
  const supabase = createClient(supabaseUrl!, anonKey!);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Authentication failed" },
      { status: 401 }
    );
  }

  const { access_token, refresh_token } = data.session;

  // Build the success response and set cookies server-side (secure, httpOnly in prod).
  const res = NextResponse.json({ success: true });

  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions = {
    path: "/",
    httpOnly: false, // keep false — client login page reads these for its cookie pattern
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  res.cookies.set("sb-access-token", access_token, cookieOptions);
  res.cookies.set("sb-refresh-token", refresh_token, {
    ...cookieOptions,
    httpOnly: true, // refresh token should be httpOnly
  });

  try {
    const serialized = encodeURIComponent(JSON.stringify(data.session));
    res.cookies.set("sb:token", serialized, cookieOptions);
  } catch {
    // ignore serialization failure — access token is the primary auth mechanism
  }

  // ── Audit: log login event for all roles ──────────────────────────────────
  // Look up the member record via service role key to get actor identity.
  // Fire-and-forget: awaited but errors are fully swallowed so auth is never blocked.
  if (serviceKey) {
    try {
      const serviceClient = createClient(supabaseUrl!, serviceKey);
      const { data: memberData } = await serviceClient
        .from("members")
        .select("id, name, app_role")
        .eq("email", body.email)
        .single();

      if (memberData) {
        const member = memberData as { id: string; name: string; app_role: string };
        await createAuditLogEntry({
          actor_id: member.id,
          actor_name: member.name,
          actor_role: member.app_role,
          action: "login",
          entity_type: "auth",
          entity_id: member.id,
          summary: `${member.name} (${member.app_role}) signed in`,
        });
      }
    } catch {
      // Intentionally swallow — audit must never block login
    }
  }

  return res;
}
