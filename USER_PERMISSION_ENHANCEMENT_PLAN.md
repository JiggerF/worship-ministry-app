# User Permission Enhancement Plan

**Date:** 2026-08-25
**Status:** Draft — awaiting review
**Scope:** Audit + recommendation (no code changes)

---

## 1. Current State

The app has 5 hardcoded roles: `Admin`, `Coordinator`, `WorshipLeader`, `MusicCoordinator`, `Musician`. Permissions are enforced at three layers:

| Layer | Where | Mechanism |
|-------|-------|-----------|
| Sidebar nav | `admin/layout.tsx` | Hides Settings + Audit for non-Admin |
| Middleware | `middleware.ts` | Blocks URL patterns per role |
| API routes | `api/members/route.ts` etc. | Returns 403 based on `actor.role` |

### What each role can do today

| Capability | Admin | Coordinator | WorshipLeader | MusicCoordinator | Musician |
|-----------|-------|-------------|---------------|------------------|----------|
| View admin tabs | All 12 | 10 (no Settings/Audit) | 10 | 10 | None |
| Add/edit members | Yes | No | Yes | Yes | No |
| Delete members | Yes | No | No | No | No |
| Add/delete songs | Yes | Yes | No | No | No |
| Edit songs | Yes | Yes | No | Edit only | No |
| Manage roster | Yes | Yes | Yes | No | No |

---

## 2. The Problem

**The admin pain point:** "I want to give UserX access to do Thing Y, but their role doesn't allow it and no role matches what I need."

Examples:
- Give a Coordinator write access to Songs but not People — impossible
- Hide the People tab from a specific WorshipLeader — impossible
- Let a Musician view (but not edit) the Roster page — impossible without promoting them

**This is not theoretical.** Two per-user exceptions already exist today, managed through ad-hoc code or manual workarounds:
1. A WorshipLeader granted EDIT access to **Team Handbook** (role default: no write)
2. A WorshipLeader granted EDIT access to **Song Health** (role default: no write)

These prove the hardcoded role map alone is insufficient — the system needs per-user overrides as a core feature, not a deferred nice-to-have.

**Root cause:** Permission checks are scattered as role string comparisons (`member.app_role !== "Coordinator"`) across ~15 files. There is no single place that defines what each role can do. Changing a role's capabilities requires editing middleware, page components, and API routes.

---

## 3. What We Considered and Rejected

### Full RBAC/ABAC System (4-iteration plan)

An earlier assessment proposed:
1. DB-driven permission matrix table
2. Per-user permission overrides table
3. Custom role creation UI
4. Tab visibility as a permission resource

**Why we rejected it:**

- **Over-engineered for scale.** This app serves 10-50 users in a church team. A dynamic permission engine solves a problem we don't have.
- **UX burden.** A permission matrix grid with per-user overrides will confuse non-technical worship pastors. "Coordinators can read People" is understandable; a checkbox grid is not.
- **Security regression risk.** Migrating from simple string checks to DB lookups creates a transitional period where some routes use old logic and some use new logic — that's where permission bugs live.
- **Performance cost.** Every `canEdit` check currently costs zero (string comparison). A DB-driven system requires queries or a cache layer with invalidation logic.
- **Testing explosion.** 5 roles x N resources is testable. 5 roles x N resources x per-user overrides is combinatorial.

---

## 4. Recommended Approach: Centralized Permission Map

**One refactor that delivers 80% of the value with near-zero risk.**

### What changes

Create a single `src/lib/permissions.ts` module with a hardcoded permission map:

```typescript
type Resource = "people" | "songs" | "roster" | "setlist" | "availability"
              | "recordings" | "handbook" | "settings" | "audit" | "health";
type Action = "view" | "write" | "delete";

const PERMISSION_MAP: Record<AppRole, Partial<Record<Resource, Action[]>>> = {
  Admin:            { /* all resources, all actions */ },
  Coordinator:      { people: ["view"], songs: ["view", "write", "delete"], roster: ["view", "write", "delete"], /* ... */ },
  WorshipLeader:    { roster: ["view", "write"], songs: ["view"], /* ... */ },
  MusicCoordinator: { songs: ["view", "write"], /* ... */ },
  Musician:         { },
};

export function hasPermission(role: AppRole | null, resource: Resource, action: Action): boolean {
  if (!role) return false;
  return PERMISSION_MAP[role]?.[resource]?.includes(action) ?? false;
}
```

Then replace every scattered check like `member.app_role !== "Coordinator"` with `hasPermission(member.app_role, "people", "write")`.

### What this gives you

- **Single source of truth.** One file defines all permissions. Changing what a Coordinator can do is a one-line edit.
- **Zero database changes.** No migration, no new tables, no cache invalidation.
- **Fully testable.** One unit test file covers every role-resource-action combination.
- **Multi-tenant compatible.** The tenant-scoped role from `organization_members.app_role` feeds into the same function.
- **Readable.** Any developer (or an admin reading the source) can see the full permission matrix at a glance.

### What this does NOT give you

- Custom role creation via UI
- Admin-configurable tab visibility via UI

These are not needed at current scale.

---

## 5. Per-User Permission Overrides (Required)

Two real users already have per-user exceptions that the role map cannot express:
1. **WorshipLeader A** — granted `handbook.write` (role default: no write)
2. **WorshipLeader B** — granted `health.write` (role default: no write)

This makes per-user overrides a core requirement, not a future enhancement.

### Design

Add a `permission_overrides` JSONB column to the `members` table (or `organization_members` in multi-tenant mode):

```jsonc
// Example: WorshipLeader with handbook edit override
{
  "handbook": ["view", "write"],
  "health": ["view", "write"]
}
```

Modify `hasPermission()` to check overrides first:

```typescript
export function hasPermission(
  role: AppRole | null,
  resource: Resource,
  action: Action,
  overrides?: Partial<Record<Resource, Action[]>> | null
): boolean {
  if (!role) return false;
  // Per-user override takes precedence
  if (overrides?.[resource]) {
    return overrides[resource]!.includes(action);
  }
  // Fall back to role defaults
  return PERMISSION_MAP[role]?.[resource]?.includes(action) ?? false;
}
```

### Admin UX for overrides

On the People page edit modal, below the role dropdown:

- A collapsible "Custom Permissions" section (collapsed by default)
- Shows the role's default permissions as read-only checkmarks
- Admin can toggle individual resource-action pairs to grant or revoke
- Overrides are visually distinct (e.g., highlighted or badged) so the admin knows this user differs from their role default
- When a user has overrides, show a small indicator on their row in the People list (e.g., "Custom" badge)

### What this does NOT include

- **No override revocation UI complexity.** Setting an override to match the role default simply removes that key from the JSONB — the role map takes over again.
- **No custom role creation.** The 5 built-in roles remain. Overrides handle the edge cases.
- **No DB-driven role permission table.** The role map stays in code. Only per-user exceptions live in the DB.

---

## 6. Implementation Steps

### Step 1 — Create `src/lib/permissions.ts`
- Define the `Resource`, `Action`, and `PERMISSION_MAP` types
- Export `hasPermission(role, resource, action)` and convenience helpers like `canView()`, `canEdit()`, `canDelete()`
- Write unit tests covering every role-resource-action cell

### Step 2 — Add `permission_overrides` column
- Add JSONB column to `members` (single-tenant) and `organization_members` (multi-tenant)
- Migrate the 2 existing per-user exceptions into the column
- Migration: `supabase/migrations/XXX_add_permission_overrides.sql`

### Step 3 — Update `/api/me` response
- Include computed permissions (role defaults merged with overrides) in the response
- Example: `{ member: {...}, permissions: { people: ["view"], songs: ["view", "write"], handbook: ["view", "write"] } }`
- Client components consume `permissions` directly — no need to import the permission map

### Step 4 — Replace scattered role checks
- **Middleware:** Replace role string arrays with `hasPermission()` calls
- **Page components:** Replace inline `canEdit` derivations with permissions from `/api/me` response
- **API routes:** Replace `actor.role === "Coordinator"` guards with `hasPermission(actor.role, resource, action, actor.overrides)`
- Migrate one file at a time; run `npm run test` after each

### Step 5 — Update sidebar nav filtering
- Replace `RESTRICTED_NAV_HIDDEN` array with `hasPermission(role, tabResource, "view")`
- Tab visibility is now governed by the same permission map as everything else

### Step 6 — Update People page edit modal
- Add collapsible "Custom Permissions" section below role dropdown
- Show role defaults as read-only; allow admin to toggle overrides
- Show "Custom" badge on member rows that have overrides
- Persist overrides to `permission_overrides` JSONB column on save

### Step 7 — Update People page role assignment UX
- Show a description next to each role in the dropdown explaining what it grants
- Example: "Coordinator — Can manage roster and songs. Read-only access to People."

---

## 7. TLDR per Step

| Step | What you get | Risk | Impact |
|------|-------------|------|--------|
| **1. Create `permissions.ts`** | Single file defines what every role can do. No more hunting through 15 files to understand or change permissions. | Low — no behavior change, just a new module with tests. | Foundation for everything else. |
| **2. Add `permission_overrides` column** | DB migration adds JSONB column. Your 2 existing per-user exceptions get migrated into it. | Low — additive column, no existing data affected. Needs careful migration script. | Unblocks per-user overrides. No UI yet. |
| **3. Update `/api/me` response** | Client gets a flat `permissions` object (role defaults merged with overrides). Pages stop needing to know role logic. | Medium — every page consuming `/api/me` needs to handle the new shape. Ship behind backward-compatible response (add field, don't remove `app_role`). | Decouples frontend from role names. |
| **4. Replace scattered role checks** | All `app_role !== "Coordinator"` checks become `hasPermission()` calls. One grep confirms no stragglers. | **Highest risk step.** Half-migrated state can create permission gaps. Migrate one file at a time with tests after each. | Eliminates the core code smell. After this, changing what a role can do is a one-line edit. |
| **5. Sidebar nav uses permission map** | Tab visibility governed by the same system as everything else. A user with a `handbook.view` override sees the Handbook tab even if their role wouldn't show it. | Low — small change in `layout.tsx`. | Your 2 override users automatically see the right tabs. |
| **6. "Custom Permissions" UI in People modal** | Admin clicks edit on a member, expands "Custom Permissions", toggles individual resource access. Overrides saved to DB. "Custom" badge on member rows. | Medium — new UI surface area. Risk of admin misconfiguration. Mitigate with "Reset to defaults" button and clear visual diff. | **This is the step that solves your original pain point.** No more asking a developer to grant per-user access. |
| **7. Role descriptions in dropdown** | Each role in the dropdown shows what it grants (e.g., "Coordinator — Roster + Songs, read-only People"). | Low — copy change only. | Admins stop guessing what each role means. |

---

## 8. Recommended Shipping Order

Ship in 3 PRs to minimize risk and get value incrementally:

### PR 1 — Foundation (Steps 1 + 2 + 3)

Deliver together as one PR. Creates `permissions.ts`, adds the DB column, updates `/api/me`. No visible behavior change — existing role checks still work alongside the new system. This is the safe groundwork.

**Validates:** permission map matches current behavior, `/api/me` returns correct computed permissions, 2 existing overrides load correctly.

### PR 2 — Migration (Step 4, one file per commit)

The highest-risk step gets its own PR. Replace scattered role string checks with `hasPermission()` calls. One file per commit so any regression is instantly bisectable.

**Validates:** `grep -r "app_role.*Coordinator" src/` returns zero hits outside `permissions.ts` and type definitions. All existing tests pass.

### PR 3 — UI Improvements (Steps 5 + 6 + 7)

Ship together. Sidebar nav uses the permission map, People modal gets the "Custom Permissions" section, role dropdown gets descriptions. This is where admins see the payoff.

**Validates:** override users see correct tabs, admin can grant/revoke per-user permissions from the UI, "Custom" badge visible on member rows.

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Half-migrated state during Step 3 | Migrate one file at a time with tests. Old checks and new checks produce the same results until the map is intentionally changed. |
| Permission map doesn't match current behavior | Write the map to exactly match current behavior first. Verify with existing tests. Adjust permissions only after migration is complete. |
| `/api/me` response size grows | Permissions object is small (~20 key-value pairs). No concern at this scale. |
| Override JSONB column is untyped at DB level | Validate shape in `hasPermission()` and in the API route that writes overrides. Add a check constraint or validation function in the migration if desired. |
| Admin misconfigures overrides | Show clear visual diff between role defaults and overrides. "Reset to role defaults" button removes all overrides for that user. |

---

## 10. Success Criteria

- [ ] All role string comparisons removed from middleware, pages, and API routes
- [ ] `permissions.ts` is the single source of truth — `grep -r "app_role.*Coordinator" src/` returns zero hits outside of `permissions.ts` and type definitions
- [ ] All existing tests pass without modification (behavior-preserving refactor)
- [ ] Admin can adjust a role's capabilities by editing one file, one object
- [ ] Role dropdown on People page shows human-readable descriptions of what each role grants
- [ ] 2 existing per-user exceptions migrated to `permission_overrides` column
- [ ] People page edit modal has "Custom Permissions" section for overrides
- [ ] Users with overrides show a "Custom" badge in the People list
