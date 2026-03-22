import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SundayRecording, SundayRecordingWithTeam } from "@/lib/types/database";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

// ─────────────────────────────────────────────
// DB operations
// ─────────────────────────────────────────────

/**
 * Fetch all recordings for a tenant, newest first, joined with the
 * roster members for each Sunday date.
 */
export async function getRecordings(tenantId: string): Promise<SundayRecordingWithTeam[]> {
  const { data: recordings, error } = await supabase
    .from("sunday_recordings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sunday_date", { ascending: false });

  if (error) throw new Error(`getRecordings: ${error.message}`);
  if (!recordings || recordings.length === 0) return [];

  // Collect unique Sunday dates to batch-fetch roster members
  const dates = [...new Set(recordings.map((r) => r.sunday_date as string))];

  const { data: assignments, error: rosterErr } = await supabase
    .from("roster")
    .select("sunday_date:date, member:member_id(id, name)")
    .eq("tenant_id", tenantId)
    .in("date", dates)
    .not("member_id", "is", null);

  if (rosterErr) throw new Error(`getRecordings (roster): ${rosterErr.message}`);

  // Build a map: date → deduplicated member list
  type MemberRef = { id: string; name: string };
  const teamByDate = new Map<string, MemberRef[]>();

  for (const a of assignments ?? []) {
    const m = a.member as unknown as MemberRef | null;
    if (!m) continue;
    const date = a.sunday_date as string;
    const existing = teamByDate.get(date) ?? [];
    if (!existing.find((x) => x.id === m.id)) {
      existing.push({ id: m.id, name: m.name });
    }
    teamByDate.set(date, existing);
  }

  return (recordings as SundayRecording[]).map((r) => ({
    ...r,
    featured_members: teamByDate.get(r.sunday_date) ?? [],
  }));
}

export interface CreateRecordingPayload {
  title: string;
  sunday_date: string;    // YYYY-MM-DD
  recording_type: "audio" | "video";
  drive_url: string;
  duration_seconds: number | null;
  uploaded_by: string | null;
}

/**
 * Insert a new recording row scoped to the given tenant.
 */
export async function createRecording(
  tenantId: string,
  payload: CreateRecordingPayload
): Promise<SundayRecording> {
  const { data, error } = await supabase
    .from("sunday_recordings")
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single();

  if (error) throw new Error(`createRecording: ${error.message}`);
  return data as SundayRecording;
}

/**
 * Delete a recording by ID, scoped to the tenant (prevents cross-tenant IDOR).
 */
export async function deleteRecording(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("sunday_recordings")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`deleteRecording: ${error.message}`);
}
