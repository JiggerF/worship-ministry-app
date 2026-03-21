import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/server/platform-auth";

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/**
 * GET /api/platform/tenants
 *
 * Returns all organizations with member and song counts.
 * Requires platform admin authentication.
 */
export async function GET(req: NextRequest) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  try {
    const supabase = getServiceClient();

    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, slug, is_active, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Enrich each org with member and song counts
    const enriched = await Promise.all(
      (orgs ?? []).map(async (org) => {
        const [{ count: memberCount }, { count: songCount }] = await Promise.all([
          supabase
            .from("organization_members")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("is_active", true),
          supabase
            .from("songs")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", org.id),
        ]);
        return { ...org, member_count: memberCount ?? 0, song_count: songCount ?? 0 };
      })
    );

    return NextResponse.json(enriched);
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

/**
 * POST /api/platform/tenants
 *
 * Provisions a new tenant via the provision_tenant() stored procedure.
 * Body: { name, slug, admin_email, admin_name }
 *
 * On success returns { org_id } and triggers an invite email via Supabase Auth.
 * The stored procedure is atomic — partial failure rolls back completely.
 */
export async function POST(req: NextRequest) {
  const deny = await requirePlatformAdmin(req);
  if (deny) return deny;

  let body: { name?: string; slug?: string; admin_email?: string; admin_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug, admin_email, admin_name } = body;
  if (!name || !slug || !admin_email || !admin_name) {
    return NextResponse.json(
      { error: "name, slug, admin_email, and admin_name are required" },
      { status: 400 }
    );
  }

  // Validate slug: lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 }
    );
  }

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
    return NextResponse.json({ error: "admin_email is not a valid email address" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Call the atomic stored procedure
    const { data, error } = await supabase.rpc("provision_tenant", {
      p_name: name,
      p_slug: slug,
      p_admin_email: admin_email,
      p_admin_name: admin_name,
    });

    if (error) {
      // Unique slug conflict produces a specific Postgres error
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Slug "${slug}" is already in use` },
          { status: 409 }
        );
      }
      throw error;
    }

    const orgId = data as string;

    // Send invite email (non-transactional — provisioning already committed)
    // If this fails, the tenant still exists and the admin can log in once their
    // Supabase Auth account is created manually or via another invite.
    try {
      await supabase.auth.admin.inviteUserByEmail(admin_email, {
        data: { name: admin_name, org_id: orgId },
      });
    } catch {
      // Log but do not fail the provisioning response
      console.warn(`[provision_tenant] invite email failed for ${admin_email}`);
    }

    return NextResponse.json({ org_id: orgId }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
