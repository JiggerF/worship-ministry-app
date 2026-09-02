import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { hasPermission, RESOURCES } from "@/lib/permissions";
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
    if (body.permission_overrides !== undefined) {
      // Validate: must be null or Record<Resource, Action[]>
      const po = body.permission_overrides;
      if (po !== null) {
        if (typeof po !== "object" || Array.isArray(po)) {
          return NextResponse.json({ error: "permission_overrides must be an object or null" }, { status: 400 });
        }
        const validActions = ["view", "write", "delete"];
        const resourceNames = RESOURCES as readonly string[];
        for (const [key, val] of Object.entries(po)) {
          if (!resourceNames.includes(key)) {
            return NextResponse.json({ error: `Invalid resource in permission_overrides: ${key}` }, { status: 400 });
          }
          if (!Array.isArray(val) || !val.every((a: unknown) => typeof a === "string" && validActions.includes(a))) {
            return NextResponse.json({ error: `Invalid actions for resource ${key}` }, { status: 400 });
          }
        }
      }
      changes.permission_overrides = po;
    }

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
