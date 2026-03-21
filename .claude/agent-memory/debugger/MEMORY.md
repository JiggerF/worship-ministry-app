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

## High-Risk Files

- `src/app/api/auth/login/route.ts` — Multi-tenant validation block (lines 93-157) runs
  AFTER Supabase Auth. Any 403 from here has a different message than Supabase's 401.
- `src/middleware.ts` — resolveTenantId() reads ?org= param in dev, subdomain in prod,
  sb-tenant-id cookie as fallback. Returns null if org slug not found in organizations table.
- `supabase/migrations/022_provision_tenant.sql` — provision_tenant() creates members row
  but NOT Supabase Auth user. Auth user must be created separately via invite or admin API.

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

## Test Commands

- Auth route tests: `npx vitest run __tests__/integration/auth-route.test.ts`
- Middleware tenant tests: `npx vitest run __tests__/integration/middleware-tenant.test.ts`
- Component tests: `npm run test:components`
