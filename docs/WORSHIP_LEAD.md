# Worship Leader Feature — Implementation Plan

## Overview

This document outlines the full feature plan for a **Worship Leader (WL)** role in the app. The WL can:

- Log in and view the roster schedule
- See which Sunday they are rostered as Worship Lead
- Pick up to 3 songs for that Sunday from the shared song pool
- Set the performance key for each chosen song (defaults to original key if not set)
- Save songs as draft, then publish them
- Musicians see those published songs (with keys) on the portal roster card
- Musicians can download a combined PDF of all 3 chord sheets in the selected keys

The WL **cannot** modify the member roster table (who plays what instrument). That is the Coordinator's job alone.

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
| Admin auth (`/admin`) | Guards Admin + Coordinator; `WorshipLead` not yet a role | `src/middleware.ts` |
| Portal (musician view) | No auth; public. Roster/songs are read-only | `src/app/portal/` |
| `AppRole` enum | `"Admin" | "Coordinator" | "Musician"` — no `"WorshipLead"` yet | `src/lib/types/database.ts` |
| jsPDF infrastructure | Used in `chord-sheet-modal.tsx` for single-song PDF (browser-only) | `src/components/chord-sheet-modal.tsx` |

### What does NOT exist yet (must build)

- `WorshipLead` `app_role` value in DB enum + TypeScript types
- `sunday_setlist` DB table
- Setlist API routes (`GET`, `POST`, `DELETE`, `PATCH /publish`)
- WL-specific auth area (`/wl/`) + middleware guard
- Song selection UI in "pick mode"
- Combined multi-song client-side PDF download page
- Published setlist displayed on portal roster cards

---

## Role Design

### New `app_role` value: `"WorshipLead"`

The existing `AppRole` enum is `"Admin" | "Coordinator" | "Musician"`. We add `"WorshipLead"`.

A member with `app_role = "WorshipLead"`:
- Logs in via the same `/admin/login` page
- Is redirected to `/wl/roster` (a dedicated WL area under `/wl/`)
- Has access to: `/wl/roster`, `/wl/songs`
- Does NOT have access to: `/admin/*` (people, settings, admin roster management)

> **Why a separate `/wl/` area?** The `/portal` routes are currently public (no auth). The `/admin` routes are for Admin + Coordinator. A dedicated `/wl/` namespace keeps routing, middleware, and layout concerns clean without touching the existing public portal or admin areas.

### Permission matrix

| Route | Admin | Coordinator | WorshipLead | Musician (portal) |
|---|:---:|:---:|:---:|:---:|
| `/admin/roster` | ✅ | ✅ | ❌ | ❌ |
| `/admin/people` | ✅ | ✅ | ❌ | ❌ |
| `/admin/songs` | ✅ | ✅ | ❌ | ❌ |
| `/admin/settings` | ✅ | ❌ | ❌ | ❌ |
| `/wl/roster` | — | — | ✅ | ❌ |
| `/wl/songs` | — | — | ✅ | ❌ |
| `/portal/*` | public | public | public | public |
| `POST /api/setlist` | ✅ | ✅ | ✅ (own dates only) | ❌ |

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

-- RLS: service role key used for all writes (same pattern as rest of app)
-- Portal SELECT: only status = 'PUBLISHED' visible without auth
```

### Updated `app_role` enum

Migration: `supabase/migrations/010_add_worship_lead_role.sql`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'WorshipLead';
```

> **Note on migration numbers:** Migrations 008 and 009 are already taken by the audit log feature (`008_audit_log.sql`, `009_audit_log_retention.sql`). WL migrations start at **010**.

---

## TypeScript Types

Changes to `src/lib/types/database.ts`:

```typescript
// Add to AppRole:
export type AppRole = "Admin" | "Coordinator" | "Musician" | "WorshipLead";

// New type:
export type SetlistStatus = "DRAFT" | "PUBLISHED";

// Update SetlistSong (was missing chosen_key, status, created_by):
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

// SetlistSongWithDetails (already exists, no change needed):
export interface SetlistSongWithDetails extends SetlistSong {
  song: SongWithCharts;
}
```

---

## API Routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/setlist?date=YYYY-MM-DD` | any | Fetch setlist (PUBLISHED only for portal/public; all statuses for WL session) |
| POST | `/api/setlist` | WL+ | Upsert a song at a position (creates or replaces) |
| DELETE | `/api/setlist/[id]` | WL+ (own) | Remove a song from the setlist |
| PATCH | `/api/setlist/[date]/publish` | WL+ | Set all songs for that date to status = PUBLISHED |

> **No server-side PDF route.** jsPDF is browser-only (DOM dependency) and cannot run in Next.js API routes. PDF generation is handled client-side (see MVP 5).

---

## UX Flow — Step by Step

### 1. WL Login
- Navigates to `/admin/login` (same page used by Admin/Coordinator)
- On success, login page detects `app_role = "WorshipLead"` → redirects to `/wl/roster`
- `/wl/roster` is a read-only roster view (same visual language as `/portal/roster`) **plus** an editable Songs section on Sundays where they are listed as `worship_lead`

### 2. Roster view — spotting "my" Sunday
- WL lands on `/wl/roster` — month roster cards identical to portal SundayCard layout
- Page fetches `/api/me` to get the WL's own `member_id` (not direct RLS queries — see MEMORY.md)
- Any Sunday where their `member_id` appears in the `worship_lead` role slot is highlighted with a subtle "Your Sunday" badge
- **Songs section states:**
  - Empty → `"No songs chosen yet — Tap to select songs"` CTA button
  - After draft save → 3 songs listed + **DRAFT** badge (amber) + "Edit songs" button
  - After publish → 3 songs listed + **PUBLISHED** badge (green) + "Edit songs" button (un-publish is implicit on re-save)
- Cards where they are NOT the WL show songs read-only (same as musician portal view)

### 3. Song selection — "pick mode"
- Tapping "Add songs" (or "Edit songs") on their Sunday card navigates to `/wl/songs?date=YYYY-MM-DD&picking=1`
- The song pool page enters **pick mode**: a sticky selection tray appears at the bottom (mobile-first)
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
- Each `SongCard` gains a large **+ button** (mobile-first, min 44px tap target) that adds the song to the next empty slot. If all 3 slots are full, + is disabled (greyed).
- If already selected, the + button becomes a **× (remove)** button
- When re-entering pick mode ("Edit songs"), the tray pre-loads existing selections from the saved draft

### 4. Key selection per song
- In the selection tray, each selected song shows a key chip (default: `chord_charts[0].key`, or "No key" if no chart exists)
- Tapping the key chip opens an inline key picker using `ALL_KEYS` from `src/lib/utils/transpose.ts`
- Selected key is stored in local tray state until "Done" is tapped
- WL can also tap the song title to open `ChordSheetModal` to preview + transpose before committing the key
- If `ChordSheetModal` closes with a key change, the tray updates the chip for that slot
- **Fallback rule:** If WL never picks a key, `chosen_key` is saved as `null`. At display and PDF time, the app falls back to `chord_charts[0].key`, or shows "original key" if no charts exist

### 5. Saving songs
- Tapping "Done — Save songs for [date]" calls `POST /api/setlist` for each slot (upsert by `sunday_date + position`)
- Navigator returns to `/wl/roster` with that Sunday card now showing the 3 songs + **DRAFT** badge
- WL can tap "Edit songs" at any time to re-enter pick mode (existing selections pre-loaded)

### 6. Publishing
- On the WL's Sunday card Songs section, two action buttons appear:
  ```
  [Save as Draft]   [Publish Songs →]
  ```
- "Publish Songs" calls `PATCH /api/setlist/{date}/publish`
- Status badge transitions from DRAFT (amber) → PUBLISHED (green)
- Once published, songs are visible to all musicians on `/portal/roster`
- WL can still edit after publish — "Edit songs" brings them back to pick mode; saving re-sets status to DRAFT until they publish again

### 7. Musician portal — reading published setlist
- `/portal/roster` `SundayCard` fetches `GET /api/setlist?date=` for each visible Sunday
- Returns only `status = PUBLISHED` songs for public/portal callers
- Shows 3 songs with their `chosen_key` (or original key if null)
- The existing "Download Chord Charts" button navigates to `/portal/print/[date]` (client-side PDF page)

### 8. Combined PDF download (musicians + WL)
- Route: `/portal/print/[date]` (public) and `/wl/print/[date]` (WL view)
- Client-side page — runs in the browser using existing jsPDF infrastructure
- On load: fetches chord sheet `file_url` for each of the 3 songs directly (same as `ChordSheetModal`)
- For each song: applies `parseChordSheet` + `semitonesBetween` transposition to `chosen_key`
- Renders into a single jsPDF document with page breaks between songs
- Header per song: `{Song Title} — Key of {chosen_key}`
- Auto-triggers download on page load; also shows a "Download PDF" button as fallback
- If a song has no chord chart (`file_url` is null), that song's page shows a placeholder message

---

## MVP Slices

### MVP 1 — Foundation: data layer + role (no UI changes)
**Goal:** Everything compiles and no existing behaviour breaks.

**Scope:**
1. New migration `010`: `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'WorshipLead'`
2. New migration `011`: `CREATE TABLE public.sunday_setlist` (schema above, `chosen_key` nullable)
3. Update `src/lib/types/database.ts`:
   - Add `"WorshipLead"` to `AppRole`
   - Add `SetlistStatus = "DRAFT" | "PUBLISHED"`
   - Update `SetlistSong` with all fields (`chosen_key`, `status`, `created_by`, `created_at`, `updated_at`)
4. New `src/lib/db/setlist.ts`: `getSetlist(date)`, `upsertSetlistSong(...)`, `deleteSetlistSong(id)`, `publishSetlist(date)`
5. New API routes (stubbed with proper auth checks):
   - `GET /api/setlist?date=` → returns rows (PUBLISHED only without WL session)
   - `POST /api/setlist` → upserts a row (WL auth required)
   - `DELETE /api/setlist/[id]` → deletes (WL auth required)
   - `PATCH /api/setlist/[date]/publish` → sets status = PUBLISHED

**What stays the same:** All existing `/admin`, `/portal`, and `/wl` routes unchanged. SundayCard still receives empty `setlist: []`.

**Tests to add:**
- Unit tests for `setlist.ts` DB helpers (mock Supabase client)
- Integration tests: GET returns empty [], POST creates row, DELETE removes row, PATCH sets PUBLISHED
- TypeScript compilation check (exhaustiveness on any new switch arms)

---

### MVP 2 — WL auth area
**Goal:** WL can log in and land on a protected roster page.

**Scope:**
1. Extend `src/middleware.ts`:
   - Add `/wl/:path*` to the `config.matcher` array (alongside existing `/admin/:path*`)
   - Add new guard block: if `pathname.startsWith('/wl')`, require authenticated user with `app_role === "WorshipLead"` (also pass Admin/Coordinator for dev/test access)
   - Non-WL users attempting `/wl/` → redirect to `/admin/login?reason=not_worship_lead`
   - **Important:** Keep the existing `/admin` guard untouched — it already blocks WL (line 146/181–191)
2. Extend admin login page (`src/app/admin/login/page.tsx`): after successful login, if `app_role === "WorshipLead"` → push to `/wl/roster`
3. New `src/app/wl/layout.tsx`: WL sidebar with nav items: **Roster**, **Song Pool** — no People, Settings, or Audit
4. New `src/app/wl/roster/page.tsx`:
   - Reuse `SundayCard` component (pass read-only props — no admin controls)
   - Fetch `/api/me` to get the WL's `id`
   - Highlight Sundays where `assignment.role.name === "worship_lead" && assignment.member_id === wlId` with "Your Sunday" badge
   - Songs section: stub "Add songs" CTA (links to `/wl/songs?date=...&picking=1`)
   - No editable roster grid — member assignments are read-only

**Tests to add:**
- Middleware routing: WL accessing `/wl/roster` → allowed; Musician accessing `/wl/roster` → redirect; WL accessing `/admin/roster` → redirect
- Render test: WL layout shows only Roster + Song Pool nav items
- Render test: "Your Sunday" badge appears on correct cards

---

### MVP 3 — Song pick mode + save (core WL feature)
**Goal:** WL can select up to 3 songs and save them as a DRAFT setlist.

**Scope:**
1. `src/app/wl/songs/page.tsx`:
   - Detect `?picking=1&date=` query params
   - Render sticky selection tray at bottom (mobile-first, z-indexed above scroll)
   - Tray shows 3 slots: selected song title + key chip (defaults to `chord_charts[0].key`) + × remove button
   - "Done" button → `POST /api/setlist` for each filled slot → navigate to `/wl/roster`
   - If re-entering edit mode: pre-load existing draft from `GET /api/setlist?date=`
2. Update `src/components/song-card.tsx`:
   - Add optional props: `onSelect?: (song: SongWithCharts) => void` and `isSelected?: boolean`
   - Render the + / × button only when `onSelect` is provided (undefined = no button rendered)
   - + button: min 44px tap target, visually prominent (primary colour)
   - × button: shown when `isSelected === true`
   - **Zero visual change** when props are absent — portal/admin views unchanged
3. `src/app/wl/roster/page.tsx` (extend):
   - Fetch `GET /api/setlist?date=` for each visible Sunday
   - Merge into Sunday card's `setlist` array
   - Show DRAFT badge on Songs section header
   - Show "Edit songs" and "Publish Songs" action buttons for WL's own Sundays

**Tests to add:**
- Component test: `SongCard` with `onSelect` renders + button; without `onSelect` renders nothing extra
- Component test: `SongCard` with `isSelected=true` renders × button
- Integration test: `POST /api/setlist` creates rows; subsequent GET returns them
- Render test: Songs section shows DRAFT badge + song list after save

---

### MVP 4 — Key selection per song
**Goal:** WL can specify which key each song should be played in; musicians see the chosen key.

**Scope:**
1. Selection tray (built in MVP 3): each filled slot's key chip is now tappable
   - Tap → inline key picker dropdown using `ALL_KEYS` from `src/lib/utils/transpose.ts`
   - Chosen key stored in React state until "Done" is tapped; saved to `sunday_setlist.chosen_key` on POST
   - If no chord charts exist for a song: chip shows "Original" and key picker is disabled
2. "Preview" affordance: tapping the song title in the tray opens `ChordSheetModal` in the WL songs page
   - `ChordSheetModal`'s `onKeyChange` callback updates the tray's key chip for that slot
3. Portal + WL roster: display `chosen_key` (or `chord_charts[0].key` if `chosen_key` is null) next to each song title in the Songs section
4. Fallback display rule: `chosen_key ?? chord_charts[0]?.key ?? "Original key"`

**Tests to add:**
- Unit tests: key fallback logic (`chosen_key ?? chord_charts[0].key ?? "Original key"`)
- Component test: key chip shows correct key; tap opens picker; selection updates chip
- Integration test: `POST /api/setlist` with `chosen_key` saves correctly; GET returns it

---

### MVP 5 — Publish + musician combined PDF
**Goal:** Published setlists appear on portal roster; musicians can download a combined PDF.

**Scope:**
1. WL roster page — Songs section finalised:
   - `[Save Draft]` re-saves any edits (sets status back to DRAFT)
   - `[Publish Songs →]` calls `PATCH /api/setlist/{date}/publish`
   - Post-publish: badge transitions to PUBLISHED (green)
   - "Edit songs" still available after publish — workflow: edit → re-saves as DRAFT → must re-publish
2. `GET /api/setlist?date=` auth rules:
   - WL session present → returns all statuses (DRAFT + PUBLISHED)
   - No WL session → returns only `status = PUBLISHED` (for portal/public)
3. `src/app/portal/roster/page.tsx`:
   - Fetch `GET /api/setlist?date=` for each Sunday
   - Merge `setlist` into `SundayRoster` objects passed to `SundayCard`
4. `src/components/sunday-card.tsx`:
   - "Download Chord Charts" button navigates to `/portal/print/[date]` (new tab)
   - Only visible when `setlist.length > 0 && setlist.some(s => s.status === "PUBLISHED")`
5. New `src/app/portal/print/[date]/page.tsx` — **client-side PDF page:**
   - Reads `date` from route param; calls `GET /api/setlist?date=`
   - For each song (up to 3): fetches `file_url` (Google Doc chord sheet) directly in the browser
   - Applies `parseChordSheet` + `semitonesBetween` transposition to `chosen_key`
   - Builds a single jsPDF document: song header + transposed chord sheet + `doc.addPage()` between songs
   - Auto-triggers `doc.save("Setlist-{date}.pdf")` on mount
   - Shows a "Download PDF" button as manual fallback + loading state while fetching
   - If `file_url` is null for a song: renders a placeholder page ("No chord chart available for {title}")
6. Mirror at `src/app/wl/print/[date]/page.tsx` (can share same component — WL also needs combined PDF for prep)

> **Why client-side PDF?** jsPDF relies on browser DOM APIs and cannot run in Next.js API routes. This mirrors the existing `ChordSheetModal` pattern — the Print button already generates PDFs in-browser. No new server infrastructure needed.

**Tests to add:**
- Integration test: PATCH publish sets all Sunday's songs to PUBLISHED
- Integration test: public GET `/api/setlist?date=` returns only PUBLISHED songs; WL session GET returns all
- Component test: portal `SundayCard` with populated setlist shows Download button; with empty setlist hides it
- Component test: print page renders loading state → song list → download trigger (mock `jsPDF`)

---

## File Change Map

```
src/
  lib/
    types/
      database.ts              ← add "WorshipLead" to AppRole; add SetlistStatus; update SetlistSong
    db/
      setlist.ts               ← NEW: getSetlist, upsertSetlistSong, deleteSetlistSong, publishSetlist
  middleware.ts                ← add /wl path guard + WorshipLead role check + update matcher
  app/
    admin/
      login/page.tsx           ← add post-login redirect for WorshipLead → /wl/roster
    wl/
      layout.tsx               ← NEW: WL sidebar (Roster + Song Pool only)
      roster/
        page.tsx               ← NEW: read-only roster + editable Songs section
      songs/
        page.tsx               ← NEW: song pool + pick mode with selection tray
      print/
        [date]/
          page.tsx             ← NEW: client-side combined PDF (WL prep use)
    portal/
      roster/
        page.tsx               ← fetch setlist per Sunday + pass to SundayCard (MVP 5)
      print/
        [date]/
          page.tsx             ← NEW: client-side combined PDF for musicians (MVP 5)
    api/
      setlist/
        route.ts               ← NEW: GET / POST
        [id]/
          route.ts             ← NEW: DELETE
        [date]/
          publish/
            route.ts           ← NEW: PATCH publish
  components/
    song-card.tsx              ← add optional onSelect / isSelected props (backward-compatible)
    sunday-card.tsx            ← wire Download button to /portal/print/[date] (MVP 5)
supabase/
  migrations/
    010_add_worship_lead_role.sql  ← NEW: ALTER TYPE app_role ADD VALUE 'WorshipLead'
    011_sunday_setlist.sql         ← NEW: CREATE TABLE sunday_setlist (chosen_key nullable)
```

---

## Isolation Strategy — Avoiding Regression

Each MVP slice is designed to be deployable independently.

### MVP 1 (data layer)
- DB migrations are additive only (`ADD VALUE IF NOT EXISTS`, new table — no column removal)
- New DB helpers are a new file (`setlist.ts`) — no edits to existing `members.ts` or `songs.ts`
- New API routes are new files — no edits to existing routes
- `AppRole` change is additive; TypeScript exhaustiveness checks will surface any missed switch arms
- `SetlistSong` type change is backward-compatible (no existing code reads the missing fields)

### MVP 2 (WL auth)
- New `/wl` routes are isolated from `/admin` and `/portal`
- Middleware change: adds a new path guard + new matcher entry; existing `/admin` guard untouched
- Admin login redirect: gated on `app_role === "WorshipLead"` — Admin and Coordinator flow unchanged

### MVP 3 (pick mode)
- `SongCard` changes use optional props with `undefined` guards — portal and admin views pass neither prop, rendering unchanged
- WL songs page is a new file — portal songs page untouched
- `POST /api/setlist` is a new route — existing song/roster APIs untouched

### MVP 4 (key selection)
- Local React state only; no changes to transpose utils or `ChordSheetModal` internals
- `ChordSheetModal` already accepts an `onKeyChange`-style callback pattern — no component changes

### MVP 5 (publish + PDF)
- Portal roster setlist fetch is additive (`setlist` was always `[]` — populating it doesn't break layout)
- `SundayCard` Download button is hidden until setlist has published songs — no visual regression on empty state
- PDF print page is a new route — no edits to existing routes or components

---

## Open Questions / Future Work

- **Un-publish / re-draft:** WL can revert a PUBLISHED setlist by editing and saving draft; re-publish required. Admin/Coordinator can also override. No hard lock planned unless a future "freeze" feature is added.
- **More than 3 songs:** Business rule confirmation — is exactly 3 always the right number? Consider making quantity configurable via settings. Deferred.
- **Song ordering:** Should WL be able to reorder songs (1 → 2 → 3)? Drag-to-reorder or swap arrows on the tray. Deferred to post-MVP.
- **Admin/Coordinator visibility of WL setlist:** Admin should be able to see the WL's drafted setlist on the admin roster page (read-only). Deferred — not needed for initial WL feature.
- **Notification on publish:** When WL publishes, should Coordinator/Admin receive an in-app or email notification? Out of scope for current slices.
- **Key collision:** If a musician changes key via portal `ChordSheetModal` but WL later changes the `chosen_key`, the musician's change is session-local in the existing modal (not persisted). WL's `chosen_key` in the DB is the authoritative source. This is the documented workaround.
- **Chord sheet availability:** The combined PDF skips songs with no `file_url` gracefully. If none of the 3 songs have chord sheets, the Download button should be hidden or show a tooltip explaining why.
