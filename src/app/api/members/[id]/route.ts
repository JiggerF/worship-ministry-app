import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
const supabase = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  const id = (await context.params).id;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  try {
    const updateFields: Record<string, unknown> = {};
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.email !== undefined) updateFields.email = body.email;
    if (body.phone !== undefined) updateFields.phone = body.phone ?? null;
    if (body.app_role !== undefined) updateFields.app_role = body.app_role;
    if (body.is_active !== undefined) updateFields.is_active = body.is_active;

    if (Object.keys(updateFields).length > 0) {
      const { data: updated, error: updErr } = await supabase.from("members").update(updateFields).eq("id", id).select().single();
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      // If roles not provided, return early
      if (!Array.isArray(body.roles)) return NextResponse.json({ ...updated, roles: [] });
    }

    // Handle roles assignment if provided (array of role names)
    if (Array.isArray(body.roles)) {
      // Fetch role ids by name
      const { data: roles } = await supabase.from("roles").select("id,name").in("name", body.roles);
      // Remove existing assignments for member
      await supabase.from("member_roles").delete().eq("member_id", id);
      const rows = (roles ?? []).map((r: { id: number }) => ({ member_id: id, role_id: r.id }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("member_roles").insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    // Return current member with roles
    const { data: member } = await supabase.from("members").select("*").eq("id", id).single();
    const { data: assignments } = await supabase.from("member_roles").select("role_id").eq("member_id", id);
    const { data: allRoles } = await supabase.from("roles").select("id,name");
    const roleMap = new Map<number, string>();
    (allRoles ?? []).forEach((r: { id: number; name: string }) => roleMap.set(r.id, r.name));
    const roleNames = (assignments ?? []).map((a: { role_id: number }) => roleMap.get(a.role_id)).filter(Boolean);

    return NextResponse.json({ ...member, roles: roleNames });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e?.message ?? String(err) }, { status: 500 });
  }
}