# Availability Form — Implementation Plan

## Problem Statement

The coordinator currently sends a Google Form manually every 6–8 weeks asking musicians to mark which Sundays they're available. Once responses come in, they switch back to the admin roster page to manually figure out who to assign per role per Sunday. This context-switching is the core UX friction.

**Goal:** Replace the Google Form with an integrated availability form, capture responses in the app, and surface that data *where the coordinator actually needs it* — on the roster page during assignment — so they never have to context-switch between two places.

---

## The Coordinator Workflow (Cycle Reference)

This is the repeating cycle the app needs to support:

```
March 15   → Coordinator sends availability form for April–May
March 20   → Expected full response (5-day window) — coordinator chases non-responders
March ~22  → Coordinator builds DRAFT April roster using responses
March ~24  → Musicians notified via Viber to check the draft and confirm
~March 24  → Coordinator finalises April roster (FINAL)
~March 24  → Coordinator sends Viber message: "April roster is FINAL, check the portal"
            (must be at least 1 week before April 1)

April 15   → Send availability form for May–June
April 20   → Expected full response
April ~22  → Build DRAFT May roster
April ~24  → Finalise May roster (FINAL) — at least 1 week before May 1
            → Viber notification

[Repeat every month, staggered 6 weeks ahead]
```

---

## Two Core UX Problems

### Problem 1 — The form
Google Form is external and untracked. Responses live in a Google Sheet the coordinator has to open separately. There's no link between a response and a member profile.

### Problem 2 — The context switch
After responses come in, coordinator must:
1. Open Google Sheet (responses)
2. Open admin app → Roster page
3. Mentally cross-reference who said available for which Sunday, then assign

This is the biggest pain point. The solution must eliminate this switch.

---

## Recommended Architecture

### Key Insight
Coordinator needs responses and roster **in the same view**. A standalone `/admin/responses` page would recreate the same context-switch problem — just inside the app.

**The right approach:** Responses are captured on their own page for management (send form, track who responded, chase non-responders), but the *content* of those responses (who's available when) is **surfaced inline on the roster assignment page** so assignments are made with full context in one place.

---

## MVP Breakdown

| MVP | Scope | Risk |
|-----|-------|------|
| **MVP 1** | DB schema + availability form page (magic link, auto-generated Sundays, submit) | Low — isolated new table, no roster changes |
| **MVP 2** | `/admin/availability` — coordinator view: response tracking, chase non-responders, read-only response list | Low — read-only admin UI |
| **MVP 3** | Roster page enhancement — availability indicators inline on assignment dropdowns | Medium — touches core roster assignment UI |
| **MVP 4** | Coordinator notifications workflow — in-app "send Viber message" reminder prompts | Low — informational UI only |

---

## Phase 1 — Data Model

### New Table: `availability_periods`
Represents one "send" — e.g., "April–May 2026 availability round".

```sql
CREATE TABLE availability_periods (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now() NOT NULL,
  created_by   uuid        REFERENCES members(id) ON DELETE SET NULL,
  label        text        NOT NULL,  -- e.g. "April–May 2026"
  starts_on    date        NOT NULL,  -- first Sunday in scope
  ends_on      date        NOT NULL,  -- last Sunday in scope
  deadline     date,                  -- expected response date
  closed_at    timestamptz            -- null = open, set when coordinator closes
);
```

### New Table: `availability_responses`
One row per musician per period.

```sql
CREATE TABLE availability_responses (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_at timestamptz DEFAULT now() NOT NULL,
  period_id    uuid        REFERENCES availability_periods(id) ON DELETE CASCADE NOT NULL,
  member_id    uuid        REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (period_id, member_id)
);
```

### New Table: `availability_dates`
One row per Sunday per response — the actual availability data.

```sql
CREATE TABLE availability_dates (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid    REFERENCES availability_responses(id) ON DELETE CASCADE NOT NULL,
  date        date    NOT NULL,
  available   boolean NOT NULL,
  note        text    -- optional: "away", "late arrival", etc.
);
```

---

## Phase 2 — Musician Form (MVP 1)

### Access
- Accessed via **magic link** (existing magic link infra already in place)
- Coordinator generates a link per musician from `/admin/availability`
- Link format: `/availability?token=<magic_token>&period=<period_id>`
- Token resolves to a `member_id` — no login required for musicians

### Form Layout (mirrors Google Form structure)
- Header: "WCC Worship Ministry — Availability for [Month]"
- Subtitle: "Please mark your availability for each Sunday below"
- For each Sunday in the period:
  ```
  Sunday 6 April 2026
  ○ Available   ○ Not Available
  [ Optional note... ]
  ```
- Submit button — single submit, idempotent (upsert on `period_id + member_id`)
- Confirmation screen after submit: "Thanks [Name], your availability has been recorded."

### Re-submission
Musicians can re-open their magic link and resubmit. The upsert will overwrite their previous response. Coordinator can see "Last updated" timestamp per musician.

---

## Phase 3 — Admin Availability Page `/admin/availability` (MVP 2)

### Two sub-views

#### Sub-view A: Periods List
- List of all availability rounds (most recent first)
- Each card: label, date range, deadline, response count (e.g., "8 / 11 responded")
- "+ New Period" button — form to define date range + deadline + generate musician links
- "Close period" action — marks no more responses accepted

#### Sub-view B: Period Detail (click into a period)
The coordinator's command centre for a given round:

```
April–May 2026 Availability
Response deadline: 20 March (3 days away)

RESPONDED (8/11)
┌──────────┬──────┬──────┬──────┬──────┐
│ Member   │ 5/4  │ 12/4 │ 19/4 │ 26/4 │  ← each column = a Sunday
├──────────┼──────┼──────┼──────┼──────┤
│ Alona    │  ✓   │  ✓   │  ✗   │  ✓   │
│ Tess     │  ✓   │  ✗   │  ✓   │  ✓   │
│ Jossel   │  ✓   │  ✓   │  ✓   │  ✓   │
└──────────┴──────┴──────┴──────┴──────┘

NOT YET RESPONDED (3/11)
• Teng    [Copy magic link]  [Send reminder]
• Joseph  [Copy magic link]  [Send reminder]
• Marc    [Copy magic link]  [Send reminder]
```

- ✓ = available (green), ✗ = unavailable (red), — = no response (gray)
- Hover on a cell → shows optional note if any
- "Copy magic link" per non-responder — coordinator pastes into Viber DM
- Read-only; no editing musician responses from here

---

## Phase 4 — Roster Page Integration (MVP 3)

### The Core UX Solution

This is the key to eliminating context-switching. When coordinator is assigning musicians on the roster page, each assignment slot shows **availability status inline**.

#### Approach: Availability-aware assignment dropdown
When coordinator clicks an unassigned slot (e.g., "Acoustic Guitar, April 6"):

```
Assign Acoustic Guitar — Sunday 6 April 2026
─────────────────────────────────────────────
✓ Available
  Teng            Acoustic Guitar
  Joseph          Acoustic Guitar

✗ Not available
  Marc            Acoustic Guitar

— No response yet
  Ronald          Acoustic Guitar
```

- Musicians sorted: available first, then unavailable, then no response
- Color-coded indicators (green dot, red dot, gray dot)
- Coordinator can still assign an "unavailable" musician (override) — just with a visual warning
- No page navigation needed

#### Roster grid view enhancement
On the main roster grid, assigned musicians show a small availability dot:
- 🟢 confirmed available
- 🔴 not available (flagged for coordinator attention)
- ⚪ no response (coordinator should follow up)

This lets coordinator see at a glance if the draft has any conflicts before finalising.

---

## Phase 5 — Notifications Workflow Helper (MVP 4)

Light-touch reminders inside the app to reduce coordinator cognitive load.

### Availability period timeline nudges
On the `/admin/availability` period detail:
- If deadline is approaching and some haven't responded: "3 musicians haven't responded yet. Deadline in 2 days."
- If deadline passed and all responded: "All 11 musicians have responded. Ready to build the roster →" [link to roster page]

### Roster finalisation nudge
On the roster page, when a month's roster is still DRAFT and the month starts in < 10 days:
- "April roster is still Draft. Consider finalising at least 1 week before April 1."

### Post-finalise reminder (informational)
After coordinator clicks Finalise:
- Banner: "April roster is now Final. Don't forget to send the Viber message so musicians know to check the portal."
- No in-app Viber integration — just a prompt

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/010_availability.sql` | 3 new tables: periods, responses, dates |
| `src/lib/db/availability.ts` | DB helpers: createPeriod, getResponses, upsertResponse, getAvailabilityForDate |
| `src/app/availability/page.tsx` | Public musician-facing form (magic link access) |
| `src/app/admin/availability/page.tsx` | Coordinator admin view (period list + detail) |
| `src/app/api/availability/periods/route.ts` | GET list, POST create period |
| `src/app/api/availability/periods/[id]/route.ts` | GET detail, PATCH close |
| `src/app/api/availability/respond/route.ts` | POST submit response (magic-link-authenticated) |
| `src/app/api/availability/for-date/route.ts` | GET availability data for a given Sunday (used by roster page) |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/admin/layout.tsx` | Add "Availability" to sidebar nav (Admin + Coordinator) |
| `src/middleware.ts` | Allow `/availability` (public, magic-link access) |
| `src/app/admin/roster/page.tsx` | Add availability indicators to assignment dropdowns |
| `src/lib/types/database.ts` | Add `AvailabilityPeriod`, `AvailabilityResponse`, `AvailabilityDate` types |

---

## Open Questions

| Question | Notes |
|----------|-------|
| Magic link expiry for availability forms | Current magic links expire — should availability links be longer-lived (30 days)? |
| What Sundays auto-populate in a period? | Generate all Sundays between `starts_on` and `ends_on` automatically |
| Can coordinator edit a musician's response on their behalf? | Useful if someone calls/texts instead of using the link. Probably yes via period detail. |
| Should non-active members be excluded from periods? | Yes — only `status = 'active'` members get links |
| Availability data for roles vs general? | Start general (just available/unavailable per Sunday). Per-role availability is too complex for MVP. |

---

## Implementation Order

1. **DB migration** (MVP 1) — tables first, unblocks everything
2. **Musician form** (MVP 1) — so real data starts collecting early
3. **Admin availability page** (MVP 2) — coordinator tooling
4. **Roster integration** (MVP 3) — highest-value UX improvement, builds on real data from steps 1–3
5. **Nudges/reminders** (MVP 4) — lowest priority, polish

---

## Design Principles

- **No new mental model for musicians** — form looks like the Google Form they're used to
- **Coordinator stays in one place to build the roster** — availability data comes to them
- **Responses page is for management, not reference** — coordinator manages the round from `/admin/availability`, then builds from `/admin/roster`
- **Override is always possible** — coordinator can assign anyone regardless of their stated availability; the system informs, never blocks
