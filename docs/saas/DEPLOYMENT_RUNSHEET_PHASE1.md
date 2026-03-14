# Deployment Runsheet — Phase 0/1: Multi-Tenant Foundation

**Date:** 14 March 2026  
**Branch:** `feature-tenancy-phase-1`  
**Personas:** SDET · Staff Engineer · SaaS Architect  
**Risk level:** LOW — kill switch defaults OFF; Church #1 sees zero behavior change  
**Estimated time:** ~30 min (migrations ~5 min, deploy ~8 min, smoke test ~10 min)

---

## Situation Awareness

| Item | State |
|------|-------|
| All 667 tests passing | ✅ `MULTI_TENANT_ENABLED=true` baked into vitest.config.mjs |
| Kill switch OFF behavior | ✅ Identical to prod today — `getTenantId()` returns WCC UUID unconditionally |
| Kill switch ON behavior | ✅ Tested — `x-tenant-id` header injected by middleware, all routes scoped |
| Migrations on prod | ❌ 019–023 not yet applied |
| App code on prod | ❌ `feature-tenancy-phase-1` not yet merged to main |
| Church #1 data safety | ✅ All migrations backfill existing rows to WCC UUID before adding NOT NULL |

### What ships in this deploy

- **Migrations 019–023** — multi-tenant schema foundation (additive/backward-compatible)
- **App code** — all route handlers + middleware updated with `getTenantId()` and `tenant_id` scoping
- **Kill switch OFF** (`MULTI_TENANT_ENABLED` unset in Vercel) — full backward compat with Church #1

---

## Pre-Deploy Checklist

Run these before touching anything in prod. All must pass.

```bash
# 1. Confirm clean test run (kill switch ON — hardest mode)
npm run test
# Expected: Test Files 33 passed, Tests 667 passed, 0 failed

# 2. Confirm no TypeScript errors
npm run build
# Expected: ✓ Compiled successfully

# 3. Confirm no lint errors
npm run lint
# Expected: No errors (warnings OK)
```

- [ ] All 667 tests pass
- [ ] Build succeeds with no type errors
- [ ] Lint clean
- [ ] Confirm current prod Supabase migration version — last applied should be `018_handbook_add_tech_coordinator.sql`
  - Check via Supabase Dashboard → SQL Editor: `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;`
- [ ] Notify team: "Deploying multi-tenant schema foundation — no user-visible changes. 5 min downtime window not required."

---

## Step 1 — Commit & Push

All 62 changed files (including migrations 019–023) are uncommitted. Stage and commit cleanly.

```bash
cd /Users/jiggerfantonial/src/worship-ministry-app

# Stage everything — migrations are untracked, app code is modified
git add -A

# Verify staging looks right (no node_modules, no .env.local, no coverage)
git status

# Commit
git commit -m "feat: multi-tenant foundation (Phase 0/1)

- Migrations 019-023: organizations, organization_members, feature_flags,
  tenant_id columns on all data tables, constraint updates, provision_tenant()
- All route handlers scoped by getTenantId() / tenant_id
- Middleware injects x-tenant-id header, strips client-supplied values
- Kill switch MULTI_TENANT_ENABLED (default OFF = full backward compat)
- 667 tests passing with kill switch ON
- SDET signoff: 14 March 2026"

# Push
git push origin feature-tenancy-phase-1
```

- [ ] Push succeeded
- [ ] CI passes on `feature-tenancy-phase-1` (if configured)

---

## Step 2 — Create & Merge PR

1. Open GitHub → New PR: `feature-tenancy-phase-1` → `main`
2. PR title: `feat: multi-tenant foundation (Phase 0/1)`
3. PR description — checklist to include:
   - [ ] 667 tests passing
   - [ ] Migrations 019–023 documented in `schema_snapshot.sql`
   - [ ] Kill switch OFF = no behavior change for Church #1
   - [ ] SDET signoff attached
4. Request review if required; otherwise self-merge
5. **Merge strategy: Squash or Merge commit — no rebase** (preserves migration file history)

- [ ] PR merged to main

---

## Step 3 — Apply Migrations to Production Supabase

> ⚠️ **Apply in numbered order. Do not skip or reorder.** Each migration depends on the previous.  
> Run each one individually via Supabase Dashboard → SQL Editor → New Query. Paste and run.  
> Verify success before proceeding to the next.

### Pre-migration snapshot (optional but recommended)

```sql
-- Save a manual snapshot label in your notes
SELECT count(*) FROM public.members;
SELECT count(*) FROM public.songs;
SELECT count(*) FROM public.roster;
-- Note these counts for post-migration verification
```

---

### Migration 019 — Multi-tenant tables + WCC seed

File: `supabase/migrations/019_multi_tenant_tables.sql`

**What it does:**
- Renames `member_roles` → `member_role_assignments`
- Creates: `organizations`, `organization_members`, `feature_flags`, `organization_features`, `platform_admins`
- Seeds WCC (`id = 00000000-0000-0000-0000-000000000001`) into `organizations`
- Backfills all existing members into `organization_members` with their current `app_role`

**Verify after running:**
```sql
SELECT id, name, slug FROM public.organizations;
-- Expected: 1 row — 00000000-0000-0000-0000-000000000001 | WCC Worship Ministry | wcc

SELECT count(*) FROM public.organization_members;
-- Expected: same count as SELECT count(*) FROM public.members
```

- [ ] 019 applied without error
- [ ] `organizations` row present
- [ ] `organization_members` count matches `members` count

---

### Migration 020 — Add `tenant_id` to all data tables

File: `supabase/migrations/020_add_tenant_id.sql`

**What it does:**
- Adds `tenant_id UUID NOT NULL` (with FK → organizations) to:
  `songs`, `roster`, `availability`, `availability_periods`, `sunday_setlist`, `audit_log`, `settings`, `handbook_documents`
- Backfills all existing rows to WCC UUID before adding `NOT NULL`
- Creates composite indexes for all primary query patterns
- Drops column `DEFAULT` after backfill (app code must supply `tenant_id` explicitly going forward)

**Verify after running:**
```sql
SELECT count(*) FROM public.songs WHERE tenant_id IS NULL;
SELECT count(*) FROM public.roster WHERE tenant_id IS NULL;
SELECT count(*) FROM public.availability_periods WHERE tenant_id IS NULL;
-- All must return 0
```

- [ ] 020 applied without error
- [ ] Zero NULL `tenant_id` rows on all data tables

---

### Migration 021 — Fix UNIQUE constraints + `app_settings` PK

File: `supabase/migrations/021_fix_constraints.sql`

**What it does:**
- Rewrites UNIQUE constraints to include `tenant_id` so Church B can have entries that date-overlap with Church A:
  - `roster`: `(date, role_id)` → `(tenant_id, date, role_id)`
  - `availability`: `(member_id, date)` → `(tenant_id, member_id, date)`
  - `sunday_setlist`: `(sunday_date, position)` → `(tenant_id, sunday_date, position)`
- `app_settings` PK: `(key)` → `(tenant_id, key)`
- Replaces global availability_periods EXCLUDE constraint with tenant-scoped version

**Verify after running:**
```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'roster' AND constraint_type = 'UNIQUE';
-- Expected: roster_tenant_date_role_unique

SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'app_settings' AND constraint_type = 'PRIMARY KEY';
-- Expected: app_settings_pkey (tenant_id, key)
```

- [ ] 021 applied without error
- [ ] UNIQUE constraint names updated on roster, availability, sunday_setlist
- [ ] app_settings PK is now composite (tenant_id, key)

---

### Migration 022 — `provision_tenant()` stored procedure

File: `supabase/migrations/022_provision_tenant.sql`

**What it does:**
- Creates `provision_tenant(name, slug, admin_email, admin_name)` PL/pgSQL function
- Atomically: creates org, upserts admin member, assigns Admin role, enables feature flags, seeds app_settings, seeds 7 handbook document stubs
- Used by Phase 2 tenant onboarding flow

**Verify after running:**
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'provision_tenant';
-- Expected: 1 row
```

- [ ] 022 applied without error
- [ ] `provision_tenant` function exists in public schema

---

### Migration 023 — `organization_members.app_role` CHECK constraint

File: `supabase/migrations/023_org_members_app_role_check.sql`

**What it does:**
- Adds CHECK constraint on `organization_members.app_role` to enforce the exact AppRole enum values:
  `Admin | Coordinator | Musician | MusicCoordinator | WorshipLeader`

**Verify after running:**
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'organization_members_app_role_check';
-- Expected: 1 row
```

- [ ] 023 applied without error
- [ ] CHECK constraint present on `organization_members`

---

### Post-migration row count verification

```sql
-- Row counts must match pre-migration snapshot
SELECT count(*) FROM public.members;
SELECT count(*) FROM public.songs;
SELECT count(*) FROM public.roster;
SELECT count(*) FROM public.organization_members;

-- No data should be NULL or orphaned
SELECT count(*) FROM public.songs WHERE tenant_id != '00000000-0000-0000-0000-000000000001';
-- Expected: 0 (all Church #1 data)
```

- [ ] Row counts match pre-migration snapshot
- [ ] Zero rows with unexpected `tenant_id`

---

## Step 4 — Vercel Deployment

1. Vercel will auto-deploy `main` branch after the PR merge (or trigger manually)
2. **Confirm these env vars in Vercel Dashboard → Project Settings → Environment Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>` | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service key>` | Already set |
| `MULTI_TENANT_ENABLED` | **NOT SET** | Kill switch OFF — this is intentional |

> ⚠️ **Do NOT set `MULTI_TENANT_ENABLED=true` in Vercel at this time.**  
> The kill switch stays OFF until Phase 2 multi-tenant routing is smoke-tested end-to-end.

3. Wait for deployment to complete (typically 2–4 minutes)
4. Confirm deployment status: green in Vercel dashboard, no build errors

- [ ] Vercel deployment succeeded
- [ ] `MULTI_TENANT_ENABLED` is NOT set in Vercel env vars

---

## Step 5 — Smoke Test (Production)

Run these manually against the live prod URL immediately after deploy.

### Auth
- [ ] Login with Admin credentials → lands on `/admin/roster`, no errors
- [ ] Login with Coordinator credentials → lands on `/admin/roster`, People/Songs pages read-only
- [ ] Logout → redirects to `/admin/login`

### People page
- [ ] List loads correctly with existing members
- [ ] Admin: Add Member modal opens, all fields render
- [ ] Admin: Edit a member role → saves correctly
- [ ] Coordinator: No "+ Add Member" button visible

### Songs page
- [ ] Song list loads
- [ ] Admin: Add Song modal opens and saves
- [ ] Chord sheet upload works (if chord sheets exist)

### Roster page
- [ ] Roster grid loads for current month
- [ ] Save Draft / Publish actions complete without errors

### Availability
- [ ] Magic link for an existing member still works (portal access)
- [ ] Availability form submits correctly

### Settings
- [ ] Admin can reach `/admin/settings` — page loads

### Audit log (spot check)
- [ ] Make one change (e.g., edit a member) → verify audit entry created with no errors in Vercel logs

- [ ] All smoke test items pass

---

## Rollback Procedures

### Scenario A — App bug discovered post-deploy (kill switch still OFF)

No migration rollback needed. Simply revert the Vercel deployment to the previous build.

```
Vercel Dashboard → Deployments → select previous → Redeploy
```

- [ ] Previous deployment promoted to production
- [ ] Smoke test core flows

---

### Scenario B — Migration caused data issue

> Migrations 019–023 are strictly additive for Church #1 data. A data issue would be unexpected, but the recovery path is:

1. Immediately set `MULTI_TENANT_ENABLED` to empty (already OFF — no action needed on app side)
2. The app continues to function using the WCC UUID hardcoded fallback
3. Investigate the issue in Supabase Studio
4. If a constraint needs reverting, apply a hotfix migration (`024_rollback_hotfix.sql`) — do NOT run migrations in reverse

---

### Scenario C — Kill switch accidentally set to ON in Vercel

**Symptom:** Church #1 users receive 500 errors or empty data pages.  
**Fix:** Remove `MULTI_TENANT_ENABLED` from Vercel env vars → trigger redeployment.  
**Time to recovery:** ~2 minutes (Vercel instant redeploy).

---

## Kill Switch Flip Procedure (Future — NOT part of this deploy)

When Phase 2 multi-tenant routing is ready and tested locally:

1. Run full test suite one more time: `npm run test` → 667 pass
2. Verify `provision_tenant()` has been tested on staging with a second church slug
3. Verify Vercel production has subdomain routing configured (`*.worshipapp.com`)
4. Set `MULTI_TENANT_ENABLED=true` in Vercel → redeploy
5. Test `wcc.worshipapp.com` → Church #1 data loads normally
6. Test unknown subdomain → returns `{ "error": "Organization not found" }` (HTTP 404)

---

## Phase 2 Prerequisites Verified

These are the blockers for Phase 2 (Roster Core) to begin. **All are green post this deploy.**

| Prerequisite | Status | Notes |
|---|---|---|
| `tenant_id` on all data tables | ✅ | Migration 020 |
| `organization_members` table | ✅ | Migration 019 — backfilled for all existing members |
| `provision_tenant()` stored proc | ✅ | Migration 022 — atomic new church onboarding |
| Tenant-scoped UNIQUE constraints | ✅ | Migration 021 |
| Kill switch infrastructure | ✅ | `isMultiTenantEnabled()` + middleware injection |
| Route handlers scope by `tenant_id` | ✅ | All `/api/*` routes updated |
| Test coverage with kill switch ON | ✅ | 667 tests, `MULTI_TENANT_ENABLED=true` in vitest |
| `app_role` CHECK constraint on org_members | ✅ | Migration 023 |

**Phase 2 entry point:** Roster Core — editable grid (Date × Roles), availability tracker, burnout indicator, conflict alerts, DRAFT → LOCKED status workflow. See `PLAN.md` Phase 2 and `work-slices/MEMBER-ROSTER-PAGE-SLICE-1.md`.

---

## Sign-off

| Role | Name | Date | Signed |
|------|------|------|--------|
| SDET | | 14 March 2026 | |
| Staff Engineer | | 14 March 2026 | |
| SaaS Architect | | 14 March 2026 | |

**Post-deploy declaration:** All smoke test items above checked. No regressions observed. System is stable on kill switch OFF. Phase 2 implementation may begin.
