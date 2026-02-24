import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { publishSetlist } from "@/lib/db/setlist";
import type { AppRole } from "@/lib/types/database";

const SETLIST_ROLES: AppRole[] = ["Admin", "Coordinator", "MusicCoordinator", "WorshipLeader"];

// ─────────────────────────────────────────────
// PATCH /api/setlist/[date]/publish
//
// Sets all songs for the given Sunday date to PUBLISHED.
// Requires SETLIST_ROLES.
// ─────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || !SETLIST_ROLES.includes(actor.role as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: date } = await context.params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date param (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    await publishSetlist(date);
    return NextResponse.json({ published: true, date });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
