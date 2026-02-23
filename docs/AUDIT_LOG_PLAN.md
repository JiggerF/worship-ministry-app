# Audit Log — MVP Implementation Plan

## MVP Breakdown

| MVP | Status | Scope | Risk |
|-----|--------|-------|------|
| **MVP 1** | ✅ Done | Infrastructure + full songs audit (create/update/delete) + audit page + nav | Low — new table, songs mutations are lower-stakes than roster |
| **MVP 2** | ✅ Done | Roster audit (save draft, finalize, revert, save note) | Medium — instruments the most-used write path |
| **Retention** | ✅ Done | DB trigger: 2-year rolling window + 10,000 row hard cap | Zero risk — DB-only, no app code |
| **MVP 3** | ⬜ Pending | People audit (create/update/deactivate members) + filter UI | Low-risk additions on top of stable infrastructure |

MVP 1 is self-contained and testable end-to-end. Each MVP builds on the last without touching completed work.

### Retention Policy
- **2-year rolling window** — entries older than 2 years are deleted automatically
- **10,000 row hard cap** — oldest excess rows trimmed if limit exceeded (~40 years away at current volume)
- Cleanup fires probabilistically (5% of inserts) via Postgres trigger in `009_audit_log_retention.sql`
- Estimated volume: ~250 events/year → 2-year window holds ~500 rows

---

## Context

With the Coordinator role having edit access to Roster and Songs, Admin users need visibility into who changed what. This is MVP vertical slice 1 — a simple, readable activity log. No change-diffing, no filters — just log what happened, who did it, and when.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/008_audit_log.sql` | New `audit_log` table + index |
| `src/lib/server/get-actor.ts` | Extract actor identity from request cookies |
| `src/lib/db/audit-log.ts` | `createAuditLogEntry` + `getAuditLog` DB helpers |
| `src/app/api/audit-log/route.ts` | Paginated GET endpoint (Admin-only) |
| `src/app/admin/audit/page.tsx` | Admin-only audit log page |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/songs/route.ts` | Log after successful POST |
| `src/app/api/songs/[id]/route.ts` | Log after successful PATCH + DELETE |
| `src/app/api/roster/route.ts` | Log after successful POST + all PATCH variants |
| `src/app/admin/layout.tsx` | Add "Audit" to `SIDEBAR_ITEMS`, Admin-only |
| `src/middleware.ts` | Block Coordinator from `/admin/audit` |

---

## Step 1 — DB Migration

**File:** `supabase/migrations/008_audit_log.sql`

```sql
CREATE TABLE audit_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  actor_id    uuid        REFERENCES members(id) ON DELETE SET NULL,
  actor_name  text        NOT NULL,  -- denormalized; survives member deletion
  actor_role  text        NOT NULL,  -- Admin | Coordinator
  action      text        NOT NULL,  -- see Actions table below
  entity_type text        NOT NULL,  -- song | roster
  entity_id   text,                  -- song uuid OR YYYY-MM
  summary     text        NOT NULL   -- human-readable description
);

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
```

---

## Step 2 — Actor Extraction Helper

**File:** `src/lib/server/get-actor.ts`

Server-only helper. Reads the `sb-access-token` cookie from `NextRequest`, decodes the JWT payload for the email, then queries `members` via service role key.

Returns `{ id, name, role }` or `null` when unauthenticated or in dev-bypass mode.

```ts
export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

export async function getActorFromRequest(req: NextRequest): Promise<AuditActor | null>
```

Uses the same JWT decode pattern already in `src/middleware.ts:91-101`:
```ts
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
email = payload?.email ?? null;
```

---

## Step 3 — DB Helper

**File:** `src/lib/db/audit-log.ts`

```ts
export type AuditAction =
  | "create_song" | "update_song" | "delete_song"
  | "save_roster_draft" | "finalize_roster" | "revert_roster" | "save_roster_note";

export interface CreateAuditLogEntry {
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  entity_type: "song" | "roster";
  entity_id?: string;
  summary: string;
}

// Silently swallows errors — audit failure must NOT break primary operation
export async function createAuditLogEntry(entry: CreateAuditLogEntry): Promise<void>

// For the audit page
export async function getAuditLog(
  page: number,
  pageSize: number
): Promise<{ entries: AuditLogRow[]; total: number }>
```

Pagination: offset-based (`range(from, to)` on Supabase), ordered by `created_at DESC`, page size = 50.

---

## Step 4 — API Instrumentation

After each successful mutation, call `createAuditLogEntry` (fire-and-forget). Audit failure does **not** affect the primary response.

### Actions tracked

| Route | HTTP | Trigger condition | Action | entity_type | entity_id | Summary |
|-------|------|------------------|--------|------------|-----------|---------|
| `/api/songs` | POST | success | `create_song` | `song` | `song.id` | `Created song '{title}'` |
| `/api/songs/[id]` | PATCH | success | `update_song` | `song` | `id` | `Updated song '{title}'` |
| `/api/songs/[id]` | DELETE | success | `delete_song` | `song` | `id` | `Deleted song '{title}'` |
| `/api/roster` | POST | success | `save_roster_draft` | `roster` | `YYYY-MM` (from first assignment date) | `Saved roster draft for {YYYY-MM}` |
| `/api/roster` | PATCH (default) | success | `finalize_roster` | `roster` | `body.month` | `Finalized roster for {YYYY-MM}` |
| `/api/roster` | PATCH `action=revert` | success | `revert_roster` | `roster` | `body.month` | `Reverted roster to draft for {YYYY-MM}` |
| `/api/roster` | PATCH `notes` defined | success | `save_roster_note` | `roster` | `body.month` | `Updated roster note for {YYYY-MM}` |

> **`delete_song` note:** The song title must be captured before the DELETE executes (pre-fetch by id, or the client passes it in the request body). The row is gone by the time we log.

---

## Step 5 — Audit Log GET Endpoint

**File:** `src/app/api/audit-log/route.ts`

- Extracts actor via `getActorFromRequest`; returns `403` if actor is not `Admin`
- Accepts `?page=1` (1-indexed, defaults to `1`)
- Returns `{ entries, total, page, pageSize }`
- Delegates to `getAuditLog` from Step 3

---

## Step 6 — Audit Page UI

**File:** `src/app/admin/audit/page.tsx` (`"use client"`)

Fetches `/api/audit-log?page=N` on mount and on page change.

**Role guard:** `useCurrentMember()` → if `member !== null && member.app_role !== "Admin"` show access-denied. Middleware redirects first anyway.

### Table columns

| Column | Detail |
|--------|--------|
| **Timestamp** | Melbourne time via `Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', dateStyle: 'short', timeStyle: 'short' })` |
| **User** | `actor_name` + role chip (yellow = Admin, purple = Coordinator) |
| **Action** | Colored badge — green = create, amber = update, red = delete, blue = roster actions |
| **Details** | `summary` field (e.g. `"Updated song 'Amazing Grace'"`) |

**Pagination:** Prev / Next buttons + `"Page N of M"` indicator.

**Empty state:** `"No activity recorded yet."` centered in table body.

---

## Step 7 — Layout Nav

**File:** `src/app/admin/layout.tsx`

Add to `SIDEBAR_ITEMS`:
```ts
{ href: "/admin/audit", label: "Audit", icon: "📋" }
```

Update the Coordinator filter to exclude Audit (same pattern as Settings):
```ts
const filteredSidebar = member?.app_role === "Coordinator"
  ? SIDEBAR_ITEMS.filter(
      (item) => item.href !== "/admin/settings" && item.href !== "/admin/audit"
    )
  : SIDEBAR_ITEMS;
```

When `member` is `null` (loading), neither Settings nor Audit will show — consistent with the restrictive-default rule.

---

## Step 8 — Middleware

**File:** `src/middleware.ts`

Add inside the Coordinator block (after the existing `/admin/settings` check, line ~197):

```ts
// Block /admin/audit
if (path.startsWith("/admin/audit")) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/admin/roster";
  redirectUrl.searchParams.set("reason", "no_audit_access");
  return NextResponse.redirect(redirectUrl);
}
```

---

## Verification

1. `npm run dev` — confirm app starts clean
2. **As Admin:**
   - "Audit" appears in sidebar
   - Create a song → `/admin/audit` shows `create_song` entry
   - Edit the song → new `update_song` entry
   - Delete the song → `delete_song` entry with correct title
   - Save a roster draft → `save_roster_draft` entry
   - Finalize a month → `finalize_roster` entry
   - Revert to draft → `revert_roster` entry
   - Save a roster note → `save_roster_note` entry
   - Timestamp displays in Melbourne time (AEDT/AEST)
3. **As Coordinator:**
   - "Audit" not in sidebar
   - Typing `/admin/audit` directly → redirected to `/admin/roster`
   - Editing a roster still creates an audit entry with `actor_role = Coordinator`
4. `npm run test` — all existing tests pass (no regressions)
