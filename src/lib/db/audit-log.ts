import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuditAction, AuditLogRow } from "@/lib/types/database";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type { AuditAction };

export interface CreateAuditLogEntry {
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  entity_type: "song" | "roster" | "setlist";
  entity_id?: string | null;
  summary: string;
}

const PAGE_SIZE = 50;

/**
 * Write an audit log entry. Silently swallows all errors so a logging
 * failure can never break the primary operation.
 */
export async function createAuditLogEntry(
  entry: CreateAuditLogEntry
): Promise<void> {
  if (!supabaseUrl || !serviceKey) {
    console.error("[audit] createAuditLogEntry: missing env vars — entry not written", {
      action: entry.action,
    });
    return;
  }
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from("audit_log").insert(entry);
    if (error) {
      console.error("[audit] createAuditLogEntry: Supabase insert failed", {
        action: entry.action,
        error: error.message,
        code: error.code,
      });
    }
  } catch (err) {
    // Intentionally swallow thrown exceptions — audit must never break primary ops
    console.error("[audit] createAuditLogEntry: unexpected exception", err);
  }
}

/**
 * Fetch a paginated page of audit log entries.
 * sortDir defaults to "desc" (newest first).
 */
export async function getAuditLog(
  page = 1,
  sortDir: "asc" | "desc" = "desc"
): Promise<{ entries: AuditLogRow[]; total: number; pageSize: number }> {
  if (!supabaseUrl || !serviceKey) {
    return { entries: [], total: 0, pageSize: PAGE_SIZE };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: sortDir === "asc" })
    .range(from, to);

  if (error) throw error;

  return {
    entries: (data as AuditLogRow[]) ?? [],
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}
