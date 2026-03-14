# SaaS Architecture Challenge Log (Design 2)

> **Date:** March 2026
> **Reviewed documents:** [TECHNICAL_PLAN_DESIGN2.md](./TECHNICAL_PLAN_DESIGN2.md), [SAAS_ARCHITECTURE_DESIGN2.md](./SAAS_ARCHITECTURE_DESIGN2.md)
> **Review lenses:** Systems Thinking, Staff Software Engineer, SDET / Quality Engineer

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | Fixed in both plans |
| High | 5 | Fixed in both plans |
| Medium | 3 | Documented; noted in plans |

---

## CRITICAL Issues

### C1: `availability_periods` EXCLUDE constraint breaks in multi-tenant

**Category:** Data model
**Found by:** SDET / Quality Engineer

**Problem:**
Migration `014_no_overlapping_open_periods.sql` creates an `EXCLUDE` constraint using `btree_gist`:

```sql
EXCLUDE USING gist (
  daterange(starts_on, ends_on, '[]') WITH &&
)
WHERE (closed_at IS NULL);
```

This constraint is globally scoped. Two churches cannot both create an open availability period for the same date range — Church B's period would be rejected as overlapping with Church A's.

**Impact:** Church onboarding blocked if any availability periods overlap with existing churches.

**Fix applied:**
- Migration 021 must DROP and recreate the EXCLUDE constraint with `tenant_id`:
  ```sql
  ALTER TABLE availability_periods DROP CONSTRAINT no_overlapping_open_periods;
  ALTER TABLE availability_periods ADD CONSTRAINT no_overlapping_open_periods
    EXCLUDE USING gist (
      tenant_id WITH =,
      daterange(starts_on, ends_on, '[]') WITH &&
    ) WHERE (closed_at IS NULL);
  ```
- This ensures overlapping periods are only rejected within the same tenant

---

### C2: Middleware runs in Edge Runtime — cannot make async DB lookups

**Category:** Infrastructure
**Found by:** Staff Software Engineer + Systems Thinking

**Problem:**
Next.js middleware runs in **Edge Runtime** by default. The plan proposes doing a Supabase DB lookup (`SELECT id FROM organizations WHERE slug = ?`) inside middleware on every request. However:

1. Edge Runtime has limited API support — while Supabase client works in Edge, it adds latency to every request
2. The existing middleware already uses `Buffer.from(parts[1], 'base64')` for JWT decoding — this works in Edge but is a Node.js-style pattern
3. The middleware is already complex (auth + role lookup + route restrictions); adding tenant resolution + another DB query makes it a performance bottleneck

**Impact:** Every request pays the cost of 2 DB round-trips in middleware (org lookup + role lookup). At 3 tenants this is tolerable but architecturally concerning.

**Fix applied:**
- Document that middleware DB lookups are acceptable at 3-10 tenant scale (<5ms each with indexed columns)
- Add explicit performance budget: middleware total time must stay under 50ms
- Note that JWT custom claims (via Supabase Auth hooks) is the correct long-term fix — embeds `tenant_id` and `app_role` in the JWT, eliminating both DB lookups
- Add monitoring for middleware latency as exit criteria for Phase 1

---

### C3: Availability token route does NOT validate `periodId` belongs to the correct tenant

**Category:** Security
**Found by:** SDET / Quality Engineer

**Problem:**
The plan proposes resolving tenant context from `periodId → availability_periods.tenant_id` for magic token availability routes. However, the current code at `src/app/api/availability/[token]/route.ts` does:

```typescript
const { data: period } = await supabase
  .from("availability_periods")
  .select("*")
  .eq("id", periodId)
  .single();
```

There is **no validation** that the periodId belongs to the same tenant as the token-holder's organization. A malicious user who knows a period UUID from another church could submit availability responses to it.

**Impact:** Cross-tenant availability data injection.

**Fix applied:**
- After resolving the member's org(s) from `organization_members`, the route must verify that `period.tenant_id` matches one of the member's orgs
- Pattern:
  ```typescript
  const memberOrgs = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("member_id", member.id)
    .eq("is_active", true);

  if (!memberOrgs.data?.some(o => o.organization_id === period.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  ```
- Add integration test: "Magic token user cannot submit to period belonging to another tenant"

---

## HIGH Issues

### H1: `availability_responses` UNIQUE constraint `(period_id, member_id)` needs tenant scoping

**Category:** Data model
**Found by:** Staff Engineer

**Problem:**
The UNIQUE constraint `(period_id, member_id)` on `availability_responses` does not include `tenant_id`. While `period_id` is implicitly tenant-scoped (each period belongs to one tenant), the constraint itself doesn't enforce this at the database level. If a period row were somehow shared or if IDs collided, responses could leak across tenants.

However, `availability_responses` inherits tenant via `period_id → availability_periods.tenant_id` and the plan correctly categorizes it as an inherited table. The real risk is low because period UUIDs are globally unique.

**Fix applied:**
- Accept the current constraint as sufficient since `period_id` is a FK to a tenant-scoped table
- Add explicit test: "Cannot create availability_response for period belonging to another tenant"
- Document this as a deliberate design choice (defense relies on parent FK, not direct tenant_id)

---

### H2: `availability_dates` UNIQUE constraint `(response_id, date)` — same inherited pattern

**Category:** Data model
**Found by:** Staff Engineer

**Problem:**
Same pattern as H1 — `availability_dates` inherits tenant through `response_id → availability_responses → availability_periods`. No direct `tenant_id` column.

**Fix applied:**
- Same resolution as H1: accept inherited isolation, add explicit tests
- Add test: "Cannot insert availability_date for response belonging to another tenant's period"

---

### H3: Service role clients created in 12+ locations — no centralized tenant filtering

**Category:** Architecture
**Found by:** Systems Thinking + Staff Engineer

**Problem:**
The codebase creates Supabase service role clients in at least 12 separate locations:
- `src/lib/db/members.ts` (module-level singleton)
- `src/lib/db/audit-log.ts` (per-call)
- `src/lib/db/availability-periods.ts` (module-level)
- `src/lib/db/setlist.ts` (module-level)
- `src/lib/db/handbook.ts` (likely module-level)
- `src/lib/server/get-actor.ts` (per-call)
- `src/app/api/members/route.ts` (module-level)
- `src/app/api/members/[id]/route.ts` (module-level)
- `src/app/api/roster/route.ts` (module-level)
- `src/app/api/songs/route.ts` (module-level)
- `src/app/api/availability/[token]/route.ts` (module-level)
- `src/app/api/setlist/route.ts` (module-level)

The plan mentions `tenantFrom()` and `tenantInsert()` helpers but doesn't address that there are **two patterns** in the codebase:
1. **`lib/db/*.ts` functions** — centralized helpers (e.g., `getMembers()`, `createMember()`)
2. **Direct `supabase.from()` calls in API route files** — bypass the helpers entirely

Both patterns need tenant scoping, but the plan only discusses updating the `lib/db/*.ts` layer.

**Impact:** If even one direct `supabase.from()` call in an API route misses the `.eq("tenant_id")`, data leaks.

**Fix applied:**
- The implementation plan must address BOTH patterns explicitly:
  1. Update all `lib/db/*.ts` functions with `tenantId` parameter
  2. Update all direct `supabase.from()` calls in API route files
- Add a code review checklist item: "Every `supabase.from()` call must include `.eq('tenant_id', tenantId)` or use `tenantFrom()`"
- The file impact map must list every route file that has direct DB calls (not just those using lib/db helpers)

---

### H4: `getActorFromRequest()` has no tenant context — audit logs are unscoped

**Category:** Architecture
**Found by:** Systems Thinking

**Problem:**
`getActorFromRequest()` in `src/lib/server/get-actor.ts` returns `{ id, name, role }` with no `tenantId`. It looks up the member by email globally:

```typescript
const { data } = await supabase
  .from("members")
  .select("id, name, app_role")
  .eq("email", email)
  .single();
```

The plan mentions adding `tenantId` to `AuditActor`, but the implementation must also change the lookup to read `app_role` from `organization_members` (not `members.app_role`). Additionally, the function needs the `x-tenant-id` header to know which tenant's role to return.

**Impact:** Audit log entries written with wrong role if member has different roles at different churches. Actor resolution uses deprecated `members.app_role`.

**Fix applied:**
- `getActorFromRequest()` must:
  1. Read `x-tenant-id` from request headers
  2. Look up `organization_members.app_role` instead of `members.app_role`
  3. Return `tenantId` in the `AuditActor` object
- Add to Phase 1 implementation steps explicitly

---

### H5: Legacy `availability` table fallback path is tenant-unaware

**Category:** Coverage gap
**Found by:** SDET / Quality Engineer

**Problem:**
The availability token route at `src/app/api/availability/[token]/route.ts` has a **fallback path** (lines ~262-459) that writes to the legacy `availability` table when no matching `availability_periods` period exists. This legacy path uses:

```typescript
await supabase.from("availability").upsert(payload, { onConflict: "member_id,date" });
```

The plan adds `tenant_id` to the `availability` table but doesn't mention updating this legacy fallback path. The `onConflict` clause must become `"tenant_id,member_id,date"` and the upsert payload must include `tenant_id`.

**Impact:** Legacy availability submissions would fail or conflict across tenants.

**Fix applied:**
- Add the legacy `availability` fallback path to the API route update list
- Update `onConflict` to `"tenant_id,member_id,date"`
- Update the corresponding UNIQUE constraint in migration 021
- Add to the `lib/db/members.ts` functions that touch the legacy `availability` table: `upsertAvailability()`, `getAvailabilityByMemberId()`

---

## MEDIUM Issues

### M1: Portal routes fetch API without tenant context headers

**Category:** Coverage gap
**Found by:** SDET / Quality Engineer

**Problem:**
Portal pages (`/portal/roster/page.tsx`, `/portal/songs/page.tsx`) are client-side components that call:
```typescript
fetch('/api/roster?month=...&view=portal')
fetch('/api/songs?scope=portal')
```

These fetches go to `/api/*` routes which (after multi-tenancy) will read `x-tenant-id` from the request header. But the portal pages make these calls from the browser — the browser's `fetch()` does NOT include the `x-tenant-id` header that middleware sets.

The middleware sets `x-tenant-id` on the **server-side request headers** (via `NextResponse.next({ request: { headers } })`), which propagates to server-side route handlers. But client-side `fetch()` calls from portal pages will NOT have this header.

**Recommendation:**
- Portal pages need tenant context via one of:
  1. A cookie set by middleware (e.g., `x-tenant-id` cookie)
  2. Reading tenant from the subdomain client-side and passing as a query param
  3. The API routes reading tenant from the session/JWT instead of just the header
- The plan mentions `x-tenant-id` cookie as a propagation mechanism but doesn't detail how client-side fetches use it

---

### M2: `setlist.ts` has its own `onConflict` that needs updating

**Category:** Data model
**Found by:** Staff Engineer

**Problem:**
`src/lib/db/setlist.ts` (line 73) uses `onConflict: "sunday_date,position"`. This is a separate file from the API route — the plan's file impact map lists the API route but may miss this lib file.

**Recommendation:**
- Add `src/lib/db/setlist.ts` to the file impact map explicitly
- Update `onConflict` to `"tenant_id,sunday_date,position"`

---

### M3: `handbook_documents.created_by` references `auth.users(id)` — provisioning procedure uses `created_by_name` only

**Category:** Data consistency
**Found by:** Staff Engineer

**Problem:**
The handbook_documents table has two creator columns:
- `created_by UUID REFERENCES auth.users(id)` — links to Supabase Auth
- `created_by_name TEXT` — display name

The provisioning stored procedure seeds handbook documents with `created_by_name = p_admin_name` but leaves `created_by = NULL`. This is correct (the auth user may not exist yet at provision time — the invite email hasn't been sent). But it means handbook version history will show a null author for seeded docs.

**Recommendation:**
- Accept this as a known limitation
- Optionally: update `created_by` after the admin accepts the invite and first logs in
- Document in the provisioning flow description

---

## Findings Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| C1 | `availability_periods` EXCLUDE constraint globally scoped | Critical | Data model |
| C2 | Middleware Edge Runtime + DB lookup performance | Critical | Infrastructure |
| C3 | Availability token route doesn't validate periodId tenant | Critical | Security |
| H1 | `availability_responses` UNIQUE lacks direct tenant_id | High | Data model |
| H2 | `availability_dates` UNIQUE lacks direct tenant_id | High | Data model |
| H3 | 12+ service role client locations, two query patterns | High | Architecture |
| H4 | `getActorFromRequest()` returns no tenant context | High | Architecture |
| H5 | Legacy `availability` table fallback is tenant-unaware | High | Coverage gap |
| M1 | Portal client-side fetches won't have tenant header | Medium | Coverage gap |
| M2 | `setlist.ts` lib file has `onConflict` needing update | Medium | Data model |
| M3 | Handbook seed docs have null `created_by` | Medium | Data consistency |
