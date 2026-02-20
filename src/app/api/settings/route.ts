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
    .eq('key', 'roster_pagination')
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ future_months: 2, history_months: 6 });
  }

  const val = data.value ?? {};
  return NextResponse.json({ future_months: val.future_months ?? 2, history_months: val.history_months ?? 6 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.future_months !== 'number' || typeof body.history_months !== 'number') {
    return NextResponse.json({ error: 'Invalid payload. Expect { future_months: number, history_months: number }' }, { status: 400 });
  }

  const payload = { future_months: body.future_months, history_months: body.history_months };

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'roster_pagination', value: payload }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...payload });
}
