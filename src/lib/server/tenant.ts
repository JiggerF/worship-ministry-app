import "server-only";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic UUID for Church #1 (WCC Worship Ministry).
 * Matches the value seeded in migration 019 and used as the FK default in 020.
 * Safe to hard-code — this value is permanent and stable.
 */
export const WCC_TENANT_ID = "00000000-0000-0000-0000-000000000001";

// ─────────────────────────────────────────────────────────────────────────────
// Kill Switch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true only when the MULTI_TENANT_ENABLED env var is explicitly "true".
 * Defaults to false (single-tenant mode) so the kill switch is on by default.
 */
export function isMultiTenantEnabled(): boolean {
  return process.env.MULTI_TENANT_ENABLED === "true";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the tenant_id for the current request. Fail-closed.
 *
 * Behaviour by mode:
 *
 * - MULTI_TENANT_ENABLED=false (default / kill switch):
 *   Returns the hardcoded WCC org UUID. All existing queries continue to
 *   work without any infrastructure changes — the `.eq("tenant_id", id)` just
 *   filters to the same single tenant that owns all existing rows.
 *
 * - MULTI_TENANT_ENABLED=true:
 *   Reads x-tenant-id from the request headers. This header is injected
 *   exclusively by middleware (which strips any client-supplied version first).
 *   Throws if the header is absent — that indicates middleware mis-configuration,
 *   and we want a hard 500 rather than a silent data leak.
 *
 * @throws {Error} when multi-tenancy is enabled but x-tenant-id is missing
 */
export function getTenantId(req: NextRequest): string {
  if (!isMultiTenantEnabled()) {
    return WCC_TENANT_ID;
  }

  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) {
    throw new Error(
      "[getTenantId] x-tenant-id header is absent. " +
        "This indicates middleware mis-configuration — the header must be injected " +
        "by middleware before reaching any API route."
    );
  }
  return tenantId;
}
