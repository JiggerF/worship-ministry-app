import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/server/platform-auth";

/**
 * GET /api/platform/me
 *
 * Returns the authenticated platform admin's identity.
 * Used by platform pages to verify access and display the logged-in admin name.
 *
 * 401 — not authenticated
 * 403 — authenticated but not a platform admin
 * 200 — { id, email, name, created_at }
 */
export async function GET(req: NextRequest) {
  const result = await getPlatformAdmin(req);
  if (!result.ok) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(result.admin);
}
