import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import {
  getPeriodDetailWithAllMembers,
  closePeriod,
  updatePeriod,
  deletePeriodIfEmpty,
  countResponsesForPeriod,
} from "@/lib/db/availability-periods";

/**
 * GET /api/availability/periods/[id]
 * Returns the period + all active musicians with their responses.
 * Requires Admin or Coordinator.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "Admin" && actor.role !== "Coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const detail = await getPeriodDetailWithAllMembers(id);
    if (!detail) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/availability/periods/[id]
 * Closes the period (sets closed_at = now).
 * Requires Admin or Coordinator.
 *
 * Body: { action: "close" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "Admin" && actor.role !== "Coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body || body.action !== "close") {
    return NextResponse.json(
      { error: 'Invalid request body. Expected { action: "close" }' },
      { status: 400 }
    );
  }

  try {
    await closePeriod(id);
    return NextResponse.json({ closed: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * PUT /api/availability/periods/[id]
 * Updates label, deadline, and (if no responses yet) starts_on / ends_on.
 * Requires Admin or Coordinator.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "Admin" && actor.role !== "Coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    label?: string;
    starts_on?: string;
    ends_on?: string;
    deadline?: string | null;
  } | null;

  if (!body?.label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  // Date changes are blocked once any musician has responded.
  const datesProvided = body.starts_on !== undefined || body.ends_on !== undefined;
  if (datesProvided) {
    const responseCount = await countResponsesForPeriod(id);
    if (responseCount > 0) {
      return NextResponse.json(
        { error: "Date range cannot be changed once responses have been collected." },
        { status: 409 }
      );
    }
  }

  try {
    await updatePeriod(id, {
      label: body.label.trim(),
      ...(body.starts_on !== undefined && { starts_on: body.starts_on }),
      ...(body.ends_on !== undefined && { ends_on: body.ends_on }),
      ...( "deadline" in body && { deadline: body.deadline }),
    });
    return NextResponse.json({ updated: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/availability/periods/[id]
 * Deletes the period only if zero responses exist.
 * Requires Admin or Coordinator.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "Admin" && actor.role !== "Coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await deletePeriodIfEmpty(id);
    if (result === "has_responses") {
      return NextResponse.json(
        { error: "Cannot delete a period that has responses. Close it instead." },
        { status: 409 }
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}
