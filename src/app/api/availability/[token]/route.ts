import { NextRequest, NextResponse } from "next/server";
import { getMemberByMagicToken } from "@/lib/db/members";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";

const MELBOURNE_TZ = "Australia/Melbourne";

/* ----------------------------- */
/* Helpers                       */
/* ----------------------------- */

function getMelbourneParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month), // 1–12
    day: Number(map.day),
  };
}

function addMonths(year: number, month1to12: number, delta: number) {
  const idx = year * 12 + (month1to12 - 1) + delta;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { year: y, month: m };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function parseTargetMonth(targetMonth: string) {
  const match = /^(\d{4})-(\d{2})-01$/.exec(targetMonth);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) return null;

  return { year, month };
}

function getSundaysBetween(startIso: string, endIso: string): string[] {
  const sundays: string[] = [];
  const end = new Date(endIso + "T00:00:00Z");
  const d = new Date(startIso + "T00:00:00Z");
  // advance to first Sunday on or after start
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    sundays.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    );
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return sundays;
}

function getSundaysUTC(year: number, month1to12: number) {
  const sundays: string[] = [];
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const monthIdx = first.getUTCMonth();

  for (
    let d = new Date(first);
    d.getUTCMonth() === monthIdx;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if (d.getUTCDay() === 0) {
      sundays.push(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getUTCDate()).padStart(2, "0")}`
      );
    }
  }

  return sundays;
}

function isLocked(targetYear: number, targetMonth: number) {
  const prev = addMonths(targetYear, targetMonth, -1);
  const lockoutIso = isoDate(prev.year, prev.month, 19);

  const now = new Date();
  const mel = getMelbourneParts(now);
  const todayIso = isoDate(mel.year, mel.month, mel.day);

  return {
    locked: todayIso > lockoutIso,
    lockoutIso,
  };
}

async function getMemberRoles(memberId: string) {
  const { data: memberRoles, error: mrError } = await supabase
    .from("member_roles")
    .select("role_id")
    .eq("member_id", memberId);

  if (mrError) throw mrError;

  const roleIds = (memberRoles ?? []).map((r) => r.role_id);
  if (roleIds.length === 0) return [];

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, name")
    .in("id", roleIds)
    .order("id");

  if (rolesError) throw rolesError;

  return roles ?? [];
}

/* ----------------------------- */
/* GET                           */
/* ----------------------------- */

type RouteContext = { params: Promise<{ token: string }> | { token: string } };

function extractTokenFromContext(context: RouteContext) {
  const p = context?.params;
  if (!p) return undefined;
  if (typeof (p as Promise<{ token: string }>).then === "function") {
    return (p as Promise<{ token: string }>).then((resolved) => resolved?.token);
  }
  return (p as { token: string }).token;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const token = await extractTokenFromContext(context);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const periodId = req.nextUrl.searchParams.get("periodId");
  const targetMonth = req.nextUrl.searchParams.get("targetMonth");

  const member = await getMemberByMagicToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  let roles: { id: number; name: string }[] = [];
  try {
    roles = await getMemberRoles(member.id);
  } catch {
    return NextResponse.json({ error: "Failed to load member roles" }, { status: 500 });
  }

  /* ── Period-based mode ── */
  if (periodId) {
    const { data: period, error: periodError } = await supabase
      .from("availability_periods")
      .select("*")
      .eq("id", periodId)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const now = new Date();
    const mel = getMelbourneParts(now);
    const todayIso = isoDate(mel.year, mel.month, mel.day);
    const locked =
      period.closed_at != null ||
      (period.deadline != null && todayIso > period.deadline);
    const lockout = { locked, lockoutIso: period.deadline ?? period.ends_on };

    const sundays = getSundaysBetween(period.starts_on, period.ends_on);

    // Fetch any existing response
    const { data: responseRow } = await supabase
      .from("availability_responses")
      .select("*")
      .eq("period_id", periodId)
      .eq("member_id", member.id)
      .single();

    let availability: { date: string; status: string; preferred_role: number | null; notes: string | null }[] = [];
    let preferredRoleId: number | null = null;

    if (responseRow) {
      preferredRoleId = responseRow.preferred_role_id ?? null;
      const { data: dateRows } = await supabase
        .from("availability_dates")
        .select("date, available")
        .eq("response_id", responseRow.id);

      availability = (dateRows ?? []).map((d: { date: string; available: boolean }) => ({
        date: d.date,
        status: d.available ? "AVAILABLE" : "UNAVAILABLE",
        preferred_role: preferredRoleId,
        notes: responseRow.notes,
      }));
    }

    return NextResponse.json({
      member,
      periodLabel: period.label,
      sundays,
      availability,
      preferredRoleId,
      roles,
      lockout,
    });
  }

  /* ── Legacy T+1 mode ── */
  if (!targetMonth) {
    return NextResponse.json(
      { error: "Missing targetMonth (YYYY-MM-01) or periodId" },
      { status: 400 }
    );
  }

  const parsed = parseTargetMonth(targetMonth);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid targetMonth format" },
      { status: 400 }
    );
  }

  // Enforce T+1 model
  const now = new Date();
  const mel = getMelbourneParts(now);
  const expected = addMonths(mel.year, mel.month, 1);

  if (
    parsed.year !== expected.year ||
    parsed.month !== expected.month
  ) {
    return NextResponse.json(
      { error: "targetMonth not allowed" },
      { status: 400 }
    );
  }

  const sundays = getSundaysUTC(parsed.year, parsed.month);

  const { data: availability, error } = await supabase
    .from("availability")
    .select("date, status, preferred_role, notes")
    .eq("member_id", member.id)
    .in("date", sundays);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lockout = isLocked(parsed.year, parsed.month);

  return NextResponse.json({
    member,
    targetMonth,
    sundays,
    availability: availability ?? [],
    roles,
    lockout,
  });
}

/* ----------------------------- */
/* POST                          */
/* ----------------------------- */

export async function POST(req: NextRequest, context: RouteContext) {
  const token = await extractTokenFromContext(context);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const periodId = req.nextUrl.searchParams.get("periodId");
  const targetMonth = req.nextUrl.searchParams.get("targetMonth");

  const member = await getMemberByMagicToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  /* ── Period-based mode ── */
  if (periodId) {
    const { data: period, error: periodError } = await supabase
      .from("availability_periods")
      .select("*")
      .eq("id", periodId)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const now = new Date();
    const mel = getMelbourneParts(now);
    const todayIso = isoDate(mel.year, mel.month, mel.day);
    const locked =
      period.closed_at != null ||
      (period.deadline != null && todayIso > period.deadline);

    if (locked) {
      return NextResponse.json(
        { error: "This availability period is closed" },
        { status: 423 }
      );
    }

    const sundays = getSundaysBetween(period.starts_on, period.ends_on);
    const availableDates = new Set<string>(body.available_dates ?? []);
    const preferred_role_id = body.preferred_role_id ?? null;
    const notes = body.notes ?? null;

    for (const d of availableDates) {
      if (!sundays.includes(d)) {
        return NextResponse.json({ error: `Invalid date: ${d}` }, { status: 400 });
      }
    }

    // Upsert response header
    const { data: responseData, error: responseError } = await supabase
      .from("availability_responses")
      .upsert(
        {
          period_id: periodId,
          member_id: member.id,
          notes,
          preferred_role_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "period_id,member_id" }
      )
      .select()
      .single();

    if (responseError) {
      return NextResponse.json({ error: responseError.message }, { status: 500 });
    }

    // Replace date rows cleanly
    await supabase
      .from("availability_dates")
      .delete()
      .eq("response_id", responseData.id);

    const dateRows = sundays.map((date) => ({
      response_id: responseData.id,
      date,
      available: availableDates.has(date),
    }));

    if (dateRows.length > 0) {
      const { error: insertError } = await supabase
        .from("availability_dates")
        .insert(dateRows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  }

  /* ── Legacy T+1 mode ── */
  if (!targetMonth) {
    return NextResponse.json(
      { error: "Missing targetMonth (YYYY-MM-01) or periodId" },
      { status: 400 }
    );
  }

  const parsed = parseTargetMonth(targetMonth);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid targetMonth format" },
      { status: 400 }
    );
  }

  // Enforce T+1 model
  const now = new Date();
  const mel = getMelbourneParts(now);
  const expected = addMonths(mel.year, mel.month, 1);

  if (
    parsed.year !== expected.year ||
    parsed.month !== expected.month
  ) {
    return NextResponse.json(
      { error: "targetMonth not allowed" },
      { status: 400 }
    );
  }

  const lockout = isLocked(parsed.year, parsed.month);
  if (lockout.locked) {
    return NextResponse.json(
      { error: "Availability is locked", lockout },
      { status: 423 }
    );
  }

  const availableDates = new Set<string>(body.available_dates ?? []);
  const preferred_role_id = body.preferred_role_id ?? null;
  const notes = body.notes ?? null;

  const sundays = getSundaysUTC(parsed.year, parsed.month);

  for (const d of availableDates) {
    if (!sundays.includes(d)) {
      return NextResponse.json(
        { error: `Invalid date: ${d}` },
        { status: 400 }
      );
    }
  }

  const payload = sundays.map((date) => ({
    member_id: member.id,
    date,
    status: (availableDates.has(date)
      ? "AVAILABLE"
      : "UNAVAILABLE") as AvailabilityStatus,
    preferred_role: preferred_role_id,
    notes,
  }));

  const { error } = await supabase
    .from("availability")
    .upsert(payload, { onConflict: "member_id,date" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}