import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

export async function GET(req: NextRequest) {
  // Return songs joined with chord_charts
  const { data, error } = await supabase
    .from("songs")
    .select(`*, chord_charts(*)`)
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const songPayload = {
    title: body.title,
    artist: body.artist ?? null,
    status: body.status ?? "approved",
    categories: body.categories ?? null,
    youtube_url: body.youtube_url ?? null,
    scripture_anchor: body.scripture_anchor ?? null,
    created_at: new Date().toISOString(),
  };

  const { data: songData, error: insertError } = await supabase.from("songs").insert(songPayload).select().single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Insert chord charts if provided
  if (Array.isArray(body.chord_charts) && body.chord_charts.length > 0) {
    const charts = body.chord_charts.map((c: any) => ({
      song_id: songData.id,
      key: c.key,
      file_url: c.file_url ?? null,
      storage_path: c.storage_path ?? null,
      created_at: new Date().toISOString(),
    }));
    const { error: chartsErr } = await supabase.from("chord_charts").insert(charts);
    if (chartsErr) return NextResponse.json({ error: chartsErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, song: songData });
}
