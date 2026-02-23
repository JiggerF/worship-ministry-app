import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SetlistSongWithDetails, SetlistStatus } from "@/lib/types/database";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface UpsertSetlistSongPayload {
  sunday_date: string;    // YYYY-MM-DD
  song_id: string;
  position: number;       // 1–3
  chosen_key?: string | null;
  created_by?: string | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Fetch all setlist rows for a given date, joined with song + chord_charts.
 *
 * @param date        YYYY-MM-DD
 * @param publishedOnly  When true, only returns PUBLISHED rows (for public portal).
 *                       When false, returns all statuses (for authenticated WL roles).
 */
export async function getSetlist(
  date: string,
  publishedOnly: boolean = true
): Promise<SetlistSongWithDetails[]> {
  let query = supabase
    .from("sunday_setlist")
    .select(`*, song:songs(*, chord_charts(*))`)
    .eq("sunday_date", date)
    .order("position", { ascending: true });

  if (publishedOnly) {
    query = query.eq("status", "PUBLISHED");
  }

  const { data, error } = await query;
  if (error) throw new Error(`getSetlist: ${error.message}`);
  return (data ?? []) as SetlistSongWithDetails[];
}

/**
 * Upsert a song at a specific position for a Sunday.
 * Uses UNIQUE(sunday_date, position) conflict target — replaces any existing song in that slot.
 */
export async function upsertSetlistSong(
  payload: UpsertSetlistSongPayload
): Promise<SetlistSongWithDetails> {
  const row = {
    sunday_date: payload.sunday_date,
    song_id: payload.song_id,
    position: payload.position,
    chosen_key: payload.chosen_key ?? null,
    created_by: payload.created_by ?? null,
    status: "DRAFT" as SetlistStatus,
  };

  const { data, error } = await supabase
    .from("sunday_setlist")
    .upsert(row, { onConflict: "sunday_date,position" })
    .select(`*, song:songs(*, chord_charts(*))`)
    .single();

  if (error) throw new Error(`upsertSetlistSong: ${error.message}`);
  return data as SetlistSongWithDetails;
}

/**
 * Revert all songs for the given Sunday date back to DRAFT.
 */
export async function revertSetlist(date: string): Promise<void> {
  const { error } = await supabase
    .from("sunday_setlist")
    .update({ status: "DRAFT" })
    .eq("sunday_date", date);

  if (error) throw new Error(`revertSetlist: ${error.message}`);
}

/**
 * Delete a setlist row by its UUID.
 */
export async function deleteSetlistSong(id: string): Promise<void> {
  const { error } = await supabase
    .from("sunday_setlist")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`deleteSetlistSong: ${error.message}`);
}

/**
 * Publish all DRAFT songs for the given Sunday date.
 * Saving again after this call reverts them to DRAFT.
 */
export async function publishSetlist(date: string): Promise<void> {
  const { error } = await supabase
    .from("sunday_setlist")
    .update({ status: "PUBLISHED" })
    .eq("sunday_date", date);

  if (error) throw new Error(`publishSetlist: ${error.message}`);
}
