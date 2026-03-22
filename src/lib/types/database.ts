// =====================================================
// DATABASE TYPES — MUST MATCH SUPABASE SCHEMA EXACTLY
// =====================================================

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type AppRole = "Admin" | "Coordinator" | "Musician" | "MusicCoordinator" | "WorshipLeader";

export type RosterStatus = "DRAFT" | "LOCKED";

export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";

export type SetlistStatus = "DRAFT" | "PUBLISHED";

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
// MULTI-TENANT TYPES
// ─────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
}

/**
 * Per-tenant membership record.
 * app_role here is the authoritative role for the (org, member) pair.
 * members.app_role is deprecated — always read app_role from this table.
 */
export interface OrganizationMember {
  organization_id: string;
  member_id: string;
  app_role: AppRole;
  is_active: boolean;
  joined_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  default_enabled: boolean;
}

export interface OrganizationFeature {
  organization_id: string;
  flag_id: string;
  enabled: boolean;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

// ─────────────────────────────────────────────
// BASE TABLE TYPES (mirror DB exactly)
// ─────────────────────────────────────────────

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /**
   * @deprecated Global role column — only used as fallback in single-tenant mode.
   * In multi-tenant mode always read app_role from organization_members for the
   * relevant (organization_id, member_id) pair.
   */
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
  tenant_id: string;
  member_id: string;
  role_id: number;
}

export interface Availability {
  id: string;
  tenant_id: string;
  member_id: string;
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  preferred_role: number | null;
  notes: string | null;
  submitted_at: string;
}

export interface RosterAssignment {
  id: string;
  tenant_id: string;
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
  tenant_id: string;
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
  tenant_id: string;
  sunday_date: string;       // YYYY-MM-DD
  song_id: string;
  position: number;          // 1–3
  chosen_key: string | null; // null → fall back to chord_charts[0].key at display/PDF time
  status: SetlistStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// HANDBOOK
// ─────────────────────────────────────────────

export type HandbookChangeType = "minor" | "major";

export interface HandbookDocument {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  content: string;
  major_version: number;
  minor_version: number;
  is_current: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  change_type: HandbookChangeType;
  what_changed: string[];
  why_changed: string;
}

// ─────────────────────────────────────────────
// /api/me RESPONSE TYPE
// ─────────────────────────────────────────────

/**
 * Shape returned by GET /api/me.
 * Extends Member with multi-tenant fields added by the route handler.
 * Use this type wherever the full /api/me response is consumed (layouts, hooks).
 *
 * app_role here is authoritative — the route resolves it from organization_members
 * for the current tenant before returning, so the @deprecated warning on Member.app_role
 * does not apply.
 */
export interface MeResponse extends Omit<Member, "app_role"> {
  /** Per-tenant authoritative role resolved by /api/me from organization_members. */
  app_role: AppRole;
  tenant_id: string;
  tenant_name: string | null;
  /** Enabled feature flag keys for the current tenant. Undefined in single-tenant mode. */
  features?: string[];
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
  | "save_roster_note"
  | "update_setlist"
  | "delete_setlist_song"
  | "publish_setlist"
  | "revert_setlist"
  | "login"
  | "logout";

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  summary: string;
}

// ─────────────────────────────────────────────
// AVAILABILITY PERIODS (coordinator-managed rounds)
// ─────────────────────────────────────────────

export interface AvailabilityPeriod {
  id: string;
  tenant_id: string;
  created_at: string;
  created_by: string | null;
  label: string;         // e.g. "April–May 2026"
  starts_on: string;     // YYYY-MM-DD
  ends_on: string;       // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DD
  closed_at: string | null;
}

export interface AvailabilityResponse {
  id: string;
  submitted_at: string;
  updated_at: string;
  period_id: string;
  member_id: string;
  notes: string | null;
  preferred_role_id: number | null;
}

export interface AvailabilityDateEntry {
  id: string;
  response_id: string;
  date: string;      // YYYY-MM-DD
  available: boolean;
}

// ─────────────────────────────────────────────
// SUNDAY RECORDINGS
// ─────────────────────────────────────────────

export type RecordingType = "audio" | "video";

export interface SundayRecording {
  id: string;
  tenant_id: string;
  title: string;
  sunday_date: string;        // YYYY-MM-DD
  recording_type: RecordingType;
  drive_url: string;          // Google Drive share link
  duration_seconds: number | null;
  uploaded_by: string | null;
  created_at: string;
}

/** SundayRecording joined with the roster members for that Sunday. */
export interface SundayRecordingWithTeam extends SundayRecording {
  featured_members: { id: string; name: string; instrument: string }[];
}