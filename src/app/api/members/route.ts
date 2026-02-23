import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
const supabase = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

export async function GET() {
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  try {
    const [{ data: members }, { data: assignments }, { data: roles }] = await Promise.all([
      supabase.from("members").select("*").order("created_at", { ascending: false }),
      supabase.from("member_roles").select("member_id,role_id"),
      supabase.from("roles").select("id,name"),
    ]);

    const roleMap = new Map<number, string>();
    (roles ?? []).forEach((r: any) => roleMap.set(r.id, r.name));

    const memberRoles = new Map<string, string[]>();
    (assignments ?? []).forEach((a: any) => {
      const arr = memberRoles.get(a.member_id) ?? [];
      const roleName = roleMap.get(a.role_id) ?? null;
      if (roleName) arr.push(roleName);
      memberRoles.set(a.member_id, arr);
    });

    const result = (members ?? []).map((m: any) => ({ ...m, roles: memberRoles.get(m.id) ?? [] }));
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Coordinator cannot create members
  const role = req.headers.get("x-app-role") || req.cookies.get("app_role")?.value;
  if (role === "Coordinator") {
    return NextResponse.json({ error: "Coordinator cannot create members" }, { status: 403 });
  }
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  const body = await req.json().catch(() => null);
  if (!body || !body.email || !body.name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const payload = {
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      app_role: body.app_role ?? "Musician",
      magic_token: body.magic_token ?? crypto.randomUUID(),
      is_active: body.is_active ?? true,
      created_at: new Date().toISOString(),
    };

    const { data: created, error: insertErr } = await supabase.from("members").insert(payload).select().single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Handle role assignments if provided (array of role names)
    if (Array.isArray(body.roles) && body.roles.length > 0) {
      const { data: roles } = await supabase.from("roles").select("id,name").in("name", body.roles);
      const rows = (roles ?? []).map((r: any) => ({ member_id: created.id, role_id: r.id }));
      if (rows.length > 0) {
        const { error: arErr } = await supabase.from("member_roles").insert(rows);
        if (arErr) return NextResponse.json({ error: arErr.message }, { status: 500 });
      }
    }

    // Return created member with roles
    const { data: assignments } = await supabase.from("member_roles").select("role_id").eq("member_id", created.id);
    const { data: allRoles } = await supabase.from("roles").select("id,name");
    const roleMap = new Map<number, string>();
    (allRoles ?? []).forEach((r: any) => roleMap.set(r.id, r.name));
    const roleNames = (assignments ?? []).map((a: any) => roleMap.get(a.role_id)).filter(Boolean);

    return NextResponse.json({ ...created, roles: roleNames });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
