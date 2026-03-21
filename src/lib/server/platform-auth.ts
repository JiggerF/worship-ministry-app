import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { PlatformAdmin } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// Platform admin authentication helper
//
// Platform admins are identified by their email being present in the
// platform_admins table. They use the same Supabase Auth pool as church
// members, but are authorised separately.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the authenticated caller's email from the request cookies.
 * Returns null if no valid session can be found.
 */
async function getEmailFromRequest(req: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  // Primary: @supabase/ssr session
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll() {},
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (!error && data?.user?.email) return data.user.email;

  // Fallback: JWT in sb-access-token cookie
  const access = req.cookies.get("sb-access-token")?.value;
  if (access) {
    try {
      const parts = access.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload?.email) return payload.email as string;
      }
    } catch { /* ignore malformed JWT */ }
  }

  // Fallback: sb:token cookie
  const sbToken = req.cookies.get("sb:token")?.value;
  if (sbToken) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sbToken));
      if (parsed?.user?.email) return parsed.user.email as string;
    } catch { /* ignore */ }
  }

  return null;
}

export type PlatformAuthResult =
  | { ok: true; admin: PlatformAdmin }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Verifies the caller is a platform admin.
 *
 * Returns a discriminated result so routes can distinguish:
 *   - "unauthenticated" → 401 (no valid session)
 *   - "forbidden"       → 403 (session exists but not in platform_admins)
 *
 * Call this at the top of every /api/platform/* route handler.
 */
export async function getPlatformAdmin(req: NextRequest): Promise<PlatformAuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { ok: false, reason: "unauthenticated" };

  const email = await getEmailFromRequest(req);
  if (!email) return { ok: false, reason: "unauthenticated" };

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data } = await supabase
      .from("platform_admins")
      .select("id, email, name, created_at")
      .eq("email", email)
      .maybeSingle();
    if (!data) return { ok: false, reason: "forbidden" };
    return { ok: true, admin: data as PlatformAdmin };
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }
}

/**
 * Convenience guard for route handlers.
 * Returns a NextResponse error on failure, or null on success.
 *
 * Usage:
 *   const deny = await requirePlatformAdmin(req);
 *   if (deny) return deny;
 *   // caller is verified — proceed
 */
export async function requirePlatformAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = await getPlatformAdmin(req);
  if (!result.ok) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return null;
}
