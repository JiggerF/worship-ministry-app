import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getMemberByEmail } from "@/lib/db/members";
import { getCurrentDoc, saveNewVersion, getHandbookEditorConfig } from "@/lib/db/handbook";
import type { SaveHandbookPayload } from "@/lib/types/handbook";

/** Resolve the caller's email from session cookies (mirrors /api/me logic). */
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

  // Fallback: JWT in sb-access-token
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

  // Fallback: sb:token serialised session
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
// GET /api/handbook/[slug]
// Returns the current document for the given slug.
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const doc = await getCurrentDoc(slug);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json(doc);
  } catch (err) {
    console.error(`GET /api/handbook/${slug} error:`, err);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/handbook/[slug]
// Saves a new version. Only Admin and Coordinator may write.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // --- Server-side role check ---
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

  // --- Payload validation ---
  let body: Partial<SaveHandbookPayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, change_type, what_changed, why_changed } = body;

  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (change_type !== "minor" && change_type !== "major") {
    return NextResponse.json(
      { error: "change_type must be 'minor' or 'major'" },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(what_changed) ||
    what_changed.length === 0 ||
    !what_changed.some((s) => typeof s === "string" && s.trim() !== "")
  ) {
    return NextResponse.json(
      { error: "what_changed is required" },
      { status: 400 }
    );
  }
  if (typeof why_changed !== "string" || why_changed.trim() === "") {
    return NextResponse.json(
      { error: "why_changed is required" },
      { status: 400 }
    );
  }

  // --- Save ---
  // Pass null for created_by: the column references auth.users(id) which differs
  // from the members table PK. We store the author's name in created_by_name instead.
  try {
    const doc = await saveNewVersion(
      slug,
      { content, change_type, what_changed, why_changed },
      null,
      member.name
    );
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error(`POST /api/handbook/${slug} error:`, err);
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }
}
