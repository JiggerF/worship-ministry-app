import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");

// Don't throw during module load if the service role key is missing; instead
// create the client only when the key is present. This prevents Next from
// returning an HTML error page (non-JSON) which crashes the client JSON parse.
const supabase = serviceKey ? createClient(supabaseUrl, serviceKey) : null;
const USE_DEV = process.env.USE_DEV_MOCK_ROSTER === "true" || process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true";

// Simple in-memory store for dev-mode notes so the notes modal can be used
// without a service role key during local development. This is intentionally
// ephemeral and only for convenience in dev.
const devNotesStore: Record<string, { notes: string } | undefined> = {};

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
  try {
    const monthParam = req.nextUrl.searchParams.get("month");
    const parsed = parseMonth(monthParam);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid month format (YYYY-MM required)" },
        { status: 400 }
      );
    }

    // Decide whether to return the development mock based on an explicit
    // environment flag `USE_DEV_MOCK_ROSTER`. This allows devs to opt-in
    // to mock data via .env.local (recommended) and switch to real DB by
    // changing the flag without editing code.
    const useMock = process.env.USE_DEV_MOCK_ROSTER === "true";

    if (useMock) {
      // Build a list of Sundays (ISO date strings) within the requested month
      const year = parsed.year;
      const monthIdx = parsed.month - 1; // JS Date months are 0-indexed
      const sundays: string[] = [];
      // Find the first Sunday of the month
      const first = new Date(Date.UTC(year, monthIdx, 1));
      const day = first.getUTCDay();
      const offsetToSunday = (7 - day) % 7;
      const d = new Date(Date.UTC(year, monthIdx, 1 + offsetToSunday));
      while (d.getUTCMonth() === monthIdx) {
        sundays.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 7);
      }

      // Use the full development mock generator so the admin UI sees
      // realistic assignments and setlists during local development.
      const { default: makeDevRoster } = await import("@/lib/mocks/devRoster");
      const { assignments, setlists } = makeDevRoster(sundays);

      const noteKey = `roster_note:${monthParam}`;
      const notes = devNotesStore[noteKey]?.notes ?? null;

      return NextResponse.json(
        { assignments, setlists, notes, debug: { sundays, assignmentsCount: assignments.length } },
        { status: 200, headers: { "x-dev-roster": "true-v2" } }
      );
    }

    // Production/service path: require a service key
    if (!supabase) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
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

    const assignments = (data ?? []).map((row: { id: string; date: string; member_id: string; status: string; roles: unknown; members: unknown }) => ({
      id: row.id,
      date: row.date,
      member_id: row.member_id,
      status: row.status,
      role: row.roles ?? null,
      member: row.members ?? null,
    }));

    // Fetch any saved month note from app_settings key `roster_note:YYYY-MM`
    const noteKey = `roster_note:${monthParam}`;
    let note = null;
    try {
      const noteRes = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", noteKey)
        .limit(1)
        .single();
      note = noteRes?.data?.value?.notes ?? null;
    } catch {
      note = null;
    }

    return NextResponse.json({ assignments, notes: note }, { status: 200, headers: { "x-dev-roster": "false" } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
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
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.assignments)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = body.assignments.map((a: { date: string; role_id: number; member_id: string | null }) => ({
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
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }
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

  // If caller is saving notes for the month, persist into app_settings and return
  if (body.notes !== undefined) {
    const key = `roster_note:${body.month}`;
    const value = { notes: body.notes };

    if (!supabase) {
      if (USE_DEV) {
        devNotesStore[key] = value;
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const { error } = await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // If caller requested a revert action, unlock assignments for the month
  if (body.action === 'revert') {
    if (!supabase) {
      if (USE_DEV) {
        // In dev mode without a DB, we simply return success and let the client
        // update its local state (the client already includes a fallback).
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const parsedRevert = parseMonth(body.month);
    if (!parsedRevert) {
      return NextResponse.json({ error: "Invalid month format (YYYY-MM)" }, { status: 400 });
    }

    const { start, end } = getMonthRange(parsedRevert.year, parsedRevert.month);

    const { error } = await supabase
      .from("roster")
      .update({ status: "DRAFT", locked_at: null })
      .gte("date", start)
      .lte("date", end);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
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