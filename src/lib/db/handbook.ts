import "server-only";
import { createClient } from "@supabase/supabase-js";
import type {
  HandbookDocument,
  HandbookMeta,
  SaveHandbookPayload,
} from "@/lib/types/handbook";
import { versionLabel } from "@/lib/types/handbook";
import type { AppRole } from "@/lib/types/database";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "handbook_documents";
const DEFAULT_EDITOR_ROLES: AppRole[] = ["Admin", "Coordinator"];

export interface HandbookEditorConfig {
  editorRoles: AppRole[];
  editorMemberIds: string[];
}

/**
 * Returns the roles and individual member IDs permitted to edit handbook documents.
 * Admin is always included in editorRoles regardless of stored value.
 */
export async function getHandbookEditorConfig(): Promise<HandbookEditorConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "handbook_permissions")
    .single();

  if (error || !data) return { editorRoles: DEFAULT_EDITOR_ROLES, editorMemberIds: [] };

  const roles = data.value?.editor_roles;
  const memberIds = data.value?.editor_member_ids;

  const editorRoles: AppRole[] = Array.isArray(roles)
    ? (Array.from(new Set(["Admin" as AppRole, ...(roles as AppRole[])])) as AppRole[])
    : DEFAULT_EDITOR_ROLES;

  const editorMemberIds: string[] = Array.isArray(memberIds) ? (memberIds as string[]) : [];

  return { editorRoles, editorMemberIds };
}

/** Returns metadata for all current documents (no content). */
export async function getHandbookMeta(): Promise<HandbookMeta[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, slug, title, major_version, minor_version, created_by_name, created_at"
    )
    .eq("is_current", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as HandbookMeta[];
}

/** Returns the current document for a slug, including full content. */
export async function getCurrentDoc(
  slug: string
): Promise<HandbookDocument | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("is_current", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw new Error(error.message);
  }
  return data as HandbookDocument;
}

/** Returns all versions for a slug, newest first. Used by MVP2 history panel. */
export async function getDocHistory(slug: string): Promise<HandbookDocument[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .order("major_version", { ascending: false })
    .order("minor_version", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as HandbookDocument[];
}

/**
 * Saves a new version of a document.
 * - Computes the next version number from the current row.
 * - Flips is_current = false on the old row.
 * - Inserts the new row with is_current = true.
 * Both operations run sequentially — Supabase does not support multi-statement
 * transactions via the REST API, but the window of inconsistency is < 1ms.
 */
export async function saveNewVersion(
  slug: string,
  payload: SaveHandbookPayload,
  authorId: string | null,
  authorName: string | null
): Promise<HandbookDocument> {
  // 1. Fetch current row to determine next version numbers
  const current = await getCurrentDoc(slug);

  let nextMajor = 1;
  let nextMinor = 0;

  if (current) {
    if (payload.change_type === "major") {
      nextMajor = current.major_version + 1;
      nextMinor = 0;
    } else {
      nextMajor = current.major_version;
      nextMinor = current.minor_version + 1;
    }

    // 2. Flip old current → false
    const { error: flipError } = await supabase
      .from(TABLE)
      .update({ is_current: false })
      .eq("id", current.id);

    if (flipError) throw new Error(flipError.message);
  }

  // 3. Insert new version
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      slug,
      title: current?.title ?? slug,
      content: payload.content,
      major_version: nextMajor,
      minor_version: nextMinor,
      is_current: true,
      created_by: authorId,
      created_by_name: authorName,
      change_type: payload.change_type,
      what_changed: payload.what_changed,
      why_changed: payload.why_changed,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HandbookDocument;
}

/**
 * Restores an old version as a new current version.
 * Non-destructive: creates a new row with the old content.
 * The change log is auto-generated noting it was a restore.
 */
export async function restoreVersion(
  slug: string,
  versionId: string,
  authorId: string | null,
  authorName: string | null
): Promise<HandbookDocument> {
  const { data: old, error: fetchError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", versionId)
    .eq("slug", slug) // safety: confirm it belongs to this slug
    .single();

  if (fetchError || !old) {
    throw new Error(fetchError?.message ?? "Version not found");
  }

  const oldDoc = old as HandbookDocument;

  return saveNewVersion(
    slug,
    {
      content: oldDoc.content,
      change_type: "minor",
      what_changed: [
        `Restored from ${versionLabel(oldDoc)}`,
        "Content rolled back to this earlier version",
      ],
      why_changed: `Manual restore by ${authorName ?? "editor"}`,
    },
    authorId,
    authorName
  );
}
