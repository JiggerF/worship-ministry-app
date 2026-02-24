import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuditLogEntry } from "@/lib/db/audit-log";
import { getActorFromRequest } from "@/lib/server/get-actor";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { chord_charts, ...songFields } = body;

  // Update the song row
  const { data: songData, error: updateError } = await supabase
    .from("songs")
    .update(songFields)
    .eq("id", id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Replace chord charts: delete existing, re-insert new ones
  if (Array.isArray(chord_charts)) {
    const { error: deleteError } = await supabase.from("chord_charts").delete().eq("song_id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    if (chord_charts.length > 0) {
      const charts = chord_charts.map((c: { key: string; file_url?: string | null; storage_path?: string | null }) => ({
        song_id: id,
        key: c.key,
        file_url: c.file_url ?? null,
        storage_path: c.storage_path ?? null,
        created_at: new Date().toISOString(),
      }));
      const { error: insertError } = await supabase.from("chord_charts").insert(charts);
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Await audit before returning — fire-and-forget .then() is dropped by serverless
  // runtimes that terminate immediately after the response is sent.
  try {
    const actor = await getActorFromRequest(req);
    if (actor) {
      await createAuditLogEntry({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "update_song",
        entity_type: "song",
        entity_id: id,
        summary: `Updated song '${songData.title}'`,
      });
    }
  } catch {
    // Intentionally swallow — audit must never break the primary operation
  }

  return NextResponse.json({ success: true, song: songData });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  // Fetch title before deleting for the audit summary
  const { data: existing } = await supabase.from("songs").select("title").eq("id", id).single();

  // chord_charts will cascade delete via FK constraint
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Await audit before returning — fire-and-forget .then() is dropped by serverless
  // runtimes that terminate immediately after the response is sent.
  try {
    const actor = await getActorFromRequest(req);
    if (actor) {
      await createAuditLogEntry({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: "delete_song",
        entity_type: "song",
        entity_id: id,
        summary: `Deleted song '${(existing as { title?: string } | null)?.title ?? id}'`,
      });
    }
  } catch {
    // Intentionally swallow — audit must never break the primary operation
  }

  return NextResponse.json({ success: true });
}
