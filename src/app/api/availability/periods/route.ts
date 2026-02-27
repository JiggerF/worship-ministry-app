import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import {
  createPeriod,
  listPeriodsWithCounts,
} from "@/lib/db/availability-periods";

/** Two date ranges [a0,a1] and [b0,b1] overlap if a0 <= b1 AND a1 >= b0 */
function rangesOverlap(a0: string, a1: string, b0: string, b1: string) {
  return a0 <= b1 && a1 >= b0;
}

/**
 * GET /api/availability/periods
 * Returns all periods, most recent first.
 * Requires Admin or Coordinator.
 */
export async function GET(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "Admin" && actor.role !== "Coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const periods = await listPeriodsWithCounts();
    return NextResponse.json(periods);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * POST /api/availability/periods
 * Creates a new availability period.
 * Requires Admin or Coordinator.
 *
 * Body: { label, starts_on, ends_on, deadline? }
 */
export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "Admin" && actor.role !== "Coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { label, starts_on, ends_on, deadline } = body as Record<string, string | undefined>;

  if (!label || !starts_on || !ends_on) {
    return NextResponse.json(
      { error: "Missing required fields: label, starts_on, ends_on" },
      { status: 400 }
    );
  }

  // Basic date format validation
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_DATE.test(starts_on) || !ISO_DATE.test(ends_on)) {
    return NextResponse.json(
      { error: "starts_on and ends_on must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (starts_on > ends_on) {
    return NextResponse.json(
      { error: "starts_on must be before or equal to ends_on" },
      { status: 400 }
    );
  }

  // Overlap guard: reject if the new range overlaps any existing OPEN period.
  // This prevents duplicate availability data for the same Sundays, which breaks
  // the Roster availability map and confuses members with two identical magic links.
  try {
    const existing = await listPeriodsWithCounts();
    const openPeriods = existing.filter((p) => !p.closed_at);
    const conflict = openPeriods.find((p) =>
      rangesOverlap(starts_on, ends_on, p.starts_on, p.ends_on)
    );
    if (conflict) {
      return NextResponse.json(
        {
          error: `Date range overlaps the existing open period "${conflict.label}" (${conflict.starts_on} – ${conflict.ends_on}). Close it first or choose non-overlapping dates.`,
        },
        { status: 409 }
      );
    }
  } catch {
    // If the overlap check itself fails, let creation proceed — DB constraint is the final guard
  }

  try {
    const period = await createPeriod({
      label: label.trim(),
      starts_on,
      ends_on,
      deadline: deadline ?? null,
      created_by: actor.id ?? null,
    });
    return NextResponse.json(period, { status: 201 });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}
