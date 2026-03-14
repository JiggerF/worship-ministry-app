# Multi-Tenant SaaS — Technical Planning Document

> **Status:** Draft — March 2026
> **Authors:** Platform team
> **Companion document:** [SAAS_ARCHITECTURE_PLAN.md](./SAAS_ARCHITECTURE_PLAN.md) (implementation roadmap)
> **Project context:** [PROJECT-CONTEXT.md](../../.claude/context/PROJECT-CONTEXT.md)

---

## Table of Contents

1. [Current System Assessment](#1-current-system-assessment)
2. [Target Multi-Tenant Architecture](#2-target-multi-tenant-architecture)
3. [Migration Strategy](#3-migration-strategy)
4. [Database Evolution Plan](#4-database-evolution-plan)
5. [Service Layer Changes](#5-service-layer-changes)
6. [AI Agent Considerations](#6-ai-agent-considerations)
7. [Feature Flag Model](#7-feature-flag-model)
8. [Risks and Tradeoffs](#8-risks-and-tradeoffs)
9. [Recommended Implementation Phases](#9-recommended-implementation-phases)

---

## 1. Current System Assessment

### 1.1 System overview

The platform is a Next.js 16 application backed by Supabase (PostgreSQL). It currently operates as a **single-tenant system** serving one church. All data belongs to a single implicit organization.

**Implemented modules:**

| Module | Tables | API routes | Status |
|--------|--------|-----------|--------|
| Volunteer management | `members`, `member_role_assignments` | `/api/members`, `/api/me` | Production |
| Roster scheduling | `roster` | `/api/roster` | Production |
| Song library | `songs`, `chord_charts` | `/api/songs` | Production |
| Availability tracking | `availability_periods`, `availability_responses`, `availability_dates` | `/api/availability/*` | Production |
| Setlist management | `sunday_setlist` | `/api/setlist/*` | Production |
| Team handbook | `handbook_documents` | `/api/handbook/*` | Production (MVP1) |
| Audit logging | `audit_log` | `/api/audit-log` | Production |
| App settings | `app_settings` | `/api/settings` | Production |
| Equipment tracking | — | — | **Not yet built** |
| AI roster agent | — | — | **Not yet built** |

### 1.2 Architectural assumptions that prevent multi-tenancy

**A1 — No tenant identifier in the data model.**
Every table assumes a single global dataset. There is no `tenant_id`, `organization_id`, or any concept of data ownership beyond the individual user level. A `SELECT * FROM songs` returns every song in the system — there is no way to scope it.

**A2 — Roles are globally scoped.**
`members.app_role` (Admin, Coordinator, Musician, etc.) is a column on the `members` table itself. A person's role is system-wide, not per-organization. This means a user cannot be an Admin at Church A and a Musician at Church B.

**A3 — Auth resolves identity but not tenant context.**
The middleware authenticates the user (who are you?) but never asks "which organization are you accessing?". Session cookies carry user identity only. There is no subdomain, path prefix, or JWT claim that indicates tenant affiliation.

**A4 — API routes have no tenant boundary.**
All 25+ route files query Supabase without any organization filter. A service-role query like `supabase.from("members").select("*")` returns all members globally. There is no application-layer isolation.

**A5 — Settings are global singletons.**
`app_settings` uses `key` as its primary key (e.g., `roster_pagination`, `max_songs_per_setlist`). There is one value per setting for the entire system — no way to have different config per church.

**A6 — Magic tokens are tenant-unaware.**
The `members.magic_token` UUID grants unauthenticated access to availability forms. The token lookup returns a member but doesn't establish which organization's data to show.

**A7 — The frontend assumes a single organization.**
Sidebar navigation, page titles, and data fetching all assume one church. There is no tenant switcher, no org name display, and no feature gating per organization.

### 1.3 What works well (preserve these)

| Pattern | Why it matters |
|---------|---------------|
| **Service role key for all writes** | Server-side mutations bypass RLS; tenant filtering is a code change, not a policy rewrite |
| **`/api/me` as single source of truth for client-side identity** | Adding `tenant_id` and `features[]` to this response propagates context to all pages without touching each one |
| **RLS set to public-read, no-client-write** | Defense-in-depth; tenant RLS policies can be layered on without changing the write pattern |
| **Consistent `canEdit` gating pattern** | Role-based UI gating already works — it just needs to read from a tenant-scoped role instead of a global one |
| **`lib/db/*.ts` helper layer** | Centralised data access; adding `tenantId` to these functions automatically scopes every caller |
| **Audit log infrastructure** | Already captures actor + action; adding `tenant_id` gives per-tenant audit trails for free |

---

## 2. Target Multi-Tenant Architecture

### 2.1 Tenancy model

**Shared database, row-level tenant isolation via `tenant_id` column.**

```
┌─────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)           │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Church A    │  │  Church B    │  │ Church C │ │
│  │  tenant_id=1 │  │  tenant_id=2 │  │ tid=3    │ │
│  │              │  │              │  │          │ │
│  │ members      │  │ members      │  │ members  │ │
│  │ songs        │  │ songs        │  │ songs    │ │
│  │ roster       │  │ roster       │  │ roster   │ │
│  │ ...          │  │ ...          │  │ ...      │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Shared / Global tables                      │ │
│  │  organizations, roles, feature_flags,        │ │
│  │  platform_admins                             │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

Why this model:
- **3-10 tenants** with ~20 members and ~100 songs each — too small for schema-per-tenant or multi-database overhead
- Single migration set, single deployment, single Supabase project
- Supabase RLS naturally supports `tenant_id` filtering as defense-in-depth
- Scales to hundreds of tenants before needing to revisit

### 2.2 Tenant context flow

```
Browser request
  │
  ▼
Subdomain: wcc.worshipapp.com
  │
  ▼
Middleware
  ├─ Extract slug from subdomain ("wcc")
  ├─ Look up organizations WHERE slug = 'wcc' AND is_active = true
  ├─ Set x-tenant-id header on request
  ├─ Authenticate user (existing flow)
  ├─ Look up role from organization_members (tenant-scoped)
  └─ Enforce route restrictions
  │
  ▼
API Route
  ├─ getTenantId(req)  → reads x-tenant-id header
  ├─ All queries include .eq("tenant_id", tenantId)
  └─ All inserts include tenant_id in payload
  │
  ▼
Response
  └─ Only tenant-scoped data returned
```

### 2.3 Identity model

```
┌──────────────────┐       ┌───────────────────────┐
│  Supabase Auth   │       │     organizations      │
│  (global pool)   │       │                         │
│                  │       │  id: uuid               │
│  email/password  │       │  name: text             │
│  is universal    │       │  slug: text (unique)    │
└────────┬─────────┘       └───────────┬─────────────┘
         │                             │
         ▼                             ▼
┌──────────────────┐       ┌───────────────────────┐
│     members      │◄─────►│  organization_members  │
│                  │  M:N  │                         │
│  id: uuid        │       │  organization_id: uuid  │
│  email: text     │       │  member_id: uuid        │
│  name: text      │       │  app_role: text         │
│  magic_token     │       │  joined_at: timestamptz │
└──────────────────┘       └───────────────────────┘
```

Key decisions:
- **One Supabase Auth account per person**, regardless of how many churches they belong to
- **`app_role` moves to `organization_members`** — a person can be Admin at Church A and Musician at Church B
- **`members` does NOT get `tenant_id`** — members are global identity records. All tenant scoping flows through `organization_members` exclusively. Magic token resolution queries `organization_members` to find the member's org(s). See [Challenge H1](./CHALLENGE_LOG.md#h1)
- **A person accesses each church via its subdomain** — no tenant switcher needed initially

### 2.4 Platform admin (landlord) layer

A separate identity tier for platform operators who manage all tenants:

```
Platform admin (platform_admins table)
  │
  ├─ /platform/dashboard    → cross-tenant stats
  ├─ /platform/tenants      → CRUD organizations
  ├─ /platform/tenants/[id]/features → toggle feature flags
  └─ /platform/flags        → manage global flag definitions
```

Platform admins authenticate via the same Supabase Auth but middleware routes `/platform/*` through a different authorization path (checks `platform_admins` table, not `organization_members`).

---

## 3. Migration Strategy

### 3.1 Guiding principles

| Principle | Rationale |
|-----------|-----------|
| **Additive changes only** | Never drop columns or tables until the new path is proven. Add `tenant_id` as nullable first, backfill, then make NOT NULL. |
| **Church #1 must never break** | Every intermediate state must pass all existing tests and work in production. |
| **One concern per migration** | Schema changes, data backfill, and constraint enforcement are separate steps (even if in one SQL file) to enable rollback at each point. |
| **Application layer first, RLS second** | Since all writes use the service role key (which bypasses RLS), tenant filtering must work in application code before RLS policies add defense-in-depth. |
| **Feature parity before onboarding** | Don't onboard Church #2 until every module correctly scopes data. A partially-migrated system leaks data. |

### 3.2 Migration sequence

```
Step 1: Schema additions (safe, no behavior change)
  │  Add organizations table
  │  Add organization_members table
  │  Add feature_flags + organization_features tables
  │  Add platform_admins table
  │  Add tenant_id (NULLABLE, DEFAULT=Church1) to all data tables
  │
  ▼
Step 2: Data backfill (safe, no behavior change)
  │  UPDATE all rows SET tenant_id = Church1_UUID
  │  INSERT organization_members FROM members.app_role
  │  INSERT organization_features (all enabled for Church 1)
  │
  ▼
Step 3: Enforce constraints (minor risk, tested first)
  │  ALTER tenant_id SET NOT NULL, DROP DEFAULT
  │  Add composite indexes (tenant_id, ...)
  │
  ▼
Step 4: Application layer migration (incremental, behind feature flag)
  │  Update middleware: resolve tenant from subdomain
  │  Update /api/me: read role from organization_members
  │  Update all API routes: add .eq("tenant_id", tenantId)
  │  Update all lib/db functions: add tenantId parameter
  │
  ▼
Step 5: Verification & cutover
  │  Run full test suite with tenant fixtures
  │  Deploy to staging with subdomain routing
  │  Verify Church #1 works identically
  │  Cross-tenant isolation smoke test
  │
  ▼
Step 6: Deprecate old paths
     Remove members.app_role column (after Phase 1 stable)
     Update RLS policies with tenant scoping (defense-in-depth)
```

### 3.3 Zero-downtime guarantees

| Change | Risk level | Why it's safe |
|--------|-----------|--------------|
| Adding nullable columns with DEFAULT | None | Existing queries ignore the new column |
| Backfilling data | None | UPDATE on existing rows; no schema change |
| Making NOT NULL | Low | Only after all rows verified non-null |
| Adding indexes | None | CREATE INDEX CONCURRENTLY in Postgres |
| Changing application queries | Medium | Deploy behind feature flag; gradual rollout |
| Dropping `members.app_role` | Medium | Only after all code reads from `organization_members`; keep column for 1 release as safety net |

---

## 4. Database Evolution Plan

### 4.1 New tables

#### `organizations`

The tenant entity. Every church is one row.

```sql
CREATE TABLE organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  settings   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

`settings` JSONB stores per-tenant configuration overrides (timezone, default language, branding — future). Avoids creating a new column for every config option.

#### `organization_members`

Decouples role assignment from global `members` table. Enables per-org roles.

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

#### `feature_flags` + `organization_features`

Two-table design: global definitions + per-tenant overrides.

```sql
CREATE TABLE feature_flags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key        TEXT UNIQUE NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE organization_features (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  flag_id         UUID REFERENCES feature_flags(id) ON DELETE CASCADE NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, flag_id)
);
```

#### `platform_admins`

Separate from `members` — platform operators are not church volunteers.

```sql
CREATE TABLE platform_admins (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### 4.2 Column additions to existing tables

**Tables receiving `tenant_id UUID NOT NULL REFERENCES organizations(id)`:**

| Table | Index strategy | Notes |
|-------|---------------|-------|
| ~~`members`~~ | N/A | **Global identity record** — no `tenant_id`. Tenant scoping via `organization_members` only (see [Challenge H1](./CHALLENGE_LOG.md#h1)) |
| `member_role_assignments` | `(tenant_id, member_id)` | Redundant but simplifies join-free queries |
| `songs` | `(tenant_id, title)` | Composite index for filtered search |
| `roster` | `(tenant_id, date)` | Primary query pattern is by month |
| `availability_periods` | `(tenant_id, starts_on DESC)` | Ordered listing |
| `sunday_setlist` | `(tenant_id, sunday_date)` | Lookup by Sunday |
| `app_settings` | PK changes to `(tenant_id, key)` | Settings become per-tenant |
| `audit_log` | `(tenant_id, created_at DESC)` | Per-tenant activity feed |
| `handbook_documents` | `(tenant_id, slug, is_current)` | Scoped versioning |

**Tables that do NOT get `tenant_id` (inherit via FK):**

| Table | Inherits via | Reasoning |
|-------|-------------|-----------|
| `chord_charts` | `song_id → songs.tenant_id` | Always queried via song JOIN |
| `availability_responses` | `period_id → availability_periods.tenant_id` | Always queried via period |
| `availability_dates` | `response_id → availability_responses` | Always queried via response |

**Tables that stay global (shared across tenants):**

| Table | Reasoning |
|-------|-----------|
| `roles` | Musical roles (drums, bass, vocals, etc.) are universal. If a church needs custom roles, this can be revisited. |

### 4.3 `app_settings` primary key change

Current: `PRIMARY KEY (key)`
Target: `PRIMARY KEY (tenant_id, key)`

Migration approach:
```sql
-- 1. Add tenant_id to app_settings (nullable, default Church 1)
-- 2. Backfill
-- 3. Drop old PK, add new composite PK
ALTER TABLE app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (tenant_id, key);
```

### 4.4 Future: equipment & asset tables (design tenant-aware from day one)

Equipment tracking is documented in PROJECT-CONTEXT.md but not yet built. When implemented, these tables should include `tenant_id` from the start:

```sql
-- Example future schema (not part of this migration)
CREATE TABLE equipment (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID REFERENCES organizations(id) NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,  -- 'instrument', 'sound', 'lighting'
  status      TEXT NOT NULL DEFAULT 'available',
  assigned_to UUID REFERENCES members(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_equipment_tenant ON equipment(tenant_id);
```

This avoids the entire backfill/migration complexity we face with current tables.

---

## 5. Service Layer Changes

### 5.1 Tenant context extraction

New shared utility consumed by every API route:

```
src/lib/server/tenant.ts

  getTenantId(req: NextRequest): string
    → reads x-tenant-id header (set by middleware)
    → throws if missing (fail-closed)
```

### 5.2 Tenant-scoped query wrapper

To prevent developers from forgetting `.eq("tenant_id", ...)`, introduce a helper:

```
src/lib/db/tenant-query.ts

  tenantFrom(supabase, table, tenantId)
    → returns supabase.from(table).eq("tenant_id", tenantId)
    → NOTE: does NOT call .select() — caller chains .select(), .order(), etc.
    → This prevents developers from bypassing the helper for non-trivial queries (see Challenge H4)

  tenantInsert(supabase, table, tenantId, data)
    → merges { tenant_id: tenantId } into data before insert
```

All `lib/db/*.ts` functions migrate to use these helpers. Direct `supabase.from()` calls in API routes are replaced.

### 5.3 `lib/db/members.ts` evolution

Every function gains a `tenantId` parameter:

```typescript
// BEFORE
export async function getMembers(): Promise<MemberWithRoles[]>

// AFTER
export async function getMembers(tenantId: string): Promise<MemberWithRoles[]>
```

**Exception: `getMemberByMagicToken(token)`** — magic tokens are globally unique. The lookup returns the member, then queries `organization_members` to find their org(s). If exactly one org → use it as tenant context. If multiple orgs → require subdomain context. This is the only function that resolves tenant from data rather than from request context. See [Challenge C3](./CHALLENGE_LOG.md#c3).

### 5.4 `/api/me` evolution

This is the highest-impact change because every client page depends on it.

**Current response:**
```json
{
  "id": "...",
  "name": "...",
  "email": "...",
  "app_role": "Admin",
  "magic_token": "...",
  "is_active": true
}
```

**Target response (backward-compatible additions):**
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
  "features": ["roster", "songs", "availability", "setlist", "handbook", "audit_log"]
}
```

The `app_role` field now comes from `organization_members` instead of `members.app_role`. The response shape is additive — no client code breaks.

### 5.5 Middleware evolution (`src/middleware.ts`)

Current middleware flow:
```
Request → Auth check → Role lookup (members.app_role) → Route restrictions
```

**Middleware matcher** must cover all route groups (see [Challenge C1](./CHALLENGE_LOG.md#c1), [C3](./CHALLENGE_LOG.md#c3)):

```typescript
export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal/:path*"],
};
```

Target middleware flow:
```
Request → DELETE any client-supplied x-tenant-id header (NEVER trust incoming value)
        → Tenant resolution → Auth check → Role lookup (organization_members) → Route restrictions
                │                                        │
                ├─ /platform/* → platform_admins check   │
                ├─ /admin/*    → organization_members    │
                ├─ /api/*      → organization_members    │
                ├─ /portal/*   → session or magic token  │
                └─ /availability?token=xxx → token-based │
```

New responsibilities:
1. **Delete then set** `x-tenant-id` header — never trust client-supplied value (see [Challenge C1](./CHALLENGE_LOG.md#c1))
2. Extract tenant slug from subdomain (or `?org=` in dev)
3. Validate organization exists and is active
4. Set `x-tenant-id` header for downstream consumption
5. Route `/platform/*` requests through platform admin auth
6. Route `/portal/*` and `/api/*` through tenant context (see [Challenge C3](./CHALLENGE_LOG.md#c3))
7. Read `app_role` from `organization_members` (not `members`)
8. For availability token routes: resolve member → `organization_members` → org

### 5.6 `get-actor.ts` evolution

The audit actor type gains tenant context:

```typescript
// BEFORE
interface AuditActor {
  id: string | null;
  name: string;
  role: string;
}

// AFTER
interface AuditActor {
  id: string | null;
  name: string;
  role: string;
  tenantId: string;
}
```

### 5.7 Login flow changes

The login page inherits tenant context from its subdomain. After Supabase Auth succeeds:

1. Look up `organization_members` for this email + tenant
2. If not found → 403: "You are not a member of this organization"
3. If found but `organization_members.is_active = false` → 403: "Your account is deactivated at this church" (per-tenant deactivation — see [Challenge C2](./CHALLENGE_LOG.md#c2))
4. If `members.is_active = false` → 403: "Your account has been suspended" (platform-level kill switch, only platform admins can set)
5. If both active → proceed with cookie-setting flow (unchanged)

### 5.8 API route update pattern

Every route follows the same mechanical change:

```typescript
// BEFORE
export async function GET(req: NextRequest) {
  const { data } = await supabase.from("songs").select("*").order("title");
  return NextResponse.json(data);
}

// AFTER
export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  const { data } = await supabase
    .from("songs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("title");
  return NextResponse.json(data);
}
```

For mutations (POST/PUT/DELETE), also verify the target resource belongs to the tenant:

```typescript
// DELETE - verify ownership
const tenantId = getTenantId(req);
const { data: song } = await supabase
  .from("songs")
  .select("tenant_id")
  .eq("id", songId)
  .single();

if (song?.tenant_id !== tenantId) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

---

## 6. AI Agent Considerations

### 6.1 Current state

The platform documents AI-assisted tools in PROJECT-CONTEXT.md:
- Roster recommendation agent
- Fairness and workload analysis
- Burnout prevention suggestions

**None of these are implemented yet.** There are no AI SDK dependencies (no `anthropic`, `openai`, or `langchain` in `package.json`), no AI-related API routes, and no agent code. This is entirely planned work.

### 6.2 Why this matters for multi-tenancy

AI agents that read volunteer data, availability, and roster history to make recommendations are **high-risk for tenant data leaks** if not designed correctly. An agent that inadvertently trains on or references Church A's data when making recommendations for Church B would be both a privacy violation and operationally harmful.

### 6.3 Tenant safety rules for AI agents

**Rule 1: Tenant context must be injected, never inferred.**
Every agent invocation receives `tenantId` as an explicit parameter. The agent never discovers its tenant from the data it processes.

```typescript
// CORRECT
async function recommendRoster(tenantId: string, sundayDate: string) {
  const members = await getMembers(tenantId);
  const availability = await getAvailability(tenantId, sundayDate);
  // ... agent logic using only this tenant's data
}

// WRONG
async function recommendRoster(sundayDate: string) {
  const members = await supabase.from("members").select("*"); // ALL tenants!
}
```

**Rule 2: All data queries within an agent must use tenant-scoped helpers.**
Agents must use `getMembers(tenantId)`, `getRoster(tenantId, month)`, etc. — never raw `supabase.from()`. This ensures the same tenant boundary that protects API routes also protects agent data access.

**Rule 3: Agent context windows must not contain cross-tenant data.**
If using an LLM API (Claude, etc.) for recommendations, the prompt/context sent to the model must contain only the current tenant's data. This is a natural consequence of Rule 2 — if the data queries are tenant-scoped, the context will be too.

**Rule 4: Agent outputs are recommendations only — human-approved per tenant.**
This is already a platform principle (from PROJECT-CONTEXT.md). Agents never auto-commit changes. A roster recommendation for Church A is reviewed and approved by Church A's Admin/Coordinator. This provides a human checkpoint that catches any context errors.

**Rule 5: Agent audit trails are tenant-scoped.**
When an agent generates a recommendation, log it to `audit_log` with the correct `tenant_id`. This ensures Church A's admin sees only their agent activity.

### 6.4 Architecture pattern for tenant-safe agents

```
┌─────────────────────────────────────────┐
│  Agent invocation                        │
│                                          │
│  Input: tenantId, parameters             │
│           │                              │
│           ▼                              │
│  ┌─────────────────┐                    │
│  │ Data Layer       │                    │
│  │ (tenant-scoped)  │                    │
│  │                   │                    │
│  │ getMembers(tid)   │                    │
│  │ getRoster(tid,..) │                    │
│  │ getAvail(tid,..)  │                    │
│  └────────┬──────────┘                    │
│           │                              │
│           ▼                              │
│  ┌─────────────────┐                    │
│  │ Agent Logic      │                    │
│  │ (stateless)      │                    │
│  │                   │                    │
│  │ Scoring, ranking, │                    │
│  │ fairness checks   │                    │
│  └────────┬──────────┘                    │
│           │                              │
│           ▼                              │
│  Output: recommendations[]               │
│  (never auto-committed)                  │
│                                          │
│  Audit: logAgentAction(tid, ...)         │
└─────────────────────────────────────────┘
```

### 6.5 When to implement

AI agents should be built **after** multi-tenancy is stable (Phase 2+). Since no AI code exists today, there is no migration burden — just a design constraint: **all new AI code must accept `tenantId` as a required parameter from day one.**

---

## 7. Feature Flag Model

### 7.1 Design goals

| Goal | How |
|------|-----|
| Platform owner controls which features each church gets | `organization_features` table with per-tenant overrides |
| New features default to off for new tenants | `feature_flags.default_enabled = false` for premium features |
| Feature checks are fast (no N+1 queries) | Batch load all flags for a tenant once per request via `/api/me` |
| Features gate both UI and API | Server-side check blocks API access; client-side check hides UI elements |

### 7.2 Flag definitions (initial set)

| Flag key | Label | Default | Rationale |
|----------|-------|---------|-----------|
| `roster` | Roster Manager | `true` | Core feature, all tenants |
| `songs` | Song Library | `true` | Core feature, all tenants |
| `availability` | Availability Tracking | `true` | Core feature, all tenants |
| `setlist` | Setlist Manager | `true` | Core feature, all tenants |
| `handbook` | Team Handbook | `false` | Advanced feature, opt-in |
| `audit_log` | Audit Log | `false` | Advanced feature, opt-in |
| `chord_sheets` | Chord Sheet PDFs | `true` | Core, paired with songs |
| `equipment` | Equipment Tracking | `false` | Future module, off by default |
| `ai_roster` | AI Roster Agent | `false` | Future module, off by default |

### 7.3 Resolution logic

```
For a given (tenantId, flagKey):

1. SELECT enabled FROM organization_features
   WHERE organization_id = tenantId
   AND flag_id = (SELECT id FROM feature_flags WHERE flag_key = flagKey)

2. If row exists → return enabled value (explicit override)

3. If no row → SELECT default_enabled FROM feature_flags
   WHERE flag_key = flagKey

4. If no flag definition → return false (fail-closed)
```

### 7.4 Server-side enforcement

```typescript
// In API route
const tenantId = getTenantId(req);
if (!(await isFeatureEnabled(tenantId, "setlist"))) {
  return NextResponse.json({ error: "Feature not available" }, { status: 403 });
}
```

### 7.5 Client-side gating

Features are delivered via `/api/me` response → consumed by layout:

```typescript
// In admin layout
const { member } = useCurrentMember();
const enabledFeatures = member?.features ?? [];

// Sidebar items filtered
const visibleItems = SIDEBAR_ITEMS.filter(
  (item) => !item.featureKey || enabledFeatures.includes(item.featureKey)
);
```

Individual pages also check on mount and redirect to `/admin/roster` if their feature is disabled.

### 7.6 Platform admin management

The landlord dashboard at `/platform/tenants/[id]/features` shows a toggle grid:

```
┌─────────────────────────────────────────────────┐
│  Church A — Features                             │
│                                                   │
│  ✅ Roster Manager          (core)               │
│  ✅ Song Library            (core)               │
│  ✅ Availability Tracking   (core)               │
│  ✅ Setlist Manager         (core)               │
│  ☐  Team Handbook           (advanced)           │
│  ☐  Audit Log               (advanced)           │
│  ☐  Equipment Tracking      (future)             │
│  ☐  AI Roster Agent         (future)             │
│                                                   │
│  [Save Changes]                                   │
└─────────────────────────────────────────────────┘
```

---

## 8. Risks and Tradeoffs

### 8.1 High-severity risks

**Risk: Missing `tenant_id` filter on a query → cross-tenant data leak.**
- Likelihood: Medium (many routes to update, easy to miss one)
- Impact: High (privacy violation, trust destruction)
- Mitigation:
  1. `tenantFrom()` query wrapper makes unscoped queries syntactically harder to write
  2. Tenant isolation integration tests cover every API endpoint
  3. Code review checklist: "Does this query include tenant_id?"
  4. RLS policies as defense-in-depth (catches bugs even if application layer fails)

**Risk: Dual-role confusion during migration (`members.app_role` vs `organization_members.app_role`).**
- Likelihood: Medium (two sources of truth temporarily)
- Impact: Medium (wrong permissions applied)
- Mitigation:
  1. Mark `members.app_role` as `@deprecated` in TypeScript types immediately
  2. Update `/api/me` to read from `organization_members` before any other route changes
  3. Drop `members.app_role` column after Phase 1 is stable (1 release buffer)

### 8.2 Medium-severity risks

**Risk: Existing Church #1 URLs break when subdomain routing is introduced.**
- Mitigation: Support bare domain alongside subdomains during transition. Redirect bare domain to `wcc.worshipapp.com` after verification period.

**Risk: Magic token links become ambiguous in multi-tenant context.**
- Mitigation: Magic tokens are globally unique UUIDs. Lookup returns member with `tenant_id`. The availability form uses that tenant to scope the response display. No URL change needed.

**Risk: Middleware performance degrades (now does DB lookup for every request).**
- Mitigation: Accept DB lookup at current scale — `SELECT FROM organizations WHERE slug = ?` with an indexed column is <5ms at 3-10 tenants. In-memory caching does NOT work on Vercel serverless (each invocation starts with empty memory). Future: Vercel KV (Redis) or JWT custom claims via Supabase Auth hooks. See [Challenge H3](./CHALLENGE_LOG.md#h3).

### 8.3 Tradeoffs accepted

| Tradeoff | Decision | Reasoning |
|----------|----------|-----------|
| Shared `roles` table vs per-tenant roles | Shared (global) | Musical roles are universal. Customization is a future concern for future tenants. Avoids seeding roles for every new org. |
| `members` is a global identity table (no `tenant_id`) | Removed redundancy | `members.email` has a UNIQUE constraint; adding `tenant_id` creates a contradiction for multi-org members. All tenant scoping flows through `organization_members`. See [Challenge H1](./CHALLENGE_LOG.md#h1). |
| Platform admins are a separate table (not a role) | Separate | Platform operators are not church volunteers. Mixing them into the member/role system would complicate every role-based check. |
| Feature flags stored in DB, not env vars or config file | DB | Per-tenant overrides require storage. DB enables the platform admin UI to toggle flags without redeployment. |
| No billing/subscription system | Defer | 3 tenants, manual management. Add Stripe integration when tenant count justifies it. |

### 8.4 Complexity areas to monitor

| Area | Complexity driver | Watch for |
|------|------------------|-----------|
| Middleware | Now resolves tenant + auth + role + features | Keep middleware lean; extract helpers; add timing logs |
| `/api/me` | Joins `members` + `organization_members` + `organization_features` | Single well-optimized query with proper indexes |
| Test fixtures | Every test needs `tenant_id` in mock data | Create shared test helpers (`createTestTenant()`, `createTestMember(tenantId)`) |
| New developer onboarding | "Why are there two role columns?" | Document the transition in CLAUDE.md; remove `members.app_role` ASAP |

---

## 9. Recommended Implementation Phases

### Phase 0 — Database Foundation
> **Goal:** Schema supports multi-tenancy. Zero behavior change.
> **Effort:** 1–2 weeks
> **Risk:** Low (additive only)

| Task | Detail |
|------|--------|
| Create `organizations` table | Seed Church #1 with fixed UUID |
| Create `organization_members` table | Backfill from `members.app_role` |
| Create `feature_flags` + `organization_features` | Seed initial flags; enable all for Church #1 |
| Create `platform_admins` table | Seed with platform owner email |
| Add `tenant_id` to all data tables | Nullable → backfill → NOT NULL → indexes |
| Update TypeScript types | Add `Organization`, `OrganizationMember`, `FeatureFlag`; add `tenant_id` to existing types |
| Verify | All tests pass; app works unchanged; migration rolls back cleanly |

**Exit criteria:** `npm run test` passes. `npm run build` passes. Church #1 app functions identically.

---

### Phase 1 — Tenant Context Propagation
> **Goal:** Every data path is tenant-scoped. Church #1 works on its subdomain.
> **Effort:** 2–3 weeks
> **Risk:** Medium (behavioral change in every API route)

| Task | Detail |
|------|--------|
| Implement `getTenantId()` helper | `src/lib/server/tenant.ts` |
| Implement `tenantFrom()` query wrapper | `src/lib/db/tenant-query.ts` |
| Update middleware | Subdomain → tenant resolution; organization_members role lookup |
| Update `/api/me` | Return role from `organization_members`; add `tenant_id` to response |
| Update all `lib/db/*.ts` functions | Add `tenantId` parameter |
| Update all API routes (~25 files) | Add tenant filter to every query |
| Update login flow | Verify member belongs to tenant |
| Configure Vercel wildcard subdomain | DNS + Vercel project settings |
| Verify | Cross-tenant isolation smoke test; all tests pass with tenant fixtures |

**Exit criteria:** Church #1 works at `wcc.worshipapp.com`. A manually-provisioned Church #2 sees only its own data. All tests pass.

**Onboarding gate:** Church #2 can be provisioned via SQL at this point (manual, no UI).

---

### Phase 2 — Feature Flags & Platform Admin
> **Goal:** Platform owner can manage tenants and features via UI.
> **Effort:** 2–3 weeks
> **Risk:** Low (new code, no changes to existing paths)

| Task | Detail |
|------|--------|
| Implement `isFeatureEnabled()` / `getEnabledFeatures()` | `src/lib/server/feature-flags.ts` |
| Add `features[]` to `/api/me` response | Client pages consume this for UI gating |
| Gate sidebar items by feature | `src/app/admin/layout.tsx` |
| Gate API routes by feature | 403 if feature disabled for tenant |
| Build platform admin pages | `/platform/login`, `/platform/dashboard`, `/platform/tenants`, `/platform/flags` |
| Build tenant provisioning API | `POST /api/platform/tenants` — calls `provision_tenant()` stored procedure (atomic transaction for steps 1-6), then sends invite email (step 7, retryable). See [Challenge H2](./CHALLENGE_LOG.md#h2) |
| Verify | Platform admin can create tenant, toggle features, view stats |

**Exit criteria:** New tenants can be provisioned via platform admin UI. Features toggle correctly.

**Onboarding gate:** Church #2 and #3 can be onboarded via the platform admin dashboard.

---

### Phase 3 — Onboarding & Production Hardening
> **Goal:** Multiple churches live and verified. System hardened.
> **Effort:** 2–3 weeks
> **Risk:** Low (operational, not architectural)

| Task | Detail |
|------|--------|
| Onboard Church #2 | Provision via platform admin; admin sets up their members/songs |
| Onboard Church #3 | Same process |
| Tenant isolation integration tests | Every API endpoint verified for cross-tenant isolation |
| Feature flag tests | Disabled feature → 403 API + hidden UI |
| RLS defense-in-depth policies | Tenant-scoped SELECT policies on all tables |
| Performance indexes | Composite indexes on hot query paths |
| Performance monitoring | Accept DB lookups at current scale; note Vercel KV as future optimization if needed (see [Challenge H3](./CHALLENGE_LOG.md#h3)) |
| Drop `members.app_role` column | After verifying all code reads from `organization_members` |
| Optional: CSV import | Bulk member/song import for new churches |

**Exit criteria:** 3 churches operational. Isolation tests pass. Performance acceptable. Clean build and full test suite green.

---

### Phase 4 — Future Modules (tenant-aware from day one)
> **Goal:** New features built with multi-tenancy baked in.
> **Effort:** Ongoing

| Module | Tenant consideration |
|--------|---------------------|
| Equipment tracking | All tables include `tenant_id`; API routes use `getTenantId()` |
| AI roster agent | `tenantId` as required parameter; all data queries scoped; no cross-tenant context in LLM prompts |
| Billing/subscriptions | Link to `organizations`; gate features based on plan tier |
| White-label branding | `organizations.settings` JSONB stores logo URL, color scheme |
| Self-service signup | Public registration → creates organization + admin member |

---

### Summary timeline

```
Wk 1─2   Phase 0: DB Foundation          ░░░░░░░░░░
Wk 3─5   Phase 1: Tenant Propagation     ░░░░░░░░░░░░░░░
                                          ⚑ Church #2 possible (manual)
Wk 6─8   Phase 2: Flags & Platform UI    ░░░░░░░░░░░░░░░
                                          ⚑ Church #2+3 via UI
Wk 8─10  Phase 3: Hardening & Go-live    ░░░░░░░░░░░░░░░
                                          ✓ Production multi-tenant
Wk 11+   Phase 4: New modules            ░░░░░░░░░░░░░░░→
                                          Equipment, AI agents, billing
```
