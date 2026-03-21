import { NextRequest, NextResponse } from "next/server";
import { generateMagicToken } from "@/lib/db/members";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ["Admin", "Coordinator"];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  // Only Admin / Coordinator can regenerate magic tokens
  const actor = await getActorFromRequest(req);
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = context?.params;
  const id: string = typeof (p as Promise<{ id: string }>).then === "function"
    ? (await (p as Promise<{ id: string }>)).id
    : (p as { id: string }).id;

  // Verify the target member belongs to the caller's tenant.
  // Prevents an admin from one tenant regenerating tokens for members of another.
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("member_id")
      .eq("organization_id", actor.tenantId)
      .eq("member_id", id)
      .maybeSingle();

    if (!orgMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
  }

  const token = await generateMagicToken(id);
  return NextResponse.json({ token });
}
