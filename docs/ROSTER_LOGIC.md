# Roster Logic — Rolling Two-Month Roster Strategy

## 1. Overview

The roster operates on a rolling two-month cycle. On the 15th of every calendar month, a new cycle opens covering all Sundays in the month that is two months ahead (T+2). On the 20th, the upcoming month (T+1) is hard-locked. This creates a continuous pipeline where availability is always being collected for the future while the near-term is confirmed and stable.

---

## 2. Monthly Timeline (15th/20th Rule)

### Recurring Monthly Events

| Day of Month | Event                    | Detail                                                              |
|-------------|--------------------------|----------------------------------------------------------------------|
| 1st         | Archive previous month   | Previous month's cycle → ARCHIVED (read-only)                        |
| 15th        | **CYCLE_OPEN**           | New cycle created for Month T+2. Availability form opens. Email sent to all active members with magic links. |
| 17th        | Reminder 1               | Email to non-respondents: "You haven't submitted availability yet."  |
| 18th        | Admin reminder           | Reminder to admin if T+1 assignments are still incomplete.           |
| 19th        | Final reminder + lockout | Last reminder to non-respondents. **Availability form locks** (1 day before DRAFT deadline). |
| 20th        | **HARD_LOCK**            | All T+1 DRAFT assignments → LOCKED. Confirmation emails sent.        |

### Example: February 2026

| Date     | Action                                                                                   |
|----------|------------------------------------------------------------------------------------------|
| Feb 1    | January 2026 cycle → ARCHIVED. March 2026 assignments are in DRAFT status.               |
| Feb 15   | New cycle for **April 2026**. Availability form opens for April Sundays (Apr 5, 12, 19, 26). Emails sent. |
| Feb 17   | Reminder to members who haven't submitted April availability.                             |
| Feb 18   | Reminder to admin if March roster has unfilled roles.                                     |
| Feb 19   | Final reminder to non-respondents. **April availability form locks for edits.**            |
| Feb 20   | **March 2026 LOCKED.** All March Sunday assignments confirmed. Chord bundler available for March dates (if songs assigned). |
| Feb 20-28| Admin reviews April availability, begins DRAFT assignments for April.                     |

---

## 3. Status State Machine

### States

| Status    | Description                                              |
|-----------|----------------------------------------------------------|
| EMPTY     | Sunday exists in cycle but no musician interaction yet    |
| AVAILABLE | Musician has submitted availability for this date        |
| DRAFT     | Admin has assigned the musician to a role on this date    |
| LOCKED    | Assignment is confirmed and immutable (except emergency)  |

### Transitions

```
EMPTY ──[musician submits form]──> AVAILABLE
AVAILABLE ──[admin assigns role]──> DRAFT
DRAFT ──[20th hard-lock cron]──> LOCKED
LOCKED ──[admin emergency swap]──> DRAFT (new assignee) ──> LOCKED (re-locked)
```

### Transition Rules

| From      | To        | Triggered By     | Conditions                                      |
|-----------|-----------|------------------|-------------------------------------------------|
| EMPTY     | AVAILABLE | Musician         | Cycle must be OPEN; form not locked out          |
| AVAILABLE | EMPTY     | Musician         | Can withdraw before form lockout                 |
| AVAILABLE | DRAFT     | Admin            | At least one musician AVAILABLE for the role      |
| DRAFT     | AVAILABLE | Admin            | Admin un-assigns; reverts to pool                |
| DRAFT     | LOCKED    | System (cron)    | Fires on the 20th for all T+1 DRAFT entries      |
| LOCKED    | DRAFT     | Admin (emergency)| Requires reason; logged in audit trail           |
| DRAFT     | LOCKED    | Admin (emergency)| Re-lock after emergency swap                     |

---

## 4. Database Schema (Supabase / Postgres)

### `members`

| Column      | Type        | Constraints                                                                 |
|-------------|-------------|-----------------------------------------------------------------------------|
| id          | uuid (PK)   | `DEFAULT gen_random_uuid()`                                                 |
| name        | text        | NOT NULL                                                                    |
| email       | text        | NOT NULL                                                                    |
| phone       | text        | nullable — for Viber/SMS reminders                                          |
| roles       | text[]      | NOT NULL — array of roles member can fill (e.g., `{drums,keyboard}`)        |
| magic_token | uuid        | NOT NULL, **UNIQUE** — for no-login links, auto-generated on create         |
| is_active   | boolean     | DEFAULT true — soft-disable without deletion                                |
| created_at  | timestamptz | DEFAULT now()                                                               |

**Role enum values:** `worship_lead`, `backup_vocals_1`, `backup_vocals_2`, `electric_guitar`, `acoustic_guitar`, `bass`, `keyboard`, `drums`, `percussion`, `setup`, `sound`

### `availability`

| Column         | Type        | Constraints                          |
|----------------|-------------|--------------------------------------|
| id             | uuid (PK)   | `DEFAULT gen_random_uuid()`          |
| member_id      | uuid (FK)   | REFERENCES members(id)               |
| date           | date        | NOT NULL — the Sunday date           |
| status         | text        | NOT NULL — `available` / `unavailable` |
| preferred_role | text        | nullable — member's preferred role for this submission |
| notes          | text        | nullable                             |
| submitted_at   | timestamptz | DEFAULT now()                        |

**Unique constraint:** `(member_id, date)`

### `roster`

| Column      | Type        | Constraints                          |
|-------------|-------------|--------------------------------------|
| id          | uuid (PK)   | `DEFAULT gen_random_uuid()`          |
| member_id   | uuid (FK)   | REFERENCES members(id)               |
| date        | date        | NOT NULL — the Sunday date           |
| role        | text        | NOT NULL — the assigned role         |
| status      | text        | NOT NULL — `draft` / `locked`        |
| assigned_by | uuid (FK)   | nullable — admin who made assignment |
| assigned_at | timestamptz | DEFAULT now()                        |
| locked_at   | timestamptz | nullable — when locked               |

**Unique constraint:** `(date, role)` — one member per role per Sunday

### `songs`

| Column           | Type        | Constraints                          |
|------------------|-------------|--------------------------------------|
| id               | uuid (PK)   | `DEFAULT gen_random_uuid()`          |
| title            | text        | NOT NULL                             |
| artist           | text        | nullable — artist or hymn composer   |
| status           | text        | NOT NULL, DEFAULT `'approved'` — enum: `approved`, `new_song_learning` (more in MVP 2) |
| categories       | text[]      | nullable — tags (e.g., `{call_to_worship, gospel_salvation}`) |
| youtube_url      | text        | nullable — official YouTube reference link |
| scripture_anchor | text        | nullable — Bible references (e.g., "Romans 3–8, Ephesians 2:1–10") |
| created_at       | timestamptz | DEFAULT now()                        |

**Status enum values (MVP 1):** `approved`, `new_song_learning`

**Category values:** `assurance_of_grace`, `gospel_salvation`, `call_to_worship`, `praise_upbeat`, `confession_repentance`, `thanksgiving` (extensible)

### `chord_charts` (one song → many charts, one per key)

| Column       | Type        | Constraints                          |
|--------------|-------------|--------------------------------------|
| id           | uuid (PK)   | `DEFAULT gen_random_uuid()`          |
| song_id      | uuid (FK)   | REFERENCES songs(id) ON DELETE CASCADE |
| key          | text        | NOT NULL — musical key (e.g., "C", "G", "Bb") |
| file_url     | text        | nullable — external link (e.g., Google Docs) |
| storage_path | text        | nullable — path in Supabase Storage (`chord-charts/<song_id>/<key>.docx`) |
| created_at   | timestamptz | DEFAULT now()                        |

**Unique constraint:** `(song_id, key)`

### `setlist_songs` (join table — links songs to Sunday dates)

| Column      | Type        | Constraints                          |
|-------------|-------------|--------------------------------------|
| id          | uuid (PK)   | `DEFAULT gen_random_uuid()`          |
| sunday_date | date        | NOT NULL                             |
| song_id     | uuid (FK)   | REFERENCES songs(id)                 |
| position    | integer     | NOT NULL — order in setlist (1, 2, 3...) |

**Unique constraint:** `(sunday_date, song_id)`

### Supabase Storage

- **Bucket:** `chord-charts`
- **Path pattern:** `chord-charts/<song_id>/<filename.docx>`
- `songs.storage_path` stores the bucket path
- `songs.file_url` is the public/signed URL for download

---

## 5. Automation Hooks (Cron Endpoints)

```
src/app/api/cron/
  ├── cycle-open/route.ts      # 15th — 0 8 15 * *
  ├── hard-lock/route.ts       # 20th — 0 8 20 * *
  ├── archive/route.ts         # 1st  — 0 0 1 * *
  └── reminders/route.ts       # 17th-19th — 0 8 17-19 * *
```

Each route handler secured with `CRON_SECRET` header check. Registered in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/cycle-open", "schedule": "0 8 15 * *" },
    { "path": "/api/cron/hard-lock",  "schedule": "0 8 20 * *" },
    { "path": "/api/cron/archive",    "schedule": "0 0 1 * *" },
    { "path": "/api/cron/reminders",  "schedule": "0 8 17-19 * *" }
  ]
}
```

---

## 6. Chord Bundler Trigger

PDF generation is **independent of roster lock status**. The trigger is:

```
IF songs are assigned to a sunday_date
THEN enable "Download Chord Bundle" / "Generate PDF"
```

Worship leaders can set the song lineup up to 1 week in advance even when not all roles are confirmed. This ensures musicians can start practicing early.

---

## 7. Emergency Swap Protocol (Post-LOCK)

1. Admin navigates to the locked Sunday date on admin roster page
2. Selects the role to swap
3. System shows available members (those who marked AVAILABLE for that date AND have the role)
4. Admin selects replacement, provides mandatory reason
5. System updates roster row (new member_id, status temporarily DRAFT then re-LOCKED)
6. **No automated notification** — admin handles swap communication manually via SMS/Viber

---

## 8. Availability Form Lockout

- Availability URL (`/availability?token=xxx`) is accessible throughout the cycle
- Members can edit submissions **up to 1 day before the DRAFT reminder is sent** (the 19th)
- After lockout: form becomes read-only with message:
  > "No more edits allowed since schedule is already being finalised! Pls contact your rostering coordinator (Jigger/Alona)."
- Admin can still override/edit availability on their end

---

## 9. Edge Cases

| Scenario                        | Handling                                                            |
|---------------------------------|---------------------------------------------------------------------|
| No one available for a role     | Conflict alert shown to admin; role cell marked with warning icon   |
| Member rostered 3+ times/month  | Burnout indicator flag on admin dashboard                           |
| Force-assign without availability| Admin can assign any member regardless of availability submission   |
| Member deactivated mid-cycle    | If DRAFT → admin must reassign. If LOCKED → triggers emergency swap |
| Multiple services per Sunday    | Future (MVP 2) — add `service_type` column to roster               |
| Cycle with zero Sundays         | Skip cycle creation (validate before insert)                       |
