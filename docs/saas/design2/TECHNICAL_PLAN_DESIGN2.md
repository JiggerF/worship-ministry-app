# Multi-Tenant SaaS — Technical Planning Document (Design 2)

> **Status:** Draft — March 2026
> **Pipeline:** `feature-planning-pipeline.md` (6-phase engineering planning cycle)
> **Skills applied:** Product Manager, SaaS Architect, Systems Thinking, Staff Software Engineer, SDET/Quality Engineer
> **System context:** [PROJECT-CONTEXT.md](../../../.claude/context/PROJECT-CONTEXT.md)
> **Companion document:** [SAAS_ARCHITECTURE_WRKFLOW2.md](./SAAS_ARCHITECTURE_WRKFLOW2.md) (implementation roadmap)
> **Challenge log:** [CHALLENGE_LOG.md](./CHALLENGE_LOG.md) (critical review findings)

---

## Table of Contents

1. [Phase 1 — Feature Definition](#phase-1--feature-definition)
2. [Phase 2 — Architecture Design](#phase-2--architecture-design)
3. [Phase 4 — Test Strategy](#phase-4--test-strategy)
4. [Phase 6 — Critical Design Review](#phase-6--critical-design-review)

---

## Phase 1 — Feature Definition

### 1.1 Problem Statement

The Worship Ministry Platform currently operates as a **single-tenant application** serving one church (WCC Worship Ministry). All data — members, songs, rosters, availability, settings — lives in a single global dataset with no organizational boundary.

A second church has expressed interest in using the platform, with a third expected shortly. Without tenant isolation, onboarding a second church would:
- Expose Church A's members, songs, and rosters to Church B
- Merge availability responses across organizations
- Make it impossible to have different admins or settings per church
- Create role conflicts (a person cannot be Admin at one church and Musician at another)

**The core problem:** There is no concept of "which organization does this data belong to?" anywhere in the system.

### 1.2 Target Users

| User type | Description | Multi-tenancy impact |
|-----------|-------------|---------------------|
| **Church Admin** | 1-2 per church; manages members, songs, rosters, settings | Needs full control of their own church's data; must not see other churches |
| **Coordinator / WorshipLeader / MusicCoordinator** | Per-church staff with restricted admin access | Same role, scoped to their church only |
| **Musician** | ~20 per church; submits availability, views portal | Accesses portal and availability form; data scoped to their church |
| **Platform Admin (Landlord)** | Single operator managing all tenants | Provisions churches, toggles features, monitors health across all orgs |

### 1.3 Expected Outcome

3+ churches operating independently on a single deployment:
- Strict data isolation (Church A cannot see or modify Church B's data)
- Per-church roles (same person can have different roles at different churches)
- Per-church feature flags (some features enabled for some churches only)
- Platform admin dashboard for tenant management
- Zero disruption to the existing church during migration

### 1.4 Constraints (from codebase analysis)

| # | Constraint | Source |
|---|-----------|--------|
| C1 | `members.email` has a UNIQUE constraint — a person in 2 churches needs ONE `members` row | `supabase/migrations/001_init.sql` |
| C2 | `members.app_role` is a global column — no way to have per-church roles | `src/lib/types/database.ts` |
| C3 | Middleware only matches `/admin/:path*` — `/api/*`, `/portal/*`, `/availability/*` are unprotected | `src/middleware.ts` line 246-248 |
| C4 | All 25+ API routes use service role key with zero tenant filtering | All files under `src/app/api/` |
| C5 | `app_settings` PK is `(key)` — global singleton, not per-tenant | `supabase/migrations/003_settings.sql` |
| C6 | Magic tokens are globally unique but tenant-unaware | `src/lib/db/members.ts` `getMemberByMagicToken()` |
| C7 | Vercel serverless functions are ephemeral — no persistent in-memory cache | Infrastructure constraint |
| C8 | Supabase JS client has no multi-statement transaction support | Supabase SDK limitation |
| C9 | `roster` table has UNIQUE `(date, role_id)` — globally scoped, blocks multi-tenant use | `supabase/migrations/001_init.sql` |
| C10 | All writes use the service role key (bypasses RLS) — tenant filtering must work in application code | `src/lib/db/members.ts` |
| C11 | `availability_periods` EXCLUDE constraint (`no_overlapping_open_periods`) is globally scoped — blocks overlapping periods across tenants | `supabase/migrations/014_no_overlapping_open_periods.sql` |
| C12 | Middleware runs in Edge Runtime — DB lookups add latency to every request; no persistent caching | `src/middleware.ts` |
| C13 | Service role clients created in 12+ locations with two query patterns (lib/db helpers AND direct `supabase.from()` in routes) | Multiple files |

### 1.5 Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Data leak via missing tenant filter** | Critical | Any of the 25+ API routes missing `.eq("tenant_id")` leaks data cross-tenant |
| **Header spoofing** | Critical | If middleware doesn't cover all routes, a client could forge `x-tenant-id` |
| **Portal/availability gap** | Critical | Portal and availability routes have zero tenant context today |
| **Dual role confusion** | High | `members.app_role` vs `organization_members.app_role` during migration period |
| **Magic token ambiguity** | High | Multi-org member's token doesn't specify which church's data to show |
| **Non-atomic provisioning** | High | Partial failure during tenant creation leaves orphaned data |
| **Middleware performance** | Medium | DB lookup on every request for slug→org resolution |
| **Unique constraint conflicts** | Medium | `roster(date, role_id)` prevents same-date assignments across tenants |

### 1.6 MVP Scope

**In scope (must have):**
- `organizations` table with subdomain-based routing
- `organization_members` join table with per-tenant `app_role` and `is_active`
- `tenant_id` column on all data tables (except `members` and `roles`)
- All API routes scoped by `tenant_id`
- Middleware expanded to cover `/api/*` and `/portal/*`
- Feature flag system (DB-stored, per-tenant overrides)
- Platform admin dashboard for tenant CRUD and feature toggles
- Atomic tenant provisioning via PostgreSQL stored procedure
- `MULTI_TENANT_ENABLED` environment variable kill switch

**Out of scope (future):**
- Self-service church signup (tenants provisioned by platform admin)
- Per-tenant billing/subscriptions (manual for 3 tenants)
- White-label branding per church
- Tenant-switcher UI (each church accessed via its own subdomain)
- CSV import for bulk data migration

### 1.7 Future Extensions

| Extension | When | Notes |
|-----------|------|-------|
| Equipment tracking module | Post-launch | Design tenant-aware from day one (no backfill) |
| AI roster recommendation agent | Post-launch | Must receive `tenantId` as required parameter; no cross-tenant context |
| Billing / subscriptions | When tenant count > 5 | Stripe integration linked to `organizations` |
| White-label branding | When requested | `organizations.settings` JSONB for logo, colors |
| Self-service signup | When scaling beyond manual | Public registration creates org + admin member |

---

## Phase 2 — Architecture Design

### 2.1 System Overview

**Tenancy model:** Shared database with `tenant_id` column (row-level isolation)

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **Shared DB + `tenant_id`** | **Chosen** | Standard SaaS pattern; works with Supabase RLS; single migration set; scales to hundreds of tenants |
| Schema-per-tenant | Rejected | Migrations must run N times; connection pooling complexity; overkill for 3-10 tenants |
| Separate databases | Rejected | Separate Supabase projects; separate billing; no shared auth pool |

```
+-------------------------------------------------+
|              Supabase (PostgreSQL)                |
|                                                   |
|  +-------------+  +-------------+  +----------+  |
|  | Church A     |  | Church B     |  | Church C |  |
|  | tenant_id=X  |  | tenant_id=Y  |  | tid=Z    |  |
|  |              |  |              |  |          |  |
|  | songs        |  | songs        |  | songs    |  |
|  | roster       |  | roster       |  | roster   |  |
|  | avail        |  | avail        |  | avail    |  |
|  +-------------+  +-------------+  +----------+  |
|                                                   |
|  +---------------------------------------------+  |
|  | Shared / Global                               |  |
|  | members, roles, organizations, feature_flags, |  |
|  | platform_admins                               |  |
|  +---------------------------------------------+  |
+-------------------------------------------------+
```

### 2.2 Data Model Changes

#### New tables (5)

##### `organizations` — the tenant entity

```sql
CREATE TABLE organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,          -- subdomain routing key
  is_active  BOOLEAN NOT NULL DEFAULT true,
  settings   JSONB DEFAULT '{}'::jsonb,     -- per-tenant config overrides
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

##### `organization_members` — member ↔ tenant with per-tenant role

```sql
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  member_id       UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  app_role        TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,  -- per-tenant deactivation
  joined_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (organization_id, member_id)
);
```

**Key decisions:**
- `app_role` moves from `members` → `organization_members` — a person can be Admin at Church A and Musician at Church B
- `is_active` is per-tenant — Church A deactivating a shared member does NOT affect Church B
- `members.is_active` becomes a platform-level kill switch (only platform admins set it)

##### `feature_flags` — global flag definitions

```sql
CREATE TABLE feature_flags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key        TEXT UNIQUE NOT NULL,     -- "roster", "setlist", "handbook"
  label           TEXT NOT NULL,
  description     TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT false
);
```

##### `organization_features` — per-tenant flag overrides

```sql
CREATE TABLE organization_features (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  flag_id         UUID REFERENCES feature_flags(id) ON DELETE CASCADE NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, flag_id)
);
```

##### `platform_admins` — landlord accounts (separate from church members)

```sql
CREATE TABLE platform_admins (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### Tables receiving `tenant_id`

| Table | Index strategy | Notes |
|-------|---------------|-------|
| `songs` | `(tenant_id, title)` | Composite for filtered search |
| `roster` | `(tenant_id, date)` | Primary query by month; UNIQUE changes to `(tenant_id, date, role_id)` |
| `member_role_assignments` | `(tenant_id, member_id)` | Simplifies join-free queries |
| `availability_periods` | `(tenant_id, starts_on DESC)` | Ordered listing; EXCLUDE constraint must be recreated with `tenant_id` — see [Challenge C1](./CHALLENGE_LOG.md#c1-availability_periods-exclude-constraint-breaks-in-multi-tenant) |
| `availability` | `(tenant_id)` | Legacy table |
| `sunday_setlist` | `(tenant_id, sunday_date)` | Lookup by date |
| `app_settings` | PK changes to `(tenant_id, key)` | Was singleton, becomes per-tenant |
| `audit_log` | `(tenant_id, created_at DESC)` | Per-tenant activity feed |
| `handbook_documents` | `(tenant_id, slug, is_current)` | Scoped versioning |

#### Tables staying global (no `tenant_id`)

| Table | Reasoning |
|-------|-----------|
| `members` | Global identity record. `email` has UNIQUE constraint. A person in 2 churches has ONE row. Adding `tenant_id` creates a contradiction. All tenant scoping via `organization_members`. |
| `roles` | Musical roles (drums, bass, vocals, etc.) are universal across all churches. |

#### Tables inheriting tenant via FK (no direct `tenant_id`)

| Table | Inherits via | Reasoning |
|-------|-------------|-----------|
| `chord_charts` | `song_id → songs.tenant_id` | Always queried via song JOIN |
| `availability_responses` | `period_id → availability_periods.tenant_id` | Always queried via period |
| `availability_dates` | `response_id → availability_responses` | Always queried via response chain |

### 2.3 Tenant Context Flow

```
Browser request
  |
  v
Subdomain: wcc.worshipapp.com
  |
  v
Middleware (matcher: /admin/*, /api/*, /portal/*)
  |-- DELETE any client-supplied x-tenant-id header
  |-- Extract slug from subdomain ("wcc") or ?org= query param (dev)
  |-- DB: SELECT id FROM organizations WHERE slug = 'wcc' AND is_active = true
  |-- SET x-tenant-id header (server-side only, never trust client)
  |-- Authenticate user (existing cookie flow)
  |-- Look up role: SELECT app_role FROM organization_members WHERE org_id = ? AND member_id = ?
  |-- Enforce route restrictions (existing logic, tenant-scoped role)
  |
  v
API Route
  |-- getTenantId(req) -> reads x-tenant-id header (throws if missing)
  |-- All queries: .eq("tenant_id", tenantId)
  |-- All inserts: { ...data, tenant_id: tenantId }
  |-- All mutations: verify target.tenant_id === tenantId before mutating
  |
  v
Response (only tenant-scoped data)
```

**Route-specific handling:**

| Route group | Tenant resolution | Auth |
|-------------|------------------|------|
| `/admin/*` | Subdomain → org lookup | Session + `organization_members` role |
| `/api/*` | Subdomain → org lookup | Session required (except availability token routes) |
| `/portal/*` | Subdomain → org lookup | Session or magic token |
| `/availability?token=xxx` | Token → member → period → `availability_periods.tenant_id` | Token-based (no session) |
| `/platform/*` | No tenant context | `platform_admins` table check |

> **Performance note:** Middleware runs in Edge Runtime. The org lookup + role lookup add ~5-10ms per request at 3-10 tenants (indexed columns). Performance budget: middleware total < 50ms. Long-term fix: JWT custom claims via Supabase Auth hooks eliminates both lookups. See [Challenge C2](./CHALLENGE_LOG.md#c2-middleware-runs-in-edge-runtime--cannot-make-async-db-lookups).

### 2.4 Identity Model

```
+------------------+       +-----------------------+
|  Supabase Auth   |       |     organizations      |
|  (global pool)   |       |                         |
|                  |       |  id, name, slug,         |
|  email/password  |       |  is_active, settings     |
+--------+---------+       +-----------+-------------+
         |                             |
         v                             v
+------------------+       +-----------------------+
|     members      |<----->|  organization_members  |
|                  |  M:N  |                         |
|  id, email,      |       |  organization_id        |
|  name, phone,    |       |  member_id              |
|  magic_token,    |       |  app_role               |
|  is_active       |       |  is_active              |
+------------------+       +-----------------------+
```

Key points:
- **One Supabase Auth account per person**, regardless of how many churches
- **`app_role` lives on `organization_members`** — per-tenant roles
- **`members` has no `tenant_id`** — it's a global identity table
- **Multi-org access:** same person, different subdomains, different roles
- **Two-level activation:** `members.is_active` = platform kill switch; `organization_members.is_active` = per-tenant deactivation

### 2.5 Service Layer Design

#### New utilities

**`src/lib/server/tenant.ts`** — Tenant context extraction (fail-closed)

```typescript
export function getTenantId(req: NextRequest): string {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) throw new Error("Missing tenant context");
  // Validate UUID format to prevent injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("Invalid tenant ID format");
  }
  return tenantId;
}
```

**`src/lib/db/tenant-query.ts`** — Scoped query helpers

```typescript
// Returns query builder WITHOUT .select() — caller chains .select(), .order(), etc.
// This prevents the helper from being bypassed for non-trivial queries.
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

**`src/lib/server/feature-flags.ts`** — Feature flag resolution (fail-closed)

```typescript
export async function isFeatureEnabled(tenantId: string, flagKey: string): Promise<boolean> {
  // 1. Check organization_features for explicit override
  // 2. Fall back to feature_flags.default_enabled
  // 3. If no flag definition → return false (fail-closed)
}

export async function getEnabledFeatures(tenantId: string): Promise<string[]> {
  // Returns all enabled flag_keys for this tenant
  // Used by /api/me to populate features[] in response
}
```

#### Modified utilities

**`src/lib/db/members.ts`** — Every function gains `tenantId` parameter:

| Function | Change |
|----------|--------|
| `getMembers(tenantId)` | Query `organization_members` to scope member list to tenant |
| `createMember(tenantId, payload)` | Create `members` row + `organization_members` entry |
| `getMember(tenantId, id)` | Verify member is in org via `organization_members` |
| `getMemberByEmail(email)` | Stays global (identity lookup) |
| `getMemberByMagicToken(token)` | Stays global; also resolves org via `organization_members` |
| `updateMember(tenantId, id, changes)` | Verify membership in org |
| `deleteMember(tenantId, id)` | Remove from `organization_members` (not necessarily from `members`) |

**`src/lib/server/get-actor.ts`** — Add `tenantId` to `AuditActor` interface:

```typescript
interface AuditActor {
  id: string | null;
  name: string;
  role: string;
  tenantId: string;  // NEW
}
```

### 2.6 API Route Update Pattern

Every route follows the same mechanical change:

**Read pattern:**
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

**Mutation ownership verification (critical for PUT/DELETE):**
```typescript
const tenantId = getTenantId(req);
const { data: song } = await supabase
  .from("songs")
  .select("tenant_id")
  .eq("id", songId)
  .single();

if (!song || song.tenant_id !== tenantId) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
  // 404 (not 403) avoids leaking cross-tenant resource existence
}
```

**`/api/me` response evolution (backward-compatible):**
```json
{
  "id": "...",
  "name": "...",
  "email": "...",
  "app_role": "Admin",
  "magic_token": "...",
  "is_active": true,
  "tenant_id": "...",
  "tenant_name": "WCC Worship Ministry",
  "features": ["roster", "songs", "availability", "setlist"]
}
```

### 2.7 Feature Flag Resolution

```
For a given (tenantId, flagKey):

1. SELECT enabled FROM organization_features
   WHERE organization_id = tenantId
   AND flag_id = (SELECT id FROM feature_flags WHERE flag_key = flagKey)

2. If row exists → return its enabled value (explicit override)

3. If no row → SELECT default_enabled FROM feature_flags
   WHERE flag_key = flagKey

4. If no flag definition → return false (fail-closed)
```

**Initial flag set:**

| Flag key | Label | Default | Rationale |
|----------|-------|---------|-----------|
| `roster` | Roster Manager | `true` | Core feature |
| `songs` | Song Library | `true` | Core feature |
| `availability` | Availability Tracking | `true` | Core feature |
| `setlist` | Setlist Manager | `true` | Core feature |
| `handbook` | Team Handbook | `false` | Advanced, opt-in |
| `audit_log` | Audit Log | `false` | Advanced, opt-in |
| `chord_sheets` | Chord Sheet PDFs | `true` | Paired with songs |
| `equipment` | Equipment Tracking | `false` | Future module |
| `ai_roster` | AI Roster Agent | `false` | Future module |

### 2.8 Failure Modes

| Failure | Behavior | Recovery |
|---------|----------|----------|
| Missing `x-tenant-id` header | `getTenantId()` throws → 500 | Fail-closed; indicates middleware misconfiguration |
| Invalid/inactive org slug | Middleware redirects to error page | User sees "Organization not found" |
| Member not in organization | `/api/me` returns 403 | User sees "Not a member of this organization" |
| Feature disabled for tenant | API returns 403; UI hides nav item | Admin enables via platform dashboard |
| Provisioning partial failure | Stored procedure rolls back entire transaction | No orphaned data; retry from platform admin |
| Middleware DB lookup fails | 500 on all routes | Supabase health issue; check connection |

### 2.9 Simpler Alternative Considered

**Path-based tenancy (`/org/wcc/admin/roster`)** instead of subdomain-based:
- Avoids DNS wildcard configuration
- But requires changing every internal link, every API call URL, every middleware matcher
- Every `fetch("/api/songs")` becomes `fetch("/org/${slug}/api/songs")`
- Every `<Link href="/admin/roster">` needs slug injection

**Verdict:** Rejected. Subdomain approach requires no frontend URL changes — the app runs at identical paths, just on a different hostname. Vercel supports wildcard subdomains natively.

---

## Phase 4 — Test Strategy

### 4.1 Unit Tests

#### `__tests__/unit/tenant.test.ts`

| Test case | Expected |
|-----------|----------|
| `getTenantId()` returns header value when present | Valid UUID returned |
| `getTenantId()` throws when header missing | Error: "Missing tenant context" |
| `getTenantId()` throws on non-UUID string | Error: "Invalid tenant ID format" |
| `getTenantId()` throws on SQL injection attempt (`'; DROP TABLE--`) | Error: "Invalid tenant ID format" |
| `getTenantId()` accepts valid UUID with uppercase hex | Returns lowercased UUID |

#### `__tests__/unit/tenant-query.test.ts`

| Test case | Expected |
|-----------|----------|
| `tenantFrom()` applies `.eq("tenant_id", tenantId)` | Query builder has tenant filter |
| `tenantFrom()` does NOT call `.select()` | Caller must chain `.select()` |
| `tenantInsert()` merges `tenant_id` into single object | `{ name: "X", tenant_id: "..." }` |
| `tenantInsert()` merges `tenant_id` into array | Each item has `tenant_id` |

#### `__tests__/unit/feature-flags.test.ts`

| Test case | Expected |
|-----------|----------|
| Returns `true` when `organization_features.enabled = true` | Feature enabled |
| Returns `false` when `organization_features.enabled = false` | Feature disabled |
| Falls back to `feature_flags.default_enabled` when no override | Default value used |
| Returns `false` for unknown flag key | Fail-closed |
| `getEnabledFeatures()` returns all enabled keys | Array of flag_keys |

### 4.2 Integration Tests

#### `__tests__/integration/tenant-isolation.test.ts`

**Setup:** Two test tenants (A, B) with separate members, songs, rosters.

**For EVERY API endpoint:**

| Test | Pattern |
|------|---------|
| Fetch as Tenant A → returns only Tenant A data | `GET /api/songs` with tenant A context |
| Fetch as Tenant B → returns only Tenant B data | `GET /api/songs` with tenant B context |
| Tenant A cannot GET Tenant B's resource by ID | `GET /api/songs/[B-song-id]` → 404 |
| Tenant A cannot DELETE Tenant B's resource | `DELETE /api/songs/[B-song-id]` → 404 |
| Tenant A cannot UPDATE Tenant B's resource | `PUT /api/songs/[B-song-id]` → 404 |
| INSERT without `tenant_id` fails | Post to route, verify `tenant_id` is always set |

**Cover:** members, songs, roster, setlist, availability periods, settings, handbook, audit log.

#### `__tests__/integration/header-spoofing.test.ts`

| Test | Expected |
|------|----------|
| Client sends forged `x-tenant-id` header | Middleware overwrites with resolved tenant |
| API route reads middleware-set header, not client-supplied | Correct tenant data returned |
| Request with no subdomain and forged header | Blocked (no valid org slug) |

#### `__tests__/integration/multi-org-member.test.ts`

| Test | Expected |
|------|----------|
| Member belongs to org A (Admin) and org B (Musician) | — |
| Request via org A subdomain → sees Admin role | `app_role: "Admin"` in `/api/me` |
| Request via org B subdomain → sees Musician role | `app_role: "Musician"` in `/api/me` |
| Deactivation in org A (`organization_members.is_active = false`) | Blocked for org A |
| Same member still active in org B | Full access to org B |
| Platform-level deactivation (`members.is_active = false`) | Blocked everywhere |

#### `__tests__/integration/provisioning.test.ts`

| Test | Expected |
|------|----------|
| `provision_tenant()` succeeds → org + member + features + settings created | All rows present |
| `provision_tenant()` with duplicate slug → rolls back | No partial data |
| `provision_tenant()` with invalid email → rolls back | No orphaned org |
| Post-provision: new tenant's admin can log in | Auth succeeds, correct role |

### 4.3 End-to-End Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Church A admin full workflow | Login at `a.worshipapp.com` → CRUD members, songs, roster | All data scoped to Church A |
| Church B sees only own data | Login at `b.worshipapp.com` → list members, songs | Zero Church A data visible |
| Deactivated org blocked | Set `organizations.is_active = false` → all routes | 403 on all requests |
| Feature toggle | Disable "setlist" for Church B → visit setlist page | Redirect away; API returns 403 |
| Portal isolation | Church A musician views `/portal/roster` | Only Church A's published roster |

### 4.4 Edge Cases

| Edge case | Test approach |
|-----------|--------------|
| Magic token for multi-org member, request has no subdomain | Resolve via `periodId → availability_periods.tenant_id` |
| Magic token member with 0 orgs (orphaned) | Return 403: "No organization found" |
| Two tenants create a song with the same title | Both succeed (title is not globally unique, only per-tenant) |
| `roster(date, role_id)` conflict across tenants | New UNIQUE `(tenant_id, date, role_id)` allows it |
| `app_settings` upsert with old `onConflict: 'key'` | Must change to `onConflict: 'tenant_id,key'` |
| Platform admin is also a church member | `/platform/*` routes use `platform_admins` check; `/admin/*` routes use `organization_members` |
| Request to subdomain that exists but `is_active = false` | Middleware redirects to error page |
| Overlapping availability periods across tenants | No conflict — `EXCLUDE` constraint is per-tenant after adding `tenant_id` |

### 4.5 Failure Scenarios

| Scenario | Expected behavior |
|----------|------------------|
| Middleware cannot reach Supabase | 500 on all routes; no data leaks |
| `x-tenant-id` header missing on API route | `getTenantId()` throws → 500 (fail-closed) |
| `organization_members` row deleted while user has active session | Next `/api/me` call returns 403 |
| Feature flag table empty (no definitions) | All features disabled (fail-closed) |
| Provisioning stored procedure timeout | Transaction rolls back; no orphaned data |

### 4.6 AI Agent Safety Tests (placeholder)

No AI agents exist yet. When built, verify:

| Test | Expected |
|------|----------|
| Agent receives `tenantId` as explicit parameter | Required parameter, not inferred |
| Agent queries use tenant-scoped helpers | `getMembers(tenantId)`, not raw `supabase.from()` |
| LLM prompt contains only target tenant's data | No cross-tenant member names, songs, or history |
| Agent output logged to `audit_log` with correct `tenant_id` | Audit trail scoped |
| Agent failure does not commit any changes | Recommendations only, never auto-committed |

### 4.7 Update Existing Tests

All existing component tests in `__tests__/components/` must update mock data to include `tenant_id`:

```typescript
// __tests__/helpers/tenant-fixtures.ts
export const TEST_TENANT_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const TEST_TENANT_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export function createTestTenant(overrides?: Partial<Organization>): Organization { ... }
export function createTestMember(tenantId: string, overrides?: Partial<Member>): Member { ... }
export function mockTenantHeaders(tenantId: string): Headers { ... }
```

Use `TEST_TENANT_A_ID` as the default for all existing tests to maintain current behavior.

---

## Phase 6 — Critical Design Review

### Finding 1: `member_roles` vs `member_role_assignments` naming inconsistency

**Severity:** High
**Category:** Data integrity
**Found by:** Staff Engineer + Systems Thinking

**Problem:** The migration SQL (`001_init.sql`) creates a table named `member_roles`, but `src/lib/db/members.ts` references `member_role_assignments`. These are different names for the same concept. If the production table is actually `member_roles`, the migration adding `tenant_id` to `member_role_assignments` will fail.

**Impact:** Migration failure on production database.

**Fix:** Before any migration work, verify the actual table name in the production database. Update either the code or the migration to match.

---

### Finding 2: `/api/members` POST handler trusts client-sent `x-app-role` header

**Severity:** High
**Category:** Security (pre-existing)
**Found by:** SDET / Quality Engineer

**Problem:** In `src/app/api/members/route.ts`, the POST handler reads the caller's role from:
```typescript
const role = req.headers.get("x-app-role") || req.cookies.get("app_role")?.value;
```
This trusts a client-supplied header for authorization. A malicious Coordinator could forge `x-app-role: Admin` and gain write access.

**Impact:** Authorization bypass on member creation. Multi-tenancy makes this worse — an attacker could create admin accounts in other tenants.

**Fix:** Replace `x-app-role` header with `getActorFromRequest(req)` which reads the JWT, does a DB lookup, and returns the verified role.

---

### Finding 3: Inherited tables queryable without tenant check

**Severity:** Medium
**Category:** Security
**Found by:** SDET / Quality Engineer

**Problem:** `chord_charts`, `availability_responses`, and `availability_dates` have no `tenant_id`. A direct query like `SELECT * FROM chord_charts WHERE id = ?` has no tenant protection. If an attacker knows a `chord_chart` ID from another tenant, they could access it.

**Impact:** Cross-tenant data leak if inherited tables are ever queried directly by ID.

**Recommendation:** Add redundant `tenant_id` to `chord_charts` as defense-in-depth. The table is small. For `availability_responses` and `availability_dates`, always query via parent JOIN — add explicit test cases to verify this.

---

### Finding 4: Availability token tenant resolution needs specific approach

**Severity:** Medium
**Category:** Design
**Found by:** Systems Thinking + Product Manager

**Problem:** The availability form at `/availability/[token]` uses magic tokens for auth. A member might belong to multiple orgs. The naive approach (resolve member → query `organization_members` → pick org) is ambiguous for multi-org members.

**Better approach:** The availability form URL includes `?periodId=xxx`. The `periodId` belongs to a specific `availability_periods` row which has `tenant_id`. Resolve tenant from `availability_periods.tenant_id WHERE id = periodId`. This completely sidesteps the multi-org ambiguity.

**Fix:** Availability token route resolves tenant from the `periodId` parameter, not from the member's org list.

---

### Finding 5: All `onConflict` clauses must include `tenant_id`

**Severity:** High
**Category:** Data integrity
**Found by:** Staff Engineer

**Problem:** Multiple routes use Supabase's `.upsert()` with `onConflict` specifying columns that don't include `tenant_id`:
- `roster` route: `onConflict: "date,role_id"` → must become `"tenant_id,date,role_id"`
- `settings` route: `onConflict: "key"` → must become `"tenant_id,key"`
- `availability` route: `onConflict: "member_id,date"` → must become `"tenant_id,member_id,date"`

**Impact:** Upserts would conflict across tenants. Church B's roster save could overwrite Church A's roster for the same date/role.

**Fix:** Update all `onConflict` clauses and corresponding UNIQUE constraints to include `tenant_id`.

---

### Finding 6: `roster` unique constraint is globally scoped

**Severity:** High
**Category:** Data integrity
**Found by:** SaaS Architect

**Problem:** `roster` has `UNIQUE (date, role_id)` — meaning only one assignment per date per role globally. Two churches cannot both assign someone to "drums" on the same Sunday.

**Impact:** Constraint violation when two tenants save roster for the same date.

**Fix:** Migration must:
```sql
ALTER TABLE roster DROP CONSTRAINT roster_date_role_id_key;
ALTER TABLE roster ADD CONSTRAINT roster_tenant_date_role_unique
  UNIQUE (tenant_id, date, role_id);
```

Similarly check: `availability(member_id, date)`, `sunday_setlist(sunday_date, position)`, `availability_responses(period_id, member_id)`.

---

### Finding 7: No application-level kill switch for gradual rollout

**Severity:** Medium
**Category:** Operations
**Found by:** Systems Thinking + Product Manager

**Problem:** Deploying multi-tenant code changes all 25+ route files simultaneously. If a bug is discovered, the only option is a full code revert.

**Fix:** Add `MULTI_TENANT_ENABLED` environment variable:
```typescript
export function getTenantId(req: NextRequest): string | null {
  if (process.env.MULTI_TENANT_ENABLED !== 'true') return null;
  // ... normal resolution
}
```
Routes: `if (tenantId) query.eq("tenant_id", tenantId)` — gracefully degrades to single-tenant when disabled. Activation is a Vercel env var flip, not a code deploy.

---

### Findings Summary

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| F1 | `member_roles` vs `member_role_assignments` naming | High | Verify production table name before migration |
| F2 | `x-app-role` header trust in POST | High | Replace with `getActorFromRequest()` |
| F3 | Inherited tables queryable without tenant | Medium | Add redundant `tenant_id` to `chord_charts`; always JOIN for others |
| F4 | Availability token multi-org ambiguity | Medium | Resolve tenant from `periodId`, not member's org list |
| F5 | `onConflict` clauses missing `tenant_id` | High | Update all upserts and UNIQUE constraints |
| F6 | `roster` UNIQUE `(date, role_id)` is global | High | Change to `(tenant_id, date, role_id)` |
| F7 | No kill switch for rollout | Medium | `MULTI_TENANT_ENABLED` env var |
