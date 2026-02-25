# Music Coordinator — MVP 1 (IMPLEMENTED)

> **Status:** MVP 1 complete. All 572 tests passing, lint clean, build succeeds.

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

### Songs Permission Matrix (implemented)

| Action | Admin | Coordinator | MusicCoordinator | WorshipLeader |
|--------|-------|-------------|------------------|---------------|
| View songs | Yes | Yes | Yes | Yes |
| Edit existing song | Yes | Yes | Yes | No |
| Add new song | Yes | Yes | No | No |
| Delete song | Yes | Yes | No | No |

### Setlist Permission Matrix (implemented)

| Scenario | Admin | Coordinator | MusicCoordinator | WorshipLeader |
|----------|-------|-------------|------------------|---------------|
| Edit any Sunday's setlist | Yes | Yes | No | No |
| Edit setlist when assigned as worship lead | Yes | Yes | Yes | Yes |
| Edit setlist when NOT assigned | Yes | Yes | No (amber banner) | No (amber banner) |

### What MusicCoordinator CAN do on Songs

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

## MVP 1 — What Was Implemented

### 1. Middleware — tiered song URL blocks

**File:** `src/middleware.ts` (lines 221–239)

Coordinator skips song blocks entirely (full access). MusicCoordinator is blocked from `add|delete` but allowed `edit`. WorshipLeader is fully blocked from all write actions.

```typescript
// Block write-action URL patterns on songs
// Coordinator has full songs access (add/edit/delete) — skip song blocks
// MusicCoordinator can edit songs but not add/delete
// WorshipLeader is fully blocked from song write actions
if (path.startsWith("/admin/songs") && member.app_role !== "Coordinator") {
  const isMusicCoordinator = member.app_role === "MusicCoordinator";
  if (isMusicCoordinator && /add|delete/.test(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = path.replace(/(add|delete).*/, "");
    redirectUrl.searchParams.set("reason", "readonly");
    return NextResponse.redirect(redirectUrl);
  }
  if (!isMusicCoordinator && /add|edit|delete/.test(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = path.replace(/(add|edit|delete).*/, "");
    redirectUrl.searchParams.set("reason", "readonly");
    return NextResponse.redirect(redirectUrl);
  }
}
```

### 2. Songs page — split `canEdit` into granular permissions

**File:** `src/app/admin/songs/page.tsx` (lines 55–61)

```typescript
// canEditSong: can edit existing songs (Admin + Coordinator + MusicCoordinator)
const canEditSong = !memberLoading && member !== null &&
  member.app_role !== "WorshipLeader";

// canAddDeleteSong: can add new or delete songs (Admin + Coordinator)
const canAddDeleteSong = !memberLoading && member !== null &&
  member.app_role !== "WorshipLeader" &&
  member.app_role !== "MusicCoordinator";
```

**Gate mapping (as implemented):**

| UI Element | Gate |
|---|---|
| `+ Add Song` button | `canAddDeleteSong` |
| Per-row `Edit` button | `canEditSong` |
| Per-row `Delete` button | `canAddDeleteSong` |
| Edit/Add modal render | `isEditOpen && canEditSong` |
| `openAdd()` guard | `if (!canAddDeleteSong) return` |
| `openEdit()` guard | `if (!canEditSong) return` |
| `saveSong()` guard | `if (!canEditSong) return` |

### 3. API routes — server-side role enforcement

All three song mutation routes now use `getActorFromRequest()` (JWT-based, service role key lookup) instead of the old unreliable `x-app-role` header. The actor from the auth check is reused for audit logging (no duplicate `getActorFromRequest` calls).

#### `POST /api/songs` (create) — `src/app/api/songs/route.ts` (lines 32–38)

```typescript
const SONG_CREATE_ROLES = ["Admin", "Coordinator"];
const actor = await getActorFromRequest(req);
if (!actor || !SONG_CREATE_ROLES.includes(actor.role)) {
  return NextResponse.json({ error: "Not authorized to create songs" }, { status: 403 });
}
```

#### `PATCH /api/songs/[id]` (update) — `src/app/api/songs/[id]/route.ts` (lines 17–22)

```typescript
const SONG_EDIT_ROLES = ["Admin", "Coordinator", "MusicCoordinator"];
const actor = await getActorFromRequest(req);
if (!actor || !SONG_EDIT_ROLES.includes(actor.role)) {
  return NextResponse.json({ error: "Not authorized to edit songs" }, { status: 403 });
}
```

#### `DELETE /api/songs/[id]` (delete) — `src/app/api/songs/[id]/route.ts` (lines 79–83)

```typescript
const SONG_DELETE_ROLES = ["Admin", "Coordinator"];
const actor = await getActorFromRequest(req);
if (!actor || !SONG_DELETE_ROLES.includes(actor.role)) {
  return NextResponse.json({ error: "Not authorized to delete songs" }, { status: 403 });
}
```

### 4. Setlist page — MusicCoordinator worship-lead gating

**File:** `src/app/admin/setlist/page.tsx` (lines 796–817)

MusicCoordinator follows the same worship-lead check as WorshipLeader — can only edit the setlist on Sundays where they are the assigned worship lead.

```typescript
const isWorshipLeadRole =
  currentMember?.app_role === "WorshipLeader" ||
  currentMember?.app_role === "MusicCoordinator";

const canEdit =
  !memberLoading &&
  currentMember !== null &&
  (currentMember.app_role === "Admin" ||
    currentMember.app_role === "Coordinator" ||
    (isWorshipLeadRole &&
      currentMember.id === worshipLeadMemberId));

const isViewOnlyWL =
  !memberLoading &&
  isWorshipLeadRole &&
  !canEdit;
```

When `isViewOnlyWL` is true, an amber banner is shown: "You can only edit the setlist for Sundays where you are the assigned worship lead."

---

## File Change Map

```
src/
  middleware.ts                    ← tiered songs URL block (Coordinator skips, MC blocks add/delete, WL fully blocked)
  app/
    admin/
      songs/page.tsx              ← split canEdit → canEditSong + canAddDeleteSong
      setlist/page.tsx            ← MusicCoordinator worship-lead gating (same as WorshipLeader)
    api/
      songs/
        route.ts                  ← POST: Admin + Coordinator only (getActorFromRequest)
        [id]/
          route.ts                ← PATCH: Admin + Coordinator + MusicCoordinator
                                     DELETE: Admin + Coordinator only

__tests__/
  components/
    songs-page.test.tsx           ← NEW: role-based button visibility (Admin, Coordinator, MC, WL, loading)
    setlist-page.test.tsx         ← UPDATED: added MC fixtures + 3 tests (assigned, non-assigned, amber notice)
  integration/
    songs-route.test.ts           ← UPDATED: POST auth tests (Coordinator allowed, MC/WL blocked)
    songs-id-route.test.ts        ← UPDATED: PATCH/DELETE auth tests per role
    songs-route-audit.test.ts     ← UPDATED: fixed test isolation + updated denied role test
```

**No new migrations. No type changes. No layout changes.**

---

## Test Coverage (572 tests, 29 files, all passing)

### Component Tests — `__tests__/components/songs-page.test.tsx`

| Test | Assertion |
|------|-----------|
| Admin sees Add Song, Edit, Delete | All three buttons present |
| Coordinator sees Add Song, Edit, Delete | All three buttons present (full songs access) |
| MusicCoordinator sees Edit only | Edit present, Add Song + Delete absent |
| WorshipLeader sees no action buttons | All three buttons absent |
| Loading state shows no buttons | Restrictive default while `/api/me` pending |

### Component Tests — `__tests__/components/setlist-page.test.tsx` (new MC tests)

| Test | Assertion |
|------|-----------|
| Assigned MC sees action buttons | Can edit setlist when worship lead |
| Non-assigned MC sees amber notice | Shows "view-only" banner |
| Non-assigned MC sees no action buttons | Cannot edit others' setlists |

### Integration Tests — `__tests__/integration/songs-route.test.ts`

| Test | Expected |
|------|----------|
| POST as Admin | 200 |
| POST as Coordinator | 200 |
| POST as MusicCoordinator | 403 |
| POST as WorshipLeader | 403 |
| POST unauthenticated | 403 |

### Integration Tests — `__tests__/integration/songs-id-route.test.ts`

| Test | PATCH | DELETE |
|------|-------|--------|
| Admin | 200 | 200 |
| Coordinator | 200 | 200 |
| MusicCoordinator | 200 | 403 |
| WorshipLeader | 403 | 403 |
| Unauthenticated | 403 | 403 |

### Audit Tests — `__tests__/integration/songs-route-audit.test.ts`

- Audit log fires on successful POST/PATCH/DELETE
- Audit log NOT fired on 403, 400, 500, or null actor
- Test isolation fix: `mockQuery.then` reset in `beforeEach` to clear stale `mockImplementationOnce` queue

---

## Bugs Fixed During MVP 1

### Bug: Coordinator lost songs access
**Symptom:** Coordinator could no longer add/edit/delete songs after initial MVP 1 implementation.
**Root cause:** Initial plan incorrectly excluded Coordinator from `canEditSong`, `canAddDeleteSong`, and all API role arrays.
**Fix:** Removed Coordinator from all exclusion lists. Added to `SONG_CREATE_ROLES`, `SONG_EDIT_ROLES`, `SONG_DELETE_ROLES`. Coordinator now skips middleware song blocks entirely.

### Bug: MusicCoordinator had unrestricted setlist access
**Symptom:** MusicCoordinator could edit setlists for ALL Sundays, not just when assigned as worship lead.
**Root cause:** Setlist page `canEdit` treated MusicCoordinator like Admin/Coordinator (unconditional edit access).
**Fix:** Added `isWorshipLeadRole` helper combining WorshipLeader + MusicCoordinator. Both now require `currentMember.id === worshipLeadMemberId` to edit.

---

## Open Questions / Future Work (MVP 2+)

- **Field-level restrictions:** Should MusicCoordinator be blocked from changing song `status`? Currently all edit fields are open. Can restrict specific fields later if needed.
- **Audit log:** Song edits by MusicCoordinator are logged via existing audit infrastructure (`getActorFromRequest` + `createAuditLogEntry` in PATCH route). No additional audit work needed.
- **MusicCoordinator-specific features:** Potential future work — bulk chord chart uploads, song status workflow (draft → review → published), notification to Coordinator when songs are edited.
