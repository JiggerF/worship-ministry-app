# Setlist MVP1 — Implementation Slice

**Branch:** `worship-leader-mvp1`
**Status:** ✅ Complete — 420/420 tests passing, clean `tsc --noEmit`
**Scope:** Admin setlist management page for Worship Coordinators, Worship Leaders, and Music Coordinators.

---

## What Was Built

A full setlist management page at `/admin/setlist` that allows authorised users to:
- Select an upcoming Sunday from a dropdown (next 8 Sundays)
- View, add, reorder, and remove songs from a 3-slot setlist
- Change the key for any song
- Finalise (publish) or Revert to Draft a setlist
- See who is assigned as Worship Lead for that Sunday
- Enforce per-role edit permissions (read-only for non-assigned Worship Leaders)

---

## Files Changed

### Modified
| File | Change |
|------|--------|
| `src/app/admin/setlist/page.tsx` | Primary implementation — all logic lives here (single-file page) |

### Created
| File | Change |
|------|--------|
| `__tests__/components/setlist-page.test.tsx` | 40 component tests locking in all functionality |

### No new API routes or DB migrations required
All data access uses existing endpoints:
- `GET /api/setlist?date=YYYY-MM-DD`
- `POST /api/setlist` (upsert — create, reorder, change key)
- `DELETE /api/setlist/:id`
- `PATCH /api/setlist/:date/publish`
- `PATCH /api/setlist/:date/revert`
- `GET /api/roster?month=YYYY-MM` (used to read the WL assignment)
- `GET /api/songs?scope=portal` (song picker)

---

## Implementation Detail

### `src/app/admin/setlist/page.tsx`

#### Local hooks
```ts
function useCurrentMember(): { member: MemberWithRoles | null; loading: boolean }
// Fetches /api/me — RLS-safe, used to derive canEdit
```

#### Key state
```ts
const [selectedDate, setSelectedDate]         // YYYY-MM-DD, defaults to first upcoming Sunday
const [setlistRows, setSetlistRows]            // SetlistSongWithDetails[] from /api/setlist
const [worshipLeadName, setWorshipLeadName]    // string | null — displayed in card header
const [worshipLeadMemberId, setWorshipLeadMemberId] // string | null — used for WL canEdit check
const [draggedId, setDraggedId]               // drag-and-drop source row id
const [dragOverId, setDragOverId]             // drag-and-drop target row id
const [reordering, setReordering]             // true while POST reorder is in-flight
```

#### Permission logic
```ts
const canEdit =
  !memberLoading &&
  currentMember !== null &&
  (currentMember.app_role === "Admin" ||
    currentMember.app_role === "Coordinator" ||
    currentMember.app_role === "MusicCoordinator" ||
    (currentMember.app_role === "WorshipLeader" &&
      currentMember.id === worshipLeadMemberId));

const isViewOnlyWL =
  !memberLoading &&
  currentMember?.app_role === "WorshipLeader" &&
  !canEdit;
```
- Default is **restrictive** (`false`) while `/api/me` is loading — no buttons ever flash on.
- A WL with no roster assignment for that date is also read-only (because `worshipLeadMemberId` is `null` ≠ their id).

#### Drag-to-reorder
```ts
const displayRows = useMemo(...)  // live splice-swap preview during drag (no DB call)
async function handleReorder(newOrder)  // batches POST upserts, then re-fetches
```
- `draggable` attribute is set only when `canEdit && !isEditingKey`.
- `reordering: true` disables all action buttons (Clear all, Finalise, Revert) during the save.

#### Publish/Revert
- **Finalise** button: disabled when `sortedRows.length === 0` OR `isPublished` is already true.
- **Clear all** button: disabled when `isPublished` — user must Revert to Draft first.
- **Revert to Draft**: shown in place of Finalise when `isPublished`.
- Button row is entirely hidden when `canEdit === false`.

#### Position badges
Position number badges were **removed** from song rows. Order is communicated solely through visual position in the list + the drag handle. Empty slot placeholders also do not show position numbers.

---

## Role Behaviour Matrix

| Role | Can edit? | Empty slots visible? | Add songs visible? | Action buttons? | Drag handles? |
|------|-----------|---------------------|--------------------|-----------------|---------------|
| Admin | ✅ Always | ✅ | ✅ | ✅ | ✅ |
| MusicCoordinator | ✅ Always | ✅ | ✅ | ✅ | ✅ |
| Coordinator | ✅ Always | ✅ | ✅ | ✅ | ✅ |
| WorshipLeader (assigned) | ✅ | ✅ | ✅ | ✅ | ✅ |
| WorshipLeader (not assigned) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Musician | — | — | — | — | — (no admin access) |

**Amber notice** shown to non-assigned WL:
> "You are not the Worship Lead for this Sunday. View only."

---

## How to Run

```bash
# Dev server (with dev_auth=1 bypass)
npm run dev

# Dev server with real Supabase auth (test Coordinator/WL restrictions)
npm run dev:real-auth

# Run all tests
npm run test

# Run only setlist component tests
npx vitest run __tests__/components/setlist-page.test.tsx

# Type check
npx tsc --noEmit
```

Navigate to `/admin/setlist` after login.

---

## How Tests Work

**Test file:** `__tests__/components/setlist-page.test.tsx`

- 40 tests across 8 describe blocks
- No fake timers — `computeFirstUpcomingSunday()` mirrors the page's own logic so tests stay correct on any calendar date
- `fetch` is fully mocked — no Supabase connection required

**Describe blocks:**
| Block | Tests |
|-------|-------|
| Initial render | Heading, Sunday selector, 8 options |
| Admin, empty setlist | Empty slots, Add button, Finalise disabled, no Clear all |
| Admin, filled setlist | Song rows, no position badges, drag handles, Clear all, Finalise enabled, Change Key, remove buttons, slot counter |
| Published setlist | Revert to Draft, LOCKED badge, no Finalise, Clear all disabled |
| Worship Lead permission guard | Assigned WL sees controls; non-assigned WL sees notice + all controls hidden |
| Coordinator | Always sees Finalise, never sees amber notice |
| WL display in card header | Name shown when assigned, absent when not |
| Song Picker Modal | Opens, Cancel closes, search/filter present, confirm disabled until pick |

---

## Known Issues / Limitations

1. **Setlist is capped at 3 songs** — hardcoded. If the team ever needs 4+ songs per Sunday, `freeSlots = 3 - setlistRows.length` and the position logic in `handleAddSongs` both need updating.

2. **Position badge removed but `row.position` still stored in DB** — after a reorder the position updates correctly, but if a drag is in progress and the component unmounts (e.g. date change), the optimistic `displayRows` reorder is discarded and the DB is not updated. Unlikely in real use but worth noting.

3. **`POST /api/setlist` upsert resets status to DRAFT** — changing a key on a published setlist silently reverts it to DRAFT. There is no warning to the user before it happens. A future improvement would be to show a confirmation: "Editing a finalised setlist will revert it to Draft. Continue?".

4. **No WL notification when setlist is published** — musicians and the assigned WL are not notified when a setlist moves from DRAFT → PUBLISHED. This is a planned future feature (Magic Link / Notification system per `docs/MAGIC_LINK_NOTIFICATIONS.md`).

5. **No setlist audit logging** — setlist mutations (`POST /api/setlist`, publish, revert) are not instrumented with `createAuditLogEntry`. The roster and songs routes were wired up in a separate fix, but the setlist-specific audit actions are not yet defined in `AuditAction` and not yet captured.

6. **Roster fetch to get WL name uses full month data** — `GET /api/roster?month=YYYY-MM` fetches all assignments for the month just to extract the worship_lead for one date. A dedicated lightweight endpoint would be more efficient at scale.

---

## Next Steps

### Immediate (MVP 1 polish)
- [ ] Warn user before key-change if setlist is already published ("This will revert to Draft")
- [ ] Add setlist audit actions to `AuditAction` type: `publish_setlist`, `revert_setlist`, `update_setlist_song`
- [ ] Wire `createAuditLogEntry` into the setlist API routes (`POST`, `PATCH .../publish`, `PATCH .../revert`)

### MVP 2 — Musician-facing portal setlist view
- [ ] Show published setlist on `portal/roster` `SundayCard` when `isPublished`
- [ ] Gate: show "Setlist not yet published" placeholder when in DRAFT
- [ ] Display: song title, artist, key of, YouTube link per row
- [ ] Reference: `src/app/portal/` and `src/components/sunday-card.tsx`

### MVP 3 — Setlist print/PDF view
- [ ] Route: `/portal/print/[date]` or `/admin/setlist/[date]/print`
- [ ] Content: song list with chosen keys, chord chart PDF links
- [ ] Reuse `GET /api/setlist?date=` already available

### MVP 4 — Extended setlist metadata
- [ ] Notes per song (transitions, special instructions)
- [ ] Hymn/liturgy slot types beyond just songs
- [ ] More than 3 song slots (parameterise `MAX_SONGS`)
