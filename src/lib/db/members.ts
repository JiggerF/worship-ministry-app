import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────────
// Local row types (mirror Supabase query shapes)
// ─────────────────────────────────────────────

interface RoleRow { id: number; name: string; }
interface MemberAssignmentRow { roles?: { name: string } | null; }

interface MemberRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  app_role: string;
  magic_token: string;
  is_active: boolean;
  created_at: string;
  member_role_assignments?: MemberAssignmentRow[];
}

export interface MemberPayload {
  name?: string;
  email?: string;
  phone?: string | null;
  app_role?: string;
  magic_token?: string;
  is_active?: boolean;
  roles?: string[];
}

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
  return (data as RoleRow[] ?? []).map((r) => r.id);
}

/**
 * Replace all role assignments for a member within a tenant.
 * Deletes then re-inserts with tenant_id (NOT NULL since migration 020).
 */
async function saveRoleAssignments(
  memberId: string,
  tenantId: string,
  roleNames: string[]
) {
  const { error: delErr } = await supabase
    .from("member_role_assignments")
    .delete()
    .eq("member_id", memberId)
    .eq("tenant_id", tenantId);
  if (delErr) throw delErr;

  if (roleNames.length === 0) return;

  const roleIds = await getRoleIds(roleNames);
  if (roleIds.length === 0) return;

  const assignments = roleIds.map((role_id) => ({
    member_id: memberId,
    role_id,
    tenant_id: tenantId,
  }));
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
 * Lookup member by magic token (global — token is tenant-unaware)
 */
export async function getMemberByMagicToken(token: string) {
  const { data, error } = await supabase
    .from("members")
    .select("id, name, is_active")
    .eq("magic_token", token)
    .single();

  const row = data as { id: string; name: string; is_active: boolean } | null;
  if (error || !row || !row.is_active) return null;

  return {
    id: row.id,
    name: row.name,
  };
}

/**
 * Get availability rows for a member, scoped to a tenant.
 */
export async function getAvailabilityByMemberId(memberId: string, tenantId: string) {
  const { data, error } = await supabase
    .from("availability")
    .select("date, status, preferred_role, notes")
    .eq("member_id", memberId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
  return data ?? [];
}

/**
 * Upsert availability per date for a tenant.
 * onConflict changed from "member_id,date" → "tenant_id,member_id,date"
 * (migration 021 updated the UNIQUE constraint).
 */
export async function upsertAvailability(
  memberId: string,
  tenantId: string,
  entries: {
    date: string;
    status: "AVAILABLE" | "UNAVAILABLE";
    preferred_role?: number | null;
    notes?: string | null;
  }[]
) {
  const payload = entries.map((e) => ({
    tenant_id: tenantId,
    member_id: memberId,
    date: e.date,
    status: e.status,
    preferred_role: e.preferred_role ?? null,
    notes: e.notes ?? null,
  }));

  const { error } = await supabase
    .from("availability")
    .upsert(payload, { onConflict: "tenant_id,member_id,date" });

  if (error) throw error;

  return { ok: true };
}

// ─────────────────────────────────────────────
// CRUD — used by API routes
// ─────────────────────────────────────────────

function extractRoles(row: MemberRow | null): string[] {
  return (row?.member_role_assignments ?? [])
    .map((a: MemberAssignmentRow) => a.roles?.name)
    .filter(Boolean) as string[];
}

/**
 * Return all members belonging to the given tenant.
 * app_role and is_active come from organization_members (per-tenant authoritative values).
 */
export async function getMembers(tenantId: string) {
  // Step 1: obtain the per-tenant role/active state for every member in this org
  const { data: orgMembers, error: orgErr } = await supabase
    .from("organization_members")
    .select("member_id, app_role, is_active")
    .eq("organization_id", tenantId);

  if (orgErr) throw orgErr;
  if (!orgMembers?.length) return [];

  const memberIds = (orgMembers as { member_id: string; app_role: string; is_active: boolean }[])
    .map((om) => om.member_id);

  const orgRoleMap = new Map<string, { app_role: string; is_active: boolean }>(
    (orgMembers as { member_id: string; app_role: string; is_active: boolean }[]).map((om) => [
      om.member_id,
      { app_role: om.app_role, is_active: om.is_active },
    ])
  );

  // Step 2: fetch member rows + their tenant-scoped musical role assignments
  const { data, error } = await supabase
    .from("members")
    .select(
      "id, name, email, phone, magic_token, created_at, member_role_assignments(roles(name))"
    )
    .in("id", memberIds)
    .eq("member_role_assignments.tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as MemberRow[]).map((row) => {
    const orgInfo = orgRoleMap.get(row.id) ?? { app_role: "Musician", is_active: false };
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      app_role: orgInfo.app_role,    // authoritative per-tenant role
      magic_token: row.magic_token,
      is_active: orgInfo.is_active,  // authoritative per-tenant activation
      created_at: row.created_at,
      roles: extractRoles(row),
    };
  });
}

/**
 * Create a new member and add them to the given tenant.
 */
export async function createMember(tenantId: string, payload: MemberPayload) {
  const { roles: roleNames, ...memberData } = payload;

  // Insert into global members table
  const { data, error } = await supabase
    .from("members")
    .insert({
      ...memberData,
      magic_token: memberData.magic_token ?? randomUUID(),
    })
    .select()
    .single();

  if (error) throw error;

  const member = data as MemberRow;

  // Add to organization_members for this tenant
  const { error: orgErr } = await supabase.from("organization_members").insert({
    organization_id: tenantId,
    member_id: member.id,
    app_role: memberData.app_role ?? "Musician",
    is_active: memberData.is_active ?? true,
  });
  if (orgErr) throw orgErr;

  if (Array.isArray(roleNames) && roleNames.length > 0) {
    await saveRoleAssignments(member.id, tenantId, roleNames);
  }

  return { ...member, roles: roleNames ?? [] };
}

/**
 * Get a single member, verifying they belong to the tenant.
 */
export async function getMember(tenantId: string, id: string) {
  // Verify membership
  const { data: orgMember, error: orgErr } = await supabase
    .from("organization_members")
    .select("app_role, is_active")
    .eq("organization_id", tenantId)
    .eq("member_id", id)
    .maybeSingle();

  if (orgErr) throw orgErr;
  if (!orgMember) throw Object.assign(new Error("Member not found in this organization"), { code: "NOT_FOUND" });

  const { data, error } = await supabase
    .from("members")
    .select(
      "id, name, email, phone, magic_token, created_at, member_role_assignments(roles(name))"
    )
    .eq("id", id)
    .eq("member_role_assignments.tenant_id", tenantId)
    .single();

  if (error) throw error;

  const typedOrgMember = orgMember as { app_role: string; is_active: boolean };
  return {
    ...(data as unknown as MemberRow),
    app_role: typedOrgMember.app_role,
    is_active: typedOrgMember.is_active,
    roles: extractRoles(data as unknown as MemberRow),
  };
}

export async function getMemberByEmail(email: string) {
  const { data, error } = await supabase
    .from("members")
    .select("id, name, email, phone, app_role, magic_token, is_active, created_at")
    .eq("email", email)
    .single();

  if (error) throw error;
  return { ...(data as MemberRow), roles: [] as string[] };
}

/**
 * Update member fields.
 * If app_role is included in `changes`, it updates organization_members (not members.app_role).
 */
export async function updateMember(
  tenantId: string,
  id: string,
  changes: Partial<MemberPayload>
) {
  const { roles: roleNames, app_role, ...memberData } = changes;

  // Update fields on the global members table (excluding app_role — that lives in org_members)
  if (Object.keys(memberData).length > 0) {
    const { error } = await supabase
      .from("members")
      .update({ ...memberData })
      .eq("id", id);
    if (error) throw error;
  }

  // Update per-tenant role + activation on organization_members
  const orgUpdates: Record<string, unknown> = {};
  if (app_role !== undefined) orgUpdates.app_role = app_role;
  if (memberData.is_active !== undefined) orgUpdates.is_active = memberData.is_active;

  if (Object.keys(orgUpdates).length > 0) {
    const { error: orgErr } = await supabase
      .from("organization_members")
      .update(orgUpdates)
      .eq("organization_id", tenantId)
      .eq("member_id", id);
    if (orgErr) throw orgErr;
  }

  if (Array.isArray(roleNames)) {
    await saveRoleAssignments(id, tenantId, roleNames);
  }

  // Return refreshed view
  return getMember(tenantId, id);
}

/**
 * Remove a member from a tenant (removes from organization_members only).
 * The global members row and auth account are NOT deleted.
 */
export async function deleteMember(tenantId: string, id: string) {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", tenantId)
    .eq("member_id", id);
  if (error) throw error;
  return { ok: true };
}

export async function generateMagicToken(memberId: string) {
  return regenerateMagicToken(memberId);
}


// ─────────────────────────────────────────────
// Local row types (mirror Supabase query shapes)
// ─────────────────────────────────────────────

interface RoleRow { id: number; name: string; }
interface MemberAssignmentRow { roles?: { name: string } | null; }

interface MemberRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  app_role: string;
  magic_token: string;
  is_active: boolean;
  created_at: string;
  member_role_assignments?: MemberAssignmentRow[];
}

