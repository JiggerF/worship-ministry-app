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