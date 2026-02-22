# Roster Page — UI & Logic Spec

## 1. Public Portal View (`/portal/roster`)

**Reference Mockup:** `/Users/jiggerfantonial/Desktop/ViewRosterPage_Final.png`

### Page Header
- Title: **"WCC Worship Team"**
- Subtitle: "Service Roster Schedule"

### Month Tab Switcher
- Pill/toggle style: e.g., `[ February 2026 | March 2026 ]`
- Shows the current rolling 2-month window
- Can browse past months for history

### Status Banner
- Shows overall cycle status with badge:
  - `FINAL` (green) — "All rosters confirmed"
  - `DRAFT` (amber) — "Roster is being finalised"

### Sunday Cards (scrollable, stacked vertically)

Each Sunday is a **card with black border**, containing:

```
┌──────────────────────────────────────────┐
│ 📅 Sun, Feb 15, 2026      > NEXT  FINAL │
│                                          │
│ 👥 Team                                  │
│   ACOUSTIC GUITAR                        │
│   [ David Chen ]                         │
│   BACKUP VOCALS                          │
│   [ Sarah Johnson ]                      │
│   KEYS                                   │
│   [ Emily Rodriguez ]                    │
│   DRUMS                                  │
│   [ Michael Thompson ]                   │
│   BASS                                   │
│   [ Chris Martinez ]                     │
│                                          │
│ 🎵 Songs                                │
│   1. How Great Is Our God                │
│      · Chris Tomlin · Key of C           │
│   2. 10,000 Reasons                      │
│      · Matt Redman · Key of G            │
│   3. Build My Life                       │
│      · Pat Barrett · Key of D            │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │   ⬇ Download Chord Charts PDF       │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Card elements:**
- **Date header:** "Sun, Feb 15, 2026" with calendar icon
- **Status badges (top-right):**
  - `> NEXT` (green outline) — this is the upcoming Sunday
  - `FINAL` (green solid) — roster is locked/confirmed
  - `DRAFT` (amber) — roster not yet confirmed
- **Team section:** role label (UPPERCASE, gray text) + member name in pill/chip
- **Songs section:** numbered list with title (bold) + artist + key metadata
- **Download button:** full-width "Download Chord Charts PDF" (active once songs assigned)

### Default View / Auto-Scroll Rule

**Always show the upcoming Sunday as the default visible card.**

Logic (using Melbourne timezone, `Australia/Melbourne`):
```
if (current day is Sunday AND current time < 12:00 AEST/AEDT)
  → show THIS Sunday's card
else
  → show NEXT Sunday's card
```

- On page load: auto-scroll to the "current" card
- The current card gets the `> NEXT` badge
- Past Sundays remain in the list but scroll above (grayed out slightly)

### Responsive Behaviour
- Cards are the **same layout on both desktop and mobile** (card-based, not table)
- On desktop: cards are max-width constrained and centered
- On mobile: cards are full-width

---

## 2. Admin Roster View (`/admin/roster`)

The admin view uses a **table/grid layout** (different from the public card view) for efficient editing.

### Grid Column Order (left → right)

| Sunday Date | Worship Lead | Vocals 1 | Vocals 2 | Acoustic Guitar | Elec Guitar | Bass | Keys | Drums | Sound | Setup | Notes | Songs | PDF |
|-------------|-------------|----------|----------|-----------------|-------------|------|------|-------|-------|-------|-------|-------|-----|

### Expandable Rows

Clicking a date row expands to reveal:
- **Setlist section:** numbered list of songs with dropdown pickers, counter ("3/3 selected")
- **Bundled PDF:** "Generate PDF" button, "View v1" link, "Download" link
- **Notes:** editable textarea

---

## 3. Public vs Admin Views (Summary)

| Feature                  | Portal (`/portal/roster`) | Admin (`/admin/roster`) |
|--------------------------|--------------------------|------------------------|
| Layout                    | Card-per-Sunday           | Table grid             |
| View roster               | Yes (read-only)           | Yes (editable)         |
| Status badges             | Yes                       | Yes                    |
| Month navigation          | Yes (tab switcher)        | Yes (dropdown)         |
| Auto-scroll to current    | Yes                       | No                     |
| Click to edit assignments | No                        | Yes                    |
| Expandable setlist        | View only (in card)       | Editable (in row)      |
| PDF download              | Yes (if songs assigned)   | Yes                    |
| Save Draft / Publish      | No                        | Yes                    |
| Conflict alerts           | No                        | Yes                    |
| Availability tracker      | No                        | Yes                    |
| Burnout indicators        | No                        | Yes                    |

---

## 3. Admin Edit Flows

### Assign Member to Empty Slot
1. Click empty cell in a role column
2. Dropdown appears showing **only members who:**
   - Have that role in their `roles[]` profile
   - Are marked AVAILABLE for that Sunday date
3. Select member → cell fills with name + "draft" badge
4. Click "Save Draft" to persist

### Reassign Member (DRAFT Status)
1. Click filled cell (showing a name)
2. Dropdown shows same filtered list + "Remove" option
3. Select different member or remove

### Emergency Swap (LOCKED Date)
1. Click locked cell (green badge)
2. System warns: "This date is LOCKED. Swapping requires a reason."
3. Dropdown of available members appears
4. Select replacement → reason modal pops up (mandatory text)
5. Confirm → roster updated, logged

### Add/Edit Songs for a Sunday
1. Expand the date row
2. Setlist section shows numbered song dropdowns (from `songs` table)
3. Add/remove songs, reorder
4. Save

### Add/Edit Notes
1. Expand the date row
2. Notes textarea — type and save

---

## 4. Status Visual Design

| Status   | Badge Color   | Text       |
|----------|--------------|------------|
| Empty    | Gray outline  | —          |
| Available| (not shown on grid — only in admin tracker) | |
| Draft    | Amber/yellow  | `DRAFT`    |
| Locked   | Green         | `LOCKED`   |

**Conflict indicators:**
- Unfilled role cell: red dotted border + warning icon
- Overbooked member (3+ times/month): amber burnout icon next to name

---

## 5. Songs & PDF (Portal Cards)

Each card's **Songs section** shows:
- Numbered list: song title (bold) + artist + key
- Metadata sourced from `songs` table (title, artist, key fields)

**Download Chord Charts PDF** button:
- Full-width at bottom of card
- Active once songs are assigned to that Sunday (independent of roster status)
- If no songs: button hidden or grayed out with "No songs assigned yet"

---

## 6. Month Navigation

### Portal (Tab Switcher)
- Pill/toggle showing the rolling 2-month window: `[ February 2026 | March 2026 ]`
- Can browse past months for history
- Default: tab containing the upcoming Sunday

### Admin (Dropdown)
- Dropdown selector: "February 2026", "March 2026", etc.
- Past months: read-only history
- Current + next month: editable
- T+2 month: availability collection phase

---

## 7. Songs Table Schema Addition

To support artist + key metadata shown in the portal cards, update `songs` table:

| Column       | Type | Constraints |
|--------------|------|-------------|
| artist       | text | nullable    |
| key          | text | nullable — musical key (e.g., "C", "G", "D") |

And a join table for Sunday setlists:

**`setlist_songs`**
| Column      | Type        | Constraints                          |
|-------------|-------------|--------------------------------------|
| id          | uuid (PK)   | `DEFAULT gen_random_uuid()`          |
| sunday_date | date        | NOT NULL                             |
| song_id     | uuid (FK)   | REFERENCES songs(id)                 |
| position    | integer     | NOT NULL — order in setlist (1, 2, 3...) |

**Unique constraint:** `(sunday_date, song_id)`

---

## 8. Song Pool Page (`/portal/songs`)

**Reference Mockup:** `/Users/jiggerfantonial/Desktop/Song Pool.png`

Accessible from Portal nav tab alongside Roster. Same card-based UX feel as the Roster View.

### Access

| Action               | Admin | Musician (non-admin) |
|----------------------|-------|---------------------|
| View song pool       | Yes   | Yes                 |
| Add new song         | Yes   | No                  |
| Edit song            | Yes   | No                  |
| Delete song          | Yes   | No                  |
| Download chord charts| Yes   | Yes                 |
| Click YouTube link   | Yes   | Yes                 |

### Song Card Layout (matching Roster View card style)

```
┌──────────────────────────────────────────┐
│ 🎵 How Great Is Our God        Approved │
│    Chris Tomlin                          │
│                                          │
│ 🏷️ Call to Worship                      │
│ 📖 Psalm 148; Revelation 5:13           │
│                                          │
│ 🎸 Chord Charts                         │
│   Key of C  ⬇ Download                  │
│   Key of G  ⬇ Download                  │
│                                          │
│ ▶️ Watch on YouTube                      │
└──────────────────────────────────────────┘
```

**Card elements:**
- **Song title** (bold) + **status badge** (top-right):
  - `Approved` (green solid)
  - `New Song – Learning` (yellow/amber)
- **Artist/Hymn** — below title, gray text
- **Categories** — tag pills (e.g., "Call to Worship", "Gospel / Salvation", "Praise (Upbeat)")
- **Scripture Anchor** — Bible references with book icon
- **Chord Charts section** — list of available keys, each with a download link (from `chord_charts` table)
  - Links to Google Docs URL or Supabase Storage file
- **YouTube link** — "Watch on YouTube" button/link → opens official reference video

### Filtering & Search (MVP 1)

- **Search bar** — filter by song title or artist
- **Status filter** — toggle: All / Approved / New Song – Learning
- **Category filter** — multi-select tags to filter by category

### Admin Edit Mode

When admin is logged in and views `/portal/songs` (or `/admin/songs`):
- **"+ Add Song" button** at top
- Each card shows **Edit** and **Delete** icons (top-right, next to status badge)
- **Add/Edit song modal:**
  - Song Title (required)
  - Artist/Hymn (optional)
  - Status (dropdown: Approved, New Song – Learning)
  - Categories (multi-select tag picker)
  - YouTube URL (optional)
  - Scripture Anchor (optional, free text)
  - Chord Charts section:
    - Add chart: Key (dropdown) + File upload (drag-drop .docx) or external URL (Google Docs)
    - Can add multiple charts (one per key)
    - Edit/remove existing charts
- **Delete confirmation** modal before removing a song

### Portal Nav Update

```
[ Roster | Song Pool | Song Poll (coming soon) | Calendar (coming soon) ]
```

---

## 9. Reference Mockups

- **Portal roster (public):** `/Users/jiggerfantonial/Desktop/ViewRosterPage_Final.png`
- **Admin roster (desktop):** `/Users/jiggerfantonial/Desktop/AdminPage - Rostering Page.png`
- **Availability form:** `/Users/jiggerfantonial/Desktop/Availability Form - MVP 1.png`
- **Song Pool (spreadsheet data):** `/Users/jiggerfantonial/Desktop/Song Pool.png`
