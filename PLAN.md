# Worship Ministry App — Project Roadmap

## Vision

A scheduling and resource management app for the WCC worship ministry team. Automates the rolling two-month roster cycle, availability collection, assignment management, and chord sheet bundling.

## Tech Stack

| Layer          | Technology                                      |
|----------------|------------------------------------------------|
| Framework      | Next.js 16 (App Router, TypeScript)             |
| Styling        | Tailwind CSS                                    |
| Compiler       | React Compiler (auto-memoization)               |
| Database       | Supabase (Postgres)                             |
| Auth           | Supabase Auth (admin only) + magic tokens (musicians) |
| Storage        | Supabase Storage (`chord-charts` bucket)        |
| Hosting        | Vercel                                          |
| Email          | Resend                                          |
| Cron           | Vercel Cron (route handlers)                    |
| PDF Generation | TBD (pdf-lib or @react-pdf/renderer)            |

## Roles & Permissions

| Role     | Capabilities                                                        |
|----------|---------------------------------------------------------------------|
| Admin    | Full CRUD, roster assignments, lock/unlock, emergency swap, settings |
| Musician | Submit availability (via magic link), view roster on portal, download chord PDFs |

## Musician Roles (11)

Worship Lead, Backup Vocals 1, Backup Vocals 2, Electric Guitar, Acoustic Guitar, Bass, Keyboard, Drums, Percussion, Setup, Sound

## Phases

### Phase 1 — Foundation (MVP 1)
- [x] Project scaffolding (Next.js + Tailwind + Supabase + React Compiler)
- [x] Supabase project setup (tables, RLS policies)
- [x] Admin authentication (login page, Supabase Auth)
- [x] People page (member CRUD, multi-role assignment, magic token generation)
- [x] Availability form (magic link access, no auth)

### Phase 2 — Roster Core (MVP 1)
- [ ] Admin roster page (editable grid, Date × Roles)
- [ ] Availability tracker (who responded / who hasn't)
- [ ] Burnout indicator (rostered 3+ times/month)
- [ ] Conflict alerts (unfilled roles, overbooked members)
- [ ] Status workflow (EMPTY → AVAILABLE → DRAFT → LOCKED)
- [ ] Save Draft / Publish flow
- [ ] Emergency swap (post-lock, with reason)
- [ ] Form lockout (1 day before DRAFT reminder)

### Phase 3 — Portal & Chord Bundler (MVP 1)
- [ ] Public portal roster view (read-only grid + mobile cards)
- [ ] Inline setlist per Sunday (expandable row)
- [ ] Chord chart upload (drag-and-drop .docx to Supabase Storage)
- [ ] PDF bundler (generate combined chord sheet, available once songs assigned)

### Phase 4 — Notifications (MVP 1)
- [ ] Automated email on 15th (availability open + magic link)
- [ ] Reminder emails (17th, 19th for non-respondents)
- [ ] Draft published / Schedule confirmed notifications
- [ ] Admin reminder (18th, if assignments incomplete)

### Phase 5 — Polish & Deploy (MVP 1)
- [ ] Month navigation (history + future)
- [ ] Mobile responsive (card-per-Sunday)
- [ ] Vercel deployment
- [ ] Team onboarding

### Future (MVP 2)
- Service Type selector (Sunday Morning, Evening, etc.)
- Fairness Wheel visualization
- Summary dashboard cards (Sundays, Volunteers, Roles Unfilled)
- Full sidebar nav (Dashboard, Schedules, Setlists, Song Library, Reports)
- Pack Status (NOT GENERATED / PUBLISHED)
- Song Poll page
- Team Calendar of Events
- Viber Bot integration
- Member analytics (times rostered, burnout score)
- Notification preferences
- Bulk CSV import

## Related Documentation

- [ROSTER_LOGIC.md](./ROSTER_LOGIC.md) — Rolling two-month roster strategy, 15th/20th rule, state machine
- [ROSTER_PAGE.md](./ROSTER_PAGE.md) — Roster grid UI spec, admin edit flows, mobile layout
- [ADMIN.md](./ADMIN.md) — Admin persona, permissions, user journeys
- [MAGIC_LINK_NOTIFICATIONS.md](./MAGIC_LINK_NOTIFICATIONS.md) — Magic link delivery and notification behaviour
