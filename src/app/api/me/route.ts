import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getMemberByEmail } from "@/lib/db/members";
import { getTenantId, isMultiTenantEnabled, WCC_TENANT_ID } from "@/lib/server/tenant";
import { getEnabledFeatures } from "@/lib/server/feature-flags";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  let email: string | null = null;

  // Primary: use createServerClient (works when @supabase/ssr manages cookies)
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (!error && data?.user?.email) {
    email = data.user.email;
  }

  // Fallback: decode email from manually-set cookies (login page sets these directly)
  if (!email) {
    // Try sb-access-token (JWT — email is in the payload)
    const access = req.cookies.get("sb-access-token")?.value;
    if (access) {
      try {
        const parts = access.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          email = payload?.email ?? null;
        }
      } catch {
        // ignore malformed JWT
      }
    }
  }

  if (!email) {
    // Try sb:token (serialized session object set by the login page)
    const sbToken = req.cookies.get("sb:token")?.value;
    if (sbToken) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sbToken));
        email = parsed?.user?.email ?? null;
      } catch {
        // ignore
      }
    }
  }

  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // getTenantId throws when MULTI_TENANT_ENABLED=true and x-tenant-id is absent
  // (indicates middleware misconfiguration). Keep it inside the try so the route
  // returns a clean 500 rather than an unhandled rejection.
  let tenantId: string;
  try {
    tenantId = getTenantId(req);
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? "Tenant resolution failed" }, { status: 500 });
  }

  try {
    const member = await getMemberByEmail(email);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // In multi-tenant mode, resolve the per-tenant app_role from organization_members.
    // If the user is NOT a member of the resolved tenant, return 403 immediately —
    // this is the API-layer tenant boundary enforcement that prevents cross-tenant
    // data leakage even if middleware were somehow bypassed.
    let appRole = member.app_role;
    if (isMultiTenantEnabled()) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        const serviceClient = createClient(supabaseUrl, serviceKey);
        const { data: orgMember } = await serviceClient
          .from("organization_members")
          .select("app_role, is_active")
          .eq("member_id", member.id)
          .eq("organization_id", tenantId)
          .maybeSingle();
        if (!orgMember || orgMember.is_active === false) {
          // User is authenticated but does not belong to this organisation.
          return NextResponse.json(
            { error: "Not a member of this organisation" },
            { status: 403 }
          );
        }
        appRole = orgMember.app_role;
      }
    }

    // Resolve tenant name
    let tenantName: string | null = null;
    if (tenantId !== WCC_TENANT_ID || isMultiTenantEnabled()) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        const serviceClient = createClient(supabaseUrl, serviceKey);
        const { data: org } = await serviceClient
          .from("organizations")
          .select("name")
          .eq("id", tenantId)
          .single();
        tenantName = org?.name ?? null;
      }
    }

    // Get enabled features for this tenant
    const features = await getEnabledFeatures(tenantId).catch(() => [] as string[]);

    const responseBody = {
      ...member,
      app_role: appRole,
      tenant_id: tenantId,
      tenant_name: tenantName,
      features,
    };

    const res = NextResponse.json(responseBody);
    // Never cache — a stale identity would be served after switching logins.
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}
