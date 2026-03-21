import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuditLogEntry } from "@/lib/db/audit-log";
import { isMultiTenantEnabled, WCC_TENANT_ID } from "@/lib/server/tenant";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");

/**
 * POST /api/auth/login
 *
 * Accepts { email, password }, authenticates via Supabase, sets auth cookies
 * server-side, and writes a login audit event. All app_roles are tracked.
 *
 * Returns:
 *   200 { success: true }   — authenticated, cookies set
 *   400 { error: string }   — missing body / credentials
 *   401 { error: string }   — invalid credentials from Supabase
 *   500 { error: string }   — unexpected failure
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  // Use the anon key for auth — Supabase auth API requires it.
  const supabase = createClient(supabaseUrl!, anonKey!);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Authentication failed" },
      { status: 401 }
    );
  }

  const { access_token, refresh_token } = data.session;

  // Build the success response and set cookies server-side (secure, httpOnly in prod).
  const res = NextResponse.json({ success: true });

  const isProd = process.env.NODE_ENV === "production";

  // sb-access-token and sb-refresh-token must be httpOnly for server-side session detection
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  res.cookies.set("sb-access-token", access_token, cookieOptions);
  res.cookies.set("sb-refresh-token", refresh_token, cookieOptions);

  try {
    const serialized = encodeURIComponent(JSON.stringify(data.session));
    res.cookies.set("sb:token", serialized, cookieOptions);
  } catch {
    // ignore serialization failure — access token is the primary auth mechanism
  }

  // ── Multi-tenant org validation (CRITICAL — errors are NOT swallowed) ──────
  // This block must run before the audit section. A validation failure returns
  // a 403 immediately — the session cookies already set above are invalidated
  // by the client seeing the non-200 status.
  //
  // BUG HISTORY: Previously this lived inside the swallowable try/catch and
  // was guarded by `tenantId !== WCC_TENANT_ID`. The middleware dev fallback
  // `if (!slug) slug = "wcc"` meant every login resolved to WCC, so `tenantId`
  // was always WCC_TENANT_ID, so the guard was never true, so the check was
  // never executed. Tenant2 admins therefore saw Tenant1 data.
  let loginTenantId: string = WCC_TENANT_ID; // safe single-tenant default

  if (serviceKey && isMultiTenantEnabled()) {
    const serviceClient = createClient(supabaseUrl!, serviceKey);
    const { data: memberRow } = await serviceClient
      .from("members")
      .select("id")
      .eq("email", body.email)
      .maybeSingle();

    if (memberRow) {
      // x-tenant-id is injected by middleware from subdomain (prod) or ?org= param (dev).
      // After removing the dangerous "wcc" default from resolveTenantId, this will be
      // absent when the user navigates directly to the root login URL without a param.
      const requestTenantId = req.headers.get("x-tenant-id");

      if (requestTenantId) {
        // Subdomain / query-param context exists — validate membership for that org.
        const { data: orgMember } = await serviceClient
          .from("organization_members")
          .select("is_active")
          .eq("member_id", memberRow.id)
          .eq("organization_id", requestTenantId)
          .maybeSingle();

        if (!orgMember || orgMember.is_active !== true) {
          return NextResponse.json(
            { error: "Not authorised for this organisation" },
            { status: 403 }
          );
        }
        loginTenantId = requestTenantId;
      } else {
        // No subdomain / query-param — look up which org(s) this member belongs to.
        // This handles the common case where a tenant admin navigates directly to
        // /admin/login without a subdomain (e.g. in dev or early setup).
        const { data: orgMemberships } = await serviceClient
          .from("organization_members")
          .select("organization_id")
          .eq("member_id", memberRow.id)
          .eq("is_active", true)
          .limit(2);

        if (!orgMemberships || orgMemberships.length === 0) {
          return NextResponse.json(
            { error: "No active organisation membership found" },
            { status: 403 }
          );
        }
        if (orgMemberships.length > 1) {
          // Multi-org member must access from their org's specific subdomain URL
          // so we can determine which tenant context to establish.
          return NextResponse.json(
            {
              error:
                "Multiple organisations found — please sign in from your organisation's URL (e.g. yourchurch.worshipapp.com)",
            },
            { status: 400 }
          );
        }
        loginTenantId = orgMemberships[0].organization_id;
      }

      // Stamp the validated tenant ID into the session so middleware can resolve
      // it on every subsequent request without requiring a subdomain or ?org= param.
      res.cookies.set("sb-tenant-id", loginTenantId, cookieOptions);
    }
  }

  // ── Audit: log login event for all roles ──────────────────────────────────
  // Fire-and-forget: fully swallowed so auth is never blocked by audit failures.
  if (serviceKey) {
    try {
      const serviceClient = createClient(supabaseUrl!, serviceKey);
      const { data: memberData } = await serviceClient
        .from("members")
        .select("id, name, app_role")
        .eq("email", body.email)
        .maybeSingle();

      if (memberData) {
        const member = memberData as { id: string; name: string; app_role: string };
        await createAuditLogEntry({
          actor_id: member.id,
          actor_name: member.name,
          actor_role: member.app_role,
          tenant_id: loginTenantId,
          action: "login",
          entity_type: "auth",
          entity_id: member.id,
          summary: `${member.name} (${member.app_role}) signed in`,
        });
      }
    } catch {
      // Intentionally swallow — audit must never block login
    }
  }

  return res;
}
