# Project Context

## Project Name
Worship Ministry Platform

## Purpose
A SaaS platform helping churches manage worship ministry operations — reducing admin workload, improving volunteer coordination, and providing AI-assisted tools that support (not replace) human leadership.

---

# Platform Capabilities

### Worship Team Management
- Volunteer management with access roles
- Availability tracking
- Ministry roster scheduling
- Handbook (per-tenant editable documentation)

### Song Library
- Worship song database with chord sheets (Google Docs integration)
- Song category and status management

### Service Planning
- Sunday setlist builder (draft → published workflow)

### AI-Assisted Tools
- Roster recommendation agent (suggestions only, never auto-commits)
- Fairness and workload analysis

---

# Current Architecture — March 2026

The platform is a **multi-tenant SaaS application** (active branch: `feature-tenant-phase2`).

Multi-tenancy is **fully implemented** and gated behind `MULTI_TENANT_ENABLED=true`.
Church #1 (WCC) is live in production. Church #2 (`julius-church-music-ministry`) is provisioned. The kill switch is **not yet enabled in production** — 3 security gaps remain before it is safe (see Open Gaps below).

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `"use client"` / Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL), service role key, bypasses RLS — tenant isolation enforced in application code |
| Auth | Supabase Auth + `@supabase/ssr` for server-side session handling |
| Testing | Vitest + @testing-library/react — 705 tests, all passing |

## Multi-Tenant Data Model

| Layer | Tables |
|---|---|
| **Tenant-scoped** (have `tenant_id`) | `songs`, `roster`, `availability`, `availability_periods`, `sunday_setlist`, `member_role_assignments`, `app_settings`, `audit_log`, `handbook_documents` |
| **Global identity** (no `tenant_id`) | `members`, `roles` |
| **Tenant registry** | `organizations`, `organization_members`, `feature_flags`, `organization_features`, `platform_admins` |
| **Inherit tenant via FK** | `chord_charts` → `songs`, `availability_responses` → `availability_periods`, `availability_dates` → `availability_responses` |

### Key Constants
- `WCC_TENANT_ID = "00000000-0000-0000-0000-000000000001"` (Church #1, deterministic)
- Kill switch: `MULTI_TENANT_ENABLED` env var (default: `false` — single-tenant mode)
- Tenant context: middleware resolves slug → org UUID → injects as `x-tenant-id` header (strips any client-supplied value first)

## User Roles (per-tenant via `organization_members.app_role`)

| Role | Access |
|---|---|
| `Admin` | Full access |
| `Coordinator` | Read-only on People + Songs, no Settings/Audit, full Roster/Setlist/Availability/Handbook |
| `WorshipLeader` | Roster + Setlist only |
| `MusicCoordinator` | Songs (edit only, no add/delete) + Setlist/Roster |
| `Musician` | No admin access — portal + availability form only (magic-token auth) |

## Migrations Applied (in order)

| Migration | Summary |
|---|---|
| `000–018` | Single-tenant foundation (members, songs, roster, availability, setlist, handbook, audit) |
| `019` | New tables — `organizations`, `organization_members`, `feature_flags`, `organization_features`, `platform_admins`. Seeds WCC as Church #1. |
| `020` | `tenant_id UUID` added + backfilled to WCC UUID on all data tables. Indexes created. |
| `021` | Unique constraints updated to be tenant-scoped (e.g. `roster_tenant_date_role_unique`). `app_settings` PK changed to `(tenant_id, key)`. |
| `022` | `provision_tenant()` stored procedure — atomic 6-step provisioning (org → member → org_member → features → settings → handbook). |
| `023` | `organization_members.app_role` check constraint. |

## Service Utilities

| File | Purpose |
|---|---|
| `src/lib/server/tenant.ts` | `getTenantId(req)`, `isMultiTenantEnabled()`, `WCC_TENANT_ID` |
| `src/lib/db/tenant-query.ts` | `tenantFrom()`, `tenantInsert()` query helpers |
| `src/lib/server/feature-flags.ts` | `isFeatureEnabled()`, `getEnabledFeatures()` (fail-closed) |
| `src/lib/server/get-actor.ts` | `getActorFromRequest(req)` → `{ id, name, role, tenantId }` (authoritative) |
| `src/lib/server/platform-auth.ts` | `requirePlatformAdmin()` for `/api/platform/**` routes |

## Platform Admin Dashboard
- Routes: `src/app/platform/` (login, dashboard, tenants list, tenant detail, feature flag toggles)
- API: `src/app/api/platform/tenants/` — provisions new tenants via `provision_tenant()` RPC

## Auth Flow
1. Login page calls `supabase.auth.signInWithPassword()`
2. Sets `sb-access-token`, `sb-refresh-token`, `sb:token` cookies
3. In MT mode: validates `organization_members` for resolved tenant, stamps `sb-tenant-id` cookie
4. Middleware reads session via `createServerClient` with JWT cookie fallback
5. Middleware checks org membership via `organization_members` in MT mode for `/admin/*` routes
6. In `NODE_ENV=development`, `dev_auth=1` cookie bypasses all auth checks

---

# Known Open Gaps (as of March 2026)

Must be resolved before `MULTI_TENANT_ENABLED=true` is safe in production:

| # | File | Severity | Issue |
|---|---|---|---|
| GAP 1 | `src/lib/db/setlist.ts` `deleteSetlistSong()` | CRITICAL | No `tenant_id` filter on DELETE — IDOR: any admin can delete another tenant's setlist row by UUID |
| GAP 2 | `src/app/api/members/[id]/magic-token/route.ts` | HIGH | No auth check — unauthenticated callers can regenerate any member's magic token |
| GAP 3 | `src/app/api/availability/[token]/route.ts` | CRITICAL | No tenant scoping — magic-token holder can access availability data cross-tenant |
