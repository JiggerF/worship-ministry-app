// Database types matching Supabase schema

export type MemberRole =
  | "worship_lead"
  | "backup_vocals_1"
  | "backup_vocals_2"
  | "electric_guitar"
  | "acoustic_guitar"
  | "bass"
  | "keyboard"
  | "drums"
  | "percussion"
  | "setup"
  | "sound";

export type RosterStatus = "draft" | "locked";

export type AvailabilityStatus = "available" | "unavailable";

export type SongStatus = "approved" | "new_song_learning";

export type SongCategory =
  | "assurance_of_grace"
  | "gospel_salvation"
  | "call_to_worship"
  | "praise_upbeat"
  | "confession_repentance"
  | "thanksgiving";

// ── Table Row Types ──

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: MemberRole[];
  magic_token: string;
  is_active: boolean;
  created_at: string;
}

export interface Availability {
  id: string;
  member_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: AvailabilityStatus;
  preferred_role: MemberRole | null;
  notes: string | null;
  submitted_at: string;
}

export interface RosterAssignment {
  id: string;
  member_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  role: MemberRole;
  status: RosterStatus;
  assigned_by: string | null;
  assigned_at: string;
  locked_at: string | null;
}

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  status: SongStatus;
  categories: SongCategory[] | null;
  youtube_url: string | null;
  scripture_anchor: string | null;
  created_at: string;
}

export interface ChordChart {
  id: string;
  song_id: string;
  key: string;
  file_url: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface SetlistSong {
  id: string;
  sunday_date: string; // ISO date string (YYYY-MM-DD)
  song_id: string;
  position: number;
}

// ── Joined / View Types ──

export interface SongWithCharts extends Song {
  chord_charts: ChordChart[];
}

export interface SetlistSongWithDetails extends SetlistSong {
  song: SongWithCharts;
}

export interface RosterAssignmentWithMember extends RosterAssignment {
  member: Pick<Member, "id" | "name">;
}

export interface SundayRoster {
  date: string;
  status: RosterStatus | "empty";
  assignments: RosterAssignmentWithMember[];
  setlist: SetlistSongWithDetails[];
  notes: string | null;
}
