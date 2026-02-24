import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface AuditActor {
  id: string | null;
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
      return { id: null, name: "Dev Admin", role: "Admin" };
    }
  }

  if (!supabaseUrl || !serviceKey) {
    console.error("[audit] getActorFromRequest: missing env vars", {
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceKey,
    });
    return null;
  }

  const token = req.cookies.get("sb-access-token")?.value;
  if (!token) {
    const cookieNames = req.cookies.getAll().map((c) => c.name);
    console.error("[audit] getActorFromRequest: sb-access-token cookie missing", {
      presentCookies: cookieNames,
    });
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.error("[audit] getActorFromRequest: token is not a valid JWT (wrong part count)", {
        partCount: parts.length,
      });
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    const email: string | undefined = payload?.email;
    if (!email) {
      console.error("[audit] getActorFromRequest: JWT payload has no email field", {
        payloadKeys: Object.keys(payload ?? {}),
      });
      return null;
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from("members")
      .select("id, name, app_role")
      .eq("email", email)
      .single();

    if (error || !data) {
      console.error("[audit] getActorFromRequest: member lookup returned no data", {
        email,
        supabaseError: error?.message ?? null,
      });
      return null;
    }

    const row = data as { id: string; name: string; app_role: string };
    return { id: row.id, name: row.name, role: row.app_role };
  } catch (err) {
    console.error("[audit] getActorFromRequest: unexpected exception", err);
    return null;
  }
}
