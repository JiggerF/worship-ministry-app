import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
}
if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceKey);

// ─────────────────────────────────────────────
// Role assignment helpers
// ─────────────────────────────────────────────

async function getRoleIds(roleNames: string[]): Promise<number[]> {
  if (roleNames.length === 0) return [];
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .in("name", roleNames);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.id as number);
}

async function saveRoleAssignments(memberId: string, roleNames: string[]) {
  const { error: delErr } = await supabase
    .from("member_role_assignments")
    .delete()
    .eq("member_id", memberId);
  if (delErr) throw delErr;

  if (roleNames.length === 0) return;

  const roleIds = await getRoleIds(roleNames);
  if (roleIds.length === 0) return;

  const assignments = roleIds.map((role_id) => ({ member_id: memberId, role_id }));
  const { error } = await supabase.from("member_role_assignments").insert(assignments);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Member queries
// ─────────────────────────────────────────────

/**
 * Regenerate magic token (lifetime token model)
 */
export async function regenerateMagicToken(memberId: string) {
  const { data, error } = await supabase
    .from("members")
    .update({ magic_token: randomUUID() })
    .eq("id", memberId)
    .select("magic_token")
    .single();

  if (error) throw error;
  return (data as { magic_token: string }).magic_token;
}

/**
 * Lookup member by magic token
 */
export async function getMemberByMagicToken(token: string) {
  const { data, error } = await supabase
    .from("members")
    .select("id, name, is_active")
    .eq("magic_token", token)
    .single();

  if (error || !data || !(data as any).is_active) return null;

  return {
    id: (data as any).id as string,
    name: (data as any).name as string,
  };
}

/**
 * Get availability rows for a member
 */
export async function getAvailabilityByMemberId(memberId: string) {
  const { data, error } = await supabase
    .from("availability")
    .select("date, status, preferred_role, notes")
    .eq("member_id", memberId);

  if (error) throw error;
  return data ?? [];
}

/**
 * Upsert availability per date
 */
export async function upsertAvailability(
  memberId: string,
  entries: {
    date: string;
    status: "AVAILABLE" | "UNAVAILABLE";
    preferred_role?: number | null;
    notes?: string | null;
  }[]
) {
  const payload = entries.map((e) => ({
    member_id: memberId,
    date: e.date,
    status: e.status,
    preferred_role: e.preferred_role ?? null,
    notes: e.notes ?? null,
  }));

  const { error } = await supabase
    .from("availability")
    .upsert(payload, { onConflict: "member_id,date" });

  if (error) throw error;

  return { ok: true };
}

// ─────────────────────────────────────────────
// CRUD — used by API routes
// ─────────────────────────────────────────────

function extractRoles(row: any): string[] {
  return (row.member_role_assignments ?? [])
    .map((a: any) => a.roles?.name)
    .filter(Boolean);
}

export async function getMembers() {
  const { data, error } = await supabase
    .from("members")
    .select(
      "id, name, email, phone, app_role, magic_token, is_active, created_at, member_role_assignments(roles(name))"
    )
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    app_role: row.app_role,
    magic_token: row.magic_token,
    is_active: row.is_active,
    created_at: row.created_at,
    roles: extractRoles(row),
  }));
}

export async function createMember(payload: Partial<any>) {
  const { roles: roleNames, ...memberData } = payload;

  const { data, error } = await supabase
    .from("members")
    .insert({
      ...memberData,
      magic_token: memberData.magic_token ?? randomUUID(),
    })
    .select()
    .single();

  if (error) throw error;

  const member = data as any;
  if (Array.isArray(roleNames) && roleNames.length > 0) {
    await saveRoleAssignments(member.id, roleNames);
  }

  return { ...member, roles: roleNames ?? [] };
}

export async function getMember(id: string) {
  const { data, error } = await supabase
    .from("members")
    .select(
      "id, name, email, phone, app_role, magic_token, is_active, created_at, member_role_assignments(roles(name))"
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return { ...(data as any), roles: extractRoles(data) };
}

export async function getMemberByEmail(email: string) {
  const { data, error } = await supabase
    .from("members")
    .select("id, name, email, phone, app_role, magic_token, is_active, created_at")
    .eq("email", email)
    .single();

  if (error) throw error;
  return { ...(data as any), roles: [] };
}

export async function updateMember(id: string, changes: Partial<any>) {
  const { roles: roleNames, ...memberData } = changes;

  const { data, error } = await supabase
    .from("members")
    .update({ ...memberData })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (Array.isArray(roleNames)) {
    await saveRoleAssignments(id, roleNames);
  }

  return { ...(data as any), roles: roleNames ?? [] };
}

export async function deleteMember(id: string) {
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function generateMagicToken(memberId: string) {
  return regenerateMagicToken(memberId);
}
