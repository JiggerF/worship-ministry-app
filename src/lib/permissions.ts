/**
 * Centralized permission system.
 *
 * Single source of truth for what each AppRole can do.
 * Per-user overrides (stored as JSONB in the DB) take precedence
 * over role defaults when provided.
 */
import type { AppRole } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Resource =
  | "people"
  | "songs"
  | "roster"
  | "setlist"
  | "availability"
  | "recordings"
  | "handbook"
  | "settings"
  | "audit"
  | "health";

export type Action = "view" | "write" | "delete";

/**
 * Per-user permission overrides stored in `members.permission_overrides`
 * or `organization_members.permission_overrides` (JSONB column).
 *
 * Only resources with overrides are present — missing resources fall back
 * to the role default.
 */
export type PermissionOverrides = Partial<Record<Resource, Action[]>>;

/** Computed permissions object returned by /api/me. */
export type Permissions = Record<Resource, Action[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCES: readonly Resource[] = [
  "people",
  "songs",
  "roster",
  "setlist",
  "availability",
  "recordings",
  "handbook",
  "settings",
  "audit",
  "health",
] as const;

export const ALL_ACTIONS: Action[] = ["view", "write", "delete"];

/** Human-readable labels for each resource (used in the Custom Permissions UI). */
export const RESOURCE_LABELS: Record<Resource, string> = {
  people: "People",
  songs: "Songs",
  roster: "Roster",
  setlist: "Setlist",
  availability: "Availability",
  recordings: "Recordings",
  handbook: "Handbook",
  settings: "Settings",
  audit: "Audit Log",
  health: "Song Health",
};

/**
 * Default permissions per role.
 *
 * Rules:
 * - Admin: full access to everything
 * - Coordinator: full roster/setlist/availability/recordings/songs/health, view-only people/handbook, no settings/audit
 * - WorshipLeader: songs+health write, setlist write, view-only roster/people/handbook/availability/recordings, no settings/audit
 * - MusicCoordinator: songs view+write, view-only people/roster/handbook/health/availability/setlist/recordings, no settings/audit
 * - Musician: no admin access
 */
export const PERMISSION_MAP: Record<AppRole, Partial<Record<Resource, Action[]>>> = {
  Admin: {
    people: ALL_ACTIONS,
    songs: ALL_ACTIONS,
    roster: ALL_ACTIONS,
    setlist: ALL_ACTIONS,
    availability: ALL_ACTIONS,
    recordings: ALL_ACTIONS,
    handbook: ALL_ACTIONS,
    settings: ALL_ACTIONS,
    audit: ALL_ACTIONS,
    health: ALL_ACTIONS,
  },
  Coordinator: {
    people: ["view"],
    songs: ["view", "write", "delete"],
    roster: ["view", "write", "delete"],
    setlist: ["view", "write"],
    availability: ["view", "write"],
    recordings: ["view", "write"],
    handbook: ["view"],
    health: ["view", "write"],
  },
  WorshipLeader: {
    people: ["view"],
    songs: ["view", "write"],
    roster: ["view"],
    setlist: ["view"],
    availability: ["view"],
    recordings: ["view"],
    handbook: ["view"],
    health: ["view", "write"],
  },
  MusicCoordinator: {
    people: ["view"],
    songs: ["view", "write"],
    roster: ["view"],
    setlist: ["view"],
    availability: ["view"],
    recordings: ["view"],
    handbook: ["view"],
    health: ["view"],
  },
  Musician: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a role (with optional per-user overrides) has a specific permission.
 *
 * Resolution order:
 * 1. If overrides exist for this resource → use override (override replaces, not merges)
 * 2. Otherwise → use role default from PERMISSION_MAP
 * 3. null role → always false
 */
export function hasPermission(
  role: AppRole | null,
  resource: Resource,
  action: Action,
  overrides?: PermissionOverrides | null,
): boolean {
  if (!role) return false;

  // Per-user override takes precedence (replaces the role default for this resource)
  if (overrides && resource in overrides) {
    return overrides[resource]?.includes(action) ?? false;
  }

  // Fall back to role defaults
  return PERMISSION_MAP[role]?.[resource]?.includes(action) ?? false;
}

/** Convenience: can this role view the resource? */
export function canView(
  role: AppRole | null,
  resource: Resource,
  overrides?: PermissionOverrides | null,
): boolean {
  return hasPermission(role, resource, "view", overrides);
}

/** Convenience: can this role write to the resource? */
export function canEdit(
  role: AppRole | null,
  resource: Resource,
  overrides?: PermissionOverrides | null,
): boolean {
  return hasPermission(role, resource, "write", overrides);
}

/** Convenience: can this role delete from the resource? */
export function canDelete(
  role: AppRole | null,
  resource: Resource,
  overrides?: PermissionOverrides | null,
): boolean {
  return hasPermission(role, resource, "delete", overrides);
}

/**
 * Compute the full permissions object for a role + overrides.
 * Returns { resource: Action[] } for every resource.
 * Used by /api/me to return computed permissions to the client.
 */
export function getPermissionsForRole(
  role: AppRole | null,
  overrides?: PermissionOverrides | null,
): Record<Resource, Action[]> {
  const result = {} as Record<Resource, Action[]>;
  for (const resource of RESOURCES) {
    const actions: Action[] = [];
    for (const action of ALL_ACTIONS) {
      if (hasPermission(role, resource, action, overrides)) {
        actions.push(action);
      }
    }
    result[resource] = actions;
  }
  return result;
}
