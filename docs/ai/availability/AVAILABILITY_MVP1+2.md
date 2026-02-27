# Availability — MVP 1 + MVP 2 Implementation Record

> **Written:** 27 Feb 2026  
> **Status:** Both MVPs complete and fully tested (658 tests passing)  
> **Next up:** MVP 3 — Roster page deep integration (see bottom of this file)

---

## What Was Built

### MVP 1 — Musician-facing availability form (magic link)

Musicians receive a magic link that opens `/availability?token=<token>&period=<periodId>`.

**Pages & routes:**
| File | Role |
|------|------|
| `src/app/availability/page.tsx` | Public musician form — date checkboxes, primary role dropdown, optional notes, submit |
| `src/app/availability/useCurrentMember.ts` | Shared hook: fetches `/api/me` to check `app_role` for access gate |
| `src/app/api/availability/[token]/route.ts` | GET = hydrate form; POST = upsert response |

**What the musician sees:**
- Period label at top (e.g. "April–May 2026")
- Checkboxes for each Sunday in the period's `starts_on`–`ends_on` range
- Primary role dropdown (shows only member's assigned roles, member-scoped from API)
- Free-text notes field
- Submit / re-submit (idempotent — existing response is updated in-place)

**Lockout conditions (form becomes read-only / shows "closed" message):**
- `period.closed_at IS NOT NULL`  
- `Today (Melbourne TZ) > period.deadline`

**Role-based access gate (added in this session):**
- `WorshipLeader` and `MusicCoordinator` app roles see a "Availability tracking is managed by your Coordinator" message — they do not fill out availability forms themselves.
- Implemented via `useCurrentMember()` fetching `/api/me` (RLS-safe service role key).

---

### MVP 2 — Admin availability management (`/admin/availability`)

#### Sub-view A: Periods list

**File:** `src/app/admin/availability/page.tsx`

- Lists all periods, most-recent first, with response count + progress bar + deadline status chip.
- **Round Status card** at top: two panels
  - **Last round** — most recently ended *closed* period whose `ends_on` precedes the current open round's `starts_on`. Explicitly sorted by `ends_on`, not `closed_at`, so a same-cycle duplicate that was manually closed does not appear here.
  - **Current round** — the earliest open period (soonest `starts_on`). Shows live response count. If no open period, shows a "Suggested" next period computed from `suggestNextPeriod()` (first Sunday of month after last closed period ends, through last Sunday of the following month).
- **+ New Period** button opens a creation modal.
- **Edit button** per card — opens same modal pre-filled:
  - Label and deadline always editable.
  - Date fields **locked** (disabled + amber notice) once `response_count > 0` — prevents rescheduling after anyone has submitted via magic link.
  - Server-side guard in `PUT /api/availability/periods/[id]` independently rechecks response count.
- **Delete button** — only shown when `response_count === 0`. Uses `window.confirm` (destructive action). Calls `DELETE /api/availability/periods/[id]`; API re-checks count before deleting.
- **Role gate:** `WorshipLeader` and `MusicCoordinator` see a 🔒 "Access restricted" card instead of the page.

#### Sub-view B: Period detail

**File:** `src/app/admin/availability/[id]/page.tsx`

- Header: period label, date range, deadline, response progress, open/closed badge.
- **Close Period** button (PATCH action) — marks `closed_at = now()`.
- **Responded** section: grid — one row per responded musician, one column per Sunday in the period. Cells show ✓ (available), ✗ (unavailable), or — (Sunday not in response set). Last submitted timestamp shown.
- **Not yet responded** section: lists non-responders with a "Copy magic link" button per row. Link format: `origin/availability?token=<magic_token>&period=<periodId>`. Clicking copies to clipboard; shows "Copied!" flash for 2 s.

---

## Database Schema

### Tables (migrations 012–014)

#### `availability_periods` (migration 012)
```sql
id         uuid PK
created_at timestamptz
created_by uuid → members.id (SET NULL on delete)
label      text          -- e.g. "April–May 2026"
starts_on  date          -- first Sunday in scope
ends_on    date          -- last Sunday in scope
deadline   date nullable -- expected response date (informational)
closed_at  timestamptz nullable  -- null = open
```

#### `availability_responses` (migration 012 + 013)
```sql
id               uuid PK
submitted_at     timestamptz
updated_at       timestamptz
period_id        uuid → availability_periods.id  ON DELETE CASCADE
member_id        uuid → members.id               ON DELETE CASCADE
notes            text nullable
preferred_role_id integer → roles.id             ON DELETE SET NULL  -- added in 013
UNIQUE (period_id, member_id)
```

#### `availability_dates` (migration 012)
```sql
id          uuid PK
response_id uuid → availability_responses.id  ON DELETE CASCADE
date        date
available   boolean
UNIQUE (response_id, date)
```

#### Constraint: `no_overlapping_open_periods` (migration 014)
```sql
EXCLUDE USING gist (daterange(starts_on, ends_on, '[]') WITH &&)
WHERE (closed_at IS NULL);
```
Requires `btree_gist` extension. Prevents two *open* periods from having overlapping date ranges. Closed periods are exempt — historical overlap is fine.

---

## API Surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/availability/periods` | Admin, Coordinator | List all periods with response + musician counts |
| POST | `/api/availability/periods` | Admin, Coordinator | Create period; returns 409 if overlapping open period exists |
| GET | `/api/availability/periods/[id]` | Admin, Coordinator | Period detail + all members + their per-Sunday responses |
| PATCH | `/api/availability/periods/[id]` | Admin, Coordinator | Close period (`{ action: "close" }`) |
| PUT | `/api/availability/periods/[id]` | Admin, Coordinator | Update label/deadline; dates blocked if responses exist (409) |
| DELETE | `/api/availability/periods/[id]` | Admin, Coordinator | Delete period; blocked if responses exist (409) |
| GET | `/api/availability/[token]` | Magic token (public) | Hydrate musician form — member, sundays, prior responses, roles |
| POST | `/api/availability/[token]` | Magic token (public) | Upsert musician response (idempotent) |

---

## DB Helpers (`src/lib/db/availability-periods.ts`)

| Function | Purpose |
|----------|---------|
| `createPeriod(payload)` | Insert new period |
| `getPeriod(id)` | Fetch single period |
| `listPeriods()` | All periods, newest first |
| `listPeriodsWithCounts()` | All periods + `response_count` + `total_musicians` |
| `closePeriod(id)` | Set `closed_at = now()` |
| `updatePeriod(id, payload)` | Update label/dates/deadline; caller controls whether to include dates |
| `countResponsesForPeriod(id)` | Returns integer response count — used to gate date edits and deletes |
| `deletePeriodIfEmpty(id)` | Returns `"deleted"` or `"has_responses"` |

---

## Duplicate / Overlap Prevention (3 layers)

The problem: creating two overlapping open periods causes the Roster Manager's `availabilityMap` to merge conflicting responses and sends musicians duplicate magic links for the same Sundays.

**Layer 1 — Client (creation modal):**  
Live amber warning banner appears as soon as both date fields are filled and overlap is detected against existing open periods. `handleSubmit` fast-fails with `setSaveError` before calling the API.

**Layer 2 — API (`POST /api/availability/periods`):**  
Calls `listPeriodsWithCounts()`, filters open periods, checks `rangesOverlap(a0, a1, b0, b1) = a0 <= b1 && a1 >= b0`. Returns 409 with descriptive message if conflict found.

**Layer 3 — Database (migration 014):**  
`EXCLUDE USING gist` constraint. The DB will also reject such an insert even if layers 1 and 2 are bypassed.

---

## Roster Manager Integration (MVP 3 preview)

**File:** `src/app/admin/roster/page.tsx`

Availability data is already loaded and displayed in the Roster Manager:

**`loadAvailability()`** — called on `activeMonth` change:
1. Fetches all periods (`GET /api/availability/periods`)
2. Finds periods whose date range overlaps the active month
3. For each matching period, fetches `/api/availability/periods/[id]` (full detail)
4. Builds `availabilityMap: Record<date, Record<memberId, boolean>>` — merged across all matching periods

**`availabilityMap` is used in the assignment dropdowns to:**
- Group the select options into optgroups: `✓ Available`, `— No response`, `✗ Unavailable`
- Show an amber `⚠ Unavailable` warning badge + amber border on the dropdown when the currently assigned member is marked unavailable for that Sunday
- Show a red `⚠ Double-booked` badge + red border when a member is assigned to more than one non-exempt role on the same Sunday (exempt: `["setup", "sound"]`)

**Auto-month navigation on mount:**  
On initial render, the Roster Manager fetches open periods and jumps `activeMonth` to the earliest open period's start month. This ensures the coordinator lands directly on the current active round (e.g. April 2026) rather than today's month (Feb 2026).

---

## Bugs Fixed During This Session

### 1. Round Status "Last round" showing same-cycle duplicates
**Root cause:** `lastClosed` was sorted by `closed_at` (when coordinator clicked Close), so a duplicate period that was created and immediately closed appeared as "Last round".  
**Fix:** Sort closed periods by `ends_on` (the actual cycle end date) and, when an open period exists, only consider closed periods whose `ends_on < nextOpen.starts_on`. A same-cycle duplicate always has the same `ends_on` and is filtered out.

### 2. "Last round" / "Next round" label confusion
**Fix:** Renamed the right panel from "Next round" to **"Current round"** to clearly signal it is the actively collecting period, not a future one.

### 3. `useRouter` not mocked in availability component tests
**Root cause:** Switching from `<Link>` to `div + router.push` (required to support action buttons inside clickable cards) introduced a `useRouter` call without a corresponding `vi.mock("next/navigation", ...)` in the test file.  
**Fix:** Added `vi.mock("next/navigation", () => ({ useRouter: vi.fn(...), usePathname: vi.fn(...) }))` to `__tests__/components/availability-page.test.tsx`.

### 4. "Submits and closes modal" component test failing after client-side overlap guard
**Root cause:** The test's initial GET mock returned `PERIOD_OPEN` (same dates as `VALID_BODY`), which triggered the client-side overlap guard and blocked form submission.  
**Fix:** Changed initial GET in that test case to return `[]`, so no existing periods conflict with the form.

### 5. Availability form: duplicate `member` variable name clash
**Root cause:** `useCurrentMember()` hook originally returned `{ member }`, which clashed with `const [member, setMember]` state already inside `AvailabilityPage`.  
**Fix:** Destructured as `const { member: currentUser, loading: memberLoading }` in the public availability page.

---

## Known Limitations / Not Yet Built (MVP 3+)

| Gap | Notes |
|-----|-------|
| Coordinator cannot edit a musician's response on their behalf | Period detail is read-only. If a musician calls/texts instead of using the link, coordinator cannot proxy-submit. |
| Magic link URL includes `period=<id>` — links are period-specific | Sending the same member a new period requires copying a new link; old links continue to work until the period is closed or deadline passes. |
| `total_musicians` counts all active non-Admin members | Includes `WorshipLeader` and `MusicCoordinator` who are now blocked from submitting. The denominator in `X / Y responded` is therefore slightly inflated. Needs a fix to exclude `BLOCKED_ROLES` from the count. |
| No "Send reminder" action | Period detail shows non-responders with a "Copy magic link" button. There is no in-app send/notification — coordinator pastes the link into Viber manually. MVP 4 will add a workflow helper. |
| No per-role availability | Availability is general (available/unavailable per Sunday), not per role. Roster Manager uses a single boolean per `(memberId, date)`. |
| Audit log not wired to availability actions | `createPeriod`, `closePeriod`, `updatePeriod`, `deletePeriodIfEmpty` do not emit audit log entries yet. |

---

## Test Coverage

| Suite | File | Tests |
|-------|------|-------|
| Component — availability list + modal | `__tests__/components/availability-page.test.tsx` | 18 |
| Integration — periods CRUD + overlap | `__tests__/integration/availability-periods-route.test.ts` | 20 |

All 658 tests in the suite pass as of this session.

---

## MVP 3 Scope (next agent pickup)

Per `docs/ai/availability/AVAILABILITY_FORM_PLAN.md` — Phase 4:

> **Roster page enhancement** — availability indicators inline on assignment dropdowns

Most of the infrastructure is already in place (see Roster Manager Integration section above). What remains for MVP 3:

1. **Fix `total_musicians` denominator** — exclude `WorshipLeader` and `MusicCoordinator` from the count in `listPeriodsWithCounts()` to match the actual population that submits.
2. **Coordinator proxy-submit** — allow coordinator to fill in a musician's response from the period detail page (on behalf of someone who called/texted).
3. **Burnout indicator** — flag members rostered 3+ Sundays in the same month on the roster grid.
4. **Conflict alerts** — unfilled role cells shown with a warning colour/icon on the roster grid.
5. **Deeper cross-period awareness** — if a member responded to multiple periods that together cover a month, `availabilityMap` already merges them; formal testing of this path is needed.
