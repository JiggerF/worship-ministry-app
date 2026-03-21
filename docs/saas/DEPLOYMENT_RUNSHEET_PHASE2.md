# Deployment Runsheet — Phase 2: Live Multi-Tenancy

**Date:** 21 March 2026
**Branch:** `feature-tenant-phase2` → `main`
**Personas:** SDET · Staff Engineer · SaaS Architect
**Risk level:** MEDIUM — kill switch flip makes tenant routing live for both tenants
**Estimated time:** ~45 min (pre-work ~10 min, DNS/Vercel ~10 min, deploy ~8 min, smoke test ~15 min)

---

## Phase 1 Status (already complete)

| Item | State |
|------|-------|
| Migrations 019–023 applied to prod | ✅ Merged as PR #30 (`feature-tenancy-phase-1`) |
| `provision_tenant()` stored proc in prod | ✅ Migration 022 |
| Kill switch infrastructure in prod | ✅ `isMultiTenantEnabled()` + middleware injection |
| All data tables have `tenant_id` column | ✅ Migration 020 — all WCC rows backfilled |
| Tenant-scoped UNIQUE constraints | ✅ Migration 021 |

---

## What Ships in Phase 2

- **Dynamic tenant labels** — middleware injects `x-tenant-name` header; login page shows org name as title; availability page shows org name in header
- **Portal tenant fix** — `/portal/roster` and `/portal/songs` now forward `?org=` query param to API calls so non-authenticated musicians can access the portal in multi-tenant mode
- **751 tests passing** with `MULTI_TENANT_ENABLED=true` — SDET signoff: 21 March 2026

---

## Pre-Deploy Checklist

```bash
# 1. Confirm clean test run
npm run test
# Expected: 751 tests, 0 failed

# 2. Confirm no TypeScript errors
npm run build
# Expected: ✓ Compiled successfully

# 3. Lint clean
npm run lint
# Expected: No errors
```

- [ ] 751 tests pass
- [ ] Build succeeds with no type errors
- [ ] Lint clean
- [ ] Confirm current prod Supabase migration version — last applied should be `023_org_members_app_role_check.sql`

---

## Step 0 — CRITICAL: Fix WCC Slug (MUST do before flipping kill switch)

> ⚠️ **This step is mandatory.** The WCC organization row in the DB has `slug = 'wcc'` but the production subdomain is `worship.gracetoyou.com.au`. When `MULTI_TENANT_ENABLED=true`, middleware extracts `"worship"` from the subdomain and queries `organizations WHERE slug = 'worship'` — which returns no rows. WCC breaks entirely if this is not fixed first.

**Run in Supabase Dashboard → SQL Editor:**

```sql
-- Fix WCC slug to match production subdomain
UPDATE organizations
SET slug = 'worship'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Verify
SELECT id, name, slug FROM public.organizations;
-- Expected: 00000000-0000-0000-0000-000000000001 | WCC Worship Ministry | worship
```

- [ ] WCC slug updated to `worship`
- [ ] Verified via SELECT — only 1 row, slug = `worship`

---

## Step 1 — Merge `feature-tenant-phase2` to `main`

```bash
# Create PR on GitHub
# Title: feat: live multi-tenancy (Phase 2) — tenant labels + portal fix
# Base: main ← feature-tenant-phase2
```

PR checklist:
- [ ] 751 tests passing
- [ ] Dynamic tenant labels implemented and tested
- [ ] Portal `/portal/roster` and `/portal/songs` tenant-aware
- [ ] No changes to migration files (schema is complete from Phase 1)
- [ ] SDET signoff: 21 March 2026

Merge strategy: Squash or Merge commit — no rebase.

- [ ] PR merged to `main`

---

## Step 2 — Provision CFC Tenant

> Run this **before** adding DNS so the slug exists in the DB when the first request hits.

**Run in Supabase Dashboard → SQL Editor:**

```sql
-- Replace email and admin name with real CFC admin details
SELECT provision_tenant(
  'CFC Worship Ministry',
  'cfc',
  'jsabelino@gmail.com',
  'Julius Sabelino'
);

-- Verify
SELECT id, name, slug FROM public.organizations WHERE slug = 'cfc';
-- Expected: 1 row with a new UUID
```

**Then create the Supabase Auth user:**

1. Supabase Dashboard → Authentication → Users → **Invite user** (or Add User)
2. Email: the CFC admin email used above
3. Once user exists, they can log in at `https://cfc.gracetoyou.com.au/admin/login`

- [ ] `provision_tenant()` ran without error
- [ ] `organizations` row with slug `cfc` exists
- [ ] `organization_members` has 1 Admin row for CFC admin email
- [ ] Supabase Auth user created for CFC admin email

---

## Step 3 — Vercel Domain + DNS

### 3a — Add domain in Vercel

1. Vercel Dashboard → Project → Settings → **Domains**
2. Add `cfc.gracetoyou.com.au`
3. Vercel will display a **CNAME target value** (e.g. `cname.vercel-dns.com`) — copy it

> `worship.gracetoyou.com.au` should already be configured as a Vercel domain. If not, add it now the same way.

- [ ] `cfc.gracetoyou.com.au` added in Vercel Domains
- [ ] CNAME target value noted: `______________________`
- [ ] `worship.gracetoyou.com.au` confirmed in Vercel Domains

### 3b — Add DNS CNAME record

In your DNS registrar (for `gracetoyou.com.au`):

| Type | Host | Value |
|------|------|-------|
| CNAME | `cfc` | `<vercel-cname-target>` |

> DNS propagation typically takes 5–30 min. Vercel will show domain status as "Valid Configuration" once propagated.

- [ ] CNAME record added in DNS registrar
- [ ] Vercel shows `cfc.gracetoyou.com.au` as "Valid Configuration"

---

## Step 4 — Flip the Kill Switch

> ⚠️ **Do not flip until Steps 0–3 are all complete.** Flipping before Step 0 breaks WCC. Flipping before Step 2 means CFC has no tenant row.

**Vercel Dashboard → Project → Settings → Environment Variables:**

| Variable | Value | Action |
|----------|-------|--------|
| `MULTI_TENANT_ENABLED` | `true` | Add (or update from unset) |

Then: **Redeploy** (Vercel → Deployments → Redeploy latest, or push an empty commit to trigger).

- [ ] `MULTI_TENANT_ENABLED=true` set in Vercel
- [ ] Redeployment triggered
- [ ] Deployment succeeded (green in Vercel dashboard)

---

## Step 5 — Smoke Test (Production)

Run these immediately after deployment. Test WCC first to confirm no regression.

### WCC — `https://worship.gracetoyou.com.au`

**Admin flows:**
- [ ] Login with WCC Admin credentials → lands on `/admin/roster`, no errors
- [ ] Login page shows "WCC Worship Ministry" (or configured org name) in the heading
- [ ] People page: member list loads, Admin sees "+ Add Member"
- [ ] Songs page: song list loads
- [ ] Roster page: grid loads for current month, Draft/Publish work
- [ ] Settings page: Admin can reach `/admin/settings`
- [ ] Logout → redirects to `/admin/login`

**Portal (unauthenticated):**
- [ ] `https://worship.gracetoyou.com.au/portal/roster` → roster loads with WCC data, no "Organization not found" error
- [ ] `https://worship.gracetoyou.com.au/portal/songs` → song list loads

**Availability:**
- [ ] Magic link for an existing WCC member still works
- [ ] Availability form shows "WCC Worship Ministry" (or org name) in header
- [ ] Availability form submits without error

### CFC — `https://cfc.gracetoyou.com.au`

**Admin flows:**
- [ ] Login with CFC admin credentials → lands on `/admin/roster`, no errors
- [ ] Login page shows "CFC Worship Ministry" in the heading
- [ ] People page: shows only CFC members (not WCC members)
- [ ] Roster page: empty (no data yet — that's correct)
- [ ] Songs page: empty (no songs yet — that's correct)

**Isolation check:**
- [ ] Logged in as CFC admin, navigate to People — confirms zero WCC members visible

---

## Rollback Procedures

### Scenario A — WCC broken after kill switch flip

**Symptom:** WCC users get "Organization not found" or blank pages.
**Most likely cause:** Step 0 (slug fix) was not applied — slug is still `wcc` not `worship`.

**Immediate recovery (< 2 min):**
```
Vercel → Settings → Environment Variables → delete MULTI_TENANT_ENABLED → Redeploy
```
Then fix the slug (Step 0) and re-flip.

- [ ] `MULTI_TENANT_ENABLED` removed from Vercel
- [ ] Redeployment triggered and succeeded
- [ ] WCC smoke tests pass with kill switch OFF

---

### Scenario B — App bug discovered post-flip

**Fix:** Remove `MULTI_TENANT_ENABLED` from Vercel → Redeploy (~90 seconds).

The slug fix and CFC provisioning are non-destructive — they do not need to be rolled back.

---

### Scenario C — CFC subdomain not resolving

**Symptom:** `cfc.gracetoyou.com.au` returns a 404 or Vercel "Domain not configured" page.
**Fix:** DNS propagation may still be in progress. Check Vercel domain status. Wait up to 30 min. No app rollback needed.

---

## Post-Deployment Configuration

Once both tenants are live and smoke-tested:

1. **Distribute portal URL to CFC musicians:**
   `https://cfc.gracetoyou.com.au/portal/roster`
   Musicians bookmark this — subdomain carries the tenant context; no `?org=` needed.

2. **CFC admin onboarding URL:**
   `https://cfc.gracetoyou.com.au/admin/login`

3. **WCC portal URL (unchanged):**
   `https://worship.gracetoyou.com.au/portal/roster`

---

## How Subdomain → Tenant Routing Works

For reference: `src/middleware.ts` → `resolveTenantId()` extracts `hostname.split(".")[0]` (e.g. `"cfc"` from `cfc.gracetoyou.com.au`) and queries `SELECT id FROM organizations WHERE slug = $1`. The `organizations.slug` column **is** the subdomain mapping — no other config is needed. Adding a new tenant is: (1) run `provision_tenant()` with the slug, (2) add DNS CNAME.

---

## Sign-off

| Role | Name | Date | Signed |
|------|------|------|--------|
| SDET | | 21 March 2026 | |
| Staff Engineer | | 21 March 2026 | |
| SaaS Architect | | 21 March 2026 | |

**Post-deploy declaration:** All smoke test items checked. WCC data isolated to WCC. CFC data isolated to CFC. Portal pages load for unauthenticated musicians. System stable with `MULTI_TENANT_ENABLED=true`.
