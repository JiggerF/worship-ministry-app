import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/server/platform-auth";

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/platform/tenants/[id]
 *
 * Returns full tenant detail including admin contact and enabled features.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  const { id } = await ctx.params;

  try {
    const supabase = getServiceClient();

    const [{ data: org, error: orgErr }, { data: members }, { data: features }] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, slug, is_active, settings, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("organization_members")
          .select("member_id, app_role, is_active, joined_at, members(id, name, email)")
          .eq("organization_id", id)
          .order("joined_at", { ascending: true }),
        supabase
          .from("organization_features")
          .select("enabled, feature_flags(flag_key, label)")
          .eq("organization_id", id),
      ]);

    if (orgErr || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ org, members: members ?? [], features: features ?? [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

/**
 * PATCH /api/platform/tenants/[id]
 *
 * Updates tenant metadata. Only name and is_active can be patched.
 * Body: { name?: string; is_active?: boolean }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  const { id } = await ctx.params;

  let body: { name?: string; is_active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("organizations").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
