/**
 * Test helper: adds computed `permissions` to mock /api/me member objects.
 * Mirrors what the real /api/me route does with getPermissionsForRole().
 */
import { getPermissionsForRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";

/**
 * Given a mock member object with app_role, returns a new object
 * with the `permissions` field added (matching /api/me response shape).
 */
export function withPermissions<T extends { app_role: string }>(member: T): T & { permissions: ReturnType<typeof getPermissionsForRole> } {
  return {
    ...member,
    permissions: getPermissionsForRole(member.app_role as AppRole),
  };
}
