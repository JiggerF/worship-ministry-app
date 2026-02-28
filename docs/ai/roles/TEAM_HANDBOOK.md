# Team Handbook — Implementation Plan

## Overview

A versioned, in-app **Team Handbook** — the single source of truth for how the worship
ministry works. Admins and Coordinators write and maintain it in Markdown. Everyone else
reads the rendered output. Every save is a new version with a change log (who, what, why).

**Nav label:** "Team Handbook" — lives in the main admin sidebar.

---

## Handbook Structure (4 Sections)

| Section | Slug | Type | Notes |
|---------|------|------|-------|
| Vision & Values | `vision-values` | Singleton | 10 lines max; why we exist |
| Roles & Responsibilities | `roles-worship-lead` etc. | Per-role | 3 sub-pages (see template below) |
| Weekly Rhythm | `weekly-rhythm` | Singleton | Setlist deadlines, rehearsal times, roster cadence |
| Decision Rights & Escalation | `decision-rights` | Singleton | How conflicts are resolved; Owner vs Support |

**All 6 document slugs:**
- `vision-values`
- `roles-worship-lead`
- `roles-worship-coordinator`
- `roles-music-coordinator`
- `weekly-rhythm`
- `decision-rights`

---

## Role Page Template (Markdown starter per role doc)

Each role page is seeded with this template structure:

```markdown
## Purpose
_1–2 sentences: why this role exists._

## Key Responsibilities
- Responsibility 1
- Responsibility 2
- _(5–8 bullets max)_

## Decision Rights
_What this role can decide without asking anyone._
- Decision 1

## Inputs & Outputs
**Inputs:** What this role receives from others.
**Outputs:** What this role must deliver.

## Boundaries
_What this role does NOT own._

## Success Measures
1. Measure 1
2. Measure 2
3. Measure 3

---
> "We work as one team; role clarity exists to avoid confusion, not to avoid serving."
```

---

## Design Principles

- **Owner of outcome** vs **helpers** — every role page defines the owner (accountable for
  outcome + decisions) and supporters (can help, but do not override).
- Pages are kept short by design — Vision & Values is 10 lines max; role pages follow the
  fixed template above.
- The "not my job" problem is resolved at the template level: Boundaries + Decision Rights
  sections make lane ownership explicit.

---

## Versioning Model

**Semantic versioning stored in the DB from day 1 (MVP2 UI, MVP1 foundation):**

| Version | Meaning | Example |
|---------|---------|---------|
| Minor edit | Wording tweaks, small clarifications | `v1.0 → v1.1` |
| Major restructure | Section added/removed, role scope changed | `v1.1 → v2.0` |

**Every version row stores:**
- `major_version` + `minor_version` (integers, version label computed: `${major}.${minor}`)
- `change_type`: `'minor'` | `'major'`
- `what_changed TEXT[]`: exactly 2 bullets describing what changed
- `why_changed TEXT`: 1 bullet describing why

**Invariant:** Exactly one row per slug has `is_current = true`. Flipped atomically on save.

---

## Data Model

```sql
-- supabase/migrations/016_handbook_documents.sql

CREATE TABLE handbook_documents (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  content          TEXT        NOT NULL DEFAULT '',
  major_version    INT         NOT NULL DEFAULT 1,
  minor_version    INT         NOT NULL DEFAULT 0,
  is_current       BOOLEAN     NOT NULL DEFAULT false,
  created_by       UUID        REFERENCES auth.users(id),
  created_by_name  TEXT,                          -- denormalised for display
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  -- Change log (required on every save except the initial seed)
  change_type      TEXT        CHECK (change_type IN ('minor', 'major')) DEFAULT 'minor',
  what_changed     TEXT[]      DEFAULT '{}',      -- 2 bullets
  why_changed      TEXT        DEFAULT ''         -- 1 bullet
);

CREATE INDEX idx_handbook_slug_current ON handbook_documents (slug, is_current);
CREATE INDEX idx_handbook_slug_history ON handbook_documents (slug, major_version DESC, minor_version DESC);
```

**Seed:** 6 rows, one per slug, `version = 1.0`, `is_current = true`, `content = ''` (template
content rendered as "Start writing..." placeholder in UI).

---

## Access Control

| Action | Admin | Coordinator | WorshipLeader | MusicCoordinator | Musician |
|--------|-------|-------------|---------------|------------------|---------|
| Read all docs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit / save new version | ✅ | ✅ | ❌ | ❌ | ❌ |
| View version history | ✅ | ✅ | ✅ | ✅ | ✅ |
| Restore old version | ✅ | ✅ | ❌ | ❌ | ❌ |

`canEdit = !memberLoading && member !== null && (member.app_role === "Admin" || member.app_role === "Coordinator")`

---

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/handbook` | Any | All 6 slugs with metadata (no content) |
| `GET` | `/api/handbook/[slug]` | Any | Current doc (content + version + author) |
| `POST` | `/api/handbook/[slug]` | Admin / Coordinator | Save new version |
| `GET` | `/api/handbook/[slug]/history` | Any | All versions, newest first (MVP2 route, stubbed in MVP1) |
| `POST` | `/api/handbook/[slug]/restore/[id]` | Admin / Coordinator | Restore old version as new current (MVP2) |

**Server-side role enforcement on all mutating routes** — never trust client headers alone.

---

## MVP 1 — Core: Read, Write, Version Foundation

**Goal:** Anyone can read the handbook. Admin/Coordinator can edit with a simple Markdown
textarea + preview toggle. Every save creates a versioned row with the full change log
stored (MVP2 UI builds on this data).

### Checklist

**Database**
- [ ] `016_handbook_documents.sql` — table, indexes, 6 seed rows with starter template content

**Types**
- [ ] `src/lib/types/handbook.ts` — `HandbookDocument`, `HandbookMeta`, `SaveHandbookPayload`

**DB Helpers** (`src/lib/db/handbook.ts` — server-only, service role key)
- [ ] `getHandbookMeta()` — all 6 slugs, metadata only
- [ ] `getCurrentDoc(slug)` — single current row
- [ ] `saveNewVersion(slug, payload)` — flip is_current + insert; computes next version number
- [ ] `getDocHistory(slug)` — all versions newest first (used by MVP2)

**API**
- [ ] `GET /api/handbook` — calls `getHandbookMeta()`
- [ ] `GET /api/handbook/[slug]` — calls `getCurrentDoc(slug)`
- [ ] `POST /api/handbook/[slug]` — validates role (Admin/Coordinator), validates payload, calls `saveNewVersion()`
- [ ] `GET /api/handbook/[slug]/history` — stub returning `[]` (MVP2 fills in)

**UI — `/admin/handbook/page.tsx`**
- [ ] Left sidebar: 4 section links; "Roles & Responsibilities" expands to 3 sub-links
- [ ] Main content — **Read view:**
  - `react-markdown` + `remark-gfm` rendered output
  - Version badge: `v1.0 · 28 Feb 2026 · John D.`
  - "Edit" button (Admin/Coordinator only, `canEdit` pattern)
  - Empty state with template hint when `content === ''`
- [ ] Main content — **Edit view:**
  - Textarea (Markdown) with "Preview" toggle tab
  - Change log form:
    - **Change type:** radio — "Minor edit (v1.0 → v1.1)" / "Major restructure (v1.1 → v2.0)"
    - **What changed:** two text inputs (bullet 1, bullet 2) — both required
    - **Why changed:** one text input — required
  - `[Save New Version]` primary + `[Cancel]` secondary buttons
  - Inline error if any required field is blank
  - `setSaving/finally` pattern from CLAUDE.md — no alert(), uses toast

**Nav**
- [ ] Add "Team Handbook" to sidebar in `layout.tsx` (visible to all authenticated roles)
- [ ] Icon: BookOpen (already in lucide-react)

**Packages**
- [ ] `npm install react-markdown remark-gfm`

**Tests**
- [ ] `__tests__/components/handbook-page.test.tsx`:
  - Read view renders for Musician (no Edit button)
  - Edit button visible for Admin
  - Edit form shows all 4 change log fields
  - Save blocked when change log fields are empty
  - Cancel returns to read view

**Acceptance criteria for MVP1:**
- Any logged-in user opens "Team Handbook", picks a section, reads rendered markdown
- Admin clicks "Edit", writes content, fills change log, saves — toast confirms, read view updates
- Musician sees no Edit button
- Saving with blank change log fields is blocked with inline error (not alert)
- Empty doc shows a starter template hint (not a blank white box)

---

## MVP 2 — Version History & Restore

**Goal:** Surface the versioned data already stored in MVP1. Users can browse history,
view any old version, and restore it.

- Version History button beside Edit (all users can view, only Admin/Coordinator can restore)
- Slide-in panel listing all versions:
  ```
  v1.1  28 Feb 2026  John D.  [Minor] "Updated wording" / "Approved in Feb meeting"  [View] [Restore]
  v1.0  15 Jan 2026  Jane S.  [Initial]                                               [View]
  ```
- "View" modal: read-only rendered markdown of that version
- "Restore" creates a new row copying old content (change note auto-set to "Restored from v1.0")
- "Updated N days ago by X" banner on read view when doc was edited within last 7 days
- Activate `GET /api/handbook/[slug]/history` (route already exists, just stubbed)

---

## MVP 3 — Diff View + Notifications

**Goal:** Make changes obvious; notify team passively.

- "Diff" button in history panel — line-by-line diff vs current (`diff` npm package)
- In-app badge on "Team Handbook" nav item when any doc updated since last visit
  (tracked via localStorage keyed by latest version id per slug)
- `window.print()` print stylesheet for clean PDF export (no file storage)
- Email notification (only if email infrastructure already exists in the app)

---

## File Map

```
src/
  app/
    admin/
      handbook/
        page.tsx                    # MVP1 — main page (sidebar + read/edit)
    api/
      handbook/
        route.ts                    # GET /api/handbook — list metadata
        [slug]/
          route.ts                  # GET current doc, POST new version
          history/
            route.ts                # GET history (stub MVP1, full MVP2)
          restore/
            [id]/
              route.ts              # POST restore (MVP2)
  lib/
    types/
      handbook.ts                   # HandbookDocument, HandbookMeta, SaveHandbookPayload
    db/
      handbook.ts                   # server-only DB helpers (service role key)
supabase/
  migrations/
    016_handbook_documents.sql      # table + indexes + 6 seed rows
__tests__/
  components/
    handbook-page.test.tsx          # component tests (see checklist above)
```

---

## Open Questions (resolve before MVP2)

1. **Restore confirmation** — should restoring an old version require a change note explaining
   why, or is the auto-note "Restored from vX.Y" sufficient?
2. **History visibility** — currently: all authenticated users can view history. Change to
   Admin + Coordinator only?
3. **Deletion** — no hard deletes planned. A "clear" saves a new empty version. Confirm?
4. **Email notifications (MVP3)** — does the app currently send emails anywhere?
