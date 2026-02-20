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
| Local Infra    | Supabase CLI (Docker-based local stack)         |
| PDF Generation | TBD (pdf-lib or @react-pdf/renderer)            |
| Testing        | Vitest + Playwright + React Testing Library     |

## Local Development

Full setup instructions and commands in [LOCAL_DEV.md](./LOCAL_DEV.md).

**Quick start:**
```bash
supabase start           # Start local stack (Postgres, Auth, Storage, Studio)
npm run dev              # Start Next.js dev server
supabase db reset        # Reset + run migrations + seed data
```

## Test Strategy

Detailed testing approach in [TEST_STRATEGY.md](./TEST_STRATEGY.md).

**Test pyramid:**
- **Unit tests** (Vitest): Business logic, utilities, helpers
- **Integration tests** (Vitest + Supabase local): API routes, database interactions, RLS policies
- **E2E tests** (Playwright): Critical user flows (availability submission, roster publish)
- **Contract tests** (optional): Email provider, external dependencies

**Local-first philosophy:** All tests run against local Supabase stack before CI.

## Infrastructure Update (Patch v1.1)
### Objectives
- Add local environment parity using Supabase CLI (Docker-based local stack).
- Define a repeatable local workflow: start/stop/reset/migrate/seed.
- Define a testing strategy (unit/integration/e2e) that runs locally first and mirrors production where possible.
- Define cron execution strategy: Vercel Cron in prod + manual/internal triggers locally.
### Decisions
- Local dev uses **Supabase CLI** (`supabase start`) rather than a custom Postgres-only container.
- Schema changes use **Supabase migrations**; seed data uses `seed.sql` (or a seeding script) executed during `supabase db reset`.
- Local email uses **stub mode** by default (logs emails + links), with optional MailHog later if needed.
### Deliverables
- Update `PLAN.md` with Local Dev + Test Strategy sections.
- Create `LOCAL_DEV.md` with exact commands and env setup.
- Create `TEST_STRATEGY.md` describing test pyramid - include contract tests if possible, tooling, and what runs in local/CI.

## Roles & Permissions

| App Role | Capabilities                                                        |
|----------|---------------------------------------------------------------------|
| Admin    | Full CRUD, roster assignments, lock/unlock, emergency swap, settings |
| Musician | Submit availability (via magic link), view roster on portal, download chord PDFs |

## Band Roles (11)

Worship Lead, Backup Vocals 1, Backup Vocals 2, Electric Guitar, Acoustic Guitar, Bass, Keyboard, Drums, Percussion, Setup, Sound

## Phases

### Phase 1 — Foundation (MVP 1)
- [x] Project scaffolding (Next.js + Tailwind + Supabase + React Compiler)
- [x] Supabase project setup (tables, RLS policies)
- [x] Admin authentication (login page, Supabase Auth)
- [x] People page (member CRUD, multi-role assignment, magic token generation)
- [x] Availability form (magic link access, no auth)
- [ ] Local Supabase via CLI (Docker) documented + configured for local development and testing
- [ ] Test Strategy Plan Implemented

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
- [ ] Outbox dispatcher runnable locally (stub provider OK)

### Phase 5 — Polish & Deploy (MVP 1)
- [ ] Month navigation (history + future)
- [ ] Mobile responsive (card-per-Sunday)
- [ ] Vercel deployment
- [ ] Team onboarding
- [ ] Smoke test checklist for prod parity

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
