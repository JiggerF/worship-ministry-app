import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { hasPermission } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";
import { updateMember, deleteMember } from "@/lib/db/members";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(actor.role as AppRole, "people", "write")) {
    return NextResponse.json({ error: "Not authorized to update members" }, { status: 403 });
  }

  const id = (await context.params).id;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  try {
    const changes: Record<string, unknown> = {};
    if (body.name !== undefined) changes.name = body.name;
    if (body.email !== undefined) changes.email = body.email;
    if (body.phone !== undefined) changes.phone = body.phone ?? null;
    if (body.app_role !== undefined) changes.app_role = body.app_role;
    if (body.is_active !== undefined) changes.is_active = body.is_active;
    if (body.roles !== undefined) changes.roles = body.roles;

    const updated = await updateMember(actor.tenantId, id, changes);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(actor.role as AppRole, "people", "delete")) {
    return NextResponse.json({ error: "Not authorized to delete members" }, { status: 403 });
  }

  const id = (await context.params).id;

  try {
    await deleteMember(actor.tenantId, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}
