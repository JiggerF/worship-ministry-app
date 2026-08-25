/**
 * Unit tests — Permission system
 * src/lib/permissions.ts
 *
 * Verifies the centralized permission map for all 5 roles, plus
 * per-user override resolution. This is the single source of truth
 * for what each role can do.
 */
import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canView,
  canEdit,
  canDelete,
  getPermissionsForRole,
  RESOURCES,
  type Resource,
  type Action,
  type PermissionOverrides,
} from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// Role-level permission checks
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin permissions", () => {
  const role: AppRole = "Admin";

  it("has full access to every resource", () => {
    for (const resource of RESOURCES) {
      expect(hasPermission(role, resource, "view")).toBe(true);
      expect(hasPermission(role, resource, "write")).toBe(true);
      expect(hasPermission(role, resource, "delete")).toBe(true);
    }
  });
});

describe("Coordinator permissions", () => {
  const role: AppRole = "Coordinator";

  it("can view people but not write or delete", () => {
    expect(canView(role, "people")).toBe(true);
    expect(canEdit(role, "people")).toBe(false);
    expect(canDelete(role, "people")).toBe(false);
  });

  it("has full access to songs", () => {
    expect(canView(role, "songs")).toBe(true);
    expect(canEdit(role, "songs")).toBe(true);
    expect(canDelete(role, "songs")).toBe(true);
  });

  it("has full access to roster", () => {
    expect(canView(role, "roster")).toBe(true);
    expect(canEdit(role, "roster")).toBe(true);
    expect(canDelete(role, "roster")).toBe(true);
  });

  it("can view and edit setlist", () => {
    expect(canView(role, "setlist")).toBe(true);
    expect(canEdit(role, "setlist")).toBe(true);
  });

  it("can view and edit availability", () => {
    expect(canView(role, "availability")).toBe(true);
    expect(canEdit(role, "availability")).toBe(true);
  });

  it("can view and edit recordings", () => {
    expect(canView(role, "recordings")).toBe(true);
    expect(canEdit(role, "recordings")).toBe(true);
  });

  it("can view handbook but not write", () => {
    expect(canView(role, "handbook")).toBe(true);
    expect(canEdit(role, "handbook")).toBe(false);
  });

  it("cannot access settings or audit", () => {
    expect(canView(role, "settings")).toBe(false);
    expect(canView(role, "audit")).toBe(false);
  });

  it("can view and edit health", () => {
    expect(canView(role, "health")).toBe(true);
    expect(canEdit(role, "health")).toBe(true);
  });
});

describe("WorshipLeader permissions", () => {
  const role: AppRole = "WorshipLeader";

  it("can view roster but not write (Admin+Coordinator only)", () => {
    expect(canView(role, "roster")).toBe(true);
    expect(canEdit(role, "roster")).toBe(false);
  });

  it("can view and write songs but not delete", () => {
    expect(canView(role, "songs")).toBe(true);
    expect(canEdit(role, "songs")).toBe(true);
    expect(canDelete(role, "songs")).toBe(false);
  });

  it("can view people but not write", () => {
    expect(canView(role, "people")).toBe(true);
    expect(canEdit(role, "people")).toBe(false);
  });

  it("cannot access settings or audit", () => {
    expect(canView(role, "settings")).toBe(false);
    expect(canView(role, "audit")).toBe(false);
  });

  it("can view handbook but not write (default)", () => {
    expect(canView(role, "handbook")).toBe(true);
    expect(canEdit(role, "handbook")).toBe(false);
  });

  it("can view and write health", () => {
    expect(canView(role, "health")).toBe(true);
    expect(canEdit(role, "health")).toBe(true);
  });
});

describe("MusicCoordinator permissions", () => {
  const role: AppRole = "MusicCoordinator";

  it("can view and edit songs but not delete", () => {
    expect(canView(role, "songs")).toBe(true);
    expect(canEdit(role, "songs")).toBe(true);
    expect(canDelete(role, "songs")).toBe(false);
  });

  it("can view people but not write", () => {
    expect(canView(role, "people")).toBe(true);
    expect(canEdit(role, "people")).toBe(false);
  });

  it("cannot access settings or audit", () => {
    expect(canView(role, "settings")).toBe(false);
    expect(canView(role, "audit")).toBe(false);
  });
});

describe("Musician permissions", () => {
  const role: AppRole = "Musician";

  it("has no admin access to any resource", () => {
    for (const resource of RESOURCES) {
      expect(hasPermission(role, resource, "view")).toBe(false);
      expect(hasPermission(role, resource, "write")).toBe(false);
      expect(hasPermission(role, resource, "delete")).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Null / unknown role safety
// ─────────────────────────────────────────────────────────────────────────────

describe("null role handling", () => {
  it("returns false for all permissions when role is null", () => {
    expect(hasPermission(null, "people", "view")).toBe(false);
    expect(hasPermission(null, "roster", "write")).toBe(false);
    expect(canView(null, "settings")).toBe(false);
    expect(canEdit(null, "songs")).toBe(false);
    expect(canDelete(null, "people")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-user overrides
// ─────────────────────────────────────────────────────────────────────────────

describe("per-user permission overrides", () => {
  it("grants additional permissions not in the role default", () => {
    const overrides: PermissionOverrides = {
      handbook: ["view", "write"],
    };
    // WorshipLeader default: handbook view only
    expect(hasPermission("WorshipLeader", "handbook", "write")).toBe(false);
    // With override: handbook write granted
    expect(hasPermission("WorshipLeader", "handbook", "write", overrides)).toBe(true);
  });

  it("can revoke permissions that the role default grants", () => {
    const overrides: PermissionOverrides = {
      songs: ["view"], // remove write, keep view
    };
    // WorshipLeader default: songs view+write
    expect(hasPermission("WorshipLeader", "songs", "write")).toBe(true);
    // With override: songs write revoked
    expect(hasPermission("WorshipLeader", "songs", "write", overrides)).toBe(false);
    // View still works
    expect(hasPermission("WorshipLeader", "songs", "view", overrides)).toBe(true);
  });

  it("falls back to role default for resources without overrides", () => {
    const overrides: PermissionOverrides = {
      handbook: ["view", "write"],
    };
    // Roster should still follow WorshipLeader defaults (view only)
    expect(hasPermission("WorshipLeader", "roster", "view", overrides)).toBe(true);
    expect(hasPermission("WorshipLeader", "roster", "write", overrides)).toBe(false);
  });

  it("empty overrides object falls back to role defaults entirely", () => {
    const overrides: PermissionOverrides = {};
    expect(hasPermission("Coordinator", "songs", "write", overrides)).toBe(true);
  });

  it("null overrides falls back to role defaults", () => {
    expect(hasPermission("Coordinator", "songs", "write", null)).toBe(true);
    expect(hasPermission("Coordinator", "songs", "write", undefined)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPermissionsForRole — computed permissions map
// ─────────────────────────────────────────────────────────────────────────────

describe("getPermissionsForRole", () => {
  it("returns all resources with their allowed actions for Admin", () => {
    const perms = getPermissionsForRole("Admin");
    for (const resource of RESOURCES) {
      expect(perms[resource]).toContain("view");
      expect(perms[resource]).toContain("write");
      expect(perms[resource]).toContain("delete");
    }
  });

  it("returns empty arrays for Musician", () => {
    const perms = getPermissionsForRole("Musician");
    for (const resource of RESOURCES) {
      expect(perms[resource]).toEqual([]);
    }
  });

  it("merges overrides into the result", () => {
    const overrides: PermissionOverrides = {
      handbook: ["view", "write"],
    };
    const perms = getPermissionsForRole("WorshipLeader", overrides);
    expect(perms.handbook).toContain("write");
    // Non-overridden resource uses role default (roster is view-only for WorshipLeader)
    expect(perms.roster).toContain("view");
    expect(perms.roster).not.toContain("write");
  });

  it("returns empty object for null role", () => {
    const perms = getPermissionsForRole(null);
    for (const resource of RESOURCES) {
      expect(perms[resource]).toEqual([]);
    }
  });
});
