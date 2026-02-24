# Setlist MVP2 — Implementation Slice

**Session date:** 24 February 2026  
**Status:** ✅ Complete — 520/520 tests passing  
**Scope:** SundayCard musician portal refinements, portal roster sort fix, admin setlist page UX polish, THIS WEEK badge bug fix, ⭐ My Worship Lead indicator, and full regression-grade test coverage.

---

## Context

MVP1 built the admin setlist CRUD page. MVP2 focuses on:
- Making the **musician-facing portal** (`sunday-card.tsx`) display setlist data cleanly
- Polishing the **admin setlist page** UX (dropdowns, card header, badges)
- Fixing discovered bugs (sort order, THIS WEEK badge on all cards)
- Locking in test coverage for all MVP2 changes

The relevant MVP1 doc is at `docs/ai/setlist/SLICE_SETLIST_MVP1.md`.

---

## What Was Implemented

### 1. SundayCard — Musician Portal Expanded Row (`src/components/sunday-card.tsx`)

The expanded row inside each Sunday card on the musician portal was overhauled:

| Change | Detail |
|--------|--------|
| Removed key-selection feedback badge | After selecting a key in `ChordSheetModal`, the "→A ×" badge no longer showed next to the song. The modal is exploratory-only — no state is written back to the card. `selectedKeys` state and `onKeyChange` prop removed. |
| Removed "Explore other keys:" label | The prefix label before the button was removed. Button is now standalone. |
| Renamed button | "Explore other keys:" → **"Explore other Keys"** |
| Indented expanded items | `pl-5` → `pl-8` on the expanded detail panel for clearer visual hierarchy under the song title |
| Renamed download footer button | Now reads **"Download All Chord Charts [PDF]"** with `aria-label="Download all chord charts PDF"` |
| YouTube link styling | `inline-flex items-center gap-1 text-xs font-semibold text-red-600` |

The `SundayCard` component itself does not read from the setlist API — it receives setlist rows as props from the parent portal roster page.

---

### 2. Portal Roster Sort Fix (`src/app/portal/roster/page.tsx`)

**Bug:** Cards sorted descending (newest Sunday last → top of list), should be ascending with the upcoming Sunday pinned to position 1.

**Root cause:** `b.date.localeCompare(a.date)` (descending) instead of `a.date.localeCompare(b.date)` (ascending).

**Fix:** Extracted a pure exported function `sortRosterCards()` and corrected the comparison direction.

```ts
// src/app/portal/roster/page.tsx
export function sortRosterCards(
  rosters: { date: string }[],
  upcomingISO: string
): { date: string }[] {
  return [...rosters].sort((a, b) => {
    if (a.date === upcomingISO) return -1;   // upcoming always first
    if (b.date === upcomingISO) return 1;
    return a.date.localeCompare(b.date);     // rest ascending: oldest → newest
  });
}
```

The `sortedRoster` `useMemo` now delegates to this function. The function is exported so it can be unit-tested independently.

11 unit tests added at `__tests__/unit/sort-roster-cards.test.ts` covering:
- Upcoming date pinned regardless of input position
- Remaining dates always ascending after the pin
- Single-item arrays
- All 5 Sundays in a month with shuffled input
- `upcomingISO` not present → pure ascending fallback
- Input array is not mutated

---

### 3. Admin Setlist Page — UX Polish (`src/app/admin/setlist/page.tsx`)

#### 3a. Dropdown label removed
The `<label>` element "Sunday" above the `<select>` was removed. The date options are self-describing. The `<select>` received `aria-label="Service date"` for accessibility.

```tsx
// Before
<label className="...">Sunday</label>
<select value={selectedDate} ...>

// After
<select aria-label="Service date" value={selectedDate} ...>
```

#### 3b. Card header merged
Two separate lines in the card header:
```
Sunday          ← static <p>
01 Mar 2026     ← formatted date <p>
```
Merged into a single self-contained heading:
```
Sunday, 1 March 2026
```
Using `{ weekday: "long", day: "numeric", month: "long", year: "numeric" }` — weekday is now included since it doesn't repeat from the dropdown.

#### 3c. Select text darkened
`src/app/styles.module.css` — `.selectDarkText` had `opacity: 0.5` making selected dropdown text faint. `opacity` removed; text now renders at full `#111` colour.

#### 3d. ⭐ My Worship Lead indicator added
When the current user is rostered as the Worship Lead on a given Sunday:
- The dropdown `<option>` is prefixed with `⭐` (e.g. `⭐ 1 March 2026`)
- A pill appears below the dropdown: **"⭐ You are the Worship Lead for that Sunday"**
- Pill disappears when the user switches to a date where they are not the WL
- Works for any `app_role` — the feature is roster-based, not role-based
- The `myWLDates` Set is computed from the roster API response cross-referenced with `/api/me` member id

---

### 4. THIS WEEK Badge Bug Fix (`src/app/admin/setlist/page.tsx`)

**Bug:** The "THIS WEEK" badge was hardcoded unconditionally in the card header — it appeared on every selected date, not just the current week.

**Root cause:** The badge `<span>` had no conditional wrapper in the card header JSX.

**Fix:**
```tsx
// Before — always rendered
<span className="...">THIS WEEK</span>

// After — only when the selected date is the first upcoming Sunday
{selectedDate === upcomingSundays[0] && (
  <span className="...">THIS WEEK</span>
)}
```

---

### 5. Pill text rename

The "You are the Worship Lead" pill text was updated for grammatical accuracy when the selected date is not necessarily "this" week:

> "You are the Worship Lead for **this** Sunday" → "You are the Worship Lead for **that** Sunday"

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/components/sunday-card.tsx` | Modified | Key badge removed, button renamed, `pl-8` indent, download button text, YouTube styling |
| `src/app/portal/roster/page.tsx` | Modified | `sortRosterCards()` extracted + ascending sort fix |
| `src/app/admin/setlist/page.tsx` | Modified | Dropdown label removed, card header merged, ⭐ WL indicator, THIS WEEK badge conditional, pill text renamed |
| `src/app/styles.module.css` | Modified | `.selectDarkText` — `opacity: 0.5` removed |
| `__tests__/components/sunday-card.test.tsx` | Modified | 19 → 35 tests (+16) |
| `__tests__/components/setlist-page.test.tsx` | Modified | 40 → 56 tests (+16, including 3 assertion fixes) |
| `__tests__/unit/sort-roster-cards.test.ts` | Created | 11 new unit tests |

---

## Bugs Fixed

| Bug | Symptom | Fix |
|-----|---------|-----|
| Sort order wrong | Portal roster cards showed newest Sunday at top | `b.date.localeCompare(a.date)` → `a.date.localeCompare(b.date)` |
| THIS WEEK on all cards | Every selected card showed "THIS WEEK" badge in admin setlist | Wrapped badge in `selectedDate === upcomingSundays[0]` guard |
| Dropdown text faint | Selected option looked greyed-out | Removed `opacity: 0.5` from `.selectDarkText` CSS |
| Redundant "Sunday" label | Word "Sunday" appeared as both a dropdown label and a static card heading | Removed dropdown label; merged card header into single weekday+date string |
| Test assertions stale after rename | 3 setlist tests failing after "this Sunday" → "that Sunday" rename | Updated all 6 regex assertions to `/for that sunday/i` |

---

## How to Run

```bash
# Dev server
npm run dev

# Dev server with real Supabase auth (test WL restrictions)
npm run dev:real-auth

# Run ALL tests
npm run test

# Run setlist component tests only
npx vitest run __tests__/components/setlist-page.test.tsx

# Run SundayCard tests only
npx vitest run __tests__/components/sunday-card.test.tsx

# Run sort function unit tests only
npx vitest run __tests__/unit/sort-roster-cards.test.ts

# Run all component tests (fastest regression check)
npm run test:components

# Type check
npx tsc --noEmit
```

Navigate to `/admin/setlist` for the admin setlist page.  
Navigate to `/portal/roster` to see the SundayCard musician view.

---

## Test Coverage

**Total:** 520 tests passing across 27 test files (as of end of session).

### `__tests__/components/setlist-page.test.tsx` — 56 tests

| Suite | Tests | Covers |
|-------|-------|--------|
| Initial render | 3 | Heading, dropdown default value, 8 options |
| Admin, empty setlist | 4 | Empty slots, Add button, Finalise disabled, no Clear all |
| Admin, filled setlist (3 songs) | 14 | Song titles, artists, key badges, no position badges, drag handles, Clear all, Finalise, Change Key, remove buttons, slot counter |
| Published setlist | 5 | Revert to Draft, LOCKED/DRAFT badges, Clear all disabled/enabled state |
| Worship Lead permission guard | 9 | Assigned WL sees controls; non-assigned WL sees amber notice + all controls hidden |
| Coordinator (always canEdit) | 2 | Sees Finalise, no amber notice |
| WL display in card header | 2 | Name shown when assigned, absent when not |
| My Worship Lead indicator | 8 | ⭐ option prefix, pill show/hide, switches between dates, role-agnostic check |
| Card header date & THIS WEEK badge | 5 | Weekday+date format, `aria-label`, THIS WEEK show/hide/re-show on nav |
| Song Picker Modal | 6 | Opens, Cancel closes, search input, category filter, status chips, confirm disabled until pick |

### `__tests__/components/sunday-card.test.tsx` — 35 tests

| Suite | Tests | Covers |
|-------|-------|--------|
| Card render | ~10 | Title, date, role assignments, isNext badge, metadata |
| Collapsed row metadata | 5 | Key pill, artist, aria-expanded toggling |
| Scripture in expanded row | 3 | Shows on expand, hidden when collapsed, correct song |
| Download button text | 2 | Visible text + accessible label |
| Empty setlist state | 2 | "No songs assigned yet" present/absent |
| Notes | 2 | Renders when present, absent when null |
| Accordion — one open at a time | 2 | Opening B collapses A, stale content cleared |
| Explore other Keys button | ~9 | Left-aligned, no label prefix, opens ChordSheetModal |

### `__tests__/unit/sort-roster-cards.test.ts` — 11 tests

| Coverage |
|----------|
| Upcoming date pinned first from any input position (first/middle/last) |
| Remaining dates ascending after pin |
| Single-item list |
| All 5 Sundays in a month, shuffled input |
| `upcomingISO` absent → pure ascending fallback |
| Input array not mutated (immutability) |

---

## Known Issues / Limitations

### Carried from MVP1

1. **Setlist capped at 3 songs** — `freeSlots = 3 - setlistRows.length` is hardcoded. Parameterise `MAX_SONGS` if this changes.
2. **Key-change on published setlist silently reverts to DRAFT** — no confirmation dialog. A future UX improvement would warn the user before editing a finalised setlist.
3. **No WL notification on publish** — musicians and the assigned WL are not notified when a setlist moves DRAFT → PUBLISHED. Planned in `docs/MAGIC_LINK_NOTIFICATIONS.md`.
4. **No setlist audit logging** — `POST /api/setlist`, `PATCH .../publish`, `PATCH .../revert` are not instrumented with `createAuditLogEntry`. Audit actions `publish_setlist`, `revert_setlist`, `update_setlist_song` are not yet defined in the `AuditAction` enum.
5. **Roster fetch fetches full month** — `GET /api/roster?month=YYYY-MM` pulls all assignments for the month just to extract the WL for one date.

### New in MVP2

6. **"Download All Chord Charts [PDF]" button is a stub** — the button renders correctly and has an `aria-label`, but has no `onClick` handler. PDF generation or bulk chord-sheet-link opening is not implemented.
7. **`sortRosterCards` only covers portal roster page** — the admin setlist page does not sort cards (it uses `selectedDate` from a dropdown). No cross-impact.
8. **`myWLDates` computed only from the first roster fetch** — if the user navigates to a different month and the roster response changes, `myWLDates` is not recomputed. Because the dropdown is limited to the next 8 Sundays (max ~2 months), this is low risk currently.

---

## What's Next — MVP3 Candidates

### High priority
- [ ] **Implement "Download All Chord Charts [PDF]"** — open all chord sheet URLs in sequence or generate a combined PDF. The `aria-label` and button are already in place.
- [ ] **Setlist audit logging** — define `publish_setlist`, `revert_setlist`, `update_setlist_key` in `AuditAction`; wire `createAuditLogEntry` into the three setlist API routes.
- [ ] **Key-change confirmation on published setlist** — show an inline warning: "Editing a finalised setlist will revert it to Draft. Continue?"

### Medium priority
- [ ] **Notify assigned WL + musicians on publish** — trigger magic-link notification when `PATCH .../publish` succeeds. See `docs/MAGIC_LINK_NOTIFICATIONS.md`.
- [ ] **Per-Sunday notes / transitions** — an optional free-text notes field on each setlist row (stored in `setlist_songs.notes`). Already present in DB schema snapshot (`schema_snapshot.sql`), just not surfaced in the UI.
- [ ] **Optimise roster fetch** — replace the full-month `GET /api/roster?month=` call with a lightweight `GET /api/roster/wl?date=YYYY-MM-DD` endpoint that returns only the worship lead for a single date.

### Lower priority
- [ ] **Print/PDF view** — route `/portal/print/[date]` or `/admin/setlist/[date]/print` that renders the setlist cleanly for projection or printing.
- [ ] **Parameterise MAX_SONGS** — move the hardcoded `3` into a constant so it can be changed without hunting usages.
- [ ] **Setlist history** — allow admins to view past setlists (dates before today are currently not shown in the dropdown).

---

## Architecture Notes for MVP3 Agent

- **All setlist data flows through `/api/setlist`** — the page is single-file (`src/app/admin/setlist/page.tsx`, ~1100 lines). No separate context or store.
- **`canEdit` is always derived from `/api/me` + roster data** — never trust client-sent role headers.
- **`myWLDates`** is a `Set<string>` of ISO dates where `currentMember.id === assignment.member.id && assignment.role.name === "worship_lead"`. It drives both the ⭐ dropdown option prefix and the "You are the Worship Lead" pill.
- **Test helpers** (`makeFetch`, `makeSong`, `makeRow`, `rosterWith`, `computeFirstUpcomingSunday`) are all in `__tests__/components/setlist-page.test.tsx` — reuse them when adding new tests rather than duplicating fixture code.
- **`styles.module.css` `.selectDarkText`** is used on both the main date `<select>` and the inline key-change `<select>` inside each song row. Any styling changes to selects should update this class.
