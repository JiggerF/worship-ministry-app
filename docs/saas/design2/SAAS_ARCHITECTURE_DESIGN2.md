# SaaS Multi-Tenant Architecture — Implementation Roadmap (Design 2)

> **Status:** Draft — March 2026
> **Pipeline:** `feature-planning-pipeline.md` (6-phase engineering planning cycle)
> **Skills applied:** Product Manager, SaaS Architect, Systems Thinking, Staff Software Engineer, SDET/Quality Engineer
> **Companion document:** [TECHNICAL_PLAN_WRKFLOW2.md](./TECHNICAL_PLAN_WRKFLOW2.md) (architecture design, test strategy, critical review)
> **Scale assumption:** 3 churches, ~20 musicians and ~60-100 songs each

---

## Table of Contents

1. [Phase 3 — Implementation Plan](#phase-3--implementation-plan)
   - [Phase 0: Database Foundation](#phase-0--database-foundation-12-weeks)
   - [Phase 1: Tenant Context Propagation](#phase-1--tenant-context-propagation-23-weeks)
   - [Phase 2: Feature Flags & Platform Admin](#phase-2--feature-flags--platform-admin-23-weeks)
   - [Phase 3: Onboarding & Hardening](#phase-3--onboarding--production-hardening-23-weeks)
2. [Phase 5 — Release Strategy](#phase-5--release-strategy)
3. [Appendix A — File Impact Map](#appendix-a--file-impact-map)
4. [Appendix B — Provisioning Stored Procedure](#appendix-b--provisioning-stored-procedure)
5. [Appendix C — Migration SQL](#appendix-c--migration-sql)
6. [Appendix D — Timeline](#appendix-d--timeline)

---

## Phase 3 — Implementation Plan

### Safety Principles

These principles govern every change across all phases:

| Principle | Rationale |
|-----------|-----------|
| **Additive changes only** | Never drop columns or tables until the new path is proven. Add `tenant_id` as nullable first, backfill, then make NOT NULL. |
| **Church #1 must never break** | Every intermediate state must pass all existing tests and work in production. |
| **One concern per migration step** | Schema changes, data backfill, and constraint enforcement are separate steps. |
| **Application layer first, RLS second** | Since all writes use the service role key (bypasses RLS), tenant filtering must work in application code before RLS adds defense-in-depth. |
| **Feature parity before onboarding** | Don't onboard Church #2 until every module correctly scopes data. |
| **Every phase has exit criteria** | No phase is "done" without passing its verification checklist. |

---

### Phase 0 — Database Foundation (1-2 weeks)

> **Goal:** Schema supports multi-tenancy. Zero behavior change. Church #1 works identically.

#### Step 0.1 — Pre-flight: Verify table naming

**Action:** Check whether the production table is `member_roles` or `member_role_assignments`. The migration SQL uses one name, `lib/db/members.ts` uses another. See [Critical Finding F1](./TECHNICAL_PLAN_WRKFLOW2.md#finding-1-member_roles-vs-member_role_assignments-naming-inconsistency).

```bash
# Run against production Supabase
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'member%';
```

Resolve the inconsistency before proceeding.

#### Step 0.2 — Migration 019: Create new tables and seed Church #1

Create `supabase/migrations/019_multi_tenant_tables.sql`:

```sql
-- organizations
CREATE TABLE organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  settings   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed Church #1 with deterministic UUID
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'WCC Worship Ministry', 'wcc');

-- organization_members (per-tenant roles + activation)
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  member_id       UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  app_role        TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  joined_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (organization_id, member_id)
);

-- Backfill from existing members
INSERT INTO organization_members (organization_id, member_id, app_role, is_active)
SELECT '00000000-0000-0000-0000-000000000001', id, app_role, is_active
FROM members;

-- feature_flags (global definitions)
CREATE TABLE feature_flags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key        TEXT UNIQUE NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT false
);

-- organization_features (per-tenant overrides)
CREATE TABLE organization_features (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  flag_id         UUID REFERENCES feature_flags(id) ON DELETE CASCADE NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, flag_id)
);

-- platform_admins (landlord accounts)
CREATE TABLE platform_admins (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed feature flags
INSERT INTO feature_flags (flag_key, label, default_enabled) VALUES
  ('roster',       'Roster Manager',        true),
  ('songs',        'Song Library',          true),
  ('availability', 'Availability Tracking', true),
  ('setlist',      'Setlist Manager',       true),
  ('handbook',     'Team Handbook',         false),
  ('audit_log',    'Audit Log',             false),
  ('chord_sheets', 'Chord Sheet PDFs',      true),
  ('equipment',    'Equipment Tracking',    false),
  ('ai_roster',    'AI Roster Agent',       false);

-- Enable all features for Church #1
INSERT INTO organization_features (organization_id, flag_id, enabled)
SELECT '00000000-0000-0000-0000-000000000001', id, true FROM feature_flags;
```

#### Step 0.3 — Migration 020: Add tenant_id to data tables

Create `supabase/migrations/020_add_tenant_id.sql`:

```sql
-- NOTE: members does NOT get tenant_id (global identity table)
-- NOTE: roles does NOT get tenant_id (universal musical roles)

-- Add tenant_id as NULLABLE with DEFAULT (safe for existing rows)
ALTER TABLE songs ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE roster ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE availability ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE availability_periods ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE sunday_setlist ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE audit_log ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE handbook_documents ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE member_role_assignments ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Backfill (should be instant since DEFAULT already set)
UPDATE songs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE roster SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE availability SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE availability_periods SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE sunday_setlist SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE audit_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE handbook_documents SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE member_role_assignments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Make NOT NULL
ALTER TABLE songs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE songs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE roster ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE roster ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE availability ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE availability ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE availability_periods ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE availability_periods ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE sunday_setlist ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sunday_setlist ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE audit_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE handbook_documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE handbook_documents ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE member_role_assignments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE member_role_assignments ALTER COLUMN tenant_id DROP DEFAULT;

-- Indexes
CREATE INDEX idx_songs_tenant ON songs(tenant_id);
CREATE INDEX idx_songs_tenant_title ON songs(tenant_id, title);
CREATE INDEX idx_roster_tenant_date ON roster(tenant_id, date);
CREATE INDEX idx_availability_tenant ON availability(tenant_id);
CREATE INDEX idx_availability_periods_tenant ON availability_periods(tenant_id, starts_on DESC);
CREATE INDEX idx_sunday_setlist_tenant ON sunday_setlist(tenant_id, sunday_date);
CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_handbook_tenant ON handbook_documents(tenant_id, slug);
CREATE INDEX idx_member_role_assignments_tenant ON member_role_assignments(tenant_id, member_id);
```

#### Step 0.4 — Migration 021: Fix unique constraints and app_settings PK

Create `supabase/migrations/021_fix_constraints.sql`:

```sql
-- roster: UNIQUE (date, role_id) → (tenant_id, date, role_id)
ALTER TABLE roster DROP CONSTRAINT IF EXISTS roster_date_role_id_key;
ALTER TABLE roster ADD CONSTRAINT roster_tenant_date_role_unique
  UNIQUE (tenant_id, date, role_id);

-- availability: UNIQUE (member_id, date) → (tenant_id, member_id, date)
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_member_id_date_key;
ALTER TABLE availability ADD CONSTRAINT availability_tenant_member_date_unique
  UNIQUE (tenant_id, member_id, date);

-- sunday_setlist: UNIQUE (sunday_date, position) → (tenant_id, sunday_date, position)
ALTER TABLE sunday_setlist DROP CONSTRAINT IF EXISTS sunday_setlist_sunday_date_position_key;
ALTER TABLE sunday_setlist ADD CONSTRAINT sunday_setlist_tenant_date_position_unique
  UNIQUE (tenant_id, sunday_date, position);

-- app_settings: PK (key) → (tenant_id, key)
ALTER TABLE app_settings ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE app_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE app_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (tenant_id, key);
```

#### Step 0.5 — Update TypeScript types

Update `src/lib/types/database.ts`:
- Add `Organization`, `OrganizationMember`, `FeatureFlag`, `OrganizationFeature`, `PlatformAdmin` interfaces
- Add `tenant_id: string` to `Song`, `RosterAssignment`, `AvailabilityPeriod`, `SetlistSong`, `AuditLogRow`, `HandbookDocument`
- Add JSDoc `@deprecated Use organization_members.app_role instead` to `Member.app_role`

#### Step 0.6 — Verification checklist

- [ ] Migrations run successfully on dev database
- [ ] Migrations roll back cleanly (test reverse)
- [ ] All existing rows have `tenant_id` set
- [ ] `organization_members` matches current `members.app_role` for all rows
- [ ] `app_settings` PK changed — no data lost
- [ ] Unique constraints updated — no conflicts with existing data
- [ ] `npm run test` passes (tests use mock data, unaffected by schema changes)
- [ ] `npm run build` passes
- [ ] Manually verify Church #1 app works end-to-end (no behavior change)

**Exit criteria:** All checks pass. Migration is reversible. Zero user-visible change.

---

### Phase 1 — Tenant Context Propagation (2-3 weeks)

> **Goal:** Every data path is tenant-scoped. Church #1 works identically on its subdomain.

#### Step 1.1 — Create tenant utilities

**New file: `src/lib/server/tenant.ts`**

```typescript
import { NextRequest } from "next/server";

export function getTenantId(req: NextRequest): string {
  // Kill switch: if multi-tenancy is disabled, return null
  // (routes check: if tenantId, scope queries; else, single-tenant behavior)
  if (process.env.MULTI_TENANT_ENABLED !== "true") {
    return process.env.DEFAULT_TENANT_ID || "";
  }

  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) throw new Error("Missing tenant context");

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("Invalid tenant ID format");
  }
  return tenantId;
}
```

**New file: `src/lib/db/tenant-query.ts`**

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

// Returns query builder WITHOUT .select() — caller chains .select(), .order(), etc.
export function tenantFrom(supabase: SupabaseClient, table: string, tenantId: string) {
  return supabase.from(table).eq("tenant_id", tenantId);
}

export function tenantInsert(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  data: Record<string, unknown> | Record<string, unknown>[]
) {
  const rows = Array.isArray(data)
    ? data.map(r => ({ ...r, tenant_id: tenantId }))
    : { ...data, tenant_id: tenantId };
  return supabase.from(table).insert(rows);
}
```

#### Step 1.2 — Update middleware

**File: `src/middleware.ts`**

Major changes:
1. **Expand matcher** to `["/admin/:path*", "/api/:path*", "/portal/:path*"]`
2. **Subdomain extraction** (production: from hostname; dev: from `?org=` query param)
3. **Header security:** DELETE any client-supplied `x-tenant-id` header, then SET the resolved one
4. **Organization lookup:** `SELECT id FROM organizations WHERE slug = ? AND is_active = true`
5. **Role lookup:** `SELECT app_role, is_active FROM organization_members WHERE organization_id = ? AND member_id = ?`
6. **Platform admin routing:** `/platform/*` checks `platform_admins` table instead
7. **Availability exception:** `/api/availability/[token]` routes get tenant from `periodId` parameter

```typescript
export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal/:path*"],
};
```

**Tenant resolution logic:**

```typescript
// 1. Delete any client-supplied tenant header (NEVER trust)
const headers = new Headers(req.headers);
headers.delete("x-tenant-id");

// 2. Extract slug
const hostname = req.headers.get("host") || "";
let slug: string | null = null;

if (hostname.includes(".worshipapp.com")) {
  slug = hostname.split(".")[0]; // wcc.worshipapp.com → "wcc"
} else if (process.env.NODE_ENV === "development") {
  slug = req.nextUrl.searchParams.get("org"); // ?org=wcc
}

// 3. Look up org (skip for /platform/* routes)
if (slug && !req.nextUrl.pathname.startsWith("/platform")) {
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!org) {
    return NextResponse.redirect(new URL("/error/org-not-found", req.url));
  }

  headers.set("x-tenant-id", org.id);
}
```

#### Step 1.3 — Update `/api/me`

**File: `src/app/api/me/route.ts`**

Changes:
1. Read `x-tenant-id` from request headers
2. Join `organization_members` to get per-tenant `app_role` and `is_active`
3. Call `getEnabledFeatures(tenantId)` to populate `features[]`
4. Add `tenant_id`, `tenant_name`, `features` to response
5. Keep existing fields for backward compatibility

```typescript
// After resolving member by email...
const tenantId = req.headers.get("x-tenant-id");

if (tenantId) {
  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("app_role, is_active, organizations(name)")
    .eq("organization_id", tenantId)
    .eq("member_id", member.id)
    .single();

  if (!orgMember) {
    return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
  }
  if (!orgMember.is_active) {
    return NextResponse.json({ error: "Account deactivated at this church" }, { status: 403 });
  }

  const features = await getEnabledFeatures(tenantId);

  return NextResponse.json({
    ...member,
    app_role: orgMember.app_role,       // per-tenant role (overrides global)
    tenant_id: tenantId,                 // NEW
    tenant_name: orgMember.organizations?.name, // NEW
    features,                            // NEW
  });
}

// Fallback: return member as-is (single-tenant mode)
return NextResponse.json(member);
```

#### Step 1.4 — Update all API routes (25+ files)

Every route file follows this mechanical pattern:

```typescript
import { getTenantId } from "@/lib/server/tenant";

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);

  const { data } = await supabase
    .from("songs")
    .select("*, chord_charts(*)")
    .eq("tenant_id", tenantId)  // ADD THIS
    .order("title");

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantId(req);
  const body = await req.json();

  const { data, error } = await supabase
    .from("songs")
    .insert({ ...body, tenant_id: tenantId })  // ADD tenant_id
    .select()
    .single();

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = getTenantId(req);

  // Verify ownership BEFORE deleting
  const { data: song } = await supabase
    .from("songs")
    .select("tenant_id")
    .eq("id", params.id)
    .single();

  if (!song || song.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await supabase.from("songs").delete().eq("id", params.id);
  return NextResponse.json({ success: true });
}
```

**Routes to update:**

| Route file | Methods | Special handling |
|------------|---------|-----------------|
| `/api/members/route.ts` | GET, POST | Query via `organization_members` JOIN; create member + org_member |
| `/api/members/[id]/route.ts` | GET, PUT | Verify member is in org |
| `/api/members/[id]/magic-token/route.ts` | POST | Verify member is in org |
| `/api/admin/member/route.ts` | GET | Scope email lookup to org |
| `/api/songs/route.ts` | GET, POST | Standard tenant filter |
| `/api/songs/[id]/route.ts` | GET, PUT, DELETE | Ownership verification |
| `/api/roster/route.ts` | GET, POST, PATCH | Update `onConflict: "tenant_id,date,role_id"` |
| `/api/setlist/route.ts` | GET, POST, PUT | Standard tenant filter |
| `/api/setlist/[id]/route.ts` | GET, PUT, DELETE | Ownership verification |
| `/api/setlist/[id]/publish/route.ts` | POST | Ownership verification |
| `/api/setlist/[id]/revert/route.ts` | POST | Ownership verification |
| `/api/availability/[token]/route.ts` | GET, POST | Resolve tenant from `periodId → availability_periods.tenant_id` |
| `/api/availability/periods/route.ts` | GET, POST | Standard tenant filter |
| `/api/availability/periods/[id]/route.ts` | GET, PATCH | Ownership verification |
| `/api/handbook/route.ts` | GET, POST | Standard tenant filter |
| `/api/handbook/[slug]/route.ts` | GET, PUT, DELETE | Ownership verification |
| `/api/handbook/[slug]/history/route.ts` | GET | Scoped by tenant |
| `/api/handbook/[slug]/restore/[id]/route.ts` | POST | Ownership verification |
| `/api/audit-log/route.ts` | GET | Standard tenant filter |
| `/api/settings/route.ts` | GET, PATCH | Update `onConflict: "tenant_id,key"` |
| `/api/settings/handbook-permissions/route.ts` | GET | Scoped by tenant |
| `/api/chord-sheet/route.ts` | GET | Join through songs for tenant |
| `/api/auth/login/route.ts` | POST | Verify member in org after auth |
| `/api/auth/logout/route.ts` | POST | No tenant changes needed |

#### Step 1.5 — Update `lib/db/members.ts`

Add `tenantId` parameter to all functions:

```typescript
// BEFORE
export async function getMembers(): Promise<MemberWithRoles[]>

// AFTER
export async function getMembers(tenantId: string): Promise<MemberWithRoles[]> {
  // Query organization_members to get members in this org
  // Then fetch their roles
}
```

**Exception:** `getMemberByMagicToken(token)` stays global. Resolve tenant from `organization_members` or `availability_periods.tenant_id` (via `periodId` parameter).

#### Step 1.6 — Update `get-actor.ts`

**File: `src/lib/server/get-actor.ts`**

```typescript
interface AuditActor {
  id: string | null;
  name: string;
  role: string;
  tenantId: string;  // NEW
}

// Read tenantId from x-tenant-id header
// Look up role from organization_members (not members.app_role)
```

#### Step 1.7 — Fix pre-existing security issue

**File: `src/app/api/members/route.ts`**

Replace `x-app-role` header trust with `getActorFromRequest(req)`. See [Critical Finding F2](./TECHNICAL_PLAN_WRKFLOW2.md#finding-2-apimembers-post-handler-trusts-client-sent-x-app-role-header).

#### Step 1.8 — Login flow update

**File: `src/app/api/auth/login/route.ts`**

After Supabase Auth succeeds:
1. Read `x-tenant-id` from request headers
2. Look up `organization_members` for this email + tenant
3. If not found → 403: "You are not a member of this organization"
4. If `organization_members.is_active = false` → 403: "Your account is deactivated at this church"
5. If `members.is_active = false` → 403: "Your account has been suspended" (platform kill switch)
6. If all active → proceed with cookie-setting flow

#### Step 1.9 — Verification checklist

- [ ] Church #1 accessible at `wcc.worshipapp.com` (or `localhost:3000?org=wcc` in dev)
- [ ] All pages load with correct data
- [ ] Roles work correctly (Admin, Coordinator, etc.)
- [ ] A manually-provisioned Church #2 shows only its own data
- [ ] Cross-tenant data leak test: Church #2 admin cannot see Church #1 data
- [ ] Cross-tenant mutation test: Church #2 cannot DELETE/PUT Church #1 resources
- [ ] Header spoofing test: API ignores client-supplied `x-tenant-id`
- [ ] Portal routes resolve tenant from subdomain
- [ ] Availability form resolves tenant from periodId
- [ ] Per-tenant deactivation: `organization_members.is_active = false` blocks that org only
- [ ] Deactivated org (`organizations.is_active = false`) fully blocked
- [ ] `npm run test` passes with updated fixtures
- [ ] `npm run build` passes

**Exit criteria:** Church #1 fully functional on subdomain. A manually-provisioned Church #2 sees only its own data.

**Onboarding gate:** Church #2 can be provisioned via SQL at this point (manual, no UI).

---

### Phase 2 — Feature Flags & Platform Admin (2-3 weeks)

> **Goal:** Platform admin can manage tenants and features via UI. Church #2 onboardable.

#### Step 2.1 — Feature flag system

**New file: `src/lib/server/feature-flags.ts`**

```typescript
export async function isFeatureEnabled(tenantId: string, flagKey: string): Promise<boolean> {
  // 1. Check organization_features for explicit override
  const { data: override } = await supabase
    .from("organization_features")
    .select("enabled, feature_flags!inner(flag_key)")
    .eq("organization_id", tenantId)
    .eq("feature_flags.flag_key", flagKey)
    .single();

  if (override) return override.enabled;

  // 2. Fall back to default
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("default_enabled")
    .eq("flag_key", flagKey)
    .single();

  if (flag) return flag.default_enabled;

  // 3. Unknown flag → disabled (fail-closed)
  return false;
}

export async function getEnabledFeatures(tenantId: string): Promise<string[]> {
  // Batch query: all flags with their overrides for this tenant
  // Returns array of enabled flag_keys
}
```

#### Step 2.2 — Client-side feature delivery

Add `features[]` to `/api/me` response (already done in Step 1.3).

In `src/app/admin/layout.tsx`, filter sidebar:

```typescript
const FEATURE_ROUTE_MAP: Record<string, string> = {
  roster:       "/admin/roster",
  songs:        "/admin/songs",
  availability: "/admin/availability",
  setlist:      "/admin/setlist",
  handbook:     "/admin/handbook",
  audit_log:    "/admin/audit",
};

const visibleItems = sidebarItems.filter(
  (item) => !FEATURE_ROUTE_MAP[item.feature] || features.includes(item.feature)
);
```

Also display tenant name in sidebar header.

#### Step 2.3 — Server-side feature gating

Each feature-gated API route checks at the top:

```typescript
if (!(await isFeatureEnabled(tenantId, "setlist"))) {
  return NextResponse.json({ error: "Feature not available" }, { status: 403 });
}
```

#### Step 2.4 — Platform admin pages

**New pages under `src/app/platform/`:**

| File | Purpose |
|------|---------|
| `layout.tsx` | Platform admin layout (no sidebar from admin) |
| `login/page.tsx` | Platform admin login |
| `dashboard/page.tsx` | Cross-tenant stats (tenant count, total members/songs, health) |
| `tenants/page.tsx` | List all organizations with member/song counts |
| `tenants/new/page.tsx` | Create new tenant form |
| `tenants/[id]/page.tsx` | Tenant detail + settings + admin contact |
| `tenants/[id]/features/page.tsx` | Toggle feature flags per tenant |
| `flags/page.tsx` | Manage global feature flag definitions |

#### Step 2.5 — Platform admin API routes

**New routes under `src/app/api/platform/`:**

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/platform/tenants` | GET, POST | List tenants; provision new tenant (calls stored procedure) |
| `/api/platform/tenants/[id]` | GET, PATCH | Tenant detail; update name/settings/is_active |
| `/api/platform/tenants/[id]/features` | GET, PUT | Read/update feature flags for tenant |
| `/api/platform/flags` | GET, POST | List/create global feature flag definitions |
| `/api/platform/flags/[id]` | PUT | Update flag definition |

All `/api/platform/*` routes validate caller is in `platform_admins` table.

#### Step 2.6 — Tenant provisioning

Provisioning calls a PostgreSQL stored procedure for atomicity (see [Appendix B](#appendix-b--provisioning-stored-procedure)).

After the transaction commits, send invite email (non-transactional, retryable):
```typescript
if (!existingAuthAccount) {
  await supabase.auth.admin.inviteUserByEmail(adminEmail);
}
```

#### Step 2.7 — Verification checklist

- [ ] Platform admin can log in at `/platform/login`
- [ ] Dashboard shows correct tenant stats
- [ ] Can create a new tenant via UI (stored procedure succeeds)
- [ ] Feature flags toggle correctly per tenant
- [ ] Disabled features hide from sidebar + block API access (403)
- [ ] New tenant's admin receives invite email and can log in
- [ ] Provisioned tenant has correct default settings and feature flags

**Exit criteria:** Tenants can be provisioned and configured via platform admin UI.

**Onboarding gate:** Church #2 and #3 can be onboarded.

---

### Phase 3 — Onboarding & Production Hardening (2-3 weeks)

> **Goal:** Churches #2 and #3 live. System hardened with isolation tests and defense-in-depth.

#### Step 3.1 — Onboard Church #2

1. Platform admin creates tenant via `/platform/tenants/new`
2. DNS: Vercel wildcard handles `church2.worshipapp.com` automatically
3. Admin receives invite → sets password → logs in
4. Admin adds their members, songs, configures roster

#### Step 3.2 — Onboard Church #3

Same process. Onboarding is now a 5-minute operation.

#### Step 3.3 — Tenant isolation integration tests

New test file: `__tests__/integration/tenant-isolation.test.ts`

See [TECHNICAL_PLAN §4.2](./TECHNICAL_PLAN_WRKFLOW2.md#42-integration-tests) for the full test specification. Covers every API endpoint with two-tenant fixtures.

#### Step 3.4 — Feature flag tests

- Disabled feature → 403 from API
- Sidebar hides disabled feature
- Direct URL navigation to disabled feature redirects
- Newly provisioned tenant gets correct default flags

#### Step 3.5 — RLS defense-in-depth

Add tenant-scoped RLS policies as a safety net:

```sql
CREATE POLICY "tenant_isolation" ON songs
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.is_platform_admin', true) = 'true'
  );
```

Since service role key bypasses RLS, these only activate if anon key is ever used — defense-in-depth only.

#### Step 3.6 — Performance monitoring

At 3-10 tenants, accept DB lookup per request:
- `SELECT id FROM organizations WHERE slug = ?` with indexed column is <5ms
- No in-memory caching (doesn't work on Vercel serverless)

**Future optimizations (when needed):**
- Vercel KV (Redis) for slug→id and feature flag caching
- JWT custom claims (via Supabase Auth hooks) to embed `tenant_id` and `app_role` in the token

#### Step 3.7 — Drop deprecated column

After verifying all code reads from `organization_members`:
```sql
ALTER TABLE members DROP COLUMN app_role;
```

Keep for 1 release as safety buffer.

#### Step 3.8 — Verification checklist

- [ ] Church #2 fully operational (all features tested end-to-end)
- [ ] Church #3 fully operational
- [ ] Each church sees only its own data
- [ ] Settings changes in one church don't affect others
- [ ] All tenant isolation integration tests pass
- [ ] All feature flag tests pass
- [ ] Performance acceptable with 3 tenants
- [ ] RLS policies active as safety net
- [ ] `members.app_role` dropped (or scheduled for next release)
- [ ] Platform admin dashboard shows correct stats for all 3
- [ ] `npm run test` — full suite passes
- [ ] `npm run build` — clean build

**Exit criteria:** 3 churches operational. Isolation tests pass. Performance acceptable. Full test suite green.

---

## Phase 5 — Release Strategy

### 5.1 Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Data leak via missing tenant filter | Critical | Medium | `tenantFrom()` wrapper; isolation tests on every route; RLS defense-in-depth |
| Header spoofing | Critical | Low | Middleware deletes-then-sets header; integration test |
| Portal/availability data leak | Critical | Medium | Expanded middleware matcher; token resolves via periodId |
| Provisioning partial failure | High | Low | Stored procedure (single transaction) |
| Migration breaks Church #1 | High | Low | Additive changes only; kill switch env var |
| Dual role confusion | Medium | Medium | `@deprecated` annotation; drop column ASAP |
| Unique constraint conflicts | Medium | High | Updated in migration 021 before Phase 1 |

### 5.2 Feature Flag / Kill Switch

**Environment variable: `MULTI_TENANT_ENABLED`**

| Value | Behavior |
|-------|----------|
| `false` (or unset) | `getTenantId()` returns `DEFAULT_TENANT_ID`; routes skip tenant check; single-tenant behavior |
| `true` | Full multi-tenant scoping active |

This allows deploying all code changes without activating multi-tenancy. Activation is a Vercel env var change + redeploy (< 1 minute), not a code change.

### 5.3 Rollout Sequence

```
Step 1: Deploy Phase 0 migrations (additive schema only)
        Risk: None
        Rollback: DROP new tables, DROP new columns

Step 2: Deploy Phase 1 code with MULTI_TENANT_ENABLED=false
        Risk: None (all behavior unchanged)
        Rollback: Revert code deploy

Step 3: Flip MULTI_TENANT_ENABLED=true on STAGING
        Risk: Low (staging environment)
        Verify: Church #1 data correct, roles work, all pages load

Step 4: Flip MULTI_TENANT_ENABLED=true on PRODUCTION
        Risk: Medium
        Verify: Church #1 works on wcc.worshipapp.com
        Rollback: Flip back to false (immediate, < 1 minute)

Step 5: Provision Church #2 via platform admin
        Risk: Low (isolated new tenant)
        Verify: Church #2 sees only own data; Church #1 unaffected

Step 6: Provision Church #3
        Risk: Low (proven process)
        Verify: 3 tenants operational
```

### 5.4 Monitoring Plan

| Signal | Where | Purpose |
|--------|-------|---------|
| Tenant resolution timing | Middleware | Detect slow org lookups |
| Unscoped query detection | `getTenantId()` | Log if called without header (should never happen) |
| Cross-tenant 404 spike | API routes | May indicate tenant boundary bug or attack |
| Feature flag query timing | `isFeatureEnabled()` | Monitor if latency becomes a concern |
| Audit log `tenant_id` consistency | `audit_log` table | Verify no cross-tenant audit entries |
| Platform admin action logging | `/api/platform/*` routes | Track all provisioning and config changes |

### 5.5 Rollback Plan

| Scenario | Action | Data impact |
|----------|--------|-------------|
| Bug in tenant scoping (data leak) | Flip `MULTI_TENANT_ENABLED=false` | Immediate; all routes revert to single-tenant |
| Schema migration failure | Reverse migration (tables are additive) | No data loss; columns ignored by old code |
| Full revert needed | Revert code to pre-migration commit | `tenant_id` columns exist but are ignored |
| Single route broken | Fix and deploy individual route file | No need to revert entire multi-tenant system |

---

## Appendix A — File Impact Map

### Database (new migrations)

| File | Change |
|------|--------|
| `supabase/migrations/019_multi_tenant_tables.sql` | **NEW** — organizations, organization_members, feature_flags, organization_features, platform_admins |
| `supabase/migrations/020_add_tenant_id.sql` | **NEW** — Add tenant_id to 8 data tables; backfill; NOT NULL; indexes |
| `supabase/migrations/021_fix_constraints.sql` | **NEW** — Update unique constraints; change app_settings PK |
| `supabase/migrations/022_provision_tenant.sql` | **NEW** — provision_tenant() stored procedure |

### Backend — New files

| File | Purpose |
|------|---------|
| `src/lib/server/tenant.ts` | `getTenantId(req)` — fail-closed, UUID validated |
| `src/lib/db/tenant-query.ts` | `tenantFrom()`, `tenantInsert()` helpers |
| `src/lib/server/feature-flags.ts` | `isFeatureEnabled()`, `getEnabledFeatures()` |

### Backend — Modified core files

| File | Change |
|------|--------|
| `src/middleware.ts` | Expand matcher; subdomain → tenant; header security; org_members role lookup |
| `src/app/api/me/route.ts` | Join org_members; add tenant_id/tenant_name/features to response |
| `src/lib/db/members.ts` | Add `tenantId` param to all functions; query via org_members |
| `src/lib/types/database.ts` | Add 5 new interfaces; add `tenant_id` to existing types; deprecate `Member.app_role` |
| `src/lib/server/get-actor.ts` | Add `tenantId` to `AuditActor`; lookup from org_members |

### Backend — Modified API routes (tenant filter on every query)

| Route | Change |
|-------|--------|
| `src/app/api/members/route.ts` | Tenant filter; fix `x-app-role` header trust (F2) |
| `src/app/api/members/[id]/route.ts` | Tenant filter + ownership verification |
| `src/app/api/members/[id]/magic-token/route.ts` | Verify member in org |
| `src/app/api/admin/member/route.ts` | Scope to org |
| `src/app/api/songs/route.ts` | Tenant filter |
| `src/app/api/songs/[id]/route.ts` | Tenant filter + ownership |
| `src/app/api/roster/route.ts` | Tenant filter; update `onConflict` to `"tenant_id,date,role_id"` |
| `src/app/api/setlist/route.ts` | Tenant filter |
| `src/app/api/setlist/[id]/route.ts` | Tenant filter + ownership |
| `src/app/api/setlist/[id]/publish/route.ts` | Ownership verification |
| `src/app/api/setlist/[id]/revert/route.ts` | Ownership verification |
| `src/app/api/availability/[token]/route.ts` | Resolve tenant from periodId |
| `src/app/api/availability/periods/route.ts` | Tenant filter |
| `src/app/api/availability/periods/[id]/route.ts` | Ownership verification |
| `src/app/api/handbook/route.ts` | Tenant filter |
| `src/app/api/handbook/[slug]/route.ts` | Tenant filter + ownership |
| `src/app/api/handbook/[slug]/history/route.ts` | Scoped by tenant |
| `src/app/api/handbook/[slug]/restore/[id]/route.ts` | Ownership verification |
| `src/app/api/audit-log/route.ts` | Tenant filter |
| `src/app/api/settings/route.ts` | Tenant filter; update `onConflict` to `"tenant_id,key"` |
| `src/app/api/settings/handbook-permissions/route.ts` | Scoped by tenant |
| `src/app/api/chord-sheet/route.ts` | Join through songs for tenant |
| `src/app/api/auth/login/route.ts` | Verify member in org + per-tenant activation |

### Backend — Platform admin (all new)

| Route | Purpose |
|-------|---------|
| `src/app/api/platform/tenants/route.ts` | List/provision tenants |
| `src/app/api/platform/tenants/[id]/route.ts` | Tenant detail/update |
| `src/app/api/platform/tenants/[id]/features/route.ts` | Feature flag management |
| `src/app/api/platform/flags/route.ts` | Global flag CRUD |
| `src/app/api/platform/flags/[id]/route.ts` | Update flag definition |

### Frontend — Modified

| File | Change |
|------|--------|
| `src/app/admin/layout.tsx` | Feature-gated sidebar; tenant name in header |

### Frontend — Platform admin (all new)

| File | Purpose |
|------|---------|
| `src/app/platform/layout.tsx` | Platform admin layout |
| `src/app/platform/login/page.tsx` | Platform admin login |
| `src/app/platform/dashboard/page.tsx` | Cross-tenant stats |
| `src/app/platform/tenants/page.tsx` | Tenant list |
| `src/app/platform/tenants/new/page.tsx` | Create tenant form |
| `src/app/platform/tenants/[id]/page.tsx` | Tenant detail |
| `src/app/platform/tenants/[id]/features/page.tsx` | Feature toggle UI |
| `src/app/platform/flags/page.tsx` | Flag management |

### Tests — New

| File | Purpose |
|------|---------|
| `__tests__/helpers/tenant-fixtures.ts` | Shared test helpers and constants |
| `__tests__/unit/tenant.test.ts` | getTenantId() unit tests |
| `__tests__/unit/tenant-query.test.ts` | tenantFrom()/tenantInsert() tests |
| `__tests__/unit/feature-flags.test.ts` | Feature flag resolution tests |
| `__tests__/integration/tenant-isolation.test.ts` | Cross-tenant isolation (every endpoint) |
| `__tests__/integration/header-spoofing.test.ts` | Header forgery prevention |
| `__tests__/integration/multi-org-member.test.ts` | Multi-org membership tests |
| `__tests__/integration/provisioning.test.ts` | Provisioning flow tests |

### Tests — Modified

| File | Change |
|------|--------|
| All `__tests__/components/*.test.tsx` | Update fixtures to include `tenant_id` |

---

## Appendix B — Provisioning Stored Procedure

Create `supabase/migrations/022_provision_tenant.sql`:

```sql
CREATE OR REPLACE FUNCTION provision_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_admin_email TEXT,
  p_admin_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_member_id UUID;
BEGIN
  -- 1. Create organization
  INSERT INTO organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  -- 2. Create or find member (global identity)
  INSERT INTO members (email, name, app_role, magic_token)
  VALUES (p_admin_email, p_admin_name, 'Musician', gen_random_uuid())
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_member_id;

  -- 3. Create organization membership (Admin role)
  INSERT INTO organization_members (organization_id, member_id, app_role)
  VALUES (v_org_id, v_member_id, 'Admin');

  -- 4. Enable default features
  INSERT INTO organization_features (organization_id, flag_id, enabled)
  SELECT v_org_id, id, default_enabled FROM feature_flags;

  -- 5. Seed default settings
  INSERT INTO app_settings (tenant_id, key, value) VALUES
    (v_org_id, 'roster_pagination', '{"future_months": 2, "history_months": 6}'::jsonb),
    (v_org_id, 'setlist', '{"max_songs": 3}'::jsonb),
    (v_org_id, 'handbook_permissions', '{"editor_roles": ["Admin", "Coordinator"], "editor_member_ids": []}'::jsonb);

  -- 6. Seed handbook documents (6 default sections)
  INSERT INTO handbook_documents (tenant_id, slug, title, content, major_version, minor_version, is_current, created_by_name)
  VALUES
    (v_org_id, 'vision-values', 'Vision & Values', '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-worship-lead', 'Worship Lead', '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-worship-coordinator', 'Worship Coordinator', '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-music-coordinator', 'Music Coordinator', '', 1, 0, true, p_admin_name),
    (v_org_id, 'weekly-rhythm', 'Weekly Rhythm', '', 1, 0, true, p_admin_name),
    (v_org_id, 'decision-rights', 'Decision Rights', '', 1, 0, true, p_admin_name);

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;
```

**Usage from API route:**
```typescript
const { data, error } = await supabase.rpc("provision_tenant", {
  p_name: name,
  p_slug: slug,
  p_admin_email: adminEmail,
  p_admin_name: adminName,
});

if (error) {
  // Transaction rolled back — no orphaned data
  return NextResponse.json({ error: "Provisioning failed" }, { status: 500 });
}

// Step 7: Send invite email (non-transactional, retryable)
const orgId = data;
await supabase.auth.admin.inviteUserByEmail(adminEmail);

return NextResponse.json({ org_id: orgId, slug, url: `https://${slug}.worshipapp.com` });
```

---

## Appendix C — Migration SQL

See Steps 0.2-0.4 above for the complete migration SQL for files 019-021.

**Migration summary:**

| Migration | Purpose | Risk |
|-----------|---------|------|
| `019_multi_tenant_tables.sql` | Create 5 new tables; seed Church #1 and feature flags | None (additive) |
| `020_add_tenant_id.sql` | Add `tenant_id` to 8 tables; backfill; NOT NULL; indexes | Low (nullable→backfill→NOT NULL) |
| `021_fix_constraints.sql` | Update unique constraints; change app_settings PK | Medium (constraint changes) |
| `022_provision_tenant.sql` | Create `provision_tenant()` stored procedure | None (additive) |

---

## Appendix D — Timeline

```
Wk 1-2   Phase 0: DB Foundation           ░░░░░░░░░░
         |-- Pre-flight: verify table naming
         |-- Migration 019: new tables + seed
         |-- Migration 020: add tenant_id
         |-- Migration 021: fix constraints
         |-- Migration 022: provision_tenant()
         |-- TypeScript types update
         |-- Verify: all tests pass, app unchanged

Wk 3-5   Phase 1: Tenant Propagation      ░░░░░░░░░░░░░░░
         |-- Create tenant.ts + tenant-query.ts
         |-- Update middleware (expanded matcher, subdomain, header security)
         |-- Update /api/me (org_members role, features)
         |-- Update all 25+ API routes
         |-- Update lib/db/members.ts
         |-- Update get-actor.ts
         |-- Fix x-app-role header trust (F2)
         |-- Update login flow
         |-- Verify: Church #1 on subdomain, cross-tenant test

           +=============================================+
           | EARLIEST ONBOARDING POINT (manual SQL)      |
           | Church #2 can be provisioned                 |
           +=============================================+

Wk 6-8   Phase 2: Flags & Platform Admin  ░░░░░░░░░░░░░░░
         |-- Feature flag system
         |-- Platform admin pages (/platform/*)
         |-- Platform admin API routes
         |-- Tenant provisioning via stored procedure
         |-- Feature toggle per tenant

           +=============================================+
           | RECOMMENDED ONBOARDING POINT                |
           | Church #2 + #3 via platform admin UI        |
           +=============================================+

Wk 8-10  Phase 3: Hardening & Go-live     ░░░░░░░░░░░░░░░
         |-- Onboard Church #2 and #3
         |-- Tenant isolation integration tests
         |-- Feature flag tests
         |-- RLS defense-in-depth
         |-- Performance monitoring
         |-- Drop members.app_role
         |-- Full regression testing

           +=============================================+
           | PRODUCTION MULTI-TENANT                     |
           | 3 churches operational                      |
           +=============================================+

Wk 11+   Future: New Modules              ░░░░░░░░░░░░░░░→
         |-- Equipment tracking (tenant-aware from day 1)
         |-- AI roster agent (tenantId required parameter)
         |-- Billing/subscriptions
         |-- White-label branding
```
