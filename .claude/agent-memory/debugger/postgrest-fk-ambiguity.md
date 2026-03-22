# PostgREST FK Ambiguity — Detailed Notes

## FAILURE CLASS 13 — PostgREST "more than one relationship was found"

**Symptom:** A Supabase `.select()` call throws an error: "Could not embed because more than one relationship was found for '<table>' and '<referenced_table>'".

**Error location:** The error surfaces in the `error` field returned by `.from(...).select(...)`, and is thrown by a `getX()` DB helper as `Error: getX: Could not embed because more than one relationship was found for 'table' and 'members'`.

**Root cause:** PostgREST's `!inner` / embed syntax (`table:related_table(col1, col2)`) requires an unambiguous FK path. When a table has two or more FK columns that all reference the same target table, PostgREST cannot infer which FK to traverse and raises this error.

**This codebase: `roster` table has two FKs to `members`:**
- `member_id uuid references public.members(id) on delete set null` — `roster_member_id_fkey`
- `assigned_by uuid references public.members(id)` — `roster_assigned_by_fkey`

Both were defined in `supabase/migrations/001_init.sql` lines 48 and 50.

**Disambiguation syntax (two options):**

Option A — column name hint (preferred, shorter, readable):
```typescript
.select("alias:column_name(col1, col2)")
// e.g.:
.select("member:member_id(id, name)")
```

Option B — FK constraint name hint (verbose, fragile — constraint names can change):
```typescript
.select("alias:table!constraint_name(col1, col2)")
// e.g.:
.select("member:members!roster_member_id_fkey(id, name)")
```

**Always use Option A** unless the column name itself is ambiguous (rare).

**Fix applied in this codebase:**
`src/lib/db/recordings.ts` line 36:
```typescript
// Before (ambiguous):
.select("sunday_date:date, member:members(id, name)")

// After (disambiguated by column name):
.select("sunday_date:date, member:member_id(id, name)")
```

**How to spot this pattern in other queries:**
Search for `.select(` calls that use the `alias:table(` embed syntax on any table that has multiple FKs to the same target. Tables at risk in this codebase:
- `roster` — two FKs to `members` (`member_id`, `assigned_by`)
- Check `audit_log` — may have `actor_id` and similar FK columns to `members`

**Verification:**
Run `npx vitest run __tests__/integration/recordings-route.test.ts` — the test mocks the DB helper so it does not test the PostgREST string directly, but confirms no regression in the API route. The actual fix is validated by manual testing (the error disappears at runtime).

**Test coverage gap noted:** There is no DB-layer unit test that runs the actual `.select()` string against a real or mock PostgREST instance. A test against the Supabase local dev instance would catch this class of error automatically.
