# Worship Coordinator Persona — Implementation Plan

## Role Definition

**Worship Coordinator**: Trusted team member with elevated permissions above a regular musician, focused on managing the team roster and scheduling. Not an admin and has limited access to sensitive or disruptive actions.

### Permissions
- **Login:** Can log in to the app.
- **People Page:** View all members (read-only). Cannot add, edit, delete, or deactivate members.
- **Settings Page:** No access.
- **Roster Page:** Full access—can view, assign members, save drafts, and publish rosters (same as admin for this page only).
- **Songs Page:** Read-only access. Can view songs and details but cannot add, edit, or delete songs.
- **Other Admin Features:** No access.

**Purpose:**
Empower the Worship Coordinator to manage and publish team rosters without the risk of altering people data, settings, or song content. This ensures smooth scheduling while maintaining data integrity and security.

---

## Implementation Plan

### Phase 1 — Database
- Add 'Coordinator' to the `app_role` enum in Supabase.

### Phase 2 — TypeScript Types
- Add 'Coordinator' to `AppRole` in `src/lib/types/database.ts`.

### Phase 3 — Middleware
- Allow both Admin and Coordinator into `/admin/**`.
- Add route-level blocking for Coordinator:
  - Block `/admin/settings` (redirect to `/admin/roster`)
  - Allow `/admin/dashboard`, `/admin/people` (read), `/admin/roster`, `/admin/songs` (read)

### Phase 4 — Admin Layout & Navigation
- Read current user's `app_role` from session/DB.
- Hide 'Settings' nav item for Coordinators.

### Phase 5 — Page-level Guards
| Page                | Admin | Coordinator |
|---------------------|-------|-------------|
| /admin/dashboard    | Full  | Full        |
| /admin/people       | Full  | Read-only   |
| /admin/roster       | Full  | Full        |
| /admin/songs        | Full  | Read-only   |
| /admin/settings     | Full  | Blocked     |

- Each affected page will check `app_role` and conditionally hide write action buttons/forms.

### Phase 6 — API Route Protection
- Add server-side role check to write endpoints (POST/PUT/PATCH/DELETE).
- Coordinator can only call read (GET) endpoints for people and songs.
- All roster write endpoints remain open to Coordinator.

### Phase 7 — Seed / Test User
- Add a test Coordinator user in `supabase/seed.sql` for local testing.

### Order of Work
1. Migration (Phase 1)
2. Types update (Phase 2)
3. Middleware (Phase 3)
4. Layout + nav (Phase 4)
5. Pages (Phase 5)
6. API protection (Phase 6)
7. Seed user (Phase 7)

---

## Local Testing Plan

### 1. Create a Coordinator User in Supabase
- Go to your Supabase dashboard.
- Add a new user (email/password or magic link).
- In the `members` table, set `app_role` to `Coordinator` for this user and ensure `is_active` is true.

### 2. Login as Coordinator
- Use the app’s login flow with the Coordinator’s credentials.

### 3. Test Access
- **People Page:** Should be read-only (no add/edit/delete).
- **Settings Page:** Should be inaccessible (redirect or hidden).
- **Roster Page:** Should allow full management (assign, draft, publish).
- **Songs Page:** Should be read-only.
- **Other Admin Features:** Should be inaccessible.

### 4. Try Restricted Actions
- Attempt to access restricted pages directly via URL.
- Attempt to perform restricted actions (e.g., POST/PUT/DELETE via UI or API).

### 5. Verify UI
- Ensure restricted buttons/links are hidden or disabled for Coordinator.

### 6. Check API Security
- Confirm that API endpoints also enforce Coordinator restrictions (not just UI).
