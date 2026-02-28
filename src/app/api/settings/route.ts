import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

export async function GET() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['roster_pagination', 'setlist']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const pagination = rows.find((r) => r.key === 'roster_pagination')?.value ?? {};
  const setlist = rows.find((r) => r.key === 'setlist')?.value ?? {};

  return NextResponse.json({
    future_months: pagination.future_months ?? 2,
    history_months: pagination.history_months ?? 6,
    max_songs_per_setlist: setlist.max_songs ?? 3,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let hasUpdate = false;

  if (typeof body.future_months === 'number' || typeof body.history_months === 'number') {
    // Fetch existing pagination values so we can merge rather than overwrite
    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'roster_pagination')
      .limit(1)
      .single();
    const prev = existing?.value ?? {};
    const paginationPayload = {
      future_months: typeof body.future_months === 'number' ? body.future_months : (prev.future_months ?? 2),
      history_months: typeof body.history_months === 'number' ? body.history_months : (prev.history_months ?? 6),
    };
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'roster_pagination', value: paginationPayload }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    hasUpdate = true;
  }

  if (typeof body.max_songs_per_setlist === 'number') {
    if (body.max_songs_per_setlist < 1 || body.max_songs_per_setlist > 10) {
      return NextResponse.json({ error: 'max_songs_per_setlist must be between 1 and 10' }, { status: 400 });
    }
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'setlist', value: { max_songs: body.max_songs_per_setlist } }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    hasUpdate = true;
  }

  if (!hasUpdate) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
