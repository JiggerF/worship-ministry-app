import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getMemberByEmail } from "@/lib/db/members";
import { restoreVersion, getHandbookEditorConfig } from "@/lib/db/handbook";

/** Resolve caller email from session cookies (mirrors /api/me + /api/handbook/[slug]). */
async function resolveEmail(req: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
    });
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.email) return data.user.email;
  }

  const access = req.cookies.get("sb-access-token")?.value;
  if (access) {
    try {
      const parts = access.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload?.email) return payload.email as string;
      }
    } catch { /* ignore */ }
  }

  const sbToken = req.cookies.get("sb:token")?.value;
  if (sbToken) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sbToken));
      if (parsed?.user?.email) return parsed.user.email as string;
    } catch { /* ignore */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /api/handbook/[slug]/restore/[id]
// Creates a new current version whose content is copied from the given version id.
// Only Admin and Coordinator may restore.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  const email = await resolveEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const member = await getMemberByEmail(email);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 403 });
  }

  const { editorRoles, editorMemberIds } = await getHandbookEditorConfig();
  if (!editorRoles.includes(member.app_role as import("@/lib/types/database").AppRole) && !editorMemberIds.includes(member.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const doc = await restoreVersion(slug, id, member.id, member.name);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error(`POST /api/handbook/${slug}/restore/${id} error:`, err);
    const message = err instanceof Error ? err.message : "Failed to restore";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
