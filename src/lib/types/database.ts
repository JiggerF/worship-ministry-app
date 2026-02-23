// =====================================================
// DATABASE TYPES — MUST MATCH SUPABASE SCHEMA EXACTLY
// =====================================================

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type AppRole = "Admin" | "Coordinator" | "Musician";

export type RosterStatus = "DRAFT" | "LOCKED";

export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";

export type SongStatus = "learning" | "internal_approved" | "published";

export type SongCategory =
  | "assurance_of_grace"
  | "gospel_salvation"
  | "call_to_worship"
  | "praise_upbeat"
  | "confession_repentance"
  | "thanksgiving"
  | "response_commitment"
  | "communion"
  | "adoration_worship";

// Roles table values
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

// ─────────────────────────────────────────────
// BASE TABLE TYPES (mirror DB exactly)
// ─────────────────────────────────────────────

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  app_role: AppRole;
  magic_token: string;
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  name: MemberRole;
}

export interface MemberRoleAssignment {
  member_id: string;
  role_id: number;
}

export interface Availability {
  id: string;
  member_id: string;
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  preferred_role: number | null;
  notes: string | null;
  submitted_at: string;
}

export interface RosterAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  role_id: number;
  member_id: string | null;
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
  sunday_date: string;
  song_id: string;
  position: number;
}

// ─────────────────────────────────────────────
// JOINED / DERIVED TYPES
// ─────────────────────────────────────────────

export interface MemberWithRoles extends Member {
  roles: MemberRole[];
}

export interface AvailabilityWithRole extends Availability {
  role?: {
    id: number;
    name: MemberRole;
  };
}

export interface RosterAssignmentWithDetails extends RosterAssignment {
  member?: Pick<Member, "id" | "name">;
  role: {
    id: number;
    name: MemberRole;
  };
}

export interface SongWithCharts extends Song {
  chord_charts: ChordChart[];
}

export interface SetlistSongWithDetails extends SetlistSong {
  song: SongWithCharts;
}

export interface SundayRoster {
  date: string;
  status: RosterStatus | "EMPTY";
  assignments: RosterAssignmentWithDetails[];
  setlist: SetlistSongWithDetails[];
  notes: string | null;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export type AuditAction =
  | "create_song"
  | "update_song"
  | "delete_song"
  | "save_roster_draft"
  | "finalize_roster"
  | "revert_roster"
  | "save_roster_note";

export interface AuditLogRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  summary: string;
}