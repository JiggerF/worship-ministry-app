import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase query builder pre-filtered to the given tenant.
 * The caller MUST chain .select(), .order(), etc. before awaiting.
 *
 * This helper does NOT call .select() itself — callers choose their own
 * column projections so the utility cannot inadvertently hide complex queries.
 *
 * @example
 *   const { data } = await tenantFrom(supabase, "songs", tenantId)
 *     .select("id, title")
 *     .order("title");
 */
export function tenantFrom(
  supabase: SupabaseClient,
  table: string,
  tenantId: string
) {
  // The Supabase JS runtime accepts .eq() before .select(); TypeScript types
  // model this as only valid after .select(), so we cast to bypass the
  // compile-time constraint. Callers chain .select() after this call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from(table) as any).eq("tenant_id", tenantId);
}

/**
 * Inserts one or more rows with tenant_id automatically merged in.
 * Accepts a single record or an array of records.
 *
 * @example
 *   const { data } = await tenantInsert(supabase, "songs", tenantId, {
 *     title: "Amazing Grace",
 *   }).select().single();
 */
export function tenantInsert(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  data: Record<string, unknown> | Record<string, unknown>[]
) {
  const rows = Array.isArray(data)
    ? data.map((row) => ({ ...row, tenant_id: tenantId }))
    : [{ ...data, tenant_id: tenantId }];
  return supabase.from(table).insert(rows);
}
