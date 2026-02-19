import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

type RosterStatus = "DRAFT" | "LOCKED";

/* ----------------------------- */
/* Helpers                       */
/* ----------------------------- */

function parseMonth(month: string | null) {
  if (!month) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) return null;

  return { year, month: monthNum };
}

function getMonthRange(year: number, month1to12: number) {
  const start = `${year}-${String(month1to12).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month1to12, 0)); // last day of month
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(endDate.getUTCDate()).padStart(2, "0")}`;

  return { start, end };
}

/* ----------------------------- */
/* GET - Load Roster             */
/* ----------------------------- */

export async function GET(req: NextRequest) {
  const monthParam = req.nextUrl.searchParams.get("month");
  const parsed = parseMonth(monthParam);

  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid month format (YYYY-MM required)" },
      { status: 400 }
    );
  }

  const { start, end } = getMonthRange(parsed.year, parsed.month);

  const { data, error } = await supabase
    .from("roster")
    .select(
      `
      id,
      date,
      role_id,
      member_id,
      status,
      assigned_at,
      locked_at,
      members:member_id ( id, name ),
      roles:role_id ( id, name )
    `
    )
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true })
    .order("role_id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assignments = (data ?? []).map((row: any) => ({
    id: row.id,
    date: row.date,
    member_id: row.member_id,
    status: row.status,
    role: row.roles ?? null,      // { id, name: MemberRole }
    member: row.members ?? null,  // { id, name } | null
  }));
  return NextResponse.json({ assignments });
}

/* ----------------------------- */
/* POST - Save Draft             */
/* ----------------------------- */
/**
 * Body:
 * {
 *   assignments: Array<{
 *     date: "YYYY-MM-DD",
 *     role_id: number,
 *     member_id: string | null
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.assignments)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = body.assignments.map((a: any) => ({
    date: a.date,
    role_id: a.role_id,
    member_id: a.member_id ?? null,
    status: "DRAFT" as RosterStatus,
    assigned_at: new Date().toISOString(),
    locked_at: null,
  }));

  const { error } = await supabase
    .from("roster")
    .upsert(payload, { onConflict: "date,role_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ----------------------------- */
/* PATCH - Lock Month            */
/* ----------------------------- */
/**
 * Body: { month: "YYYY-MM" }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.month) {
    return NextResponse.json({ error: "Missing month" }, { status: 400 });
  }

  const parsed = parseMonth(body.month);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid month format (YYYY-MM)" },
      { status: 400 }
    );
  }

  const { start, end } = getMonthRange(parsed.year, parsed.month);

  const { error } = await supabase
    .from("roster")
    .update({
      status: "LOCKED" as RosterStatus,
      locked_at: new Date().toISOString(),
    })
    .gte("date", start)
    .lte("date", end);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}