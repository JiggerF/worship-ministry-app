import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { revertSetlist } from "@/lib/db/setlist";
import type { AppRole } from "@/lib/types/database";

const SETLIST_ROLES: AppRole[] = ["Admin", "Coordinator", "MusicCoordinator", "WorshipLeader"];

// ─────────────────────────────────────────────
// PATCH /api/setlist/[date]/revert
//
// Reverts all PUBLISHED songs for a Sunday back to DRAFT.
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
    await revertSetlist(date);
    return NextResponse.json({ reverted: true, date });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
