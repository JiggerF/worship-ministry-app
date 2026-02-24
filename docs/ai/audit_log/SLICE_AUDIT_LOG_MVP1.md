# Audit Log MVP 1+2 — Implementation Slice

**Branch:** `fix-audit-log`
**Status:** Implemented but broken — audit events not being captured in production
**Scope:** Infrastructure + songs audit (create/update/delete) + roster audit (draft/finalize/revert/note) + audit page + nav + retention policy

---

## What Was Built

An admin-only audit log that records who changed what and when, covering all song and roster mutations. Includes:
- DB table with retention policy (2-year rolling window + 10K row hard cap)
- Actor extraction from JWT cookies
- Fire-and-forget logging in all song and roster API routes
- Paginated admin page with sort toggle, action color-coding, Melbourne timezone
- Coordinator blocked from viewing audit (layout hiding + API 403)

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| `supabase/migrations/008_audit_log.sql` | `audit_log` table + `created_at DESC` index |
| `supabase/migrations/009_audit_log_retention.sql` | Probabilistic cleanup trigger (5% of inserts) — 2-year window + 10K cap |
| `src/lib/server/get-actor.ts` | `getActorFromRequest()` — extracts actor from `sb-access-token` JWT, queries members via service role key |
| `src/lib/db/audit-log.ts` | `createAuditLogEntry()` (silent on error) + `getAuditLog()` (paginated read) |
| `src/app/api/audit-log/route.ts` | `GET` — Admin-only, paginated, supports `?page=N&sort=asc\|desc` |
| `src/app/admin/audit/page.tsx` | Client page — table with pagination, sort toggle, action badges, empty/error states |
| `__tests__/components/audit-page.test.tsx` | 20 component tests — rendering, pagination, sort, empty/error states |
| `__tests__/integration/audit-log-route.test.ts` | 12 route tests — access control (Admin/Coordinator/Musician/null), query params, errors |
| `__tests__/unit/audit-log.test.ts` | 13 unit tests — insert, silent error swallowing, pagination math, sort direction |

### Modified
| File | Change |
|------|--------|
| `src/app/api/songs/route.ts` | Added audit log after successful POST (create_song) |
| `src/app/api/songs/[id]/route.ts` | Added audit log after successful PATCH (update_song) + DELETE (delete_song) |
| `src/app/api/roster/route.ts` | Added audit log after POST (save_roster_draft) + all PATCH variants (finalize/revert/note) |
| `src/app/admin/layout.tsx` | Added "Audit Log" to `SIDEBAR_ITEMS` + `COORDINATOR_HIDDEN` array |
| `src/lib/types/database.ts` | Added `AuditAction` type + `AuditLogRow` interface |

### NOT Modified (gap from plan)
| File | Planned Change | Actual |
|------|---------------|--------|
| `src/middleware.ts` | Block Coordinator from `/admin/audit` via redirect | **Not done** — no `/admin/audit` check exists. Security relies on API-level 403 + layout hiding only |

---

## How to Run / Test

```bash
# All audit tests
npm run test -- __tests__/unit/audit-log.test.ts __tests__/integration/audit-log-route.test.ts __tests__/components/audit-page.test.tsx

# Full suite (should all pass)
npm run test
```

**Manual verification (from plan):**
1. As Admin: create/edit/delete a song, save/finalize/revert roster, save roster note — each should appear in `/admin/audit`
2. As Coordinator: "Audit Log" should not appear in sidebar; navigating directly to `/admin/audit` should show data fetch blocked by 403
3. Timestamps should display in Melbourne time (AEDT/AEST)

---

## Known Issues

### BUG: Audit log not capturing events in production
- **Severity:** High — the feature appears to work locally but events are not being written in prod
- **Symptom:** `/admin/audit` page shows "No activity recorded yet." despite active song/roster mutations
- **Worked before:** Yes — was functional, broke silently after refactors
- **Root cause:** Unknown — needs investigation. Possible causes:
  1. **`getActorFromRequest` returning null in prod** — if `sb-access-token` cookie is missing/malformed or the JWT decode fails, `actor` is null and the entire audit block is skipped silently (see `if (actor) {` guard in every route)
  2. **`createAuditLogEntry` silently swallowing errors** — by design it catches all errors (line 33-35 of `audit-log.ts`). If the insert fails (wrong table schema, missing column, RLS blocking), it fails silently
  3. **Service role key mismatch** — `get-actor.ts` creates its own Supabase client with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. If either env var is missing in prod, `getActorFromRequest` returns null at line 31
  4. **Cookie format changed** — if auth cookie handling was refactored and `sb-access-token` is no longer set or is in a different format
  5. **Fire-and-forget timing** — the `.then()` pattern means audit runs after the response is sent. If the serverless function terminates before the promise resolves, the write never completes

### GAP: Middleware does not block `/admin/audit` for Coordinators
- **Risk:** Low — API returns 403 and UI hides the nav item, but a Coordinator can navigate directly to `/admin/audit` and see a "Access denied" error page instead of being redirected to `/admin/roster`
- **Fix:** Add `/admin/audit` check alongside the existing `/admin/settings` check in middleware.ts (lines 197-202)

### GAP: No test coverage for the actual instrumentation
- **What's tested:** The audit page (UI), the GET route (access control), and the DB helpers (insert/read) are all well tested in isolation
- **What's NOT tested:** None of the tests verify that `createAuditLogEntry` is actually called when a song/roster mutation succeeds. The fire-and-forget calls in `songs/route.ts`, `songs/[id]/route.ts`, and `roster/route.ts` are completely untested. This is exactly why the prod breakage went unnoticed.

### GAP: Silent failure by design
- `createAuditLogEntry` intentionally swallows all errors (correct for not breaking primary operations)
- `getActorFromRequest` returns null on any failure (correct for safety)
- Combined effect: if either function fails, no error is logged anywhere — the event just disappears. No observability into audit write failures.

---

## Next Steps

### Immediate: Fix the prod bug
1. Add temporary logging to `getActorFromRequest` and `createAuditLogEntry` to identify where the chain breaks
2. Check prod environment for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `sb-access-token` cookie presence
3. Verify the `audit_log` table exists in prod Supabase and the migration was applied

### Add instrumentation tests (prevent future regressions)
Write integration tests for each API route that verify `createAuditLogEntry` is called with correct args after a successful mutation:
- `POST /api/songs` calls audit with `action: "create_song"`
- `PATCH /api/songs/:id` calls audit with `action: "update_song"`
- `DELETE /api/songs/:id` calls audit with `action: "delete_song"`
- `POST /api/roster` calls audit with `action: "save_roster_draft"`
- `PATCH /api/roster` (finalize) calls audit with `action: "finalize_roster"`
- `PATCH /api/roster` (revert) calls audit with `action: "revert_roster"`
- `PATCH /api/roster` (notes) calls audit with `action: "save_roster_note"`

### Add middleware block for `/admin/audit`
Add to `src/middleware.ts` alongside the `/admin/settings` check.

### MVP 3: People audit (future)
- Instrument `POST /api/members` (create_member) and `PUT /api/members/:id` (update_member)
- Add `entity_type: "member"` to `CreateAuditLogEntry`
- Add filter UI to the audit page
