# Worship Leader Feature — Implementation Plan

## Overview

This document outlines the full feature plan for **worship-leading roles** in the app. The following `app_role` values can lead Sunday worship and select songs for their service:

| Role | Description |
|---|---|
| `Coordinator` | Worship Coordinator — manages the full roster AND leads worship on their Sundays |
| `MusicCoordinator` | Music Coordinator — leads worship; no full roster admin access |
| `WorshipLeader` | Worship Leader — leads worship; no admin access |

All three can:
- Pick up to 3 songs for their rostered Sunday from the shared song pool
- Set the performance key for each chosen song (defaults to original key if not set)
- Save songs as draft, then publish them

Musicians (and the public) then see published songs on the portal roster card and can download a combined chord sheet PDF in the chosen keys.

The Worship Coordinator / Music Coordinator / Worship Leader **cannot** modify the member roster table (who plays what instrument). That is the Coordinator's admin roster responsibility alone.

---

## Current State Audit

### What already exists (reuse, not rebuild)

| Area | Status | Location |
|---|---|---|
| `SundayCard` Songs section | Shell UI only — "No songs assigned yet" + non-functional download button | `src/components/sunday-card.tsx` |
| `SetlistSong`, `SetlistSongWithDetails` types | Partially defined in `database.ts` — missing `chosen_key`, `status`, `created_by` fields | `src/lib/types/database.ts` |
| Song pool browse page | Fully functional with search, filter, paginate, SongCard, ChordSheetModal | `src/app/portal/songs/page.tsx` |
| `ChordSheetModal` — key change + PDF download | Fully functional per-song | `src/components/chord-sheet-modal.tsx` |
| `parseChordSheet`, `semitonesBetween`, `ALL_KEYS` | Transpose utilities ready for reuse | `src/lib/utils/transpose.ts` |
| Admin auth (`/admin`) | Guards Admin + Coordinator; `WorshipLeader` and `MusicCoordinator` not yet wired | `src/middleware.ts` |
| Portal (musician view) | No auth; public. Roster/songs are read-only | `src/app/portal/` |
| `AppRole` type | `"Admin" | "Coordinator" | "Musician"` — `"WorshipLeader"` and `"MusicCoordinator"` missing from TS | `src/lib/types/database.ts` |
| DB enum `app_role` | Already contains `Coordinator`, `MusicCoordinator`, `WorshipLeader` (migration 006) | `supabase/migrations/006_add_coordinator_to_app_role.sql` |
| jsPDF infrastructure | Used in `chord-sheet-modal.tsx` for single-song PDF (browser-only) | `src/components/chord-sheet-modal.tsx` |

### What does NOT exist yet (must build)

- `"WorshipLeader"` and `"MusicCoordinator"` in the TypeScript `AppRole` type
- `sunday_setlist` DB table
- Setlist API routes (`GET`, `POST`, `DELETE`, `PATCH /publish`)
- Middleware allowance for `MusicCoordinator` and `WorshipLeader` into `/admin/*` with read-only restrictions (block Settings, Audit; allow Roster/People/Songs read; allow Setlist full)
- Song selection UI in "pick mode" on `/admin/songs?date=...&picking=1`
- Combined multi-song client-side PDF download page
- Published setlist displayed on portal roster cards

---

## Role Design

### Song-selecting roles

Three `app_role` values can select songs. All three are already in the DB enum (no SQL migration needed):

```typescript
// Updated AppRole in database.ts:
export type AppRole = "Admin" | "Coordinator" | "Musician" | "MusicCoordinator" | "WorshipLeader";
```

#### `Coordinator` (Worship Coordinator)
- Primary workspace: `/admin/` — full roster management, people, songs (read), setlist management
- Login redirect: `/admin/roster` (existing, unchanged)
- Song selection: via `/admin/songs?date=...&picking=1`

#### `MusicCoordinator`
- Primary workspace: `/admin/` (read-only for Roster/People/Songs) — Setlist is full management; Settings and Audit are blocked
- Login redirect: `/admin/roster`
- Song selection: via `/admin/songs?date=...&picking=1`
- Cannot modify the member roster grid (who plays what instrument) — Roster page is strictly read-only

#### `WorshipLeader`
- Primary workspace: `/admin/` (read-only for Roster/People/Songs) — Setlist is full management; Settings and Audit are blocked
- Login redirect: `/admin/roster`
- Song selection: via `/admin/songs?date=...&picking=1`
- Cannot modify the member roster grid (who plays what instrument) — Roster page is strictly read-only

### Permission matrix

> Legend: ✅ full access — ✅ ro read-only — ❌ blocked

| Route | Admin | Coordinator | MusicCoordinator | WorshipLeader | Musician |
|---|:---:|:---:|:---:|:---:|:---:|
| `/admin/roster` | ✅ | ✅ | ✅ ro | ✅ ro | ❌ |
| `/admin/people` | ✅ | ✅ ro | ✅ ro | ✅ ro | ❌ |
| `/admin/songs` | ✅ | ✅ ro | ✅ ro | ✅ ro | ❌ |
| `/admin/setlist` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/settings` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/audit` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/portal/*` | public | public | public | public | public |
| `POST /api/setlist` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PATCH /api/setlist/publish` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `DELETE /api/setlist/[id]` | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Database Schema

### New table: `sunday_setlist`

Migration: `supabase/migrations/011_sunday_setlist.sql`

```sql
CREATE TABLE IF NOT EXISTS public.sunday_setlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sunday_date   date NOT NULL,
  song_id       uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  chosen_key    text NULL,             -- NULL = fall back to chord_charts[0].key at display/PDF time
  status        text NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_by    uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (sunday_date, position)        -- 1 song per position per Sunday
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sunday_setlist_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_sunday_setlist_updated_at
BEFORE UPDATE ON public.sunday_setlist
FOR EACH ROW EXECUTE FUNCTION update_sunday_setlist_updated_at();
```

### `app_role` enum — no new SQL needed

`WorshipLeader` and `MusicCoordinator` already exist in the DB enum (migration 006). Migration 010 is TypeScript-only.

> **Migration numbering note:** Migrations 008 and 009 are already taken by the audit log feature (`008_audit_log.sql`, `009_audit_log_retention.sql`). The setlist migrations are **010** (TypeScript types / no-op SQL) and **011** (sunday_setlist table).

---

## TypeScript Types

Changes to `src/lib/types/database.ts`:

```typescript
// Updated AppRole — add MusicCoordinator and WorshipLeader:
export type AppRole = "Admin" | "Coordinator" | "Musician" | "MusicCoordinator" | "WorshipLeader";

// New type:
export type SetlistStatus = "DRAFT" | "PUBLISHED";

// Updated SetlistSong — was missing chosen_key, status, created_by:
export interface SetlistSong {
  id: string;
  sunday_date: string;       // YYYY-MM-DD
  song_id: string;
  position: number;          // 1–3
  chosen_key: string | null; // null → fall back to chord_charts[0].key
  status: SetlistStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// SetlistSongWithDetails (already exists — no change):
export interface SetlistSongWithDetails extends SetlistSong {
  song: SongWithCharts;
}
```

---

## API Routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/setlist?date=YYYY-MM-DD` | any | Fetch setlist (PUBLISHED only for portal/public; all statuses for song-selecting roles) |
| POST | `/api/setlist` | Coordinator / MusicCoordinator / WorshipLeader / Admin | Upsert a song at a position |
| DELETE | `/api/setlist/[id]` | Coordinator / MusicCoordinator / WorshipLeader / Admin | Remove a song |
| PATCH | `/api/setlist/[date]/publish` | Coordinator / MusicCoordinator / WorshipLeader / Admin | Set all songs for that date to PUBLISHED |

**Auth helper** used in all setlist write routes:
```typescript
const SETLIST_ROLES: AppRole[] = ["Admin", "Coordinator", "MusicCoordinator", "WorshipLeader"];
// Reject if actor.app_role not in SETLIST_ROLES
```

> **No server-side PDF route.** jsPDF is browser-only (DOM dependency) and cannot run in Next.js API routes. PDF generation is handled client-side (see MVP 5).

---

## UX Flow — Step by Step

### 1. Login and landing

| Role | Login page | Post-login redirect |
|---|---|---|
| Coordinator | `/admin/login` | `/admin/roster` (existing) |
| MusicCoordinator | `/admin/login` | `/admin/roster` (read-only view) |
| WorshipLeader | `/admin/login` | `/admin/roster` (read-only view) |

All roles land on `/admin/roster`. Roster management controls are hidden for `MusicCoordinator` and `WorshipLeader` — they see the roster as read-only and use the Setlist section for song selection.

### 2. Roster view — spotting "my" Sunday

**All worship-leading roles** (via `/admin/roster`):
- Page fetches `/api/me` to get the caller's `member_id` and `app_role`
- Any Sunday where their `member_id` appears in the `worship_lead` slot gets a "Your Sunday" badge
- **MusicCoordinator / WorshipLeader:** All roster grid edit controls hidden (no "Assign member" dropdowns, no draft/publish roster buttons) — read-only view
- **Coordinator / Admin:** Full roster management controls visible as normal

**Songs section states** (visible to all worship-leading roles on their own Sundays):
- Empty → "No songs chosen yet — Select songs" CTA linking to `/admin/songs?date=...&picking=1`
- Draft saved → 3 songs listed + **DRAFT** badge (amber) + "Edit songs" button
- Published → 3 songs listed + **PUBLISHED** badge (green) + "Edit songs" button

**All roles:** Songs section on Sundays they are NOT the worship_lead shows songs as read-only (published only).

### 3. Song selection — "pick mode"

Tapping "Add songs" (or "Edit songs") navigates to `/admin/songs?date=YYYY-MM-DD&picking=1`.

The song pool page enters **pick mode**: a sticky selection tray appears at the bottom (mobile-first):

```
┌──────────────────────────────────────┐
│  Songs for 2 Mar  (2 / 3 selected)  │
│  [1. Amazing Grace  G] [×]           │
│  [2. Cornerstone    C] [×]           │
│  [3. — empty —                  ]    │
│  ──────────────────────────────────  │
│  [  Done — Save songs for 2 Mar  ]   │
└──────────────────────────────────────┘
```

- Each `SongCard` gets a large **+ button** (min 44px tap target, mobile-first) adding the song to the next empty slot
- All 3 slots filled → + is disabled (greyed)
- Already selected → + becomes **× (remove)**
- Re-entering edit mode → tray pre-loads existing draft from `GET /api/setlist?date=`
- All worship-leading roles access pick mode through the same `/admin/songs` page; pick mode activates only when `?picking=1&date=` params are present
### 4. Key selection per song

- Each filled tray slot shows a key chip (default: `chord_charts[0].key`, or "No key" if no chart)
- Tapping the chip opens an inline key picker using `ALL_KEYS` from `src/lib/utils/transpose.ts`
- Tapping the song title in the tray opens `ChordSheetModal` to preview + transpose; closing with a key change updates the chip
- **Fallback rule:** `chosen_key ?? chord_charts[0]?.key ?? "Original key"` — displayed at render and PDF time

### 5. Saving songs

- "Done — Save songs for [date]" → `POST /api/setlist` for each slot (upsert by `sunday_date + position`)
- Navigator returns to `/admin/roster`; Songs section shows 3 songs + **DRAFT** badge
- "Edit songs" re-enters pick mode with existing selections pre-loaded

### 6. Publishing

Songs section action buttons (WL's own Sundays only):
```
[Save as Draft]   [Publish Songs →]
```
- "Publish Songs" → `PATCH /api/setlist/{date}/publish`
- Badge: DRAFT (amber) → PUBLISHED (green)
- WL can edit after publish — saving reverts to DRAFT; must re-publish

### 7. Musician portal — reading published setlist

- `/portal/roster` fetches `GET /api/setlist?date=` for each Sunday
- Returns only `status = PUBLISHED` songs for public callers
- Shows 3 songs with `chosen_key` (or original key if null)
- "Download Chord Charts" button navigates to `/portal/print/[date]`

### 8. Combined PDF download (musicians + worship leaders)

Route: `/portal/print/[date]` (public) and `/admin/print/[date]` (authenticated)

- **Client-side page** — runs in the browser using existing jsPDF infrastructure
- Fetches chord sheet `file_url` for each of the 3 songs directly (same as `ChordSheetModal`)
- Applies `parseChordSheet` + `semitonesBetween` transposition to `chosen_key`
- Renders single jsPDF document with page breaks between songs; header: `{Title} — Key of {chosen_key}`
- Auto-triggers `doc.save("Setlist-{date}.pdf")` on mount; "Download PDF" button as fallback
- If `file_url` is null for a song: placeholder page ("No chord chart available for {title}")

---

## MVP Slices

### MVP 1 — Foundation: data layer + TypeScript types (no UI changes)
**Goal:** Everything compiles, no existing behaviour breaks, DB table exists.

**Scope:**
1. Migration `010_worship_lead_types.sql` — documents that `WorshipLeader` and `MusicCoordinator` already exist in DB enum (SQL comment-only or no-op; serves as migration history marker)
2. Migration `011_sunday_setlist.sql` — `CREATE TABLE public.sunday_setlist` (schema above)
3. Update `src/lib/types/database.ts`:
   - Add `"MusicCoordinator"` and `"WorshipLeader"` to `AppRole`
   - Add `SetlistStatus = "DRAFT" | "PUBLISHED"`
   - Update `SetlistSong` with all fields (`chosen_key`, `status`, `created_by`, `created_at`, `updated_at`)
4. New `src/lib/db/setlist.ts`: `getSetlist(date)`, `upsertSetlistSong(...)`, `deleteSetlistSong(id)`, `publishSetlist(date)`
5. New API routes (with proper role auth guards):
   - `GET /api/setlist?date=` → returns rows; PUBLISHED only without session
   - `POST /api/setlist` → upserts; requires `SETLIST_ROLES`
   - `DELETE /api/setlist/[id]` → deletes; requires `SETLIST_ROLES`
   - `PATCH /api/setlist/[date]/publish` → sets PUBLISHED; requires `SETLIST_ROLES`

**What stays the same:** All `/admin` and `/portal` routes unchanged. `SundayCard` still receives empty `setlist: []`.

**Tests:** Unit tests for `setlist.ts` DB helpers; integration tests for all 4 routes (including role auth rejection for Musician).

---

### MVP 2 — Admin access for MusicCoordinator + WorshipLeader
**Goal:** Both `MusicCoordinator` and `WorshipLeader` land on `/admin/roster` (read-only). Settings and Audit are blocked. Song selecting roles see "Your Sunday" badge on their assigned Sundays.

**Scope:**
1. Update `src/middleware.ts`:
   - Extend existing `/admin/` guard to **allow** `MusicCoordinator` and `WorshipLeader` in (both were previously blocked)
   - Add sub-path blocks inside `/admin/` for both roles: block `/admin/settings` and `/admin/audit` (redirect to `/admin/roster`)
   - Pages they can read but not write: `/admin/roster`, `/admin/people`, `/admin/songs` — middleware passes through; page derives `canEdit` from role
   - **No `/wl/:path*` matcher needed — no `/wl/` routes exist**
2. Update `src/app/admin/login/page.tsx`:
   - After successful login: `MusicCoordinator` → `/admin/roster`; `WorshipLeader` → `/admin/roster`
   - `Coordinator` → stays `/admin/roster` (existing, unchanged)
3. Update `src/app/admin/layout.tsx`:
   - Hide **Settings** and **Audit** nav items for `MusicCoordinator` and `WorshipLeader` (extend existing Coordinator logic for Settings)
4. Update `/admin/roster/page.tsx`:
   - Derive `canEditRoster = !memberLoading && member !== null && (member.app_role === "Admin" || member.app_role === "Coordinator")`
   - `MusicCoordinator` and `WorshipLeader` see roster grid read-only; no assign/draft/publish roster controls visible
   - Add "Your Sunday" badge: highlight any Sunday card where the caller's `member_id` matches the `worship_lead` slot
5. Update `/admin/people/page.tsx` and `/admin/songs/page.tsx`:
   - Already `canEdit`-gated for `Coordinator`; extend same gate to also exclude `MusicCoordinator` and `WorshipLeader`

**Tests:** Middleware routing for all 5 roles (including `MusicCoordinator` and `WorshipLeader` → `/admin/roster`, blocked from `/admin/settings` and `/admin/audit`); render test that both roles see no edit controls on `/admin/roster`; "Your Sunday" badge detection.

---

### MVP 3 — Song pick mode + draft save (core feature)
**Goal:** All song-selecting roles can pick up to 3 songs from `/admin/songs` and save as DRAFT.

**Scope:**
1. Update `src/app/admin/songs/page.tsx`:
   - Detect `?picking=1&date=` query params → activate pick mode
   - Renders sticky selection tray (mobile-first, z-indexed above scroll)
   - Tray: 3 slots with song title + key chip + × remove; "Done" button
   - Re-entry: pre-loads existing draft from `GET /api/setlist?date=`
   - "Done" → `POST /api/setlist` for each filled slot → navigate back to `/admin/roster`
   - Normal songs page behaviour unchanged when params are absent
2. Update `src/components/song-card.tsx`:
   - Add optional props: `onSelect?: (song: SongWithCharts) => void`, `isSelected?: boolean`
   - Renders + / × button only when `onSelect` is provided (zero visual change for existing admin/portal views)
   - Min 44px tap target on + button
3. Extend `src/app/admin/roster/page.tsx`:
   - Fetch `GET /api/setlist?date=` for each Sunday
   - Merge into Sunday card `setlist` prop
   - Show DRAFT badge + "Edit songs" + "Publish Songs" buttons for the caller's own assigned Sundays (worship_lead match)

**Tests:** `SongCard` with/without `onSelect` prop; pick mode tray state management; pick mode absent when no query params; `POST /api/setlist` integration test.

---

### MVP 4 — Key selection per song
**Goal:** Worship leaders can specify which key each song should be played in.

**Scope:**
1. Tray key chips (in MVP 3 tray) — make tappable:
   - Tap → inline key picker using `ALL_KEYS` from `src/lib/utils/transpose.ts`
   - Chosen key in React state; saved to `chosen_key` on POST
   - No chord charts → chip shows "Original"; key picker disabled
2. "Preview" affordance: tapping song title in tray opens `ChordSheetModal`; closing with key change updates chip
3. Portal + admin roster: display `chosen_key ?? chord_charts[0]?.key ?? "Original key"` next to each song

**Tests:** Key fallback unit test; key chip tap → picker → save integration test.

---

### MVP 5 — Publish + musician PDF
**Goal:** Published setlists appear on portal; musicians download combined PDF.

**Scope:**
1. Admin roster Songs section — publish flow (worship-leading roles only, on their own Sundays):
   - `[Save Draft]` re-saves (status → DRAFT)
   - `[Publish Songs →]` → `PATCH /api/setlist/{date}/publish`
   - Badge: DRAFT (amber) → PUBLISHED (green)
   - Editing after publish re-saves as DRAFT; must re-publish
2. `GET /api/setlist?date=` public response: only `PUBLISHED` without auth; all statuses for `SETLIST_ROLES`
3. `src/app/portal/roster/page.tsx`: fetch setlist per Sunday; pass to `SundayCard`
4. `src/components/sunday-card.tsx`: wire "Download Chord Charts" to `/portal/print/[date]` (new tab); only show button when `setlist.length > 0 && any(status=PUBLISHED)`
5. New `src/app/portal/print/[date]/page.tsx` — **client-side PDF page:**
   - Fetches `GET /api/setlist?date=`; fetches `file_url` for each song in browser
   - Applies `parseChordSheet` + `semitonesBetween` transposition per song
   - Builds single jsPDF document; auto-downloads on mount
6. Mirror at `src/app/admin/print/[date]/page.tsx` (authenticated; can share the same component via a shared `PrintSetlistPage` component)

> **Why client-side PDF?** jsPDF uses DOM APIs, cannot run in Next.js API routes. Matches existing `ChordSheetModal` Print pattern — no new server infrastructure.

**Tests:** Publish endpoint integration; portal `SundayCard` with/without setlist; print page loading + download trigger (mock jsPDF).

---

## File Change Map

```
src/
  lib/
    types/
      database.ts              ← add "MusicCoordinator", "WorshipLeader" to AppRole
                                  add SetlistStatus; update SetlistSong with all fields
    db/
      setlist.ts               ← NEW: getSetlist, upsertSetlistSong, deleteSetlistSong, publishSetlist
  middleware.ts                ← extend /admin guard to allow MusicCoordinator + WorshipLeader
                                  block /admin/settings + /admin/audit for MusicCoordinator + WorshipLeader
  app/
    admin/
      login/page.tsx           ← add post-login redirect: MusicCoordinator → /admin/roster, WorshipLeader → /admin/roster
      layout.tsx               ← hide Settings + Audit nav for MusicCoordinator + WorshipLeader (extend existing Coordinator logic)
      roster/page.tsx          ← extend canEditRoster gate to Admin + Coordinator only; add "Your Sunday" badge for worship-lead match
      people/page.tsx          ← extend canEdit gate to exclude MusicCoordinator + WorshipLeader (already gated for Coordinator)
      songs/page.tsx           ← extend canEdit gate to exclude MusicCoordinator + WorshipLeader; add pick mode (detect ?picking=1&date=)
      print/
        [date]/
          page.tsx             ← NEW: client-side combined PDF for authenticated roles (MusicCoordinator / WorshipLeader / Coordinator)
    portal/
      roster/
        page.tsx               ← fetch setlist per Sunday + pass to SundayCard (MVP 5)
      print/
        [date]/
          page.tsx             ← NEW: client-side combined PDF for musicians (MVP 5)
    api/
      setlist/
        route.ts               ← NEW: GET / POST (auth: SETLIST_ROLES)
        [id]/
          route.ts             ← NEW: DELETE (auth: SETLIST_ROLES)
        [date]/
          publish/
            route.ts           ← NEW: PATCH publish (auth: SETLIST_ROLES)
  components/
    song-card.tsx              ← add optional onSelect / isSelected props (backward-compatible)
    sunday-card.tsx            ← wire Download button to /portal/print/[date] (MVP 5)
supabase/
  migrations/
    010_worship_lead_types.sql     ← no-op SQL; documents that WorshipLeader + MusicCoordinator
                                      already exist in DB enum (migration 006)
    011_sunday_setlist.sql         ← NEW: CREATE TABLE sunday_setlist (chosen_key nullable)
```

---

## Isolation Strategy — Avoiding Regression

### MVP 1 (data layer)
- DB migration is additive only (new table, no column removal)
- New DB helpers are new file (`setlist.ts`) — no edits to `members.ts` or `songs.ts`
- New API routes are new files — no edits to existing routes
- `AppRole` change: adding two values; any exhaustive switch arms will surface via TypeScript

### MVP 2 (auth)
- No new route areas created — all changes are inside existing `/admin/*`
- Middleware change is additive: existing `/admin` guard extended to allow `MusicCoordinator` and `WorshipLeader` in, with targeted sub-path blocks for `/admin/settings` and `/admin/audit`; no `/wl/` matcher added
- Login redirect: `MusicCoordinator` → `/admin/roster` (new); `WorshipLeader` → `/admin/roster` (new); `Coordinator` and `Admin` flow unchanged
- Page-level `canEdit` and `canEditRoster` changes are purely additive — `MusicCoordinator` and `WorshipLeader` appended to existing exclusion conditions; no logic removed

### MVP 3 (pick mode)
- `SongCard` optional props: portal and admin views that don't pass `onSelect` render unchanged
- Pick mode is an additive behaviour on the existing `/admin/songs` page — activates only when `?picking=1&date=` params are present; normal admin song browsing/editing is unaffected
- `POST /api/setlist` is a new route — existing song/roster APIs untouched

### MVP 4 (key selection)
- Local React state; no changes to transpose utils or `ChordSheetModal` internals

### MVP 5 (publish + PDF)
- Portal roster setlist fetch is additive (`setlist` was always `[]` — populating it doesn't break layout)
- `SundayCard` Download button is hidden until setlist has published songs — no visual regression on empty state
- PDF print page is a new route; no edits to existing routes

---

## Open Questions / Future Work

- **Admin roster setlist section:** Songs section (DRAFT/PUBLISHED badges + Edit/Publish buttons) is now shown directly on `/admin/roster` for all worship-leading roles. No separate page needed.
- **Un-publish / re-draft:** Saving edits after publish reverts to DRAFT; re-publish required. No hard lock unless Admin/Coordinator locks the full roster.
- **More than 3 songs:** Is exactly 3 always the right number? Consider making it configurable via settings. Deferred.
- **Song ordering:** Drag-to-reorder or swap arrows on the tray. Deferred to post-MVP.
- **Admin/Coordinator visibility of WL setlist in admin panel:** Admin should see drafted setlists on the admin roster page (read-only). Deferred.
- **Notification on publish:** Email or in-app notification to Coordinator/Admin when songs are published. Out of scope.
- **Key collision:** WL's `chosen_key` in DB is authoritative. Musician's per-session key change in portal `ChordSheetModal` is local only and overrides for their own PDF session — consistent with existing behaviour.
- **Chord sheet availability:** If none of the 3 songs have `file_url`, the Download button should be hidden or disabled with a tooltip. Handle in MVP 5.
