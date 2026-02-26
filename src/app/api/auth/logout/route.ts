import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { createAuditLogEntry } from "@/lib/db/audit-log";

/**
 * POST /api/auth/logout
 *
 * Reads the caller's identity from the sb-access-token cookie, writes a
 * logout audit event for all app_roles, then clears all auth cookies.
 *
 * The audit entry is attempted before cookies are cleared (so the actor can
 * still be resolved from the existing cookie). Errors are silently swallowed —
 * logout must always succeed regardless of audit failures.
 *
 * Returns:
 *   200 { success: true }
 */
export async function POST(req: NextRequest) {
  // Resolve actor identity BEFORE clearing cookies
  const actor = await getActorFromRequest(req).catch(() => null);

  // ── Audit: log logout event ───────────────────────────────────────────────
  if (actor) {
    try {
      await createAuditLogEntry({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "logout",
        entity_type: "auth",
        entity_id: actor.id,
        summary: `${actor.name} (${actor.role}) signed out`,
      });
    } catch {
      // Intentionally swallow — audit must never block logout
    }
  }

  // Clear all auth cookies on the response
  const res = NextResponse.json({ success: true });
  const clearOptions = { path: "/", maxAge: 0 };

  res.cookies.set("sb-access-token", "", clearOptions);
  res.cookies.set("sb-refresh-token", "", clearOptions);
  res.cookies.set("sb:token", "", clearOptions);
  // Also clear the dev bypass cookie if present
  res.cookies.set("dev_auth", "", clearOptions);

  return res;
}
