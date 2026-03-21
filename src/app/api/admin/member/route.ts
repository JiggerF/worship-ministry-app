import { NextRequest, NextResponse } from "next/server";
import { getMemberByEmail } from "@/lib/db/members";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  // Optional: when provided (multi-tenant mode), verify org membership and
  // return the per-tenant app_role instead of the deprecated global role.
  const orgId = searchParams.get("orgId");

  if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });

  try {
    const member = await getMemberByEmail(email);
    if (!member) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // When orgId is provided, verify the member belongs to that organisation and
    // return their per-tenant role. This prevents the middleware fallback path from
    // granting cross-tenant access based on the deprecated global members.app_role.
    if (orgId) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        const serviceClient = createClient(supabaseUrl, serviceKey);
        const { data: orgMember } = await serviceClient
          .from("organization_members")
          .select("app_role, is_active")
          .eq("member_id", member.id)
          .eq("organization_id", orgId)
          .maybeSingle();

        if (!orgMember || orgMember.is_active === false) {
          // Not a member of this org — block access (same as 403 in /api/me).
          return NextResponse.json({ error: "not_member_of_org" }, { status: 403 });
        }

        // Return the member with org-specific role so the middleware uses the
        // correct per-tenant role for route restriction decisions.
        return NextResponse.json({ ...member, app_role: orgMember.app_role });
      }
    }

    return NextResponse.json(member);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
