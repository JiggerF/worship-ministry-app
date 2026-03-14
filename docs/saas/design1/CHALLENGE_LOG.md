# SaaS Architecture Challenge Log

> **Date:** March 2026
> **Reviewed documents:** [SAAS_ARCHITECTURE_PLAN.md](./SAAS_ARCHITECTURE_PLAN.md), [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md)
> **Review lenses:** Systems Thinking, Staff Software Engineer, SDET / Quality Engineer

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | Fixed in both plans |
| High | 4 | Fixed in both plans |
| Medium | 3 | Documented; noted in plans |
| Low | 1 | Documented |

---

## CRITICAL Issues

### C1: `x-tenant-id` header can be spoofed on API routes

**Category:** Security
**Found by:** Systems Thinking + Quality Engineer

**Problem:**
The plan proposes: middleware extracts tenant from subdomain → sets `x-tenant-id` header → API routes trust it. But:

1. Current middleware matcher is `"/admin/:path*"` only. API routes at `/api/*` are **not covered by middleware**.
2. Even if the matcher is expanded, a malicious client could send a forged `x-tenant-id` header directly. The plan never specifies that middleware must **overwrite** (not append to) incoming headers.
3. Next.js middleware uses `NextResponse.next({ request: { headers } })` which does replace headers for downstream — but this is an implicit guarantee that needs explicit verification and testing.

**Impact:** Complete tenant isolation bypass. Any authenticated user could read/write any tenant's data by setting a custom header.

**Fix applied:**
- Middleware matcher must expand to `/admin/:path*`, `/api/:path*`, `/portal/:path*`
- Middleware must **delete then set** the `x-tenant-id` header (never trust incoming value)
- Add integration test: "API route ignores client-supplied `x-tenant-id` header"
- Add `getTenantId()` validation: verify the UUID format before using it in queries

---

### C2: `members.is_active` is global — deactivating a member kills them across ALL orgs

**Category:** Data model
**Found by:** Systems Thinking

**Problem:**
`members.is_active` is a column on the shared `members` table. If Church A's admin deactivates a shared member, that member is locked out of Church B too. Both plans say "a person can belong to multiple churches" but neither addresses this cross-tenant side effect.

**Impact:** An admin at one church can inadvertently disable a volunteer at another church.

**Fix applied:**
- Add `is_active BOOLEAN NOT NULL DEFAULT true` to `organization_members`
- Per-tenant deactivation checks `organization_members.is_active`, not `members.is_active`
- `members.is_active` becomes a **platform-level** kill switch (only platform admins can set it)
- Login flow checks: `organization_members.is_active` for tenant access, `members.is_active` for global suspension

---

### C3: Portal and availability routes have ZERO tenant context

**Category:** Coverage gap
**Found by:** Quality Engineer

**Problem:**
Both plans focus exclusively on `/admin/*` routes. But the app has:
- `/portal/roster`, `/portal/songs` — musician-facing views (no auth required beyond session)
- `/availability?token=xxx` — public form accessed via magic link
- `/api/roster?view=portal`, `/api/songs?scope=portal` — backend for portal views

None of these are under `/admin/*`. They have no subdomain resolution. After multi-tenancy, they would either return ALL tenants' data or break entirely.

**Impact:** Data leaks through portal and availability routes.

**Fix applied:**
- Middleware matcher expanded to cover `/portal/:path*` and `/api/:path*`
- Magic token lookup returns `tenant_id` from `organization_members`; middleware uses this for availability routes
- Portal routes require either subdomain context or authenticated session with tenant
- Availability routes: token resolves member → member's org(s) → if exactly one org, use it; if multiple, require subdomain

---

## HIGH Issues

### H1: `members.email` UNIQUE + `members.tenant_id` = contradiction for multi-org members

**Category:** Data model
**Found by:** Staff Engineer

**Problem:**
`members.email` has a UNIQUE constraint. A person belonging to two churches has ONE `members` row. The plan adds `tenant_id` to `members` as "home tenant" — but which tenant_id gets set? The concept is underspecified.

**Fix applied:**
- **Remove `tenant_id` from `members` table.** Members are global identity records (like Supabase Auth users).
- All tenant scoping flows through `organization_members` exclusively.
- `getMemberByMagicToken(token)` returns the member + queries `organization_members` to find their org(s).
- Tables that previously relied on `members.tenant_id` for JOINs use `organization_members` instead.

---

### H2: Provisioning flow is not atomic — partial failure leaves orphaned data

**Category:** Reliability
**Found by:** Quality Engineer

**Problem:**
The 7-step provisioning sequence (create org → features → settings → member → org_member → handbook → invite) uses individual Supabase JS client calls. The client has no multi-statement transaction support. If step 5 fails, you have an org with no admin.

**Fix applied:**
- Steps 1-6 wrapped in a PostgreSQL stored procedure (`provision_tenant()`) that runs as a single transaction.
- Step 7 (email invite) runs after the transaction commits — if it fails, the org is valid and the invite can be retried.
- Add a test: "Provisioning rolls back cleanly if any step fails"

---

### H3: In-memory cache won't work on Vercel serverless

**Category:** Infrastructure
**Found by:** Staff Engineer

**Problem:**
Both plans mention "60s in-memory Map TTL" for caching org slug→id mappings and feature flags. But Vercel serverless functions are ephemeral — each cold start has empty memory. Even warm instances don't share memory across concurrent invocations.

**Fix applied:**
- Remove all references to in-memory caching
- Accept the DB lookup for now — `SELECT FROM organizations WHERE slug = ?` with an indexed column is <5ms at 3-10 tenants
- Note Vercel KV (Redis) as a future optimization if needed at scale
- Note JWT custom claims (via Supabase Auth hooks) as the ideal long-term solution — eliminates the lookup entirely

---

### H4: `tenantFrom()` bakes in `select("*")` — too rigid, will be bypassed

**Category:** Usability / Safety
**Found by:** Staff Engineer

**Problem:**
```typescript
export function tenantFrom(supabase, table, tenantId) {
  return supabase.from(table).select("*").eq("tenant_id", tenantId);
}
```
Real queries need: specific column selects, JOINs (`.select("*, chord_charts(*)")`), counts, aggregations. Developers will bypass this helper for anything beyond trivial queries, defeating the safety purpose.

**Fix applied:**
- `tenantFrom()` returns a query builder **without** `.select()`:
  ```typescript
  export function tenantFrom(supabase, table, tenantId) {
    return supabase.from(table).eq("tenant_id", tenantId);
    // Caller chains .select(), .order(), etc.
  }
  ```
- Caller is responsible for `.select()` — helper only guarantees tenant filter is present

---

## MEDIUM Issues

### M1: Inherited tables have no direct tenant protection

**Category:** Security
**Found by:** Quality Engineer

**Problem:**
`chord_charts`, `availability_responses`, `availability_dates` don't have `tenant_id`. A query like `SELECT * FROM chord_charts WHERE id = ?` has no tenant check. If an attacker knows a chord_chart ID from another tenant, they could access it.

**Recommendation:**
- Always query inherited tables via parent JOIN, never by direct ID lookup
- Add explicit test cases: "Cannot fetch chord_chart by ID if parent song belongs to another tenant"
- Consider adding `tenant_id` to these tables as redundant defense-in-depth

---

### M2: No rollback strategy for Phase 1 application changes

**Category:** Operations
**Found by:** Systems Thinking

**Problem:**
Phase 0 says "migration is reversible." Phase 1 changes behavior across 25+ route files simultaneously. If a bug is discovered post-deployment, rolling back means reverting all files. The old code would still work (it ignores `tenant_id` columns) but there's no graceful degradation path.

**Recommendation:**
Add an application-level kill switch via environment variable:
```typescript
// MULTI_TENANT_ENABLED=true|false
export function getTenantId(req: NextRequest): string | null {
  if (process.env.MULTI_TENANT_ENABLED !== 'true') return null;
  // ... normal resolution
}
```
Routes: `if (tenantId) query.eq("tenant_id", tenantId)` — gracefully degrades to single-tenant.

---

### M3: No rate limiting or audit on platform admin APIs

**Category:** Security
**Found by:** Quality Engineer

**Problem:**
Platform admin routes (`/api/platform/*`) are protected by auth but have:
- No rate limiting on tenant provisioning
- No audit logging of platform admin actions (only tenant-level audit exists)
- Platform admin session compromise = full system compromise with no visibility

**Recommendation:**
- Add platform-level audit logging to all `/api/platform/*` routes
- Add rate limiting (e.g., max 10 tenant creations per hour)
- Consider requiring MFA for platform admin accounts

---

## LOW Issues

### L1: CHECK constraint on `app_role` prevents easy role evolution

**Category:** Maintainability
**Found by:** Staff Engineer

**Problem:**
```sql
app_role TEXT NOT NULL CHECK (app_role IN ('Admin','Coordinator','Musician',...))
```
Adding a new role requires a database migration to alter the CHECK constraint.

**Recommendation:**
Consider a foreign key to an `app_roles` lookup table instead, or document that role additions require a migration and accept the tradeoff at this scale.
