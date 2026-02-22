# Admin — Persona, Permissions & User Journeys

## 1. Persona

**Who:** Rostering coordinator — Jigger or Alona
**Role:** Worship ministry leader managing ~11+ musicians across 11 roles
**Goals:**
- Fairly distribute serving load across team members
- Minimize last-minute scheduling chaos
- Ensure every Sunday has all roles filled
- Get chord sheets to musicians early for practice

**Pain points (solved by this app):**
- Manual rostering via spreadsheets is error-prone
- Hard to track who responded to availability requests
- No visibility into member burnout / overuse
- Chord sheets scattered across WhatsApp, email, Google Drive

---

## 2. Auth & Landing

- **Login page:** `/admin/login` — Supabase Auth (email/password)
- **On login:** lands directly on **Roster Admin Page** (`/admin/roster`)
- **Session:** persisted via Supabase SSR cookies
- Musicians do NOT log in — they use magic token links

---

## 3. Permissions

| Action                          | Admin | Musician (via magic link) |
|---------------------------------|-------|--------------------------|
| View roster (portal)            | Yes   | Yes                      |
| Edit roster assignments         | Yes   | No                       |
| Save Draft / Publish            | Yes   | No                       |
| Emergency swap (post-lock)      | Yes   | No                       |
| Submit availability             | Yes (override) | Yes (own form)    |
| View availability tracker       | Yes   | No                       |
| Manage members (CRUD)           | Yes   | No                       |
| Upload chord charts             | Yes   | No                       |
| Assign songs to Sundays         | Yes   | No                       |
| Generate/download PDF bundle    | Yes   | Yes (from portal)        |
| View conflict alerts            | Yes   | No                       |
| Regenerate magic tokens         | Yes   | No                       |

---

## 4. Roster Admin Dashboard Features

### Availability Tracker Panel
- Shows per-member response status for the active cycle
- Green check: submitted availability
- Red X: has not responded
- Helps admin identify who to follow up with (manually via SMS/Viber)

### Burnout Indicator
- If a musician is rostered **3+ times in a given month** → flag with amber warning badge
- Shown next to the member's name in roster grid cells
- Helps admin distribute load fairly and avoid overworking volunteers

### Conflict Alerts (bottom of page)
- "Drummer needed for Feb 11" — unfilled role for a date
- "Tech role unfilled for Feb 18" — unfilled role
- "Volunteer Overbooked on Feb 25" — member rostered 3+ times
- Each alert expandable for details

---

## 5. User Journeys

### Monthly Cycle (Happy Path)

```
15th: System creates new cycle for T+2
      → Emails sent to all active members with magic links
      → Admin sees new cycle appear in month selector

15th-19th: Members submit availability via magic link forms
           → Admin monitors response tracker (green/red per member)
           → Admin copies magic links from People page for manual SMS follow-up

19th: Form lockout — members can no longer edit
      → Admin reviews all availability submissions
      → Admin assigns members to roles on admin roster grid
      → Click cell → dropdown of available members for that role/date → assign

20th: System auto-locks T+1 cycle
      → All DRAFT → LOCKED
      → Confirmation emails sent to assigned members

20th onwards: Admin works on T+2 DRAFT assignments
              → Emergency swaps possible on LOCKED dates if needed
```

### Roster Editing

1. Navigate to `/admin/roster`
2. Select month from dropdown
3. Click empty cell in a role column
4. Dropdown shows only members who are AVAILABLE for that date AND have that role
5. Select member → name appears with "DRAFT" badge
6. Click "Save Draft" to persist
7. When ready: click "PUBLISH" to notify assigned members

### Emergency Swap (Post-LOCK)

1. Musician contacts admin (via Viber/SMS) requesting removal
2. Admin navigates to the locked Sunday on roster page
3. Clicks the member's cell → system warns "This date is LOCKED"
4. Dropdown of available replacements appears
5. Admin selects replacement → reason modal (mandatory)
6. Confirm → roster updated, swap logged
7. Admin manually notifies both musicians via SMS/Viber

### Song Management

1. Navigate to admin roster → expand a Sunday row
2. Add songs from dropdown (searches `songs` table)
3. Or: upload new chord chart via drag-and-drop → saved to Supabase Storage
4. Assign songs to setlist
5. Musicians can download bundled PDF from portal (once songs assigned)

### Member Management

1. Navigate to `/admin/people`
2. Add member: name, email, phone (optional), roles (multi-select)
3. `magic_token` auto-generated
4. Copy availability link → send to member via Viber/email
5. Edit/deactivate members as needed
6. Deactivated members don't appear in roster dropdowns but history preserved

---

## 6. Availability Form Lockout Rules

| Period                         | Form Behaviour                                              |
|--------------------------------|-------------------------------------------------------------|
| 15th to 19th                   | Form editable — members can submit and revise availability  |
| After 19th (lockout)           | Form read-only with message: *"No more edits allowed since schedule is already being finalised! Pls contact your rostering coordinator (Jigger/Alona)."* |
| Admin side                     | Admin can always override/edit availability on their end    |

---

## 7. Reminder Logic

| Trigger                        | Recipients           | Channel | Timing                          |
|--------------------------------|---------------------|---------|---------------------------------|
| Availability not submitted     | Non-respondents      | Email   | 17th, 19th                      |
| T+1 assignments incomplete     | Admin                | Email   | 18th                            |
| 1 day before DRAFT deadline    | Non-respondents      | Email   | 19th (also triggers form lockout) |

These are in addition to the 15th (CYCLE_OPEN) and 20th (HARD_LOCK) triggers defined in ROSTER_LOGIC.md.

---

## 8. Edge Cases

| Scenario                        | Handling                                                    |
|---------------------------------|-------------------------------------------------------------|
| No one available for a role     | Conflict alert shown; admin can force-assign any member     |
| Deactivated member mid-cycle    | DRAFT → admin must reassign. LOCKED → emergency swap flow   |
| Admin forgets to assign         | 18th reminder email                                         |
| Member requests removal (locked)| Emergency swap protocol                                     |
| Multiple admins                 | Future: role-based access. MVP 1: single admin account      |

---

## 9. MVP Scoping

| Feature                                          | MVP 1 | MVP 2 |
|--------------------------------------------------|-------|-------|
| Admin login → Roster Admin Page                  | Yes   |       |
| Month selector dropdown                           | Yes   |       |
| Roster grid with editable cells                   | Yes   |       |
| Expandable row → inline setlist + PDF bundler     | Yes   |       |
| Save Draft / PUBLISH buttons                      | Yes   |       |
| Availability tracker (responded / hasn't)         | Yes   |       |
| Burnout indicator (3+ times/month)                | Yes   |       |
| Conflict Alerts                                   | Yes   |       |
| Form lockout message                              | Yes   |       |
| People management page                            | Yes   |       |
| Service Type dropdown                             |       | Yes   |
| Fairness Wheel visualization                      |       | Yes   |
| Summary cards (Sundays, Volunteers, Roles Unfilled)|      | Yes   |
| Full sidebar nav                                  |       | Yes   |
| Pack Status (NOT GENERATED / PUBLISHED)           |       | Yes   |
| Reports page                                      |       | Yes   |
| Song Library page                                 |       | Yes   |
| Member analytics overlay                          |       | Yes   |

---

## 10. Reference Mockup

`/Users/jiggerfantonial/Desktop/AdminPage - Rostering Page.png`
