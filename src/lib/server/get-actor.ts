import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

/**
 * Extracts the authenticated member from the request's sb-access-token cookie.
 * Returns null when unauthenticated, in dev-bypass mode, or env vars are missing.
 * Uses the same JWT decode pattern as middleware.ts.
 */
export async function getActorFromRequest(
  req: NextRequest
): Promise<AuditActor | null> {
  // Dev bypass: if dev_auth=1 cookie is present, return a synthetic Admin actor
  // (mirrors the same bypass in middleware.ts)
  if (process.env.NODE_ENV === "development") {
    const devAuth = req.cookies.get("dev_auth")?.value;
    if (devAuth === "1") {
      return { id: "dev", name: "Dev Admin", role: "Admin" };
    }
  }

  if (!supabaseUrl || !serviceKey) return null;

  const token = req.cookies.get("sb-access-token")?.value;
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    const email: string | undefined = payload?.email;
    if (!email) return null;

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data } = await supabase
      .from("members")
      .select("id, name, app_role")
      .eq("email", email)
      .single();

    if (!data) return null;

    const row = data as { id: string; name: string; app_role: string };
    return { id: row.id, name: row.name, role: row.app_role };
  } catch {
    return null;
  }
}
