---
name: pr-impact-test
description: Analyze a PR diff, map changed files to the exact affected test suites, run targeted tests, and report the full blast radius. Use when a PR is raised or when you want to validate the impact of recent changes without running the full test suite.
context: fork
agent: general-purpose
allowed-tools: Bash(npm run test*), Bash(npx vitest*), Bash(gh *), Bash(git *), Read, Grep
disable-model-invocation: true
---

## Live diff context

The following `git` commands always succeed and are pre-injected before you start. Use the first non-empty file list in this priority order: staged → unstaged → last commit. Record which you used as **Change source** in your report.

**Files changed — staged (not yet committed):**
!`git diff --cached --name-only`

**Files changed — unstaged (local working changes):**
!`git diff --name-only`

**Files changed — last commit:**
!`git diff HEAD~1 --name-only`

**Full diff — staged:**
!`git diff --cached`

**Full diff — unstaged:**
!`git diff`

**Full diff — last commit:**
!`git diff HEAD~1`

**If an open PR exists**, also fetch PR context using your Bash tool at the start of Step 1:
```
gh pr view --json title,number,body
gh pr diff --name-only
gh pr diff
```
If `gh` is not installed or no PR is open, skip and rely on the git diff above.

---

## Your task

You are a directed test-impact agent. Your job is to:

1. **Map** every changed file to its exact affected test file(s)
2. **Check** whether audit agents must fire before this PR can merge
3. **Run** the minimal targeted test command
4. **Report** the blast radius

---

## Step 1 — File-to-test mapping (dynamic discovery — no hardcoded table)

For each changed file, find its tests using two complementary methods. Take the union of both results.

### Method A — Import grep (catches everything, self-maintaining)

For each changed file, grep every test directory for files that import from it:

```bash
# For each changed file path (e.g. src/lib/db/setlist.ts), run:
grep -rl "setlist" __tests__/ --include="*.test.ts" --include="*.test.tsx"
```

Use the stem of the changed file (filename without extension and path) as the grep term. For files with common stems (e.g. `route`), use the parent directory name instead (e.g. `songs`, `setlist`, `members`).

Run this grep for **every changed file** and collect all matching test paths. This automatically picks up new tests as they are added to the project — no maintenance required.

### Method B — Naming convention inference (fast path)

This codebase follows predictable naming conventions. Derive candidate test filenames from changed source paths:

| Source path pattern | Derive test name by |
|---|---|
| `src/app/api/<segment>/route.ts` | `<segment>-route.test.ts` in `__tests__/integration/` |
| `src/app/api/<segment>/[id]/route.ts` | `<segment>-id-route.test.ts` in `__tests__/integration/` |
| `src/app/admin/<page>/page.tsx` | `<page>-page.test.tsx` in `__tests__/components/` |
| `src/app/admin/layout.tsx` | `admin-layout.test.tsx` in `__tests__/components/` |
| `src/components/<Name>.tsx` | kebab-case filename + `.test.tsx` in `__tests__/components/` |
| `src/lib/db/<module>.ts` | grep Method A — shared DB helpers are used by multiple routes |
| `src/lib/server/<module>.ts` | `<module>.test.ts` in `__tests__/unit/` if it exists, else Method A |
| `src/lib/constants/<module>.ts` | `constants.test.ts` in `__tests__/unit/` |
| `src/middleware.ts` | `auth-route.test.ts`, `me-route.test.ts` in `__tests__/integration/` |
| `supabase/migrations/*.sql` | No test file — triggers `migration-safety-reviewer` agent instead |

After deriving candidate filenames, **verify each exists** before adding it to the run list:

```bash
ls __tests__/integration/<candidate>.test.ts 2>/dev/null
ls __tests__/components/<candidate>.test.tsx 2>/dev/null
ls __tests__/unit/<candidate>.test.ts 2>/dev/null
```

### Combining results

Deduplicate the union of Method A and Method B results. This is your initial targeted test list.
If a changed file produces zero matches from both methods, note it explicitly in the report as "no test coverage found" — this is itself a signal worth surfacing.

---

## Step 1.5 — Upstream UI journey tracing (forward dependency propagation)

This step traces each changed file **forward** through the full stack to find indirectly affected admin pages and their component tests. It is required whenever any file in `lib/types/`, `lib/db/`, `lib/server/`, or `src/app/api/` is changed.

The user journey chain this step traces is:
```
lib/types/*.ts  →  lib/db/*.ts  →  src/app/api/route.ts  →  src/app/admin/page.tsx  →  __tests__/components/*.test.tsx
```

### Phase A — Identify changed types (for type file changes)

If any changed file is in `lib/types/` (e.g. `database.ts`), extract the **specific type names** that were added, removed, or modified from the diff. Do not use the entire file as a search term — `database.ts` is imported everywhere and a whole-file grep is too broad.

From the diff, identify changed type names (e.g. `MeResponse`, `OrganizationMember`). Then grep for usages of those specific types:

```bash
# For each changed type name:
grep -rl "MeResponse\|OrganizationMember" src/lib/db/ src/app/api/ --include="*.ts"
```

Add any files found to the **affected modules set**.

### Phase B — DB helper / server module → API route propagation

For each file in `lib/db/` or `lib/server/` that is changed (directly or found in Phase A):

```bash
# Use the module stem (e.g. "members", "setlist", "tenant")
grep -rl "from.*lib/db/members\|from.*lib/server/members" src/app/api/ --include="*.ts"
```

Add the matching API route files to the **affected API routes set**.

### Phase C — API route → Admin page propagation (URL-based tracing)

For each affected API route file (directly changed or found in Phases A/B):

1. Derive the URL path from the file path:
   - `src/app/api/songs/route.ts` → `/api/songs`
   - `src/app/api/members/[id]/route.ts` → `/api/members/`
   - `src/app/api/me/route.ts` → `/api/me`

2. Grep admin pages for that fetch URL:

```bash
grep -rl '"/api/songs"\|`/api/songs' src/app/admin/ --include="*.tsx" --include="*.ts"
```

3. Add matching admin pages to the **affected UI pages set**.

### Phase D — Admin page → component test

For each admin page in the affected UI pages set, apply Method B's naming convention to find the component test:

```bash
# e.g. src/app/admin/songs/page.tsx → songs-page.test.tsx
ls __tests__/components/songs-page.test.tsx 2>/dev/null
```

Add confirmed tests to the targeted test list. These are **UI journey tests** — include them even if the direct diff only touched a type file.

### Phase E — Record the full chain

For each UI journey test added via this step, record the complete propagation chain. This will be displayed in the report. Example:

```
database.ts (MeResponse changed) → src/app/api/me/route.ts → src/app/admin/layout.tsx → admin-layout.test.tsx
lib/db/setlist.ts → src/app/api/setlist/[id]/route.ts → src/app/admin/setlist/page.tsx → setlist-page.test.tsx
```

If Phase A–D produces no additional tests beyond Step 1, note "No additional upstream UI impact found."

---

## Step 2 — Audit agent triggers

After mapping test files, check these rules. If any condition is true, **add that agent to the blast radius report as a required pre-merge action**:

| Condition | Agent to trigger |
|---|---|
| Any file under `supabase/migrations/` changed | **migration-safety-reviewer** — must review before merge |
| Any file under `src/app/api/` or `src/lib/db/` changed or added | **tenant-security-auditor** — must audit for IDOR / unscoped writes |
| Any admin modal page changed: `people/page.tsx`, `songs/page.tsx`, `setlist/page.tsx`, `availability/page.tsx`, `audit/page.tsx` | **modal-regression-guard** — must check for blank form regression |
| Any async button handler added or modified in an admin page | **async-handler-auditor** — must verify try/catch/finally pattern |

Invoke each triggered agent as a sub-agent task now, using the diff as context. Do not skip this step if conditions are met.

---

## Step 3 — Build and run the targeted test command

Construct the minimal vitest command targeting only the affected test files identified in Step 1.

**Format:**
```
npx vitest run <file1> <file2> ...
```

Use full relative paths from the repo root, e.g.:
```
npx vitest run __tests__/integration/setlist-route.test.ts __tests__/components/setlist-page.test.tsx
```

Run the command and capture the output.

---

## Step 4 — Blast radius report

Output a structured report in this format:

```
## PR Impact Report

**Change source:** [open PR #N / staged changes / unstaged local changes / last commit HEAD~1]

**Functional areas touched:**
- [list each logical area: e.g. "Setlist API", "Songs admin page", "Tenant query helpers"]

**Upstream UI journey impact:**
- [full chain for each UI test added via Step 1.5, e.g.:]
  - `database.ts (MeResponse) → src/app/api/me/route.ts → src/app/admin/layout.tsx → admin-layout.test.tsx`
  - `lib/db/setlist.ts → src/app/api/setlist/[id]/route.ts → src/app/admin/setlist/page.tsx → setlist-page.test.tsx`
- [OR "None — changes are UI-layer only or upstream impact was already covered by direct test mapping"]

**Tests run:**
- [list each test file run — group by layer: Unit / Integration / Component (UI journey)]

**Test result:** PASS / FAIL
[If FAIL: paste the failing test names and error summaries]

**Audit agents required before merge:**
- [agent name] — [one-line reason] OR "None"

**Skipped tests (and why):**
- [any test suites NOT run, with explicit reason: "not impacted by this diff"]
```

If no test files map to the changed files (e.g. only documentation or config changed), state that explicitly and skip Step 3.
