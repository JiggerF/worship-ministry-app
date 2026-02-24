import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { deleteSetlistSong } from "@/lib/db/setlist";
import { createAuditLogEntry } from "@/lib/db/audit-log";
import type { AppRole } from "@/lib/types/database";

const SETLIST_ROLES: AppRole[] = ["Admin", "Coordinator", "MusicCoordinator", "WorshipLeader"];

// ─────────────────────────────────────────────
// DELETE /api/setlist/[id]
//
// Removes a setlist entry by its UUID.
// Requires SETLIST_ROLES.
// ─────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || !SETLIST_ROLES.includes(actor.role as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deleteSetlistSong(id);

    try {
      await createAuditLogEntry({
        actor_id: actor.id ?? null,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "delete_setlist_song",
        entity_type: "setlist",
        entity_id: id,
        summary: `Removed song from setlist (row ${id})`,
      });
    } catch { /* intentionally swallow */ }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
