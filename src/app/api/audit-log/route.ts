import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { hasPermission } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";
import { getAuditLog } from "@/lib/db/audit-log";

export async function GET(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  if (!actor || !hasPermission(actor.role as AppRole, "audit", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pageParam = req.nextUrl.searchParams.get("page");
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const sortParam = req.nextUrl.searchParams.get("sort");
  const sortDir: "asc" | "desc" = sortParam === "asc" ? "asc" : "desc";

  try {
    const result = await getAuditLog(actor.tenantId, page, sortDir);
    return NextResponse.json({ ...result, page });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch audit log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
