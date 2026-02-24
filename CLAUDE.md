# CLAUDE.md — WCC Worship Ministry Admin

## Project Overview
A Next.js admin app for the WCC Worship Ministry team. Manages rostering, song tracking, member profiles, and availability. Accessed only by authenticated Admin and Coordinator users.

---

## Tech Stack
- **Framework:** Next.js 16 (App Router, `"use client"` / Server Components)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + `@supabase/ssr` for server-side session handling
- **Testing:** Vitest + @testing-library/react

---

## Core Commands
```bash
npm run dev               # Dev server (NODE_ENV=development, allows dev_auth bypass)
npm run dev:real-auth     # Dev server with production auth (no bypass)
npm run build             # Production build
npm run lint              # ESLint
npm run test              # All tests (vitest run)
npm run test:components   # Component tests only — run after ANY change to a modal page
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

> **Rule:** Run `npm run test:components` after fixing lint errors on any page that contains a modal. A blank modal form will cause these tests to fail immediately.

---

## Project Structure (Key Files)
```
src/
  app/
    admin/
      layout.tsx            # Sidebar nav, current user display, Coordinator nav filtering
      login/page.tsx         # Sets sb-access-token / sb-refresh-token / sb:token cookies
      people/page.tsx        # Member CRUD — Coordinator is READ-ONLY here
      roster/page.tsx
      songs/page.tsx         # Song CRUD — Coordinator is READ-ONLY here
      settings/page.tsx      # Admin only — Coordinator is blocked
    api/
      me/route.ts            # Returns current user's member record (service role key, RLS-safe)
      members/route.ts       # GET all members, POST create
      members/[id]/route.ts  # PUT update, DELETE
      admin/member/route.ts  # Internal: lookup member by email (used by middleware)
  middleware.ts               # Protects /admin/** routes, enforces Coordinator restrictions
  lib/
    constants/roles.ts       # ROLES array + ROLE_LABEL_MAP — must match DB exactly
    db/members.ts            # Server-only DB helpers using service role key
    supabase/
      client.ts              # Browser Supabase client
      index.ts               # Exports real or mock client based on NEXT_PUBLIC_USE_MOCK_ROSTER
    types/database.ts        # All DB types (AppRole, MemberRole, MemberWithRoles, etc.)
supabase/migrations/         # SQL migration files — run in numbered order
```

---

## Roles & Personas

| Role | Access |
|------|--------|
| `Admin` | Full access everywhere |
| `Coordinator` | Read-only on People + Songs, no Settings, full Roster access |
| `Musician` | No admin access (redirected to login) |

**AppRole type:** `"Admin" | "Coordinator" | "Musician"` — defined in `lib/types/database.ts`

---

## Auth Flow
1. Login page (`/admin/login`) calls `supabase.auth.signInWithPassword()`
2. On success, manually sets three cookies: `sb-access-token`, `sb-refresh-token`, `sb:token`
3. Middleware reads the session via `createServerClient` from `@supabase/ssr`
4. If `createServerClient` fails (cookie format mismatch), middleware falls back to decoding the JWT in `sb-access-token` or parsing `sb:token`
5. Middleware checks `members.app_role` to allow/block routes

In `NODE_ENV=development`, a `dev_auth=1` cookie bypasses all auth checks.

---

## Key Architectural Rules

### 1. Always use `/api/me` to get the current user's role client-side
The browser Supabase client is subject to RLS. Coordinators may be blocked from reading the `members` table directly. Use the server-side `/api/me` endpoint which uses the service role key and is RLS-safe.

```typescript
// CORRECT
const { member, loading } = useCurrentMember(); // fetches /api/me internally

// WRONG — subject to RLS, silently returns null for non-Admin roles
const { data } = await supabase.from("members").select("*").eq("email", email).single();
```

### 2. Role defaults must be restrictive (null), never permissive
When role is unknown (loading or fetch failed), default to hidden — never default to `"Admin"`.

```typescript
// CORRECT — buttons hidden while loading AND on fetch failure
const canEdit = !memberLoading && member !== null && member.app_role !== "Coordinator";

// WRONG — "Admin" default causes buttons to flash or stay visible if /api/me fails
const appRole = member?.app_role || "Admin";
```

### 3. canEdit pattern for Coordinator read-only pages
Use a single `canEdit` boolean. Apply consistently to:
- Header action buttons (`+ Add Member`)
- Per-row action buttons (Edit, Deactivate, Copy Link)
- Modal guard: `{showModal && canEdit && <Modal />}`
- Handler guards: `if (!canEdit) return;`

### 4. API routes that mutate data must validate role server-side
Client-side UI guards are not enough. PUT/POST/DELETE routes must independently verify the caller's role — never trust client-sent headers alone.

### 5. Never leave placeholder comments inside modal/form bodies — EVER
`{/* ...existing code... */}` inside a `<form>` or modal renders a completely blank dialog. This broke the Add Member modal **three times** in one session.

- **Never** write `{/* ...existing code... */}` as form body content. Either write the real JSX or omit the block entirely.
- Every modal form MUST have a component test (see Rule 6) — a placeholder makes those tests fail immediately, which is the early-warning signal.

### 5a. Lint Fix Safety Protocol — READ BEFORE REMOVING ANYTHING
**This is the specific failure pattern that caused every regression:**

When lint reports `'X' is defined but never used` or `'X' is assigned a value but never used` on a page that has a modal:

```
STOP — do not remove X immediately.
```

**Mandatory checklist before removing any symbol:**
1. Search the entire file for where `X` should be used
2. If `X` is modal-related (`isSaving`, `setSaveError`, `saveError`, `toggleRole`, `ROLES`, etc.) → scroll to the modal's `<form>` JSX
3. If the form body contains `{/* ...existing code... */}` → **the form is broken, not X**. Fix the form first; the lint error will disappear naturally.
4. Only remove `X` if you have confirmed the form is fully implemented and `X` genuinely has no usage.
5. After any lint fix on a modal page, run `npm run test:components` before finishing.

**Canary pattern for `people/page.tsx`:** If lint flags any of these as unused, assume the modal form is a placeholder:
- `ROLES` (import)
- `isSaving` / `setIsSaving`
- `saveError` / `setSaveError`
- `toggleRole`

### 6. Every modal form needs a component test
Any page that opens a modal with a form must have a test in `__tests__/components/` that:
1. Mocks `fetch` for `/api/me` (Admin) and `/api/members`
2. Clicks the trigger button
3. Asserts every input (`placeholder` or `role`) is in the document
4. Asserts cancel closes the modal
5. Asserts the submit button is present and enabled

This acts as an automated regression guard — a placeholder comment will cause these tests to fail immediately.

```typescript
// Pattern: people-page.test.tsx
it("renders all required form fields when Add Member is clicked", async () => {
  vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
  render(<AdminPeoplePage />);
  await user.click(await screen.findByRole("button", { name: "+ Add Member" }));
  expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("email@example.com")).toBeInTheDocument();
  // ... all other fields
});
```

---

## Common Mistakes to Avoid

| Mistake | Correct Approach |
|---------|-----------------|
| `member?.app_role \|\| "Admin"` as role default | Use `null` + explicit loading state |
| Seeing lint warning → immediately removing `isSaving`/`saveError`/`toggleRole`/`ROLES` | Follow Rule 5a: read the form body first. If it's a placeholder, fix the form — the lint warning disappears naturally |
| Writing `{/* ...existing code... */}` inside a modal `<form>` | Write the real form fields — placeholder = blank modal |
| `supabase.from("members")` client-side to get own role | Use `fetch("/api/me")` instead |
| Assuming `createServerClient` always resolves the session | Add the `sb-access-token` JWT fallback in any server route that needs auth |
| `member?.app_role !== "Coordinator"` when member could be null | Use `canEdit` which explicitly requires `member !== null` |
| Checking `null !== "Coordinator"` (evaluates to true, shows buttons) | `canEdit = !loading && member !== null && member.app_role !== "Coordinator"` |
| Adding a modal form without a component test | Add `__tests__/components/<page>.test.tsx` asserting all form fields render |
| Not running tests after a lint fix on a modal page | Always run `npm run test:components` — a blank form causes immediate test failures |
| Button with only `border border-gray-300` (no text/bg color) | Always add `text-gray-700 bg-white hover:bg-gray-50` — omitting these makes buttons invisible/faint |

---

## Adding a New Coordinator-Restricted Page
When a new admin page should be read-only for Coordinators:
1. Add URL-level block in `middleware.ts` for write-action paths
2. In the page component, fetch role via `useCurrentMember()` → `/api/me`
3. Derive `canEdit = !memberLoading && member !== null && member.app_role !== "Coordinator"`
4. Gate all action buttons and modals behind `canEdit`
5. Add server-side role validation in the corresponding API route
6. Add a component test in `__tests__/components/` covering: modal form fields render, cancel closes modal, Coordinator sees no Add button

---

## Database Conventions
- `members.app_role` is a PostgreSQL enum: `Admin`, `Coordinator`, `Musician`
- Worship roles (instruments, vocals) live in a separate `roles` table, linked via `member_role_assignments`
- `ROLES` constant in `lib/constants/roles.ts` **must exactly match** `roles.name` values in the DB — the DB is the source of truth
- Always use the **service role key** via `lib/db/members.ts` for server-side member lookups — never the anon key for privileged operations
- Migrations live in `supabase/migrations/` — numbered sequentially (`001_`, `002_`, ...)

---

## Styling Conventions
- All UI uses Tailwind utility classes directly
- Primary button: `px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium`
- Secondary / outline button: `px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50`
- Destructive button: `border-red-300 text-red-600 hover:bg-red-50`
- Form inputs: `w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900`
- Role pills (display): `inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700`
- Role pills (toggle active): `bg-gray-900 text-white border-gray-900`
- Role pills (toggle inactive): `bg-white text-gray-600 border-gray-300 hover:border-gray-500`
- Pagination nav buttons: `px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed`

### ⚠️ CRITICAL — Always specify text color AND background on every button

**Every button MUST have an explicit `text-{color}` AND `bg-{color}` class.** Omitting either causes the button to render nearly invisible (browser default colors vary by OS/theme).

| Button type | Required classes |
|-------------|-----------------|
| Primary | `bg-gray-900 text-white hover:bg-gray-800` |
| Secondary/outline | `bg-white text-gray-700 border border-gray-300 hover:bg-gray-50` |
| Pagination Prev/Next | `bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed` |
| Destructive | `bg-white text-red-600 border border-red-300 hover:bg-red-50` |
| Disabled state | Always add `disabled:opacity-40 disabled:cursor-not-allowed` — never rely on browser default dimming |

**This is a recurring bug:** pagination and secondary-action buttons coded with only `border border-gray-300` (no `text-` or `bg-`) appear invisible/faint in production. **Always follow the full class pattern above.**
