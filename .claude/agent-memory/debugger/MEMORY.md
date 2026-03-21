# Debugger Agent Memory

## Novel Failure Patterns

### FAILURE CLASS 9 — "Invalid login credentials" for Second Tenant Admin

**Symptom:** Login page shows "Invalid login credentials" for a known second-tenant admin user.

**Triage rule:** "Invalid login credentials" is the exact string Supabase Auth returns from
`signInWithPassword()` when the Supabase Auth user does not exist OR the password is wrong.
It is NOT produced by the multi-tenant validation block (which returns 403 with different messages).

**How to distinguish from application logic errors:**
- 401 + "Invalid login credentials" = Supabase Auth failure (credentials wrong or user missing)
- 401 + "Authentication failed" = Supabase session null (edge case)
- 403 + "Not authorised for this organisation" = org membership check failed (post-auth)
- 403 + "No active organisation membership found" = no organization_members row
- 404 (HTML) = tenant slug not found in organizations table

**Root cause confirmed in this codebase:**
The `provision_tenant()` stored procedure (migration 022) creates a `members` row but does NOT
create a Supabase Auth user. The `POST /api/platform/tenants` route sends an invite email via
`supabase.auth.admin.inviteUserByEmail()` — if the invite was never accepted, or if the local
dev environment was reset without re-running provisioning, the Supabase Auth user has no
usable password.

**Fix (local dev):**
Reset the password via Supabase admin API:
```
curl -X PUT "http://127.0.0.1:54321/auth/v1/admin/users/<USER_UUID>" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"password": "Password123", "email_confirm": true}'
```
Get the UUID: `SELECT id::text FROM auth.users WHERE email = '<email>';`

**Fix (production):** Use Supabase Dashboard > Authentication > Users > Reset password,
OR trigger a password reset email, OR re-send the invite.

**Verify fix:** POST directly to Supabase Auth token endpoint — if it returns `access_token`,
credentials are now valid. Then run `npm run test:components` and auth route tests.

**Failure class:** Novel — not in registry (no code change needed, operational data fix only)

---

---

### FAILURE CLASS 11 — "You do not have platform admin access." for Regular Tenant Admin

**Symptom:** A church admin (`app_role = 'Admin'` in `members` and `organization_members`)
sees "You do not have platform admin access." when trying to log in or access admin routes.

**Root cause (two parts):**

Part A — Subdomain slug mismatch: `resolveTenantId()` extracts the first subdomain segment
from the production hostname (e.g. `worship` from `worship.gracetoyou.com.au`) and queries
`organizations WHERE slug = 'worship'`. The WCC organization was seeded with `slug = 'wcc'`,
so the lookup returns no rows. Previously `resolveTenantId()` returned `null` immediately when
the slug lookup failed — skipping the `sb-tenant-id` cookie fallback. With `MULTI_TENANT_ENABLED=true`,
`tenantId=null` caused the tenant guard to fire, returning 404 "Organization Not Found" for all
`/admin/*` routes except `/admin/login`. The `/api/me` call also got 404, so the admin layout
showed no user info.

Part B — Platform login logout side effect: The `/platform/login` page calls
`/api/auth/logout` when `/api/platform/me` returns 403 (not a platform admin). If a church
admin accidentally lands on `/platform/login` and submits credentials, their session is
destroyed — locking them out of `/admin/*` as well.

**Fix applied (two parts):**
1. `src/middleware.ts` — In `resolveTenantId()`, when the slug DB lookup returns empty rows,
   fall through to the `sb-tenant-id` cookie fallback before returning null.
2. `src/app/platform/login/page.tsx` — Remove the `fetch("/api/auth/logout")` call after a
   failed platform admin check. A failed platform admin check must not destroy the session.

**Data fix also required:** Apply migration 024 to update WCC org slug from `'wcc'` to `'worship'`
so the slug lookup succeeds in production. The code fix is defense-in-depth for future slug drift.

**How to diagnose:**
1. Run `SELECT slug FROM organizations WHERE id = '00000000-0000-0000-0000-000000000001';`
   Compare against the first subdomain segment of the production hostname.
2. If mismatch: apply migration 024 (or update slug manually).
3. If the user reports the exact string "You do not have platform admin access." — they
   landed on `/platform/login`. Check for bookmarks or links pointing there.
4. Verify the code fix is deployed: `resolveTenantId()` must have the cookie fallback AFTER
   the slug DB lookup, not only in the `!slug` branch.

**Test coverage:** `__tests__/integration/middleware-tenant.test.ts` — "falls back to
sb-tenant-id cookie when subdomain slug is present but unrecognised" (test added with fix).

---

## High-Risk Files

- `src/app/api/auth/login/route.ts` — Multi-tenant validation block (lines 93-157) runs
  AFTER Supabase Auth. Any 403 from here has a different message than Supabase's 401.
- `src/middleware.ts` — resolveTenantId() reads ?org= param in dev, subdomain in prod,
  sb-tenant-id cookie as fallback. The cookie fallback only fires when slug is null OR when
  slug DB lookup returns empty rows (after the fix). Returns null if neither resolves.
- `src/app/platform/login/page.tsx` — Must NOT call logout on a failed platform admin check.
  Calling logout destroys the session needed for /admin/* access.
- `supabase/migrations/022_provision_tenant.sql` — provision_tenant() creates members row
  but NOT Supabase Auth user. Auth user must be created separately via invite or admin API.
- `supabase/migrations/019_multi_tenant_tables.sql` — Seeds WCC org with slug = 'wcc'.
  This must match the production subdomain. See migration 024 for the production fix.

## Key DB Queries for Debugging Auth

```sql
-- Verify org exists
SELECT id, name, slug, is_active FROM organizations ORDER BY created_at;

-- Verify member row exists
SELECT id, email, app_role, is_active FROM members WHERE email = '<email>';

-- Verify org membership
SELECT om.app_role, om.is_active, o.slug
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN members m ON m.id = om.member_id
WHERE m.email = '<email>';

-- Verify Supabase Auth user exists and has password
SELECT id::text, email, encrypted_password, email_confirmed_at, invited_at
FROM auth.users WHERE email = '<email>';
```

---

### FAILURE CLASS 10 — redirect to `reason=not_admin` After Successful Login (Multi-Tenant)

**Symptom:** Login succeeds (no error), but the user is immediately redirected to
`/admin/login?reason=not_admin` on every subsequent page load. The user's data in
`members` and `organization_members` is correct (both `is_active: true`, `app_role: Admin`).

**Root cause (evolved — two generations of this bug):**

Generation 1 (original): The cookie-fallback path made an internal bare `fetch()` to
`/api/admin/member`. That fetch carried no cookies, so `resolveTenantId()` returned null,
the tenant guard fired a 404, and middleware redirected to `reason=not_admin`.

Generation 2 (current fix): The cookie-fallback path now makes direct Supabase REST API
calls (`rest/v1/members` + `rest/v1/organization_members`) using the service role key.
This bypasses the re-entrant middleware problem entirely. BUT: the compiled Edge Runtime
chunk (`.next/dev/server/edge/chunks/`) can cache a stale version of the middleware
even when the source file is updated. If `dev_auth=1` bypass works but real auth still
fails, the chunk is stale — delete `.next/` and restart the dev server.

**Why `getUser()` always fails in this codebase:**
`@supabase/ssr` 0.8.0 looks for cookies named `supabase.auth.token` (or chunked variants).
Our cookies are `sb-access-token`, `sb-refresh-token`, `sb:token`. No match → always
enters the cookie-fallback path.

**Current middleware flow (cookie-fallback path):**
1. Extract email from `sb:token` JSON cookie or `sb-access-token` JWT payload
2. `GET rest/v1/members?email=eq.<email>&select=id,app_role,is_active&limit=1` (service role key)
3. If multi-tenant + tenantId: `GET rest/v1/organization_members?member_id=eq.<id>&organization_id=eq.<tenantId>&select=app_role,is_active&limit=1`
4. Check role in ALLOWED_ROLES

**Fix:** The direct REST approach is already in `src/middleware.ts` lines 356–434.
If behavior is wrong in dev, force recompile: `rm -rf .next && npm run dev`.

**Test coverage:** `__tests__/integration/middleware-tenant.test.ts` — 5 tests.

**How to diagnose quickly:**
1. Does `dev_auth=1` bypass work? If yes → auth code issue. If no → tenant resolution.
2. Check `src/middleware.ts` lines 356–434 for the REST fetch URLs.
3. Check DB: `SELECT email, app_role, is_active FROM members WHERE email = '...'`
4. Check org: `SELECT om.app_role, om.is_active FROM organization_members om JOIN members m ON m.id = om.member_id WHERE m.email = '...'`
5. Run `npx vitest run __tests__/integration/middleware-tenant.test.ts`

---

---

### FAILURE CLASS 12 — Portal/Admin Layout Shows Hardcoded WCC Label for Other Tenants

**Symptom:** `cfc.gracetoyou.com.au/portal/roster` shows "WORDCC Worship Team" instead of "CFC Worship Ministry".

**Root cause:** `src/app/portal/layout.tsx` is a `"use client"` component with a hardcoded string
literal on line 23: `<h1>WORDCC Worship Team</h1>`. Because it is a client component it cannot call
`headers()` from `next/headers`. The middleware injects `x-tenant-name` as a request header, but
request headers are only accessible in Server Components and Route Handlers — not in client components.

**Why the admin login page works correctly but the portal layout does not:**
- `src/app/admin/login/page.tsx` is a Server Component. It calls `headers()` and reads
  `x-tenant-name` directly from the injected header.
- `src/app/portal/layout.tsx` is marked `"use client"`. No access to request headers. No API
  call to `/api/me` or any tenant-aware endpoint.

**Important caveat — cookie fallback path loses tenant name:**
When `resolveTenantId()` falls back to the `sb-tenant-id` cookie (no subdomain slug or slug
lookup failure), it returns `{ id: tenantCookie, name: "" }`. Middleware line 202 only sets
`x-tenant-name` if `tenantName` is truthy — an empty string is falsy, so the header is not
injected. Server components would also get an empty name in that path. The `/api/me` response
(`tenant_name` field, line 134) is the more reliable source as it fetches org name from DB.

**Fix pattern:** Convert the portal layout header to read from `/api/me` (which returns
`tenant_name`) or split the layout into a server wrapper that passes the org name as a prop
to the client shell. Do not attempt to read `x-tenant-name` in a `"use client"` component.

**Same pattern risk:** Any `"use client"` layout or component that hardcodes a tenant-specific
label is vulnerable. Audit all `layout.tsx` files for hardcoded org/team names.

**Related file:** `src/app/portal/layout.tsx` line 23.

---

### FAILURE CLASS 13 — Browser Tab Shows Hardcoded "WORDCC | Worship Ministry" on All Tenants

**Symptom:** All tenants see "WORDCC | Worship Ministry" in the browser tab regardless of subdomain.

**Root cause:** `src/app/layout.tsx` lines 16–40 use `export const metadata: Metadata = { ... }`
with static string literals. `export const metadata` is resolved at build time — it has no access
to the HTTP request, tenant subdomain, or cookies. Every tenant receives the same `<title>`.

**There is no `generateMetadata` export anywhere in the codebase.** Neither `src/app/portal/layout.tsx`
nor `src/app/admin/layout.tsx` override the root metadata.

**Technical constraint:** `export const metadata` in a client component is a compile error —
Next.js App Router rejects it. `generateMetadata` can only be exported from Server Components.
`src/app/admin/layout.tsx` is `"use client"` so it cannot export metadata at all.

**Fix requires a design decision:** Converting the root layout to use `generateMetadata` forces
the entire app into dynamic rendering per-request, which affects caching and SSG. The architect
must decide the rendering strategy before this is implemented.

**Fix pattern when architect approves:**
```ts
// src/app/layout.tsx — replace export const metadata with:
import { headers } from "next/headers";
export async function generateMetadata(): Promise<Metadata> {
  const tenantName = (await headers()).get("x-tenant-name") ?? "Worship Ministry";
  return { title: `${tenantName} | Worship App`, ... };
}
```

**Escalation trigger:** Any time a tenant-specific browser title or OG tag is required.

---

## Test Commands

- Auth route tests: `npx vitest run __tests__/integration/auth-route.test.ts`
- Middleware tenant tests: `npx vitest run __tests__/integration/middleware-tenant.test.ts`
- Component tests: `npm run test:components`
