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

const TENANT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the tenant_id for the current request. Fail-closed.
 *
 * Resolution order (multi-tenant mode only):
 *   1. x-tenant-id request header — injected by middleware after stripping any
 *      client-supplied value, so it is trustworthy when present.
 *   2. sb-tenant-id cookie — stamped by /api/auth/login after org-membership
 *      validation. Fallback for environments where Next.js / Turbopack does not
 *      forward middleware-modified request headers to route handlers.
 *
 * Throws if neither source yields a valid UUID, so a misconfigured request
 * results in a hard 500 rather than a silent cross-tenant data leak.
 */
export function getTenantId(req: NextRequest): string {
  if (!isMultiTenantEnabled()) {
    return WCC_TENANT_ID;
  }

  // Primary: middleware-injected header (most requests in prod/subdomain mode)
  const headerTenant = req.headers.get("x-tenant-id");
  if (headerTenant && TENANT_UUID_RE.test(headerTenant)) {
    return headerTenant;
  }

  // Fallback: validated session cookie set at login time
  const cookieTenant = req.cookies.get("sb-tenant-id")?.value;
  if (cookieTenant && TENANT_UUID_RE.test(cookieTenant)) {
    return cookieTenant;
  }

  throw new Error(
    "[getTenantId] Could not resolve tenant: x-tenant-id header absent and " +
      "no valid sb-tenant-id cookie found. Ensure the request comes through " +
      "middleware and that the user has an active session."
  );
}
