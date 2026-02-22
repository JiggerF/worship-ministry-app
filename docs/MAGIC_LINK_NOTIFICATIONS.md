# Magic Link Delivery & Notification Behaviour

## 1. Magic Link Lifecycle

| Event        | Detail                                                                     |
|--------------|----------------------------------------------------------------------------|
| Generated    | Auto-created (`gen_random_uuid()`) when admin adds a member on People page |
| Format       | `https://<app-domain>/availability?token=<magic_token>`                    |
| Persistence  | Token stays the same for the member's lifetime (not per-cycle). Same link works every month. |
| Regenerate   | Admin can regenerate from People page → invalidates old link               |
| Lookup       | On form load: `SELECT * FROM members WHERE magic_token = :token AND is_active = true` |

### What Happens on Form Load

1. Parse `token` from URL query parameter
2. Look up member by `magic_token`
3. **Valid + active:** greet by name, populate role dropdown with their `roles[]`, show availability checkboxes
4. **Valid + inactive:** show message: *"Your account is inactive. Please contact your coordinator."*
5. **Invalid/missing:** show error page

---

## 2. Magic Link Delivery Methods

### Manual (Primary for MVP 1)
- Admin navigates to People page (`/admin/people`)
- Clicks "Copy Link" button next to a member
- Pastes link into Viber, WhatsApp, or SMS manually
- Useful for following up with non-respondents

### Automated Email (MVP 1)
- On the 15th (CYCLE_OPEN), system sends email to each active member
- Email contains their unique availability link
- Sent via Resend API from Next.js cron route handler

### Viber Bot (MVP 2)
- Automated Viber message with the link
- Requires Viber Bot API setup

---

## 3. Notification Timeline

Tied to the 15th/20th rule defined in [ROSTER_LOGIC.md](./ROSTER_LOGIC.md).

| Day  | Notification          | Recipients              | Channel | Content                                                                                |
|------|-----------------------|------------------------|---------|----------------------------------------------------------------------------------------|
| 15th | Availability Open     | All active members      | Email   | "Hi {name}, availability form is open for {month1} & {month2}. Please submit by the 19th." + magic link |
| 17th | Reminder 1            | Non-respondents only    | Email   | "Reminder: you haven't submitted your availability yet. Please do so by the 19th." + magic link |
| 19th | Final Reminder        | Non-respondents only    | Email   | "Last chance! Availability form closes today." + magic link                             |
| 20th | Form Closed           | —                       | —       | No notification sent; form shows lockout message on access                              |
| —    | Draft Published       | All assigned members    | Email   | "Hi {name}, you've been rostered for {dates} as {role}. Please review." + portal link   |
| —    | Schedule Confirmed    | All assigned members    | Email   | "Schedule confirmed for {month}. Here's your final roster." + portal link               |
| —    | Emergency Swap        | —                       | —       | **No automated notification.** Admin handles swap communication manually via SMS/Viber.  |
| —    | Chord Sheets Ready    | Members for that Sunday | Email   | "Chord sheets are ready for {date}. Download your bundle." + PDF link                   |

---

## 4. Email Template Structure

### Sender
- From: `noreply@<app-domain>` or configured via Resend
- Reply-to: coordinator email (Jigger/Alona)

### Subject Line Pattern
`[WCC Worship] {action} — {month/date}`

Examples:
- `[WCC Worship] Availability Open — April & May 2026`
- `[WCC Worship] Reminder — Submit your availability by Mar 19`
- `[WCC Worship] You've been rostered — March 2026`
- `[WCC Worship] Chord sheets ready — Mar 2, 2026`

### Body Structure
```
Hi {name},

{Main message — 1-2 sentences describing the action}

{CTA button/link — e.g., "Submit Availability" or "View Roster"}

If you have questions, contact your rostering coordinator:
Jigger / Alona

—
WCC Worship Ministry
```

---

## 5. Determining "Non-Respondents"

A member is a **non-respondent** if:
- They are `is_active = true`
- The current cycle is OPEN
- They have **zero rows** in the `availability` table for any Sunday in the active cycle

Query:
```sql
SELECT m.id, m.name, m.email, m.magic_token
FROM members m
WHERE m.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM availability a
  WHERE a.member_id = m.id
  AND a.date IN (/* sundays in active cycle */)
);
```

---

## 6. Notification Preferences (MVP 2)

- Members can opt in/out of reminder emails
- Channel preference: email vs Viber vs both
- Quiet hours setting
- Managed via a preferences page linked from the availability form

---

## 7. Edge Cases

| Scenario                          | Handling                                                              |
|-----------------------------------|-----------------------------------------------------------------------|
| Member with no email              | Skip automated email; admin notified to deliver link manually via SMS |
| Bounced email                     | Flag in admin dashboard (MVP 2)                                       |
| Token accessed after deactivation | Show: *"Your account is inactive. Please contact your coordinator."*  |
| Member submits after lockout      | Form is read-only; show lockout message with coordinator contact      |
| Multiple form submissions         | Upsert — latest submission overwrites previous for the same dates     |
| Admin regenerates token           | Old link stops working; admin must re-share new link                  |
