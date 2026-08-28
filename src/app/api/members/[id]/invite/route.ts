import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { hasPermission } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(actor.role as AppRole, "people", "write")) {
    return NextResponse.json({ error: "Not authorized to send invites" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify the member belongs to the caller's tenant
    const { data: membership } = await supabase
      .from("organization_members")
      .select("member_id, members!inner(email)")
      .eq("organization_id", actor.tenantId)
      .eq("member_id", id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Member not found in organization" }, { status: 404 });
    }

    const email = (membership.members as unknown as { email: string }).email;

    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/confirm`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
