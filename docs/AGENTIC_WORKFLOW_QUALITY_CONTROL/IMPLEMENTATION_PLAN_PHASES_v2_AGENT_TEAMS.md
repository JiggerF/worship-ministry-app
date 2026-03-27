# Implementation Plan — Agentic Workflow v2 (Agent Teams)
## Quality Control as First-Class Citizen

> **Companion to:** `AGENTIC_WORKFLOW_PLAN_SDLC_v2_AGENT_TEAMS.md`
>
> **Purpose:** Concrete, phase-by-phase build instructions. Every item includes: why it exists,
> what to build, exact file locations, acceptance criteria, and the transferable mental model
> so you can replicate this architecture on any other project or introduce it to your team.
>
> **Produced by:** Three-persona debate (Systems Thinker · AI System Designer · SDET Quality Engineer)
> on the v2 SDLC plan. The debate produced 6 critical corrections to the original plan — documented in
> the Gap Map below.

---

## Table of Contents

1. [How to Use This Document](#1-how-to-use-this-document)
2. [The Mental Model — Why This Architecture Exists](#2-the-mental-model--why-this-architecture-exists)
3. [Quality Gate Gap Map — Post-Debate State](#3-quality-gate-gap-map--post-debate-state)
4. [Phase A0 — Foundation: Mapper Safety (Do Absolutely First)](#4-phase-a0--foundation-mapper-safety)
5. [Phase A — Close Layer 2: PostToolUse Hooks](#5-phase-a--close-layer-2-posttooluse-hooks)
6. [Phase B — Team Quality Contracts](#6-phase-b--team-quality-contracts)
7. [Phase C — CI Pipeline](#7-phase-c--ci-pipeline)
8. [Phase D — Staging + Monitoring](#8-phase-d--staging--monitoring)
9. [Timeline](#9-timeline)
10. [Transferable Patterns — Replicating This on Any Project](#10-transferable-patterns)

---

## 1. How to Use This Document

**This is a build plan, not a concept guide.** Every item has a concrete output: a file created, a test written, a config updated.

**Reading order:**
- First time: read sections 2 and 3 to understand the mental model and current gaps.
- Building: follow phases in order (A0 → A → B → C → D). Do not skip A0.
- Teaching your team: share sections 2, 3, and 10. The rest is project-specific detail.

**Phase dependency:**
```
A0 must complete before A  (mapper must be correct before it carries hook responsibility)
A  must complete before B  (hooks must be live before teams run at scale)
B  must complete before C  (team patterns must be proven before CI formalises them)
C  completes before D      (CI must catch what hooks miss before staging is added)
```

**The single rule this plan enforces above all others:**

> Quality control is not a phase that happens after implementation. It is embedded
> at every edit, every task completion, every agent handoff, and every PR. An agent
> team without quality infrastructure is not faster development — it is faster bug production.

---

## 2. The Mental Model — Why This Architecture Exists

### 2.1 The Problem That Requires This Solution

In a traditional workflow, a human developer is the quality gate. They read their own code before committing. They catch obvious bugs. They apply judgment.

In an agentic workflow with parallel workers, **there is no human in the inner loop.** Between the moment Worker A writes a bug and the moment a developer reviews the PR, Workers B, C, and D may have built on top of it simultaneously. A single undetected bug can propagate to every parallel worker before any gate fires.

This is not a theoretical concern — it is the expected failure mode of unconstrained parallelism. The quality architecture in this plan exists entirely to prevent and contain this propagation.

### 2.2 The 6-Layer Model (What You Are Building Toward)

Think of quality control as defense in depth. No single layer catches everything. Each layer has a specific threat it is designed for:

```
Layer 1 — Rules (CLAUDE.md)
  Threat:    Agent writes code that violates known architectural patterns
  Mechanism: Rules are loaded into every agent's context at session start
  Weakness:  Advisory only — no enforcement. Agent can ignore them.
  Status:    EXISTS

Layer 2 — In-Session Hooks (PostToolUse)
  Threat:    Agent writes a specific class of bug (IDOR, blank modal, uncaught async)
  Mechanism: Shell script fires after every Edit/Write, runs targeted tests
  Weakness:  Only catches what it is programmed to catch (mapper coverage = hook coverage)
  Status:    MISSING — highest priority

Layer 3 — Pre-Commit (Husky)
  Threat:    Agent commits code with failing intent tests; human developer does same
  Mechanism: Intent tests run on git commit; blocks if any fail
  Weakness:  Too coarse — runs ALL intent tests, not scoped. Slow under pressure.
  Status:    EXISTS (but needs improvement: scoped via mapper, ESLint added)

Layer 4 — CI / PR Gate (GitHub Actions)
  Threat:    Full regression suite, type errors, lint, build failures
  Mechanism: Full 705+ test suite + lint + build on every PR
  Weakness:  Only fires on PR creation — too late to prevent parallel contamination
  Status:    MISSING

Layer 5 — Staging Smoke (Playwright)
  Threat:    Environment-specific failures not caught in unit/integration tests
  Mechanism: 5 end-to-end paths against real staging environment
  Weakness:  Slow, requires real environment
  Status:    MISSING

Layer 6 — Production Monitoring
  Threat:    Bugs that only manifest under real user conditions
  Mechanism: Error boundaries, structured logging, Supabase logs
  Weakness:  Reactive — bugs reach users before detection
  Status:    MISSING
```

### 2.3 Why Layer 2 Is the Most Critical for Agent Teams

Layers 3-6 all fire AFTER the code is written — often after multiple workers have built on top of it. Only Layer 2 fires AT THE MOMENT OF THE EDIT.

**The math:**
- Bug introduced at edit time, caught at L2 (edit): 1 worker affected, 1 file to fix
- Bug introduced at edit time, caught at L3 (pre-commit): 1 worker, entire task to verify
- Bug introduced at edit time, caught at L4 (PR): all workers finished, entire feature at risk
- Bug introduced at edit time, caught at L5 (staging): deployed, rollback required
- Bug introduced at edit time, caught at L6 (production): users affected

Layer 2 does not just catch bugs faster. It prevents bug amplification. This distinction matters most in parallel teams.

### 2.4 Why the Mapper Is the Foundation of Everything

The impact mapper (`shadow-agent/mapper.ts`) is a file that translates "which source file changed" → "which tests cover that file." It is the routing layer that makes targeted quality checks possible.

**Both L2 (hooks) and L3 (pre-commit) depend on the mapper's correctness.**

If the mapper has an incorrect entry (wrong prefix), both L2 and L3 silently skip tests for that file. The developer sees green. No alarm sounds. This is the most dangerous failure mode in the architecture — not a visible failure, but an invisible gap.

Before the mapper carries the weight of two quality layers, it must be:
1. Tested (its own unit tests)
2. Complete (covers all pages, not just 5 of 14)
3. Fail-safe (warns when a source file has no mapping instead of silently passing)

This is why Phase A0 exists.

### 2.5 The Transferable Pattern

This architecture — layered quality gates, impact-mapped targeted tests, PostToolUse hooks, and worker quality contracts — transfers to any project where:
- Multiple agents or developers work on the same codebase in parallel
- Quality regressions have been experienced and need systemic prevention
- Code review alone is insufficient as the sole quality gate

The specific tests, hooks, and mapper entries are project-specific. The **architecture** is universal.

---

## 3. Quality Gate Gap Map — Post-Debate State

*Produced by synthesising Systems Thinker + AI System Designer + SDET analyses.*

### 3.1 The 6 Critical Corrections to the Original v2 Plan

| # | Original Claim | Corrected Reality |
|---|---|---|
| 1 | "5/11 admin pages have intent tests" | 14 admin pages exist; only 5 have tests (36%) |
| 2 | "Mapper ready for hooks" | Mapper covers only 5/14 pages; 9 pages silently bypass all quality gates |
| 3 | "Hook returns reason string" | reason string is diagnosis only; agents need fix_pattern + line_range + rule_id to self-correct reliably |
| 4 | "Task dependencies block on completion" | Dependencies should block on quality PASS, not just task completion — currently encodes data flow, not quality flow |
| 5 | "Intent tests are the quality contract" | Intent tests verify rendering only; no round-trip tests (form submit → API called → list updated) |
| 6 | "Orchestrator can monitor quality" | Orchestrator has zero visibility into hook execution; cannot distinguish "working" from "stuck in hook loop" |

### 3.2 Current Coverage by Layer

| Layer | Gate | Status | Coverage | Silent Failure Risk |
|---|---|---|---|---|
| L1 | CLAUDE.md rules | ✅ Active | All sessions | High — advisory only |
| L2a | Intent guard hook | ❌ Missing | 0% | Critical |
| L2b | API security hook | ❌ Missing | 0% | Critical |
| L2c | Modal regression hook | ❌ Missing | 0% | High |
| L2d | Migration safety hook | ❌ Missing | 0% | High |
| L3 | Pre-commit (Husky) | ⚠️ Partial | 36% pages, all tests run (not scoped) | Medium |
| L4 | CI (GitHub Actions) | ❌ Missing | 0% | Medium |
| L5 | Staging smoke | ❌ Missing | 0% | Low (personal project) |
| L6 | Production monitoring | ❌ Missing | 0% | Low (personal project) |
| **Mapper** | Foundation layer | ⚠️ Incomplete | 5/14 pages (36%) | **Critical — silent** |

### 3.3 Admin Page Coverage Map

| Admin Page | Intent Tests | Mapper Entry | L2 Coverage |
|---|---|---|---|
| `people/page.tsx` | ✅ 7 tests | ✅ `src/app/admin/people` | Ready for hooks |
| `songs/page.tsx` | ✅ 7 tests | ✅ `src/app/admin/songs` | Ready for hooks |
| `roster/page.tsx` | ⚠️ 3 tests | ✅ `src/app/admin/roster` | Partial — 3 tests only |
| `settings/page.tsx` | ⚠️ 2 tests | ✅ `src/app/admin/settings` | Partial — 2 tests only |
| `login/page.tsx` | ❌ No intent tests | ✅ (mapped, empty) | Silently bypassed |
| `recordings/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `availability/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `availability/[id]/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `setlist/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `audit/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `dashboard/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `handbook/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `about/page.tsx` | ❌ | ❌ | **Silent bypass** |
| `help/page.tsx` | ❌ | ❌ | **Silent bypass** |

**9 pages silently bypass all quality gates.** An agent editing any of these pages receives a green signal from both L2 (hooks) and L3 (pre-commit mapper path) while zero validation occurs.

---

## 4. Phase A0 — Foundation: Mapper Safety

> **Why this phase exists:** The mapper is the shared substrate beneath L2 hooks and L3 pre-commit.
> Building hooks on an incomplete, untested mapper creates a false safety layer — the system
> appears to work while silently missing 64% of the codebase.
>
> **Do this before any other phase. It takes ~2 hours and closes the most dangerous silent failure.**

---

### A0.1 — Mapper Unit Tests

**Why:** The mapper uses prefix-matching logic. Edge cases (substring matches, path normalisation on Windows vs macOS, absolute vs relative paths) can cause silent mis-routing. Without tests, every hook built on the mapper inherits these unknowns.

**What to build:**

File: `__tests__/unit/mapper.test.ts`

```typescript
// Test cases that must pass:

// 1. Known mappings return correct test files
getImpactedTests(["src/app/admin/people/page.tsx"])
  → includes "people.intent.test.tsx" and "coordinator-access.intent.test.tsx"

// 2. Shared lib changes trigger ALL intent tests
getImpactedTests(["src/lib/db/members.ts"])
  → returns all 5 (and later 14) intent test files

// 3. Unrecognised file outside src/ returns empty (not warning)
getImpactedTests(["README.md"])
  → returns []

// 4. Absolute paths are normalised correctly
getImpactedTests(["/Users/dev/project/src/app/admin/songs/page.tsx"])
  → same result as relative path

// 5. Substring prefix does NOT cause false match
// e.g. "src/app/admin/people-bulk" should NOT match "src/app/admin/people" prefix
getImpactedTests(["src/app/admin/people-bulk/page.tsx"])
  → does NOT return people intent tests (distinct page)

// 6. Multiple files: deduplication works
getImpactedTests(["src/app/admin/people/page.tsx", "src/app/admin/people/page.tsx"])
  → same result as single file (no duplicate test entries)
```

**Acceptance criteria:** All 6 test cases pass. `npm run test:unit` exits 0.

**Transferable pattern:** Any routing/mapping utility that is relied on by other systems needs its own test suite. The more load-bearing the utility, the more thorough the tests must be.

---

### A0.2 — Mapper Completeness Test

**Why (SDET finding):** When a new page is added to `src/app/admin/` without a mapper entry, the quality system silently passes every edit to that page. No alarm fires. This transforms the mapper from a safety gate into a false assurance.

**What to build:**

File: `__tests__/unit/mapper-completeness.test.ts`

```typescript
import { glob } from "glob"; // or use fast-glob
import { DIRECT_MAP } from "../../shadow-agent/mapper"; // export the map

it("every admin page has a mapper entry", async () => {
  const pageFiles = await glob("src/app/admin/**/page.tsx");

  for (const pageFile of pageFiles) {
    // Normalise to the prefix format used in DIRECT_MAP
    // e.g. "src/app/admin/recordings/page.tsx" → "src/app/admin/recordings"
    const prefix = pageFile.replace(/\/page\.tsx$/, "");

    const hasMappingEntry = DIRECT_MAP.some((entry) =>
      prefix.startsWith(entry.prefix) || entry.prefix.startsWith(prefix)
    );

    expect(hasMappingEntry, `No mapper entry for: ${pageFile}`).toBe(true);
  }
});

it("every admin API route has a mapper entry", async () => {
  const routeFiles = await glob("src/app/api/**/route.ts");
  // Same pattern — each route prefix must be in DIRECT_MAP
});
```

**Run in CI and pre-commit.** When a new page is added without updating mapper.ts, this test fails immediately with the specific file path.

**Acceptance criteria:** Test file exists, passes for all current pages, and fails (correctly) when you add a test page with no mapper entry.

**Transferable pattern:** Any registry-based system (feature flags, route mappers, permission tables) should have a completeness test that catches "item exists in codebase but not in registry."

---

### A0.3 — Mapper "Unmapped src/ File" Warning

**Why (SDET finding):** Currently `getImpactedTests` returns `[]` for any file with no mapper entry. For non-source files (README, config) this is correct. For source files under `src/app/`, returning `[]` silently bypasses all quality validation. These two outcomes must be distinguished.

**What to change:** Modify `shadow-agent/mapper.ts` to return a sentinel for unmapped source paths:

```typescript
// New exported type
export type ImpactResult = {
  tests: string[];
  unmappedSourceFile: boolean; // true if the path is under src/ but has no mapping
};

export function getImpactedTests(changedFiles: string[]): ImpactResult {
  // ... existing logic ...

  // After processing all files:
  const hasUnmappedSourceFile = changedFiles.some((f) => {
    const rel = normalise(f);
    return rel.startsWith("src/") && tests.size === 0 && !isKnownNonSource(rel);
  });

  return { tests: [...tests], unmappedSourceFile: hasUnmappedSourceFile };
}
```

The L2 hook shell script uses this to emit a warning rather than a silent pass:

```bash
if [[ "$UNMAPPED" == "true" ]]; then
  echo "[intent-guard] WARNING: $FILE_PATH has no test mapping. Update shadow-agent/mapper.ts." >&2
  # Does NOT block — warns. The completeness test (A0.2) is the hard enforcement.
fi
```

**Acceptance criteria:** Editing `src/app/admin/recordings/page.tsx` produces a visible warning in the hook output, not a silent pass.

**Transferable pattern:** Routing/dispatch systems should distinguish "no handler found because this is not a routable input" from "no handler found even though this looks like it should be routable." The first is expected; the second is a gap.

---

### A0.4 — Extend Mapper to Cover All 14 Admin Pages

**Why:** Until all pages have mapper entries, the completeness test (A0.2) will fail, blocking Phase A. Each entry must map to at least a stub test that verifies the page renders.

**Pages to add to mapper.ts** (with stub intent tests in `__tests__/intent/`):

| Page | Mapper prefix | Stub test minimum |
|---|---|---|
| `recordings` | `src/app/admin/recordings` | Page renders, Admin sees upload area |
| `availability` | `src/app/admin/availability` | Page renders, member list visible |
| `availability/[id]` | `src/app/admin/availability/[id]` | Page renders, availability grid visible |
| `setlist` | `src/app/admin/setlist` | Page renders, setlist entries visible |
| `audit` | `src/app/admin/audit` | Page renders, log entries visible |
| `dashboard` | `src/app/admin/dashboard` | Page renders with stats |
| `handbook` | `src/app/admin/handbook` | Page renders, content visible |
| `about` | `src/app/admin/about` | Page renders |
| `help` | `src/app/admin/help` | Page renders |

**Note on stub tests:** A stub test is not throwaway — "page renders without crashing" + "correct role-gated controls visible" is genuine quality coverage. Write the minimum that is actually useful, not the minimum that passes a checkbox.

**Acceptance criteria:** `npm run test:unit mapper-completeness` exits 0. All 14 pages have mapper entries.

---

### A0 Phase Complete When:

- [ ] `__tests__/unit/mapper.test.ts` exists and passes (6 test cases)
- [ ] `__tests__/unit/mapper-completeness.test.ts` exists and passes
- [ ] `getImpactedTests` exports `ImpactResult` with `unmappedSourceFile` flag
- [ ] All 14 admin pages have mapper entries
- [ ] All 9 new pages have at least a stub intent test
- [ ] `npm run test:unit` exits 0
- [ ] `npm run test:intent` exits 0

---

## 5. Phase A — Close Layer 2: PostToolUse Hooks

> **Why this phase exists:** Layer 2 is the only quality gate that fires at edit time — the only
> gate that can prevent bug amplification across parallel workers. Without it, the first real
> feedback arrives at pre-commit (one worker's entire task built on a bug) or at CI (all workers
> finished, full rework).
>
> **Prerequisite:** Phase A0 complete. The mapper must be correct before hooks rely on it.

---

### A.1 — Hook Response Schema (Design Before Building)

**Why (AI System Designer finding):** A hook that returns only a free-text `reason` string forces the agent to diagnose AND prescribe its own fix. This produces inconsistent self-correction. A structured schema lets the agent apply the fix directly.

**Define this schema first.** All hooks in this phase must conform to it.

File: `.claude/hooks/schema.md` (documentation only, not code)

```markdown
# PostToolUse Hook Response Schema

Every hook MUST return one of these two JSON shapes on stdout:

## Pass (allow edit)
{ "decision": "pass" }

## Block (require fix before continuing)
{
  "decision":    "block",
  "hook_id":     string,          // e.g. "tenant-scope-write"
  "severity":    "critical" | "high" | "medium",
  "file":        string,          // the edited file path
  "line_range":  [number, number], // [startLine, endLine] where the issue is
  "rule_ref":    string,          // e.g. "CLAUDE.md Non-Negotiable Rule #5"
  "reason":      string,          // human-readable explanation
  "fix_pattern": string,          // concrete fix the agent can apply
  "max_retries": number,          // default: 3
  "escalate_to": "orchestrator"   // who to message after max_retries
}
```

**Transferable pattern:** Any interface between a quality system and an autonomous agent must be a machine-readable contract, not human-readable prose. The agent acts on `fix_pattern`; the human reads `reason`. Both fields are required.

---

### A.2 — PostToolUse Intent Guard Hook (A1)

**What it does:** After every Edit or Write tool call on a `src/` or `__tests__/` file, maps the file to its intent tests via mapper.ts and runs them. Blocks if any fail.

**Files to create:**

`/.claude/hooks/intent-guard.sh`

```bash
#!/usr/bin/env bash
# PostToolUse hook — Layer 2 intent regression guard.
# Fires after every Edit/Write tool call.
# Maps changed file → intent tests → runs them → blocks on failure.

PAYLOAD=$(cat)
TOOL_NAME=$(echo "$PAYLOAD" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
FILE_PATH=$(echo "$PAYLOAD" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

[[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]] || exit 0
[[ -n "$FILE_PATH" ]] || exit 0

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Run mapper — get impacted tests
MAPPER_OUT=$(npx tsx shadow-agent/mapper.ts "$FILE_PATH" 2>/dev/null || echo "")

# Warn on unmapped src/ file (but do not block)
if echo "$MAPPER_OUT" | grep -q "WARNING"; then
  echo "[intent-guard] $(echo "$MAPPER_OUT" | grep WARNING)" >&2
fi

echo "$MAPPER_OUT" | grep -q "No intent tests impacted" && exit 0
[[ -z "$MAPPER_OUT" ]] && exit 0

TESTS=$(echo "$MAPPER_OUT" | grep "^  " | sed 's/^  //' | paste -sd ' ')
[[ -z "${TESTS// }" ]] && exit 0

echo "[intent-guard] File: $FILE_PATH" >&2
echo "[intent-guard] Running: $TESTS" >&2

# Log to hook execution log (for orchestrator observability)
LOG_FILE="$REPO_ROOT/.claude/hooks/execution.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TEST_OUT=$(npx vitest run $TESTS 2>&1) && PASS=true || PASS=false

echo "{\"timestamp\":\"$TIMESTAMP\",\"hook\":\"intent-guard\",\"file\":\"$FILE_PATH\",\"decision\":\"$([ "$PASS" == "true" ] && echo pass || echo block)\"}" >> "$LOG_FILE"

if [[ "$PASS" == "false" ]]; then
  FAILS=$(echo "$TEST_OUT" | grep -E "FAIL |× |AssertionError" | head -3 | tr '\n' '; ' | tr -d '"')
  FILE_BASE=$(basename "$FILE_PATH")
  python3 -c "
import json
print(json.dumps({
  'decision':    'block',
  'hook_id':     'intent-regression',
  'severity':    'high',
  'file':        '$FILE_PATH',
  'line_range':  [1, 1],
  'rule_ref':    'CLAUDE.md Rule 5 + 6',
  'reason':      'Intent tests failed after editing $FILE_BASE: $FAILS',
  'fix_pattern': 'Run: npx vitest run $TESTS to see full output. Fix failing assertions before continuing.',
  'max_retries': 3,
  'escalate_to': 'orchestrator'
}))"
else
  echo "[intent-guard] ✓ All intent tests passed." >&2
fi
```

**Update `.claude/settings.json`** to register the hook:

```json
{
  "permissions": { "allow": [ "..." ] },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/intent-guard.sh"
          }
        ]
      }
    ]
  }
}
```

**Acceptance criteria:**
- Editing `src/app/admin/people/page.tsx` triggers the hook and runs `people.intent.test.tsx`
- A deliberately broken edit (e.g., remove the `+ Add Member` button) causes the hook to block with a structured JSON response
- Editing `.claude/CLAUDE.md` does not trigger the hook (non-source file)
- Hook execution is logged to `.claude/hooks/execution.log`

---

### A.3 — PostToolUse API Security Hook (A2)

**What it does:** After every Edit or Write to `src/app/api/`, checks for missing `tenant_id` scoping on database queries that mutate data. Blocks if a write/delete is unscoped.

**File:** `.claude/hooks/api-security.sh`

**Key checks (in order of severity):**
1. Any `.delete()` or `.update()` without `.eq("tenant_id", ...)` — CRITICAL
2. Any route that returns data without a tenant filter on a multi-tenant table — HIGH
3. Any route that skips role validation (`getActorFromRequest`) — HIGH

**How to implement:** The hook script calls the existing `tenant-security-auditor` agent logic as a targeted static analysis pass, OR implements a lightweight regex scan:

```bash
# Fast path: regex scan (synchronous, ~100ms)
if grep -n "\.delete()\|\.update(" "$FILE_PATH" | grep -v "tenant_id"; then
  # Suspicious: delete/update without tenant_id on same line
  # Output block JSON with fix_pattern: "Add .eq('tenant_id', tenantId) to the chain"
fi
```

**Acceptance criteria:**
- Writing a DELETE route without `.eq("tenant_id", tenantId)` blocks with `hook_id: "tenant-scope-write"` and `fix_pattern` pointing to the correct CLAUDE.md rule
- A correctly scoped DELETE passes the hook
- Hook runs in under 3 seconds (regex scan, not full agent analysis)

---

### A.4 — PostToolUse Modal Regression Hook (A3)

**What it does:** After every Edit or Write to `src/app/admin/**/page.tsx`, scans for the known blank-modal pattern (`{/* ...existing code... */}` inside a `<form>` or modal body) and blocks immediately.

**File:** `.claude/hooks/modal-regression.sh`

**Why this warrants its own hook:** This bug has caused 3 separate regressions in this project. A targeted, fast check prevents it permanently.

```bash
# Check for placeholder comment inside form/modal body
if grep -n "/\*.*existing code\|existing code.*\*/" "$FILE_PATH" | head -3; then
  # Output block JSON:
  # fix_pattern: "Replace {/* ...existing code... */} with the real form JSX fields"
  # rule_ref: "CLAUDE.md Rule 5 — Never write placeholder comments inside modal forms"
fi
```

**Acceptance criteria:**
- Editing `people/page.tsx` to contain `{/* ...existing code... */}` inside a form triggers an immediate block
- A fully-implemented form passes the hook
- Hook runs in under 500ms

---

### A.5 — PostToolUse Migration Safety Hook (A4)

**What it does:** After every Write to `supabase/migrations/*.sql`, checks for the three most dangerous migration patterns: unscoped DELETEs, dropping columns, and missing `tenant_id` on new tables.

**File:** `.claude/hooks/migration-safety.sh`

**Key checks:**
1. `DROP COLUMN` or `DROP TABLE` — severity: critical, always requires human review
2. `DELETE FROM` without `WHERE` — severity: critical
3. New `CREATE TABLE` without `tenant_id` column — severity: high
4. Irreversible changes without a rollback comment — severity: medium

**Acceptance criteria:**
- Writing a migration with `DROP COLUMN` blocks with `severity: "critical"` and `escalate_to: "orchestrator"`
- A safe `ALTER TABLE ADD COLUMN` migration passes
- Hook runs in under 1 second (SQL text scan)

---

### A.6 — Observable Hook Execution Log

**Why (AI System Designer finding):** The orchestrator cannot currently see which hooks fired, which passed, and which workers are blocked. Without this, the orchestrator is blind to real-time quality compliance.

**What to build:**

File: `.claude/hooks/execution.log` (auto-created by hooks, gitignored)

Each hook appends a JSON line on execution:

```json
{"timestamp":"2026-03-27T10:15:32Z","hook":"intent-guard","file":"src/app/admin/people/page.tsx","decision":"block","attempt":1}
{"timestamp":"2026-03-27T10:15:45Z","hook":"intent-guard","file":"src/app/admin/people/page.tsx","decision":"pass","attempt":2}
```

**Add to `.gitignore`:**
```
.claude/hooks/execution.log
```

**Orchestrator can read this log** to answer: "Are my workers passing quality gates, or stuck in loops?"

**Acceptance criteria:**
- After any hook execution, a new line appears in `.claude/hooks/execution.log`
- The log is human-readable and machine-parseable (JSONL format)
- The log is gitignored (no committed history)

---

### A.7 — Add ESLint to Pre-Commit

**Why:** ESLint currently only runs in CI (too late). Catching lint errors before commit prevents trivial lint failures from blocking PRs and trains agents to write lint-clean code from the start.

**Update `.husky/pre-commit`:**

```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

# Run ESLint on staged files only (fast — not the whole codebase)
npx lint-staged

# Run intent tests (scoped via mapper — see A.8)
npm run test:intent
```

**Add `lint-staged` config to `package.json`:**

```json
"lint-staged": {
  "src/**/*.{ts,tsx}": ["eslint --fix", "git add"]
}
```

**Acceptance criteria:** A staged file with a lint error blocks commit with the specific lint output.

---

### A.8 — Scope Pre-Commit to Use Mapper

**Why (SDET finding):** Pre-commit currently runs ALL intent tests unconditionally via `npm run test:intent`. This means a failing test on an unrelated page blocks a commit for a completely different feature. Under pressure, developers use `--no-verify`, bypassing all pre-commit checks.

**Replace `npm run test:intent` with a scoped script** that uses mapper.ts:

File: `shadow-agent/pre-commit-check.sh`

```bash
#!/usr/bin/env bash
# Runs only the intent tests affected by staged files.
# Falls back to full intent suite if mapper returns no results.

STAGED=$(git diff --cached --name-only)
IMPACTED=$(npx tsx shadow-agent/mapper.ts $STAGED 2>/dev/null | grep "^  " | sed 's/^  //' | paste -sd ' ')

if [[ -z "${IMPACTED// }" ]]; then
  echo "[pre-commit] No intent tests impacted by staged files."
  exit 0
fi

echo "[pre-commit] Running targeted tests: $IMPACTED"
npx vitest run $IMPACTED
```

**Update `.husky/pre-commit`:**
```bash
bash shadow-agent/pre-commit-check.sh
```

**Acceptance criteria:** Staging only `src/app/admin/people/page.tsx` runs only people intent tests, not all 22+. Commit takes <10 seconds instead of 30+.

---

### A.9 — Worker Retry Budget Protocol

**Why (AI System Designer finding):** No retry limit is defined for when a hook repeatedly blocks a worker. Without a budget, workers enter infinite edit-block loops, consuming their entire context window and producing nothing.

**This is not a code change — it is a protocol documented in `.claude/CLAUDE.md`** and later embedded in every worker agent instruction file (Phase B):

```markdown
## PostToolUse Hook Compliance Protocol

When a PostToolUse hook blocks your edit:
1. Read the `fix_pattern` field in the hook response.
2. Apply the suggested fix precisely.
3. Re-edit the file.
4. If blocked again on the SAME `hook_id` after 3 attempts:
   - STOP editing this file.
   - Send message to orchestrator:
     "EVENT: hook-escalation
      hook_id: [hook_id]
      file: [file]
      attempts: 3
      last_reason: [reason]"
   - Do NOT mark the task as completed.
   - Move to the next available unblocked task.
```

**Acceptance criteria:** Protocol is documented in `.claude/CLAUDE.md` and referenced in every worker agent `.md` file.

---

### Phase A Complete When:

- [ ] `.claude/hooks/schema.md` exists (hook response contract defined)
- [ ] `.claude/hooks/intent-guard.sh` exists and blocks on test failures
- [ ] `.claude/hooks/api-security.sh` exists and blocks on unscoped writes
- [ ] `.claude/hooks/modal-regression.sh` exists and blocks on placeholder forms
- [ ] `.claude/hooks/migration-safety.sh` exists and blocks on dangerous SQL
- [ ] `.claude/settings.json` registers all 4 hooks under `hooks.PostToolUse`
- [ ] `.claude/hooks/execution.log` is created on first hook run and gitignored
- [ ] Pre-commit uses scoped test execution via mapper
- [ ] ESLint runs on staged files in pre-commit
- [ ] Retry budget protocol is documented in `.claude/CLAUDE.md`
- [ ] **Smoke test:** Edit `people/page.tsx` → intent-guard fires and logs. Remove `tenant_id` from an API route → api-security fires and blocks.

---

## 6. Phase B — Team Quality Contracts

> **Why this phase exists:** PostToolUse hooks are reactive quality gates — they catch bugs after
> the fact. Worker agent instructions are proactive quality contracts — they define what "done" means
> before the agent starts. Both are needed. Hooks catch what agents miss; instructions reduce what
> agents miss in the first place.
>
> **Prerequisite:** Phase A complete. All hooks must be live before workers run in teams.

---

### B.1-B.5 — Worker Agent Instruction Files

**Why:** The plan describes 5 worker types. None have instruction files yet. Without explicit quality compliance protocols in their instructions, workers treat quality gates as optional context rather than mandatory protocol.

**Each worker agent file MUST include (non-negotiable sections):**

1. **Role and file scope** — what files this worker may and may not edit
2. **Task claim protocol** — how to read the task board, how to claim, priority order
3. **Quality compliance protocol** — hook retry budget, when to escalate
4. **Definition of done** — the exact runnable checks that must pass before marking complete
5. **Handoff message format** — structured message to send downstream workers
6. **Escalation triggers** — what conditions require messaging the orchestrator

**File locations:** `.claude/agents/[name]-worker.md`

**Workers to define:**

| File | Role | File scope | Quality DoD |
|---|---|---|---|
| `api-worker.md` | Implements API routes | `src/app/api/**` only | All hooks pass, endpoint tested |
| `ui-worker.md` | Implements admin UI pages | `src/app/admin/**` only | Intent guard hook passes |
| `test-worker.md` | Writes tests, updates mapper | `__tests__/**`, `shadow-agent/mapper.ts` | All new tests pass, mapper updated |
| `security-worker.md` | Audits API routes, reviews code quality | Read-only audit | Written audit report in task comments |
| `db-worker.md` | Writes database migrations | `supabase/migrations/**` only | Migration safety hook passes, human review requested |

**For every worker, the Definition of Done section must look like this (example for api-worker):**

```markdown
## Definition of Done

A task is complete when ALL of the following are true:

1. All PostToolUse hooks passed on the final edit (check execution.log)
2. `npx tsc --noEmit` exits 0 (no TypeScript errors)
3. Targeted intent tests pass: `npx tsx shadow-agent/mapper.ts [your changed files]`
4. Handoff message sent to downstream worker(s) with structured format
5. TaskUpdate: status=completed, with hook results noted in description

DO NOT mark a task complete if:
- Any hook blocked your last edit
- TypeScript errors exist
- You received 3 blocks on the same hook_id and escalated (task stays in_progress)
```

**Acceptance criteria:** All 5 worker `.md` files exist in `.claude/agents/`, each containing all 6 required sections.

---

### B.6 — Team Composition Templates

**Why:** Without defined team templates, the orchestrator improvises composition every time, producing inconsistent results and missing worker types for the feature's needs.

**File:** `.claude/context/TEAM-COMPOSITIONS.md`

**Templates to define:**

```markdown
## Template 1: Bug Fix (2 workers)
Workers: debugger, test-worker
Tasks: diagnose → fix → verify → PR
Use when: isolated regression with clear symptom

## Template 2: UI-Only Feature (3 workers)
Workers: ui-worker, test-worker, security-worker
Tasks: UI implementation → intent tests → code review → PR
Use when: no new API routes, no DB changes

## Template 3: API + UI Feature (4 workers)
Workers: api-worker, ui-worker, test-worker, security-worker
Tasks: API spec → API implementation → UI → tests → security audit → PR
Dependency rule: UI task blocked until API AND security audit complete

## Template 4: Full-Stack Feature (5 workers)
Workers: api-worker, ui-worker, test-worker, security-worker, db-worker
Tasks: DB migration → API → security audit → UI → tests → code review → PR
Dependency rule: db-worker completes before api-worker starts

## Template 5: Migration Only (2 workers)
Workers: db-worker, migration-reviewer (invokes migration-safety-reviewer agent)
Tasks: write migration → review → human checkpoint → apply
ALWAYS requires human approval before apply
```

**Acceptance criteria:** File exists with all 5 templates. Each template includes: worker list, task sequence, dependency rules, when to use.

---

### B.7 — Inter-Agent Message Schema

**Why (Systems Thinker + AI System Designer finding):** Workers messaging each other with freeform text creates ambiguous handoffs. The receiving worker may misunderstand the contract, write wrong tests, or make incorrect assumptions about API shapes.

**File:** `.claude/context/AGENT-PROTOCOL.md`

**Define two message types:**

**Type 1: Task Handoff (implementation → testing)**
```
EVENT: task-handoff
FROM: api-worker
TO: test-worker
TASK_ID: 2
TASK_SUBJECT: "Implement POST /api/roster/export"
FILES_CHANGED: ["src/app/api/roster/export/route.ts"]
ENDPOINT: "POST /api/roster/export"
REQUEST_BODY: "{ rosterId: string, format: 'pdf' | 'csv' }"
RESPONSE_BODY: "{ data: string, filename: string }"
AUTH: "Requires Admin or Coordinator role"
TENANT_SCOPE: "Scoped to actor.tenantId"
NOTES: "Returns 400 for invalid rosterId; 403 for Musician role"
HOOKS_PASSED: true
```

**Type 2: Escalation (worker → orchestrator)**
```
EVENT: escalation
FROM: api-worker
URGENCY: "critical" | "blocking" | "informational"
TASK_ID: 2
SUBJECT: "Scope ambiguity: export should include cancelled assignments?"
CONTEXT: "The spec says 'roster assignments' but doesn't clarify status filter"
DECISION_NEEDED: "Include only confirmed assignments, or all statuses?"
BLOCKED: true
```

**Acceptance criteria:** Schema documented. All worker agent files reference this schema in their Handoff Message Format section.

---

### B.8 — Quality-Attestation Task Dependencies

**Why (Systems Thinker finding):** The v2 plan's task dependency design blocks downstream tasks on implementation *completion* — not quality *passage*. This means ui-worker can start building UI on an unaudited API route (the API exists but hasn't been security-reviewed).

**Revised dependency rule:**
```
BEFORE: Task 4 (UI) blocked by Task 2 (API implementation)
AFTER:  Task 4 (UI) blocked by Task 2 (API implementation) AND Task 3 (security audit)
```

**This rule must be documented in both:**
- `.claude/context/TEAM-COMPOSITIONS.md` (each template shows the correct dependency)
- `.claude/agents/orchestrator.md` (orchestrator instruction: "quality audit tasks are structural gates, not parallel observations")

**The principle:** Consumer tasks (UI, tests) must not proceed until both the implementation task AND its paired quality task are complete. This converts auditing from advisory to structural.

**Acceptance criteria:** All team composition templates show quality audit tasks as blockers of downstream consumer tasks, not parallel observers.

---

### B.9 — Orchestrator Agent Instructions

**Why:** The orchestrator is the most critical agent in a team run. If it improvises, the entire team runs on an ad-hoc plan. Explicit instructions make orchestration reproducible.

**File:** `.claude/agents/orchestrator.md`

**Required sections:**

1. **Role** — planner + exception handler, NOT implementer
2. **Phase 1-2 execution** — how to run planning pipeline skills
3. **Human checkpoint protocol** — when to pause, what format to present to the developer
4. **Task graph design rules** — same-file = sequential, quality = structural gate, PR = blocked by all
5. **Worker spawning** — team_name format, subagent_type (always general-purpose), worker-to-task assignment
6. **Monitoring protocol** — read execution.log, check task board, respond to escalations
7. **PR assembly** — how to compile worker reports into PR body
8. **What the orchestrator must NEVER do** — write implementation code, skip human checkpoints, merge without all quality gates green

**Acceptance criteria:** File exists with all 8 sections. First team run uses this file.

---

### B.10 — Expand Intent Tests: All 14 Pages

**Why:** The current 22 intent tests cover 5/14 pages and test rendering only. To be a genuine quality contract, intent tests must cover all pages and include at least one behavioral test per page.

**Test standards (beyond stub level):**

For each page, the intent test MUST cover:
1. Page renders for Admin (smoke test — not the hook, the page itself)
2. Role-gated controls: Coordinator sees/doesn't see the correct buttons
3. At least one mutation round-trip: fill form → submit → API called with correct payload → UI updates

**The mutation round-trip pattern (reference implementation for People page):**

```typescript
it("Admin adds a member and member appears in list", async () => {
  const mockFetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: () => ADMIN_MEMBER }) // /api/me
    .mockResolvedValueOnce({ ok: true, json: () => [MOCK_MEMBER_1] }) // GET /api/members
    .mockResolvedValueOnce({ ok: true, json: () => ({ id: "new-id", ...NEW_MEMBER }) }) // POST /api/members
    .mockResolvedValueOnce({ ok: true, json: () => [MOCK_MEMBER_1, NEW_MEMBER] }); // re-fetch
  vi.stubGlobal("fetch", mockFetch);

  render(<AdminPeoplePage />);
  await user.click(await screen.findByRole("button", { name: /add member/i }));
  await user.type(screen.getByPlaceholderText("Full name"), "Jane Smith");
  await user.type(screen.getByPlaceholderText("email@example.com"), "jane@wcc.com");
  await user.click(screen.getByRole("button", { name: /save/i }));

  // Verify API was called with correct payload
  const postCall = mockFetch.mock.calls.find(([url, opts]) =>
    url.includes("/api/members") && opts?.method === "POST"
  );
  expect(JSON.parse(postCall[1].body)).toMatchObject({ name: "Jane Smith", email: "jane@wcc.com" });

  // Verify member appears in list after re-fetch
  expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
});
```

**This pattern must be implemented for People first, then applied to every other page with create/edit functionality.**

**Acceptance criteria:** All 14 admin pages have intent tests. All pages with forms have at least one round-trip mutation test. `npm run test:intent` exits 0.

---

### B.11 — Mapper Coverage Maintenance Rule

**Why (Systems Thinker finding — missing reinforcing loop):** Without a rule that makes mapper updates mandatory when new tests or pages are added, the mapper silently becomes incomplete over time. This must be a contractual obligation, not a convention.

**Add to `.claude/CLAUDE.md` and every worker agent instruction:**

```markdown
## Mapper Maintenance (Non-Negotiable)

When you add any of the following, you MUST update shadow-agent/mapper.ts in the same commit:
- A new page under src/app/admin/
- A new API route under src/app/api/
- A new intent test file under __tests__/intent/

After updating mapper.ts, run: npm run test:unit mapper-completeness
This test will fail if your new file is not covered. Do NOT proceed until it passes.
```

**Acceptance criteria:** Rule exists in CLAUDE.md and all worker instruction files. `npm run test:unit mapper-completeness` is added to pre-commit.

---

### Phase B Complete When:

- [ ] Worker agent files exist: `api-worker.md`, `ui-worker.md`, `test-worker.md`, `security-worker.md`, `db-worker.md`
- [ ] Each worker file has all 6 required sections including explicit Definition of Done
- [ ] `TEAM-COMPOSITIONS.md` exists with 5 templates
- [ ] `AGENT-PROTOCOL.md` exists with handoff and escalation message schemas
- [ ] `orchestrator.md` exists with all 8 required sections
- [ ] All team composition templates show quality audit tasks as structural blockers
- [ ] Intent tests exist for all 14 admin pages
- [ ] At least one mutation round-trip test exists per page with forms
- [ ] Mapper coverage maintenance rule is in CLAUDE.md and all worker files
- [ ] **Smoke test:** Run a 2-worker bug fix team (debugger + test-worker). Verify task board coordination works. Verify at least one hook fires during the run. Verify PR body is generated.

---

## 7. Phase C — CI Pipeline

> **Why this phase exists:** Layers 2 and 3 catch bugs per-edit and per-commit. CI (Layer 4)
> catches anything that slipped through in a clean, controlled environment. It is the last
> automated gate before human PR review. Without it, the human reviewer must be the final
> quality filter — which defeats the purpose of the quality architecture.

---

### C.1 — GitHub Actions: Full Test Suite on PR

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, fixes-*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test                   # Full 705+ test suite
      - run: npm run test:intent             # Intent tests (redundant with above, explicit)
      - run: npm run build                   # Verifies no build-time errors

  mapper-completeness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run test:unit               # Includes mapper-completeness test
```

**Branch protection rule:** PRs to `main` require CI to pass before merge is allowed.

**Acceptance criteria:** CI runs on every PR. A PR with a failing intent test cannot be merged. Build failure blocks merge.

---

### C.2 — PR Impact Test Script

**Why:** Running all 705+ tests in CI on every PR takes minutes. For small changes (one page edit), this is wasteful. The mapper enables targeted CI runs.

**File:** `.github/workflows/pr-impact.yml`

```yaml
name: PR Impact Tests

on:
  pull_request:
    branches: [main]

jobs:
  targeted:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Run targeted intent tests
        run: |
          CHANGED=$(git diff --name-only origin/main...HEAD)
          TESTS=$(npx tsx shadow-agent/mapper.ts $CHANGED | grep "^  " | sed 's/^  //')
          if [ -n "$TESTS" ]; then
            npx vitest run $TESTS --reporter=verbose
          else
            echo "No intent tests impacted by this PR."
          fi
```

This runs in parallel with the full test suite. Results appear faster, giving early feedback while full CI completes.

**Acceptance criteria:** PR targeting only `people/page.tsx` runs only people intent tests within 30 seconds, while full CI completes in the background.

---

### C.3 — Orchestrator PR Body Assembly

**Why:** Agent team PRs should not require a developer to read raw diffs. The orchestrator summarises worker activity, hook results, and quality gate status into a structured PR body.

**PR body template the orchestrator fills in:**

```markdown
## Agent Team Summary

**Team:** feature-[name] · **Workers:** [list]
**All quality gates:** [✅ PASS / ❌ FAIL]

### Changes by Worker
- **api-worker:** [files changed, endpoint added/modified]
- **ui-worker:** [pages modified, new components]
- **test-worker:** [tests added, mapper updated]
- **security-worker:** [audit result — no findings / N findings, all resolved]

### Quality Gate Results
| Gate | Result | Notes |
|---|---|---|
| PostToolUse hooks | ✅ N executions, 0 unresolved blocks | |
| Intent tests | ✅ 22 tests passing | |
| TypeScript | ✅ No errors | |
| Security audit | ✅ Tenant isolation confirmed | |

### Open Questions
[None — or: list any unresolved ambiguities flagged during the run]

### Tests Added
[List new test files and what they cover]

🤖 Generated by orchestrator agent. All workers reported completion.
Human review required: merge decision only.
```

**Acceptance criteria:** After a complete team run, the orchestrator produces a PR body matching this template. Developer reviews the summary, not raw diffs, to approve.

---

### Phase C Complete When:

- [ ] `.github/workflows/ci.yml` exists and runs on every PR
- [ ] `.github/workflows/pr-impact.yml` exists for targeted testing
- [ ] Branch protection requires CI pass before merge to `main`
- [ ] Orchestrator can produce a structured PR body from task completion reports
- [ ] **Smoke test:** Create a PR with a deliberately failing test. Verify CI blocks merge.

---

## 8. Phase D — Staging + Monitoring

> **Why this phase exists:** CI catches what the tests cover. Staging catches what the tests don't —
> environment differences, real authentication flows, actual database interactions, and user experience
> issues that only appear under real conditions.
>
> **Priority:** Lower than A0-C for a personal project. Critical for team deployment.

---

### D.1 — Playwright Smoke Suite (5 Critical Paths)

**File:** `e2e/smoke.spec.ts`

**5 paths to cover:**

1. Login → lands on dashboard (auth flow works end-to-end)
2. Admin opens People page → member list loads → Add Member modal opens
3. Coordinator opens People page → no Add Member button visible (role-gating works in production)
4. Admin opens Roster page → Save Draft button present
5. Settings page → Admin can access, Coordinator gets redirected

**Why these 5:** They cover the three most critical production failure modes: auth, role-gating, and basic page rendering. If all 5 pass, the deploy is safe to complete.

**Acceptance criteria:** `npx playwright test e2e/smoke.spec.ts` against staging URL passes. Configured to run post-deploy via GitHub Actions.

---

### D.2 — Post-Deploy Verification Agent

**What it does:** After a production deploy, this agent runs the smoke suite and posts results to the PR comment. If smoke fails, it pages the developer and marks the deployment as requiring attention.

**File:** `.claude/agents/deploy-verifier.md`

**Acceptance criteria:** Agent definition exists. Post-deploy CI step runs it and posts the summary.

---

### D.3 — Error Boundary + Structured Logging

**Why:** Bugs that reach production must be surfaced quickly. Currently there is no structured error capture.

**Minimum implementation:**
1. React error boundaries on all admin page layouts (catch component-level crashes)
2. Supabase log monitoring for unexpected 500 errors on API routes
3. A `ERRORS.md` document in `.claude/context/` that captures known production error patterns (same reinforcing loop as CLAUDE.md for architecture rules)

**Acceptance criteria:** Error boundary component exists. One known error class is logged and documented.

---

### Phase D Complete When:

- [ ] `e2e/smoke.spec.ts` exists with 5 critical path tests
- [ ] Smoke tests run automatically post-deploy
- [ ] Deploy-verifier agent definition exists
- [ ] Error boundaries are on all admin layout components
- [ ] Supabase log monitoring is configured

---

## 9. Timeline

```
WEEK 1 — Phase A0 + A (Foundation + Hooks)
  Day 1-2:  A0 — Mapper tests, completeness test, unmapped warning, stub tests for 9 new pages
  Day 3-4:  A.1-A.5 — Hook schema + 4 hook scripts + settings.json
  Day 5:    A.6-A.9 — Execution log, scoped pre-commit, ESLint, retry protocol

  After Week 1: Every file edit by Claude is validated at edit time.
  Agentic safety: 15% → 75%

WEEK 2 — Phase B (Team Contracts)
  Day 1-2:  B.1-B.5 — 5 worker agent instruction files
  Day 3:    B.6-B.7 — Team compositions + inter-agent protocol
  Day 4:    B.8-B.9 — Orchestrator instructions + quality-attestation dependencies
  Day 5:    B.10 — Expand intent tests (prioritise 5 most-used pages first)
            First real 2-worker team run: simple bug fix

  After Week 2: First safe team run possible. Quality is in worker instructions.
  Agentic safety: 75% → 85%

WEEK 3 — Phase B continued + First 4-Worker Run
  B.10 continued: remaining pages
  B.11: Mapper maintenance rule embedded everywhere
  First 4-worker feature team run
  Retrospective: what did workers miss? Update instructions.
  Agentic safety: 85% → 88%

MONTH 2 — Phase C (CI)
  C.1-C.3: GitHub Actions + PR impact script + orchestrator PR assembly
  Second full feature team run with automated PR
  Agentic safety: 88% → 92%

MONTH 3 — Phase D (Staging)
  D.1-D.3: Playwright smoke + deploy verifier + error boundaries
  Goal: full autonomous feature run (developer reviews spec + PR only)
  Agentic safety: 92% → 96%
```

---

## 10. Transferable Patterns

> This section is for introducing this architecture to other projects and teams.
> The specific files are project-specific. The patterns are universal.

---

### Pattern 1: The Layered Quality Stack

**Universal principle:** Every agentic workflow needs at least 3 layers: in-session (per-edit), pre-commit, and CI. The layers protect against different threat surfaces. None of them alone is sufficient.

**How to apply to a new project:**
1. L2: Identify the 3 most expensive bug classes in your codebase. Write one hook per bug class.
2. L3: Add pre-commit hooks for tests + lint. Scope tests to changed files using an impact mapper.
3. L4: Add CI that runs full test suite + lint + build on every PR.

**Minimum viable quality stack (for any project, in 1 day):**
- One PostToolUse hook that runs tests mapped to the changed file
- Pre-commit that runs lint + targeted tests
- CI that runs full test suite

---

### Pattern 2: The Impact Mapper

**Universal principle:** Not every file change needs every test to run. A mapper that translates "changed file" → "relevant tests" makes quality gates fast enough to use at edit-time.

**How to build for a new project:**
1. List all test files and what source code they cover
2. Group by: page/module → tests for that page/module; shared/lib → all tests
3. Write a simple map (JSON or TypeScript) with these two levels
4. Add a completeness test: every page/module in `src/` must have a mapper entry

**The two rules that make a mapper useful:**
- Rule 1: Shared code (auth, DB helpers, types) → ALL tests
- Rule 2: Page/module-specific code → only that page's tests

---

### Pattern 3: The Hook Response Schema

**Universal principle:** Quality gates that communicate with agents must prescribe fixes, not just diagnose problems. The schema `{ fix_pattern, line_range, rule_ref }` is the minimum contract.

**Template for any new hook:**
```json
{
  "decision": "block",
  "hook_id": "[unique-id-for-this-rule]",
  "severity": "critical|high|medium",
  "file": "[the file that triggered the hook]",
  "line_range": [start, end],
  "rule_ref": "[link to the rule in your CLAUDE.md or coding standards]",
  "reason": "[human-readable explanation]",
  "fix_pattern": "[concrete code change the agent should make]",
  "max_retries": 3,
  "escalate_to": "orchestrator"
}
```

---

### Pattern 4: Worker Quality Contracts

**Universal principle:** Every agent worker in a parallel team must have an explicit Definition of Done that includes runnable verification commands. "Done" cannot mean "I wrote the code." It must mean "I verified the code."

**Template Definition of Done section for any worker:**
```markdown
## Definition of Done
A task is complete when ALL of the following are true:
1. All PostToolUse hooks passed on the final edit
2. No TypeScript / lint errors
3. Targeted tests pass for changed files
4. Structured handoff message sent to downstream workers
5. TaskUpdate marked completed with hook results noted
```

---

### Pattern 5: Quality-Attestation Task Dependencies

**Universal principle:** In a task dependency graph, quality audit tasks are structural gates — not parallel observations. Consumer tasks (UI built on an API, tests written for a component) must not start until both the implementation AND its quality review are complete.

**The rule:**
```
Consumer task blocked by: Implementation task + Quality audit task
NOT blocked by: Implementation task alone
```

Apply this rule in every orchestrator instruction file and every team composition template.

---

### Pattern 6: The Mapper Completeness Test

**Universal principle:** Any registry-based system (mapper, feature flags, route tables, permission configs) must have a test that fails when a new item exists in the codebase but not in the registry. Without this test, registries silently become incomplete.

**Template test for any registry:**
```typescript
it("every [source-item] has a [registry] entry", async () => {
  const sourceItems = await glob("src/[pattern]");
  for (const item of sourceItems) {
    const key = deriveKeyFromPath(item);
    expect(registry.has(key), `No registry entry for: ${item}`).toBe(true);
  }
});
```

Run this test in pre-commit and CI. It catches the gap the moment it is introduced, not weeks later when a hook fails silently.

---

*Document version: 1.0 — March 2026*
*Produced by: systems-thinker · ai-designer · sdet-engineer debate team*
*Based on: AGENTIC_WORKFLOW_PLAN_SDLC_v2_AGENT_TEAMS.md*
