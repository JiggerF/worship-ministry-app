import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getMemberByEmail } from "@/lib/db/members";
import type { AppRole } from "@/lib/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

const SETTING_KEY = "handbook_permissions";
const DEFAULT_EDITOR_ROLES: AppRole[] = ["Admin", "Coordinator"];
const LOCKED_ROLES: AppRole[] = ["Admin"];
const TOGGLEABLE_ROLES: AppRole[] = ["Coordinator", "WorshipLeader", "MusicCoordinator"];
const ALL_VALID_ROLES = [...LOCKED_ROLES, ...TOGGLEABLE_ROLES] as string[];

/** Resolve caller email from session cookies (same pattern as /api/me). */
async function resolveEmail(req: NextRequest): Promise<string | null> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anon) {
    const client = createServerClient(supabaseUrl, anon, {
      cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
    });
    const { data, error } = await client.auth.getUser();
    if (!error && data?.user?.email) return data.user.email;
  }

  const access = req.cookies.get("sb-access-token")?.value;
  if (access) {
    try {
      const parts = access.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload?.email) return payload.email as string;
      }
    } catch { /* ignore */ }
  }

  const sbToken = req.cookies.get("sb:token")?.value;
  if (sbToken) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sbToken));
      if (parsed?.user?.email) return parsed.user.email as string;
    } catch { /* ignore */ }
  }

  return null;
}

async function loadPermissions(): Promise<{ editor_roles: AppRole[]; editor_member_ids: string[] }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .single();

  if (error || !data) return { editor_roles: DEFAULT_EDITOR_ROLES, editor_member_ids: [] };

  const roles = data.value?.editor_roles;
  const memberIds = data.value?.editor_member_ids;

  const editor_roles: AppRole[] = Array.isArray(roles)
    ? (Array.from(new Set([...LOCKED_ROLES, ...roles.filter((r: unknown) => ALL_VALID_ROLES.includes(r as string))])) as AppRole[])
    : DEFAULT_EDITOR_ROLES;

  const editor_member_ids: string[] = Array.isArray(memberIds) ? (memberIds as string[]) : [];

  return { editor_roles, editor_member_ids };
}

// ---------------------------------------------------------------------------
// GET /api/settings/handbook-permissions
// Returns editor_roles and editor_member_ids. Any authenticated member may call this.
// ---------------------------------------------------------------------------
export async function GET() {
  const perms = await loadPermissions();
  return NextResponse.json(perms);
}

// ---------------------------------------------------------------------------
// PUT /api/settings/handbook-permissions
// Updates editor_roles and/or editor_member_ids. Only Admin may change.
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  const email = await resolveEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const member = await getMemberByEmail(email);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 403 });
  }

  if (member.app_role !== "Admin") {
    return NextResponse.json({ error: "Forbidden — only Admins can change permissions" }, { status: 403 });
  }

  let body: { editor_roles?: unknown; editor_member_ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.editor_roles)) {
    return NextResponse.json({ error: "editor_roles must be an array" }, { status: 400 });
  }
  if (!Array.isArray(body.editor_member_ids)) {
    return NextResponse.json({ error: "editor_member_ids must be an array" }, { status: 400 });
  }

  // Validate roles
  const incomingRoles = body.editor_roles as string[];
  const invalidRoles = incomingRoles.filter((r) => !ALL_VALID_ROLES.includes(r));
  if (invalidRoles.length > 0) {
    return NextResponse.json({ error: `Invalid roles: ${invalidRoles.join(", ")}` }, { status: 400 });
  }

  // Validate member IDs are UUIDs
  const incomingMemberIds = body.editor_member_ids as string[];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = incomingMemberIds.filter((id) => !uuidPattern.test(id));
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: "editor_member_ids contains invalid UUIDs" }, { status: 400 });
  }

  // Always enforce Admin role is included
  const finalRoles = Array.from(new Set([...LOCKED_ROLES, ...incomingRoles]));
  const finalMemberIds = Array.from(new Set(incomingMemberIds));

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: SETTING_KEY, value: { editor_roles: finalRoles, editor_member_ids: finalMemberIds } },
      { onConflict: "key" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ editor_roles: finalRoles, editor_member_ids: finalMemberIds });
}
