import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureFlagRow {
  flag_key: string;
  default_enabled: boolean;
  organization_features: { organization_id: string; enabled: boolean }[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves whether a specific feature flag is enabled for a given tenant.
 *
 * Resolution order:
 *   1. Check organization_features for an explicit per-tenant override.
 *   2. Fall back to feature_flags.default_enabled.
 *   3. If the flag key doesn't exist: return false (fail-closed).
 *
 * Silently returns false on env/DB errors so flag resolution never crashes
 * the primary operation.
 */
export async function isFeatureEnabled(
  tenantId: string,
  flagKey: string
): Promise<boolean> {
  if (!supabaseUrl || !serviceKey) return false;

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: flag } = await supabase
      .from("feature_flags")
      .select(
        "flag_key, default_enabled, organization_features!left(organization_id, enabled)"
      )
      .eq("flag_key", flagKey)
      .maybeSingle();

    if (!flag) return false; // unknown flag — fail-closed

    const row = flag as FeatureFlagRow;
    const override = (row.organization_features ?? []).find(
      (o) => o.organization_id === tenantId
    );

    return override !== undefined ? override.enabled : row.default_enabled;
  } catch {
    return false;
  }
}

/**
 * Returns all enabled flag_keys for the given tenant.
 * Used by /api/me to populate the features[] array in the response.
 *
 * Silently returns an empty array on error so auth never breaks.
 */
export async function getEnabledFeatures(tenantId: string): Promise<string[]> {
  if (!supabaseUrl || !serviceKey) return [];

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: flags } = await supabase
      .from("feature_flags")
      .select(
        "flag_key, default_enabled, organization_features!left(organization_id, enabled)"
      )
      .order("flag_key");

    if (!flags) return [];

    return (flags as FeatureFlagRow[])
      .filter((row) => {
        const override = (row.organization_features ?? []).find(
          (o) => o.organization_id === tenantId
        );
        return override !== undefined ? override.enabled : row.default_enabled;
      })
      .map((row) => row.flag_key);
  } catch {
    return [];
  }
}
