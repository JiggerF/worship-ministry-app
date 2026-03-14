import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { getTenantId } from "@/lib/server/tenant";
import { getMembers, createMember } from "@/lib/db/members";

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  try {
    const members = await getMembers(tenantId);
    return NextResponse.json(members);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Validate server-side via actor — never trust client-sent x-app-role header
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role === "Coordinator") {
    return NextResponse.json({ error: "Not authorized to create members" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.email || !body.name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const member = await createMember(actor.tenantId, {
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      app_role: body.app_role ?? "Musician",
      magic_token: body.magic_token ?? crypto.randomUUID(),
      is_active: body.is_active ?? true,
      roles: Array.isArray(body.roles) ? body.roles : [],
    });
    return NextResponse.json(member);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}
