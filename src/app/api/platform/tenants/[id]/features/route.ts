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
 * GET /api/platform/tenants/[id]/features
 *
 * Returns all feature flags with their enabled/disabled state for this tenant.
 * Merges global feature_flags with organization_features overrides.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  const { id } = await ctx.params;

  try {
    const supabase = getServiceClient();

    const [{ data: allFlags }, { data: overrides }] = await Promise.all([
      supabase
        .from("feature_flags")
        .select("id, flag_key, label, description, default_enabled")
        .order("flag_key"),
      supabase
        .from("organization_features")
        .select("flag_id, enabled")
        .eq("organization_id", id),
    ]);

    const overrideMap = new Map(
      (overrides ?? []).map((o) => [o.flag_id, o.enabled])
    );

    const merged = (allFlags ?? []).map((flag) => ({
      ...flag,
      enabled:
        overrideMap.has(flag.id) ? overrideMap.get(flag.id) : flag.default_enabled,
    }));

    return NextResponse.json(merged);
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

/**
 * PUT /api/platform/tenants/[id]/features
 *
 * Upserts a feature flag override for this tenant.
 * Body: { flag_key: string; enabled: boolean }
 */
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  const { id } = await ctx.params;

  let body: { flag_key?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.flag_key !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "flag_key (string) and enabled (boolean) are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getServiceClient();

    // Resolve flag_key → flag_id
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("id")
      .eq("flag_key", body.flag_key)
      .maybeSingle();

    if (!flag) {
      return NextResponse.json({ error: `Unknown flag: ${body.flag_key}` }, { status: 404 });
    }

    const { error } = await supabase
      .from("organization_features")
      .upsert(
        { organization_id: id, flag_id: flag.id, enabled: body.enabled },
        { onConflict: "organization_id,flag_id" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
