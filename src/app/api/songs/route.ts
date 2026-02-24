import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuditLogEntry } from "@/lib/db/audit-log";
import { getActorFromRequest } from "@/lib/server/get-actor";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

export async function GET(req: NextRequest) {
  // ?scope=portal hides internal_approved songs from the member-facing portal
  const scope = req.nextUrl.searchParams.get("scope");

  let query = supabase
    .from("songs")
    .select(`*, chord_charts(*)`)
    .order("title", { ascending: true });

  if (scope === "portal") {
    query = query.neq("status", "internal_approved");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  // Coordinator cannot create songs
  const role = req.headers.get("x-app-role") || req.cookies.get("app_role")?.value;
  if (role === "Coordinator") {
    return NextResponse.json({ error: "Coordinator cannot create songs" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !body.title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const songPayload = {
    title: body.title,
    artist: body.artist ?? null,
    status: body.status ?? "published",
    categories: body.categories ?? null,
    youtube_url: body.youtube_url ?? null,
    scripture_anchor: body.scripture_anchor ?? null,
    created_at: new Date().toISOString(),
  };

  const { data: songData, error: insertError } = await supabase.from("songs").insert(songPayload).select().single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Insert chord charts if provided
  if (Array.isArray(body.chord_charts) && body.chord_charts.length > 0) {
    const charts = body.chord_charts.map((c: { key: string; file_url?: string; storage_path?: string }) => ({
      song_id: songData.id,
      key: c.key,
      file_url: c.file_url ?? null,
      storage_path: c.storage_path ?? null,
      created_at: new Date().toISOString(),
    }));
    const { error: chartsErr } = await supabase.from("chord_charts").insert(charts);
    if (chartsErr) return NextResponse.json({ error: chartsErr.message }, { status: 500 });
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
        action: "create_song",
        entity_type: "song",
        entity_id: songData.id,
        summary: `Created song '${songData.title}'`,
      });
    }
  } catch {
    // Intentionally swallow — audit must never break the primary operation
  }

  return NextResponse.json({ success: true, song: songData });
}
