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

function extractTokenFromContext(context: any) {
  const p = context?.params;
  if (!p) return undefined;
  if (typeof p.then === "function") {
    // params is a Promise
    return p.then((resolved: any) => resolved?.token);
  }
  return p.token;
}

export async function GET(req: NextRequest, context: any) {
  const token = await extractTokenFromContext(context);
  const targetMonth = req.nextUrl.searchParams.get("targetMonth");

  if (!targetMonth) {
    return NextResponse.json(
      { error: "Missing targetMonth (YYYY-MM-01)" },
      { status: 400 }
    );
  }

  const member = await getMemberByMagicToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
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

  let roles: { id: number; name: string }[] = [];
  try {
    roles = await getMemberRoles(member.id);
  } catch {
    return NextResponse.json(
      { error: "Failed to load member roles" },
      { status: 500 }
    );
  }

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

export async function POST(req: NextRequest, context: any) {
  const token = await extractTokenFromContext(context);
  const targetMonth = req.nextUrl.searchParams.get("targetMonth");

  if (!targetMonth) {
    return NextResponse.json(
      { error: "Missing targetMonth (YYYY-MM-01)" },
      { status: 400 }
    );
  }

  const member = await getMemberByMagicToken(token);
  if (!member) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
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

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
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