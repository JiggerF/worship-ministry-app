import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/server/platform-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/platform/tenants/[id]/resend-invite
 *
 * Body: { email: string }
 *
 * Re-sends the Supabase invite email for a tenant member so they can set
 * (or reset) their password via the magic link. Requires platform admin auth.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  const { id } = await ctx.params;

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify the member actually belongs to this org before sending
    const { data: membership } = await supabase
      .from("organization_members")
      .select("member_id, members!inner(email)")
      .eq("organization_id", id)
      .eq("members.email", email)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "member_not_in_org" }, { status: 404 });
    }

    // Re-send invite via Supabase Auth admin API
    const { error } = await supabase.auth.admin.inviteUserByEmail(email);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
