# SaaS Multi-Tenant Architecture Plan

> **Status:** Draft — March 2026
> **Scope:** Transition from single-tenant to multi-tenant SaaS supporting 3+ churches
> **Scale assumption:** ~20 musicians and ~60-100 songs per church
> **Companion document:** [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) (architectural analysis, migration strategy, AI agent safety, risk assessment)

---

## Table of Contents

1. [Context & Motivation](#1-context--motivation)
2. [Architecture Decision](#2-architecture-decision)
3. [Current State Assessment](#3-current-state-assessment)
4. [Migration Safety Principles](#4-migration-safety-principles)
5. [Phase 0 — Database Foundation](#5-phase-0--database-foundation)
6. [Phase 1 — Tenant Context Propagation](#6-phase-1--tenant-context-propagation)
7. [Phase 2 — Feature Flags & Platform Admin](#7-phase-2--feature-flags--platform-admin)
8. [Phase 3 — Onboarding & Production Hardening](#8-phase-3--onboarding--production-hardening)
9. [Release Plan & Roadmap](#9-release-plan--roadmap)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Test Strategy](#11-test-strategy)
12. [AI Agent & Future Module Considerations](#12-ai-agent--future-module-considerations)
13. [Appendix — File Impact Map](#13-appendix--file-impact-map)

---

## 1. Context & Motivation

The app currently serves a single church (WCC Worship Ministry). A second church has expressed interest, with a third expected shortly — totalling 3 tenants in the near term.

**Goals:**
- Serve multiple churches from a single deployment
- Isolate each church's data (members, songs, rosters, etc.)
- Allow per-church feature configuration (some features premium/optional)
- Provide a platform-level ("landlord") admin dashboard for managing tenants
- Enable staggered onboarding without disrupting the existing church

**Non-goals (for now):**
- Per-tenant billing/subscription management (manual for 3 tenants)
- White-label branding/theming per church
- Self-service sign-up (tenants are provisioned by platform admin)

---

## 2. Architecture Decision

### Shared database with `tenant_id` column (row-level isolation)

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **Shared DB + `tenant_id`** | **Chosen** | Standard SaaS pattern; works with existing Supabase RLS; single migration set; scales to hundreds of tenants |
| Schema-per-tenant | Rejected | Migrations must run N times; connection pooling complexity; overkill for 3-10 tenants |
| Separate databases | Rejected | Requires separate Supabase projects; separate billing; no shared auth |

Every data table gets a `tenant_id UUID` column pointing to an `organizations` table. All queries filter by `tenant_id`. Supabase RLS provides defense-in-depth.

---

## 3. Current State Assessment

### What exists (single-tenant)

| Layer | State | Multi-tenant impact |
|-------|-------|-------------------|
| **Database** | 18 migrations, ~15 tables, no `tenant_id` anywhere | Every data table needs `tenant_id` column |
| **Auth** | Supabase Auth + cookie-based sessions, middleware reads JWT | Must resolve tenant from subdomain + scope role lookup |
| **Roles** | `app_role` on `members` table (global) | Must move to per-tenant join table (`organization_members`) |
| **API routes** | ~25 route files, all use service role key, no tenant filtering | Every route needs `getTenantId(req)` + `.eq("tenant_id", tid)` |
| **Frontend** | All pages fetch `/api/me` for role, local state only | Minimal changes — `/api/me` response shape stays compatible |
| **Settings** | `app_settings` table with `key` PK | Change PK to `(tenant_id, key)` |
| **Tests** | Vitest + Testing Library, component + integration tests | Fixtures need `tenant_id`; add isolation tests |

### Tables requiring `tenant_id`

| Table | Gets `tenant_id` | Notes |
|-------|:-:|-------|
| `members` | ✗ | **Global identity record** — tenant scoping via `organization_members` only (see [C1 challenge](./CHALLENGE_LOG.md#h1)) |
| `roles` | ✗ | Stays global (musical roles are universal) |
| `member_role_assignments` | ✓ | Simplifies queries |
| `songs` | ✓ | |
| `chord_charts` | ✗ | Inherits via `song_id` FK |
| `roster` | ✓ | |
| `availability` | ✓ | Legacy table |
| `availability_periods` | ✓ | |
| `availability_responses` | ✗ | Inherits via `period_id` FK |
| `availability_dates` | ✗ | Inherits via `response_id` FK |
| `sunday_setlist` | ✓ | |
| `app_settings` | ✓ | PK changes to `(tenant_id, key)` |
| `audit_log` | ✓ | |
| `handbook_documents` | ✓ | |

---

## 4. Migration Safety Principles

> See [TECHNICAL_PLAN.md §3](./TECHNICAL_PLAN.md#3-migration-strategy) for the full migration strategy and zero-downtime guarantees.

These principles govern every change across all phases:

| Principle | Rationale |
|-----------|-----------|
| **Additive changes only** | Never drop columns or tables until the new path is proven. Add `tenant_id` as nullable first, backfill, then make NOT NULL. |
| **Church #1 must never break** | Every intermediate state must pass all existing tests and work in production. |
| **One concern per migration step** | Schema changes, data backfill, and constraint enforcement are separate steps to enable rollback at each point. |
| **Application layer first, RLS second** | Since all writes use the service role key (which bypasses RLS), tenant filtering must work in application code before RLS policies add defense-in-depth. |
| **Feature parity before onboarding** | Don't onboard Church #2 until every module correctly scopes data. A partially-migrated system leaks data. |
| **Every phase has exit criteria** | No phase is "done" without passing its verification checklist. Onboarding gates are explicit. |

---

## 5. Phase 0 — Database Foundation

> **Effort:** 1–2 weeks
> **Deliverable:** Schema ready for multi-tenancy; Church #1 data migrated; all existing tests pass

### 5.1 New tables

#### `organizations` (the tenant)

```sql
CREATE TABLE organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,          -- used in subdomain routing
  is_active  BOOLEAN NOT NULL DEFAULT true,
  settings   JSONB DEFAULT '{}'::jsonb,     -- per-tenant config overrides
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### `organization_members` (member ↔ tenant + role)

```sql
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  member_id       UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  app_role        TEXT NOT NULL CHECK (
    app_role IN ('Admin','Coordinator','Musician','MusicCoordinator','WorshipLeader')
  ),
  is_active       BOOLEAN NOT NULL DEFAULT true,  -- Per-tenant activation (see Challenge C2)
  joined_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (organization_id, member_id)
);
```

**Key decision:** `app_role` moves from `members` → `organization_members`. A person can be Admin at one church and Musician at another.

#### `feature_flags` (global flag definitions)

```sql
CREATE TABLE feature_flags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key        TEXT UNIQUE NOT NULL,     -- "handbook", "setlist", "audit_log"
  label           TEXT NOT NULL,
  description     TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT false
);
```

#### `organization_features` (per-tenant overrides)

```sql
CREATE TABLE organization_features (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  flag_id         UUID REFERENCES feature_flags(id) ON DELETE CASCADE NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, flag_id)
);
```

#### `platform_admins` (super-admin / landlord)

```sql
CREATE TABLE platform_admins (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### 5.2 Add `tenant_id` to existing tables

All changes in a single migration file `019_multi_tenant.sql`:

```sql
-- 1. Create organizations and seed Church #1
INSERT INTO organizations (id, name, slug)
VALUES ('FIXED-UUID', 'WCC Worship Ministry', 'wcc');

-- 2. Add tenant_id as NULLABLE with default to DATA tables (NOT members — see Challenge H1)
-- members is a GLOBAL identity table; tenant scoping is via organization_members only
ALTER TABLE songs ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE roster ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE availability_periods ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE sunday_setlist ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE app_settings ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE audit_log ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE handbook_documents ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';
ALTER TABLE member_role_assignments ADD COLUMN tenant_id UUID
  REFERENCES organizations(id) DEFAULT 'FIXED-UUID';

-- 3. Backfill all existing rows
UPDATE songs SET tenant_id = 'FIXED-UUID' WHERE tenant_id IS NULL;
UPDATE roster SET tenant_id = 'FIXED-UUID' WHERE tenant_id IS NULL;
UPDATE availability_periods SET tenant_id = 'FIXED-UUID' WHERE tenant_id IS NULL;
-- ... repeat for all data tables

-- 4. Make NOT NULL, drop defaults
ALTER TABLE songs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE songs ALTER COLUMN tenant_id DROP DEFAULT;
-- ... repeat for all data tables

-- 5. Add indexes
CREATE INDEX idx_songs_tenant ON songs(tenant_id);
CREATE INDEX idx_roster_tenant ON roster(tenant_id);
CREATE INDEX idx_member_role_assignments_tenant ON member_role_assignments(tenant_id);
-- ... etc.

-- 6. Seed organization_members from existing members.app_role
INSERT INTO organization_members (organization_id, member_id, app_role, is_active)
SELECT 'FIXED-UUID', id, app_role, is_active FROM members;

-- 7. Update app_settings PK → (tenant_id, key)
-- (handled via recreate or ALTER)
```

### 5.3 Seed feature flags

```sql
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
```

Church #1 gets all features enabled:

```sql
INSERT INTO organization_features (organization_id, flag_id, enabled)
SELECT 'FIXED-UUID', id, true FROM feature_flags;
```

### 5.4 Verification & exit criteria

- [ ] Run migration on dev database — verify it rolls back cleanly
- [ ] All existing rows have `tenant_id` set
- [ ] `organization_members` matches current `members.app_role`
- [ ] `app_settings` PK changed — verify no data lost
- [ ] `npm run test` passes (tests use mock data, should be unaffected)
- [ ] `npm run build` passes
- [ ] Manually verify Church #1 app still works end-to-end

**Exit criteria:** All checks above pass. No behavioral change visible to users. Migration is reversible.

---

## 6. Phase 1 — Tenant Context Propagation

> **Effort:** 2–3 weeks
> **Deliverable:** All API routes tenant-scoped; middleware resolves tenant; Church #1 works identically on its subdomain

### 6.1 Tenant resolution strategy

**Subdomain-based:** `{slug}.worshipapp.com`

| Environment | Resolution |
|-------------|-----------|
| Production | Subdomain: `wcc.worshipapp.com` |
| Development | Query param: `localhost:3000?org=wcc` or `wcc.localhost:3000` |
| Fallback | `x-tenant-slug` header (for API testing) |

Vercel supports wildcard subdomains on custom domains out of the box.

### 6.2 Middleware changes (`src/middleware.ts`)

**Middleware matcher** must cover all route groups (see [Challenge C1](./CHALLENGE_LOG.md#c1), [C3](./CHALLENGE_LOG.md#c3)):

```typescript
export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal/:path*"],
};
```

**Security requirement:** Middleware must **delete then set** the `x-tenant-id` header — never trust an incoming value from the client. This prevents header spoofing attacks.

New flow:

```
Request → Extract tenant slug from subdomain
        → DELETE any client-supplied x-tenant-id header
        → Look up organizations by slug (must be active)
        → SET x-tenant-id header on request (overwrite, never append)
        → Existing auth flow (session / cookie fallback)
        → Look up role from organization_members (NOT members.app_role)
        → Route restrictions (same logic, tenant-scoped role)
```

**Route-specific handling:**

| Route group | Tenant resolution | Auth |
|-------------|------------------|------|
| `/admin/*` | Subdomain slug → org lookup | Session + `organization_members` role check |
| `/api/*` | Subdomain slug → org lookup (same as admin) | Session required (except availability token routes) |
| `/portal/*` | Subdomain slug → org lookup | Session or magic token |
| `/availability?token=xxx` | Magic token → member → `organization_members` → org | Token-based (no session) |
| `/platform/*` | No tenant context | `platform_admins` table check |

**Availability route special case:** The magic token lookup returns the member, then queries `organization_members` to find their org(s). If exactly one org → use it. If multiple orgs → require subdomain context.

The tenant ID propagates via:

| From → To | Mechanism |
|-----------|-----------|
| Middleware → API routes | `x-tenant-id` request header (server-set only, never trust client) |
| Middleware → Client pages | `x-tenant-id` cookie (set by middleware) |
| API routes → DB queries | `getTenantId(req)` helper reads header |

### 6.3 New helpers: `src/lib/server/tenant.ts` + `src/lib/db/tenant-query.ts`

```typescript
// src/lib/server/tenant.ts — context extraction (fail-closed)
export function getTenantId(req: NextRequest): string {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) throw new Error("Missing tenant context");
  // Validate UUID format to prevent injection (see Challenge C1)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("Invalid tenant ID format");
  }
  return tenantId;
}
```

```typescript
// src/lib/db/tenant-query.ts — scoped query helpers
// NOTE: tenantFrom() returns a query builder WITHOUT .select() — caller chains
// .select(), .order(), etc. This prevents the helper from being bypassed for
// anything beyond trivial queries. (see Challenge H4)
export function tenantFrom(supabase: SupabaseClient, table: string, tenantId: string) {
  return supabase.from(table).eq("tenant_id", tenantId);
}

export function tenantInsert(supabase: SupabaseClient, table: string, tenantId: string, data: Record<string, unknown>) {
  return supabase.from(table).insert({ ...data, tenant_id: tenantId });
}
```

Both reads AND writes must be tenant-scoped. `tenantInsert` prevents accidentally inserting rows without a `tenant_id`.

### 6.4 API route updates

**Read pattern:** Every route that queries tenant-scoped data adds `.eq("tenant_id", tenantId)`:

```typescript
// BEFORE
const { data } = await supabase.from("songs").select("*").order("title");

// AFTER
const tenantId = getTenantId(req);
const { data } = await supabase
  .from("songs")
  .select("*")
  .eq("tenant_id", tenantId)
  .order("title");
```

**Mutation ownership verification pattern** (critical for PUT/DELETE):

```typescript
// DELETE — MUST verify the resource belongs to this tenant before mutating
const tenantId = getTenantId(req);
const { data: song } = await supabase
  .from("songs")
  .select("tenant_id")
  .eq("id", songId)
  .single();

if (!song || song.tenant_id !== tenantId) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
// Now safe to delete
```

> **Quality rule:** Every PUT/DELETE route must verify resource ownership. Returning 404 (not 403) avoids leaking the existence of cross-tenant resources.

**Full API route impact list:**

| Route | Changes |
|-------|---------|
| `GET /api/me` | Lookup role from `organization_members` by tenant + member |
| `GET/POST /api/members` | Filter/insert with `tenant_id` |
| `PUT/DELETE /api/members/[id]` | Verify member belongs to tenant |
| `GET /api/admin/member` | Scope email lookup to tenant |
| `GET/POST /api/songs` | Filter/insert with `tenant_id` |
| `PUT/DELETE /api/songs/[id]` | Verify song belongs to tenant |
| `GET/POST/PATCH /api/roster` | Filter/insert with `tenant_id` |
| `GET/POST /api/setlist` | Filter/insert with `tenant_id` |
| `*/api/setlist/[id]/*` | Verify setlist belongs to tenant |
| `*/api/availability/*` | Filter/insert with `tenant_id` |
| `GET /api/audit-log` | Filter by `tenant_id` |
| `GET/PATCH /api/settings` | Filter by `tenant_id` |
| `*/api/handbook/*` | Filter by `tenant_id` |
| `POST /api/auth/login` | Verify member belongs to tenant before granting access |

### 6.5 `lib/db/members.ts` refactor

Every function gains a `tenantId` parameter:

```typescript
// BEFORE
export async function getMembers() { ... }

// AFTER
export async function getMembers(tenantId: string) {
  // .eq("tenant_id", tenantId) added to query
}
```

Functions to update: `getMembers`, `createMember`, `getMember`, `getMemberByEmail`, `updateMember`, `deleteMember`.

Exception: `getMemberByMagicToken(token)` — magic tokens are globally unique. The function returns the member (including their `tenant_id`) and the calling code uses that tenant context.

### 6.6 `/api/me` refactor

This is the most impactful change. Currently returns `members.app_role`. Must now:

1. Get `tenant_id` from request context
2. Join `organization_members` to get the **tenant-scoped** `app_role`
3. Return it in the same response shape

```typescript
// Response shape stays backward-compatible (additive only):
{
  id: "...",
  name: "...",
  email: "...",
  app_role: "Admin",                    // now from organization_members
  tenant_id: "...",                     // NEW
  tenant_name: "WCC Worship Ministry",  // NEW — for UI display
  features: ["roster", ...],            // NEW (added in Phase 2)
  // ... rest unchanged
}
```

Client-side `useCurrentMember()` hook requires **no changes** — it already reads `member.app_role` from the response.

### 6.7 Login flow changes

With subdomain routing, the login page at `wcc.worshipapp.com/admin/login` inherits the tenant context.

After authenticating via Supabase Auth:
1. Look up `organization_members` for this user + tenant
2. If not found → return 403: "You are not a member of this organization"
3. If found but `organization_members.is_active = false` → return 403: "Your account is deactivated at this church"
4. If `members.is_active = false` → return 403: "Your account has been suspended" (platform-level kill switch, only platform admins can set this — see [Challenge C2](./CHALLENGE_LOG.md#c2))
5. If both active → proceed with existing cookie-setting flow

### 6.8 Multi-org membership

A person CAN belong to multiple churches via separate rows in `organization_members`. They access each church via its subdomain. No tenant-switcher UI needed initially.

### 6.9 Verification & exit criteria

- [ ] Church #1 accessible at `wcc.worshipapp.com` (or `localhost:3000?org=wcc` in dev)
- [ ] All pages load with correct data
- [ ] Roles work correctly (Admin, Coordinator, etc.)
- [ ] A manually-provisioned Church #2 shows only its own data
- [ ] Cross-tenant data leak test: Church #2 admin cannot see Church #1 data
- [ ] Cross-tenant mutation test: Church #2 admin cannot DELETE/PUT Church #1 resources
- [ ] **Header spoofing test:** API route ignores client-supplied `x-tenant-id` header (see [C1](./CHALLENGE_LOG.md#c1))
- [ ] **Portal routes:** `/portal/roster` and `/portal/songs` resolve tenant from subdomain (see [C3](./CHALLENGE_LOG.md#c3))
- [ ] **Availability routes:** Magic token resolves member → org; correct tenant data shown
- [ ] **Per-tenant deactivation:** `organization_members.is_active = false` blocks access to THAT org only (see [C2](./CHALLENGE_LOG.md#c2))
- [ ] Deactivated org (is_active=false) returns error, not data
- [ ] `npm run test` passes with updated fixtures
- [ ] `npm run build` passes

**Exit criteria:** All checks above pass. Church #1 fully functional on subdomain.

**Onboarding gate:** Church #2 can be provisioned via manual SQL at this point. Core features work but no platform admin UI yet.

---

## 7. Phase 2 — Feature Flags & Platform Admin

> **Effort:** 2–3 weeks
> **Deliverable:** Platform admin dashboard; feature flags gate UI; **Church #2 can be fully onboarded**

### 7.1 Feature flag system

#### Server-side check

New file `src/lib/server/feature-flags.ts`:

```typescript
export async function isFeatureEnabled(
  tenantId: string,
  flagKey: string
): Promise<boolean> {
  // 1. Check organization_features for explicit override
  // 2. Fall back to feature_flags.default_enabled
}

export async function getEnabledFeatures(
  tenantId: string
): Promise<string[]> {
  // Returns all enabled flag_keys for this tenant
}
```

#### Client-side delivery

Add to `/api/me` response:

```json
{
  "features": ["roster", "availability", "setlist", "songs"]
}
```

#### UI gating

In `src/app/admin/layout.tsx`, filter sidebar navigation:

```typescript
const FEATURE_ROUTE_MAP: Record<string, string> = {
  roster:       "/admin/roster",
  songs:        "/admin/songs",
  availability: "/admin/availability",
  setlist:      "/admin/setlist",
  handbook:     "/admin/handbook",
  audit_log:    "/admin/audit",
};

// Hide sidebar items for disabled features
const visibleRoutes = sidebarItems.filter(
  (item) => !FEATURE_ROUTE_MAP[item.feature] || features.includes(item.feature)
);
```

Individual pages also check and redirect if the feature is disabled for their tenant.

### 7.2 Platform admin dashboard

**Route group:** `/platform/` — separate from `/admin/`, not tenant-scoped.

**Auth:** Platform admins identified by `platform_admins` table. Middleware detects `/platform/*` routes and checks this table instead of `organization_members`.

#### Pages

| Route | Purpose |
|-------|---------|
| `/platform/login` | Platform admin login |
| `/platform/dashboard` | Overview: tenant count, total members/songs across all tenants, system health |
| `/platform/tenants` | List all organizations with stats (member count, song count, active/inactive) |
| `/platform/tenants/new` | Create new tenant form |
| `/platform/tenants/[id]` | Tenant detail: stats, settings overrides, admin contact |
| `/platform/tenants/[id]/features` | Toggle feature flags per tenant |
| `/platform/tenants/[id]/members` | Read-only member list for this tenant |
| `/platform/flags` | Manage global feature flag definitions (add/edit/remove flags) |

#### Tenant provisioning flow

From "Add Tenant" in platform admin:

```
Input: name, slug, admin_email, admin_name
  ↓
Steps 1–6 execute inside a PostgreSQL stored procedure (single transaction):
  SELECT provision_tenant(name, slug, admin_email, admin_name)
    1. INSERT INTO organizations (name, slug)
    2. INSERT INTO organization_features (defaults from feature_flags)
    3. INSERT INTO app_settings (default config for new tenant)
    4. CREATE OR FIND members row for admin_email
    5. INSERT INTO organization_members (org_id, member_id, 'Admin')
    6. Seed handbook_documents (6 default sections)
  → If ANY step fails, entire transaction rolls back (no orphaned data)
  ↓
Step 7 runs AFTER the transaction commits (non-transactional):
  7. If no Supabase Auth account → supabase.auth.admin.inviteUserByEmail()
  → If invite fails, org is valid — invite can be retried
  ↓
Return: { org_id, slug, tenant_url }
```

> **Why a stored procedure?** The Supabase JS client has no multi-statement transaction support. Without a stored procedure, a failure at step 5 would leave an organization with no admin. See [Challenge H2](./CHALLENGE_LOG.md#h2).

### 7.3 Platform admin API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/platform/tenants` | GET | List all tenants with stats |
| `/api/platform/tenants` | POST | Provision new tenant |
| `/api/platform/tenants/[id]` | GET | Tenant detail |
| `/api/platform/tenants/[id]` | PATCH | Update tenant (name, is_active, settings) |
| `/api/platform/tenants/[id]/features` | GET | List feature flags for tenant |
| `/api/platform/tenants/[id]/features` | PUT | Update feature flags for tenant |
| `/api/platform/flags` | GET | List all global feature flags |
| `/api/platform/flags` | POST | Create new feature flag |
| `/api/platform/flags/[id]` | PUT | Update flag definition |

All `/api/platform/*` routes require `platform_admins` authentication.

### 7.4 Verification & exit criteria

- [ ] Platform admin can log in at `/platform/login`
- [ ] Dashboard shows correct tenant stats
- [ ] Can create a new tenant via UI
- [ ] Feature flags toggle correctly per tenant
- [ ] Disabled features hide from sidebar + block API access (server returns 403)
- [ ] New tenant's admin receives invite email and can log in
- [ ] Provisioned tenant has correct default settings and feature flags

**Exit criteria:** Tenants can be provisioned and configured entirely through the platform admin UI.

**Onboarding gate:** Church #2 and #3 can be onboarded via the platform admin dashboard.

---

## 8. Phase 3 — Onboarding & Production Hardening

> **Effort:** 2–3 weeks
> **Deliverable:** Churches #2 and #3 onboarded; system hardened with isolation tests and defense-in-depth

### 8.1 Tenant-scoped settings

The existing `/admin/settings` page becomes tenant-specific automatically (since `app_settings` now has `tenant_id`). Each church can independently configure:

- Roster pagination (`future_months`, `history_months`)
- Setlist max songs per Sunday
- Handbook editor permissions

### 8.2 Onboard Church #2

1. Platform admin creates tenant via `/platform/tenants/new`
2. DNS: Vercel wildcard handles `church2.worshipapp.com` automatically
3. Church #2 admin receives invite email → sets password → logs in
4. Admin adds their members, songs, configures roster

### 8.3 Onboard Church #3

Same process. At this point onboarding is a 5-minute operation.

### 8.4 Optional: CSV import

If churches have existing data in spreadsheets, add a simple CSV import on:
- **People page:** Import members (name, email, phone, roles)
- **Songs page:** Import songs (title, artist, status, categories)

This is optional but significantly accelerates onboarding.

### 8.5 Tenant isolation integration tests

New test file `__tests__/integration/tenant-isolation.test.ts`:

```typescript
// Setup: Two tenants with separate members, songs, rosters
// For each API endpoint:
//   1. Fetch as Tenant A → returns only Tenant A data
//   2. Fetch as Tenant B → returns only Tenant B data
//   3. Tenant A cannot access Tenant B's resources by ID (GET returns 404)
//   4. Tenant A cannot mutate Tenant B's resources (PUT/DELETE returns 404)
//   5. Multi-org member sees correct data per subdomain
//   6. Deactivated organization (is_active=false) is fully blocked
```

Cover: members, songs, roster, setlist, availability, settings, handbook, audit log.

### 8.6 Feature flag tests

- Disabled feature returns 403 from API
- Sidebar hides disabled feature
- Direct URL navigation to disabled feature redirects
- Newly provisioned tenant gets correct default flags

### 8.7 RLS defense-in-depth

Add tenant-scoped RLS policies as a safety net (application layer is primary):

```sql
CREATE POLICY "tenant_isolation" ON members
  FOR SELECT USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.is_platform_admin', true) = 'true'
  );
```

Since service role key bypasses RLS, these only activate if the anon key is ever used — defense-in-depth only.

### 8.8 Performance indexes

```sql
CREATE INDEX idx_roster_tenant_date ON roster(tenant_id, date);
CREATE INDEX idx_songs_tenant_title ON songs(tenant_id, title);
CREATE INDEX idx_availability_periods_tenant ON availability_periods(tenant_id, starts_on DESC);
CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);
```

### 8.9 Feature flag performance

> **Note:** In-memory caching (e.g., 60s TTL Map) does NOT work on Vercel serverless — each function invocation starts with empty memory, and concurrent invocations don't share state. See [Challenge H3](./CHALLENGE_LOG.md#h3).

At 3–10 tenants, accept the DB lookup per request. `SELECT FROM organizations WHERE slug = ?` with an indexed column is <5ms.

**Future optimizations (when needed at scale):**
- **Vercel KV (Redis):** Cache slug→id and feature flag lookups
- **JWT custom claims (via Supabase Auth hooks):** Embed `tenant_id` and `app_role` in the JWT — eliminates the middleware DB lookup entirely

### 8.10 Drop deprecated column

Remove `members.app_role` column after verifying all code reads from `organization_members`. Keep for 1 release as a safety buffer.

### 8.11 Verification & exit criteria

- [ ] Church #2 fully operational (all features tested end-to-end)
- [ ] Church #3 fully operational
- [ ] Each church sees only its own data
- [ ] Settings changes in one church don't affect others
- [ ] All tenant isolation integration tests pass
- [ ] All feature flag tests pass
- [ ] Performance acceptable with 3 tenants (check query plans)
- [ ] RLS policies active as safety net
- [ ] `members.app_role` column dropped (or scheduled for next release)
- [ ] Platform admin dashboard shows correct stats for all 3
- [ ] `npm run test` — full suite passes
- [ ] `npm run build` — clean build

**Exit criteria:** 3 churches operational. Isolation tests pass. Performance acceptable. Full test suite green.

---

## 9. Release Plan & Roadmap

### Timeline

```
Week 1-2   ┃ Phase 0: Database Foundation
           ┃ ├─ New tables (organizations, org_members, feature_flags, etc.)
           ┃ ├─ Add tenant_id to all data tables
           ┃ ├─ Migrate Church #1 data
           ┃ └─ Verify existing functionality unbroken
           ┃
Week 3-5   ┃ Phase 1: Tenant Context Propagation
           ┃ ├─ Middleware: subdomain → tenant resolution
           ┃ ├─ All API routes: tenant-scoped queries
           ┃ ├─ Mutation ownership verification on all PUT/DELETE
           ┃ ├─ /api/me: return role from organization_members
           ┃ ├─ Login flow: tenant-aware member validation
           ┃ └─ DB helpers: tenantId parameter on all functions
           ┃
           ┃   ╔══════════════════════════════════════════════╗
           ┃   ║ ⚑ EARLIEST ONBOARDING POINT (manual)        ║
           ┃   ║   Church #2 can be provisioned via SQL       ║
           ┃   ║   Core features work, no admin UI yet        ║
           ┃   ╚══════════════════════════════════════════════╝
           ┃
Week 6-8   ┃ Phase 2: Feature Flags & Platform Admin
           ┃ ├─ Feature flag system (server + client)
           ┃ ├─ Platform admin pages (/platform/*)
           ┃ ├─ Tenant provisioning via UI
           ┃ └─ Feature toggle per tenant
           ┃
           ┃   ╔══════════════════════════════════════════════╗
           ┃   ║ ⚑ RECOMMENDED ONBOARDING POINT              ║
           ┃   ║   Church #2 + #3 onboarded via platform UI  ║
           ┃   ║   Feature flags control their experience     ║
           ┃   ╚══════════════════════════════════════════════╝
           ┃
Week 8-10  ┃ Phase 3: Onboarding & Production Hardening
           ┃ ├─ Onboard Church #2 and #3
           ┃ ├─ Tenant isolation integration tests
           ┃ ├─ Feature flag tests
           ┃ ├─ RLS defense-in-depth policies
           ┃ ├─ Performance indexes
           ┃ ├─ Drop members.app_role column
           ┃ └─ Full regression testing
           ┃
Week 11+   ┃ Future: New modules (tenant-aware from day one)
           ┃ ├─ Equipment tracking
           ┃ ├─ AI roster agent
           ┃ ├─ Billing/subscriptions
           ┃ └─ White-label branding
```

### Release milestones

| Release | Phase | What ships | Who can onboard |
|---------|-------|-----------|----------------|
| **v1.1** | 0 | DB schema ready, Church #1 migrated, app unchanged from user perspective | Nobody new yet |
| **v1.2** | 1 | Tenant-scoped app, subdomain routing, Church #1 on `wcc.worshipapp.com` | Church #2 (manual SQL provisioning) |
| **v1.3** | 2 | Platform admin dashboard, feature flags, UI-based provisioning | Church #2 + #3 (via platform admin) |
| **v1.4** | 3 | Churches #2 and #3 live, hardened, isolation-tested, performance-optimized | Production-ready for growth |

### Staggered onboarding plan

| Church | Onboard at | How | Notes |
|--------|-----------|-----|-------|
| Church #1 (WCC) | Already live | Automatic (migration backfill) | Zero disruption; existing data preserved |
| Church #2 | End of Phase 1 (week 5) or Phase 2 (week 8) | Phase 1: Manual SQL; Phase 2: Platform admin UI | Recommend waiting for Phase 2 unless urgent |
| Church #3 | Phase 2 or Phase 3 (week 8-10) | Platform admin UI | Full self-service onboarding |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Missing `tenant_id` filter on a query** → data leak | High | `tenantFrom()` / `tenantInsert()` wrappers; mutation ownership verification on PUT/DELETE; isolation integration tests; RLS defense-in-depth |
| **Missing ownership check on mutations** → cross-tenant writes | High | Every PUT/DELETE must verify `resource.tenant_id === tenantId` before mutating; return 404 not 403 to avoid leaking resource existence |
| **Magic token links break** (currently tenant-unaware) | Medium | Tokens are globally unique UUIDs; lookup returns tenant_id; portal uses it to scope data |
| **`members.app_role` vs `organization_members.app_role` confusion** during migration | Medium | Mark as `@deprecated` in TypeScript types in Phase 0; update `/api/me` first; drop column in Phase 3 |
| **Existing Church #1 URLs break** | Medium | Support both bare domain and subdomain during Phase 1; redirect bare domain to `wcc.worshipapp.com` |
| **Middleware performance** (now does DB lookup for every request) | Medium | Accept DB lookup at current scale (<5ms indexed query for 3-10 tenants); future: Vercel KV or JWT custom claims — see [Challenge H3](./CHALLENGE_LOG.md#h3) |
| **Supabase Auth is global** (not per-tenant) | Low | This is fine — one auth pool, tenant scoping via `organization_members`. A user can belong to multiple orgs |
| **Subdomain DNS/Vercel config issues** | Low | Vercel wildcard subdomains work natively; test in staging first |
| **Performance with extra `tenant_id` filters** | Low | At 3-10 tenants, ~20 members each, negligible. Composite indexes added in Phase 0/3 |

### Complexity areas to monitor

| Area | Complexity driver | Watch for |
|------|------------------|-----------|
| Middleware | Now resolves tenant + auth + role + features | Keep middleware lean; extract helpers into `lib/server/`; add timing logs |
| `/api/me` | Joins `members` + `organization_members` + `organization_features` | Single well-optimized query with proper indexes |
| Test fixtures | Every test needs `tenant_id` in mock data | Create shared test helpers (`createTestTenant()`, `createTestMember(tenantId)`) |
| New developer onboarding | "Why are there two role columns?" | Document transition in CLAUDE.md; drop `members.app_role` ASAP after Phase 1 |

---

## 11. Test Strategy

> See [TECHNICAL_PLAN.md §8.4](./TECHNICAL_PLAN.md#84-complexity-areas-to-monitor) for complexity monitoring areas.

### 11.1 Test categories for multi-tenancy

| Category | When to add | What it covers |
|----------|------------|---------------|
| **Tenant isolation tests** | Phase 1 (start), Phase 3 (complete) | Every API endpoint returns only the requesting tenant's data; cross-tenant GET/PUT/DELETE returns 404 |
| **Mutation ownership tests** | Phase 1 | PUT/DELETE on resource owned by another tenant returns 404; INSERT without tenant_id fails |
| **Multi-org member tests** | Phase 1 | Member belongs to 2 orgs; sees correct data and role per subdomain |
| **Deactivated org tests** | Phase 1 | `is_active=false` org → all requests blocked; platform admin can still view |
| **Feature flag tests** | Phase 2 | Disabled feature → 403 API + hidden sidebar item + redirect on direct URL |
| **Platform admin tests** | Phase 2 | Tenant CRUD; feature toggle; cannot access tenant admin routes |
| **Provisioning tests** | Phase 2 | New tenant gets correct default settings, feature flags, and handbook sections |

### 11.2 Test fixtures

Create shared helpers to reduce boilerplate across all test files:

```typescript
// __tests__/helpers/tenant-fixtures.ts
export const TEST_TENANT_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const TEST_TENANT_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export function createTestTenant(overrides?: Partial<Organization>): Organization { ... }
export function createTestMember(tenantId: string, overrides?: Partial<Member>): Member { ... }
export function mockTenantHeaders(tenantId: string): Headers { ... }
```

### 11.3 Existing tests

All existing component and integration tests must be updated to include `tenant_id` in mock data. Use `TEST_TENANT_A_ID` as the default to keep existing test behavior unchanged.

### 11.4 Observability

| Signal | Where | Purpose |
|--------|-------|---------|
| Tenant resolution timing | Middleware | Detect cache misses or slow org lookups |
| Unscoped query detection | `tenantFrom()` / `tenantInsert()` | Log warning if called with empty tenantId (should never happen) |
| Cross-tenant 404s | API routes | Spike in 404s on mutation endpoints may indicate a tenant boundary bug or attack |
| Feature flag query timing | `isFeatureEnabled()` | Monitor if DB lookup latency becomes a concern (future: add Vercel KV caching) |

---

## 12. AI Agent & Future Module Considerations

> See [TECHNICAL_PLAN.md §6](./TECHNICAL_PLAN.md#6-ai-agent-considerations) for the full AI agent safety analysis.

### 12.1 AI agents (roster recommendation, fairness analysis)

AI agents are **not yet implemented** (no AI SDK dependencies in the codebase). When built, they must follow these tenant safety rules:

1. **Tenant context injected, never inferred** — every agent invocation receives `tenantId` as a required parameter
2. **All data queries use tenant-scoped helpers** — `getMembers(tenantId)`, `getRoster(tenantId, month)`, never raw `supabase.from()`
3. **No cross-tenant data in LLM context** — if using Claude/GPT for recommendations, prompts contain only the current tenant's data
4. **Outputs are recommendations only** — agents never auto-commit; human approval required per tenant
5. **Agent actions are audit-logged** — `audit_log` with correct `tenant_id`

### 12.2 Equipment tracking

Equipment tracking is documented in PROJECT-CONTEXT.md but not yet built. When implemented:

- All tables must include `tenant_id` from day one (avoids the backfill migration we face with current tables)
- API routes use `getTenantId(req)` + `tenantFrom()` / `tenantInsert()`
- Gated behind the `equipment` feature flag (default: disabled for new tenants)

### 12.3 Future modules

| Module | Tenant design rule |
|--------|-------------------|
| Equipment tracking | `tenant_id` on all tables; `getTenantId()` in all routes |
| AI roster agent | `tenantId` as required parameter; feature-flagged (`ai_roster`) |
| Billing/subscriptions | Link to `organizations`; gate features based on plan tier |
| White-label branding | `organizations.settings` JSONB stores logo URL, color scheme |
| Self-service signup | Public registration → creates organization + admin member |

---

## 13. Appendix — File Impact Map

### Database

| File | Change |
|------|--------|
| `supabase/migrations/019_multi_tenant.sql` | **NEW** — All schema changes (tables, columns, indexes, seed data) |

### Backend — Core

| File | Change |
|------|--------|
| `src/middleware.ts` | Subdomain tenant resolution; role lookup from `organization_members`; platform admin route handling |
| `src/lib/server/tenant.ts` | **NEW** — `getTenantId(req)` helper |
| `src/lib/server/get-actor.ts` | Add `tenantId` to `AuditActor`; lookup from `organization_members` |
| `src/lib/server/feature-flags.ts` | **NEW** — `isFeatureEnabled()`, `getEnabledFeatures()` |
| `src/lib/db/members.ts` | Add `tenantId` param to all functions |
| `src/lib/db/tenant-query.ts` | **NEW** — `tenantFrom()` query wrapper |
| `src/lib/types/database.ts` | Add `Organization`, `OrganizationMember`, `FeatureFlag`, `PlatformAdmin` types; add `tenant_id` to existing types |

### Backend — API Routes (tenant filter on every query)

| Route | Change type |
|-------|------------|
| `src/app/api/me/route.ts` | Role from `organization_members`; add `features` to response |
| `src/app/api/members/route.ts` | Add tenant filter |
| `src/app/api/members/[id]/route.ts` | Add tenant filter |
| `src/app/api/admin/member/route.ts` | Add tenant filter |
| `src/app/api/songs/route.ts` | Add tenant filter |
| `src/app/api/songs/[id]/route.ts` | Add tenant filter |
| `src/app/api/roster/route.ts` | Add tenant filter |
| `src/app/api/setlist/route.ts` | Add tenant filter |
| `src/app/api/setlist/[id]/*.ts` | Add tenant filter |
| `src/app/api/availability/*/route.ts` | Add tenant filter |
| `src/app/api/audit-log/route.ts` | Add tenant filter |
| `src/app/api/settings/route.ts` | Add tenant filter |
| `src/app/api/handbook/*/route.ts` | Add tenant filter |
| `src/app/api/auth/login/route.ts` | Verify member belongs to tenant |

### Backend — Platform Admin (all new)

| Route | Purpose |
|-------|---------|
| `src/app/api/platform/tenants/route.ts` | **NEW** — List/create tenants |
| `src/app/api/platform/tenants/[id]/route.ts` | **NEW** — Tenant detail/update |
| `src/app/api/platform/tenants/[id]/features/route.ts` | **NEW** — Feature flag management |
| `src/app/api/platform/flags/route.ts` | **NEW** — Global flag CRUD |

### Frontend

| File | Change |
|------|--------|
| `src/app/admin/layout.tsx` | Feature-flag gated sidebar; tenant name display |
| `src/app/platform/layout.tsx` | **NEW** — Platform admin layout |
| `src/app/platform/dashboard/page.tsx` | **NEW** — Overview dashboard |
| `src/app/platform/tenants/page.tsx` | **NEW** — Tenant list |
| `src/app/platform/tenants/new/page.tsx` | **NEW** — Tenant creation form |
| `src/app/platform/tenants/[id]/page.tsx` | **NEW** — Tenant detail |
| `src/app/platform/tenants/[id]/features/page.tsx` | **NEW** — Feature toggle UI |
| `src/app/platform/flags/page.tsx` | **NEW** — Flag management UI |
| `src/app/platform/login/page.tsx` | **NEW** — Platform admin login |

### Tests

| File | Change |
|------|--------|
| `__tests__/helpers/tenant-fixtures.ts` | **NEW** — Shared tenant test helpers and constants |
| `__tests__/integration/tenant-isolation.test.ts` | **NEW** — Cross-tenant data isolation tests (reads + mutations) |
| `__tests__/integration/feature-flags.test.ts` | **NEW** — Feature flag enforcement tests |
| `__tests__/integration/multi-org-member.test.ts` | **NEW** — Multi-org membership tests |
| `__tests__/integration/tenant-provisioning.test.ts` | **NEW** — Provisioning flow tests (defaults, invites) |
| `__tests__/components/*.test.tsx` | Update fixtures to include `tenant_id` |
