import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { getSetlist, upsertSetlistSong } from "@/lib/db/setlist";
import { createAuditLogEntry } from "@/lib/db/audit-log";
import type { AppRole } from "@/lib/types/database";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function getMaxSongsPerSetlist(): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'setlist')
      .limit(1)
      .single();
    return data?.value?.max_songs ?? 3;
  } catch {
    return 3;
  }
}

const SETLIST_ROLES: AppRole[] = ["Admin", "Coordinator", "MusicCoordinator", "WorshipLeader"];

// ─────────────────────────────────────────────
// GET /api/setlist?date=YYYY-MM-DD
//
// Public callers → PUBLISHED rows only.
// Authenticated SETLIST_ROLES → all statuses (DRAFT + PUBLISHED).
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid ?date=YYYY-MM-DD" }, { status: 400 });
  }

  const actor = await getActorFromRequest(req);
  const canSeeDrafts = actor !== null && SETLIST_ROLES.includes(actor.role as AppRole);

  try {
    const rows = await getSetlist(date, /* publishedOnly */ !canSeeDrafts);
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/setlist
//
// Upserts a song into a position for a Sunday date.
// Requires SETLIST_ROLES. Saving always resets status to DRAFT.
//
// Body: { sunday_date, song_id, position, chosen_key? }
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  if (!actor || !SETLIST_ROLES.includes(actor.role as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sunday_date, song_id, position, chosen_key } = body as {
    sunday_date?: string;
    song_id?: string;
    position?: number;
    chosen_key?: string | null;
  };

  if (!sunday_date || !/^\d{4}-\d{2}-\d{2}$/.test(sunday_date)) {
    return NextResponse.json({ error: "Missing or invalid sunday_date (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!song_id) {
    return NextResponse.json({ error: "Missing song_id" }, { status: 400 });
  }
  const maxSongs = await getMaxSongsPerSetlist();
  if (position === undefined || position === null || position < 1 || position > maxSongs) {
    return NextResponse.json({ error: `position must be between 1 and ${maxSongs}` }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    const row = await upsertSetlistSong({
      sunday_date,
      song_id,
      position,
      chosen_key: chosen_key ?? null,
      created_by: UUID_RE.test(actor.id ?? "") ? actor.id : null,
    });

    // Audit: fire-and-forget pattern (swallow errors — audit must never break primary ops)
    try {
      await createAuditLogEntry({
        actor_id: actor.id ?? null,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "update_setlist",
        entity_type: "setlist",
        entity_id: sunday_date,
        summary: `Updated setlist for ${sunday_date} (position ${position})`,
      });
    } catch { /* intentionally swallow */ }

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
