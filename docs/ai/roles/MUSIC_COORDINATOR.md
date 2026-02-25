# Music Coordinator — Implementation Plan

## Overview

The **Music Coordinator** (`MusicCoordinator`) sits between the Worship Coordinator (`Coordinator`) and Worship Leader (`WorshipLeader`) in the permission hierarchy. He logs in via `/admin/login` and shares the same base permissions as `WorshipLeader` with one key difference: **edit access on the Songs page**.

### Permission Hierarchy

```
Admin            — full access everywhere
Coordinator      — full roster, full songs (add/edit/delete), read-only people, no settings/audit
MusicCoordinator — same as WorshipLeader + can EDIT songs (not add/delete)
WorshipLeader    — read-only roster/people/songs, setlist management (own Sundays only)
Musician         — no admin access
```

### What MusicCoordinator CAN do on Songs (new)

- Edit existing song info (title, artist, status, category, keys, scripture, youtube URL)
- Upload/change chord chart links on existing songs
- All fields in the edit modal are available

### What MusicCoordinator CANNOT do on Songs

- Add new songs (+ Add Song button hidden)
- Delete songs (Delete button hidden)

### Unchanged from WorshipLeader

- Login via `/admin/login` → redirects to `/admin/roster`
- Roster page: read-only (no member assignment controls)
- People page: read-only (no add/edit/delete members)
- Settings page: blocked (redirected)
- Audit page: blocked (redirected)
- Setlist: can only edit on Sundays where they are the assigned worship lead (same as WorshipLeader)

---

## Current State Audit

| Area | Current MusicCoordinator Treatment | Change Needed |
|---|---|---|
| `AppRole` type | Already includes `"MusicCoordinator"` | None |
| DB enum `app_role` | Already contains `MusicCoordinator` (migration 006) | None |
| Middleware `ALLOWED_ROLES` | Already includes `MusicCoordinator` | None |
| Middleware `RESTRICTED_ROLES` | Blocks `add\|edit\|delete` on `/admin/songs/**` | Allow `edit` for MusicCoordinator |
| Admin layout nav | Settings + Audit hidden for MusicCoordinator | None |
| Songs page `canEdit` | `false` for MusicCoordinator (fully read-only) | Split into `canEditSong` + `canAddDeleteSong` |
| Songs page — Edit button | Hidden for MusicCoordinator | Show for MusicCoordinator |
| Songs page — Add Song button | Hidden for MusicCoordinator | Keep hidden |
| Songs page — Delete button | Hidden for MusicCoordinator | Keep hidden |
| Songs page — Edit modal | Blocked for MusicCoordinator | Allow for MusicCoordinator |
| `POST /api/songs` | Only blocks `Coordinator` by name | Also block `MusicCoordinator` + `WorshipLeader` |
| `PATCH /api/songs/[id]` | No role check at all | Allow `Admin`, `Coordinator`, `MusicCoordinator`; block others |
| `DELETE /api/songs/[id]` | No role check at all | Block `MusicCoordinator`, `WorshipLeader`, `Coordinator` |
| People page | Read-only for MusicCoordinator | None |
| Roster page | Read-only for MusicCoordinator | None |
| Login redirect | `/admin/roster` | None |

---

## MVP 1 — Music Coordinator Song Edit Permissions

### 1. Middleware — allow edit actions for MusicCoordinator on songs

**File:** `src/middleware.ts`

**Current:** All `RESTRICTED_ROLES` (including MusicCoordinator) are blocked from `/admin/songs/**` matching `add|edit|delete`.

**Change:** Split the songs URL-pattern block so that MusicCoordinator is only blocked from `add` and `delete`, but allowed through for `edit`.

```typescript
// Current (line ~196):
const RESTRICTED_ROLES = ["Coordinator", "WorshipLeader", "MusicCoordinator"] as const;
// ... blocks /admin/songs/** matching add|edit|delete for all three

// New approach:
// 1. Block add|delete on /admin/songs for ALL restricted roles
// 2. Block edit on /admin/songs for Coordinator + WorshipLeader only (NOT MusicCoordinator)
```

### 2. Songs page — split `canEdit` into granular permissions

**File:** `src/app/admin/songs/page.tsx`

**Current `canEdit`** (line 56–59):
```typescript
const canEdit = !memberLoading && member !== null &&
  member.app_role !== "Coordinator" &&
  member.app_role !== "WorshipLeader" &&
  member.app_role !== "MusicCoordinator";
```

**New — two permission booleans:**
```typescript
// Can edit existing songs (Admin + MusicCoordinator)
const canEditSong = !memberLoading && member !== null &&
  member.app_role !== "Coordinator" &&
  member.app_role !== "WorshipLeader";
  // MusicCoordinator is NOT excluded → canEditSong = true

// Can add new songs or delete songs (Admin only, not MusicCoordinator)
const canAddDeleteSong = !memberLoading && member !== null &&
  member.app_role !== "Coordinator" &&
  member.app_role !== "WorshipLeader" &&
  member.app_role !== "MusicCoordinator";
```

**Gate mapping:**

| UI Element | Current Gate | New Gate |
|---|---|---|
| `+ Add Song` button | `canEdit` | `canAddDeleteSong` |
| Per-row `Edit` button | `canEdit` | `canEditSong` |
| Per-row `Delete` button | `canEdit` | `canAddDeleteSong` |
| Edit/Add modal render | `isEditOpen && canEdit` | `isEditOpen && canEditSong` |
| `openAdd()` guard | `if (!canEdit) return` | `if (!canAddDeleteSong) return` |
| `openEdit()` guard | `if (!canEdit) return` | `if (!canEditSong) return` |
| `saveSong()` guard | `if (!canEdit) return` | `if (!canEditSong) return` |
| Modal title | `editing ? "Edit Song" : "Add Song"` | No change (MusicCoordinator will only ever see "Edit Song") |

### 3. API route — server-side role enforcement

#### `POST /api/songs` (create new song)

**File:** `src/app/api/songs/route.ts`

**Current:** Only blocks `Coordinator`. Uses unreliable `x-app-role` header.

**Change:** Use `getActorFromRequest()` to get the real role server-side. Block all roles except `Admin`.

```typescript
export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  if (!actor || !["Admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only Admin can create songs" }, { status: 403 });
  }
  // ... rest unchanged
}
```

> **Note:** `Coordinator` also cannot add songs per the permission matrix. Only `Admin` can add songs.

#### `PATCH /api/songs/[id]` (update existing song)

**File:** `src/app/api/songs/[id]/route.ts`

**Current:** No role check at all.

**Change:** Allow `Admin` and `MusicCoordinator`. Block all others.

```typescript
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const actor = await getActorFromRequest(req);
  const SONG_EDIT_ROLES = ["Admin", "MusicCoordinator"];
  if (!actor || !SONG_EDIT_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Not authorized to edit songs" }, { status: 403 });
  }
  // ... rest unchanged
}
```

#### `DELETE /api/songs/[id]` (delete song)

**File:** `src/app/api/songs/[id]/route.ts`

**Current:** No role check at all.

**Change:** Only allow `Admin`.

```typescript
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const actor = await getActorFromRequest(req);
  if (!actor || actor.role !== "Admin") {
    return NextResponse.json({ error: "Only Admin can delete songs" }, { status: 403 });
  }
  // ... rest unchanged
}
```

---

## File Change Map

```
src/
  middleware.ts                    ← split songs URL block: allow edit for MusicCoordinator
  app/
    admin/
      songs/page.tsx              ← split canEdit → canEditSong + canAddDeleteSong
    api/
      songs/
        route.ts                  ← POST: proper role check (Admin only)
        [id]/
          route.ts                ← PATCH: allow Admin + MusicCoordinator
                                     DELETE: allow Admin only
```

**No new files.** No migrations. No type changes. No layout changes.

---

## Isolation Strategy — Avoiding Regression

1. **Middleware change is narrowing, not broadening:** MusicCoordinator was already allowed into `/admin/**`. We're only removing the URL-level `edit` block for songs — no new route access granted.

2. **Songs page split is safe:** `canAddDeleteSong` has the exact same logic as the old `canEdit`. Only `canEditSong` is more permissive (allows MusicCoordinator). Admin and WorshipLeader behaviour is completely unchanged.

3. **API route changes are additive security:** PATCH and DELETE currently have NO role checks — we're adding checks, not removing them. The only risk is breaking Admin's ability to edit/delete if `getActorFromRequest` fails, but this helper is already used successfully in the audit log paths of the same routes.

4. **POST already had a role check** (for Coordinator) — we're replacing the unreliable header-based check with the proper `getActorFromRequest` helper.

---

## Testing Plan

### Manual Tests

1. **Login as MusicCoordinator** → lands on `/admin/roster`
2. **Songs page:**
   - `+ Add Song` button is hidden
   - Per-row `Edit` button is visible
   - Per-row `Delete` button is hidden
   - Clicking `Edit` opens the edit modal with all fields (title, artist, status, category, keys, scripture, youtube, chord link)
   - Saving edits works (PATCH succeeds)
3. **API security:**
   - `POST /api/songs` as MusicCoordinator → 403
   - `PATCH /api/songs/[id]` as MusicCoordinator → 200
   - `DELETE /api/songs/[id]` as MusicCoordinator → 403
4. **No regression for other roles:**
   - Admin: Add, Edit, Delete all still work
   - WorshipLeader: Songs page is fully read-only (no Edit, no Add, no Delete)
   - Coordinator: Songs page is fully read-only

### Automated Tests

- Update `__tests__/components/songs-page.test.tsx` (if it exists) or create it:
  - MusicCoordinator sees Edit but not Add/Delete
  - Admin sees all three
  - WorshipLeader sees none

---

## Open Questions / Future Work

- **Coordinator song edit:** Currently Coordinator cannot edit songs. If this should change, add `"Coordinator"` to `SONG_EDIT_ROLES` and `canEditSong`.
- **Field-level restrictions:** Should MusicCoordinator be blocked from changing song `status`? Currently all edit fields are open. Can restrict specific fields later if needed.
- **Audit log:** Song edits by MusicCoordinator will be logged via the existing audit infrastructure (same `getActorFromRequest` + `createAuditLogEntry` pattern already in PATCH).
