# Agentic Workflow Plan v2.0 — Agent Teams Edition
## Worship Ministry App · Personal Learning Bed → Team Playbook

> **Supersedes:** `AGENTIC_WORKFLOW_PLAN_SDLC.md` (v1.0)
>
> **What changed:** Agent Teams are now enabled. This is not an incremental improvement to v1 —
> it is a fundamentally different execution model. Sequential subagent delegation is replaced by
> a parallel, self-coordinating team with a shared task board and real-time inter-agent messaging.
> Everything in the quality control architecture must be re-evaluated under this new model.

---

## Table of Contents

1. [What Agent Teams Actually Are — The Capability Model](#1-what-agent-teams-actually-are--the-capability-model)
2. [What Changed vs v1 — The Delta](#2-what-changed-vs-v1--the-delta)
3. [Current Inventory — Honest Assessment](#3-current-inventory--honest-assessment)
4. [Gap Analysis — What Is Still Missing](#4-gap-analysis--what-is-still-missing)
5. [Quality Control Architecture — Rethought for Parallel Execution](#5-quality-control-architecture--rethought-for-parallel-execution)
6. [The Target Architecture — Full Agent Team Workflow](#6-the-target-architecture--full-agent-team-workflow)
7. [SDLC Integration — Every Phase Remapped](#7-sdlc-integration--every-phase-remapped)
8. [Role Plays — Team Model](#8-role-plays--team-model)
   - [Building a Feature](#81-building-a-feature)
   - [Fixing a Bug](#82-fixing-a-bug)
   - [Testing a Feature](#83-testing-a-feature)
9. [Roadmap — How to Get There with Teams](#9-roadmap--how-to-get-there-with-teams)
10. [The Ultimate Goal — What Full Autonomous Looks Like](#10-the-ultimate-goal--what-full-autonomous-looks-like)
11. [Team Introduction Playbook — Updated](#11-team-introduction-playbook--updated)

---

## 1. What Agent Teams Actually Are — The Capability Model

Before analysing the impact, it is essential to be precise about what agent teams provide and what they do not. Many developers conflate "multi-agent" with "parallel agents." These are related but distinct.

### The Primitives

| Primitive | What It Does | Why It Matters |
|---|---|---|
| `TeamCreate` | Creates a named team with a shared task directory | The coordination substrate — all agents on the team share this |
| `TaskCreate` | Adds a task to the shared board with subject, description, status | The unit of work — granular enough for one agent to own |
| `TaskList` | Reads all tasks — status, owner, blockers | How agents find available work without being told |
| `TaskUpdate` | Changes status, assigns owner, sets dependencies | How agents claim work, declare completion, block/unblock tasks |
| `SendMessage` | Direct message, broadcast, or shutdown signal between agents | Real-time coordination without going through orchestrator |
| `Task (team_name + name)` | Spawns a named agent that joins the team | How the team is populated with workers |

### What This Enables That Did Not Exist Before

**v1 model — Sequential delegation:**
```
Orchestrator spawns Worker A
  → waits for Worker A to return a message
  → reads the message
  → spawns Worker B with context from A's message
  → waits for Worker B
  → spawns Worker C
  ...
```
The orchestrator is a bottleneck. Every handoff requires orchestrator attention. Workers cannot communicate directly. Total time = sum of all worker times.

**v2 model — Parallel team execution:**
```
Orchestrator creates 8 tasks on shared board with dependency chain
Orchestrator spawns Worker A, B, C, D simultaneously
  Workers autonomously claim available tasks
  Workers message each other directly ("API spec ready, starting implementation")
  Workers create new tasks when they discover additional work
  Orchestrator monitors task board, handles escalations only
  When all tasks complete → orchestrator assembles PR
```
Total time ≈ longest critical path, not sum of all work. Workers self-direct. Orchestrator focuses on decision-making, not traffic-cop.

### What Agent Teams Do NOT Change

- The 6-layer quality stack still applies. Parallel execution does not replace quality gates — it makes them more urgent.
- Human checkpoints are still required (spec approval, plan approval, PR merge).
- PostToolUse hooks are still needed — in fact they become MORE critical (see Section 5).
- Intent tests, pre-commit, CI are unchanged.
- Workers still need clear, bounded scope — unconstrained agents produce chaos at any parallelism level.

---

## 2. What Changed vs v1 — The Delta

### 2.1 Execution Model: Sequential → Parallel

| Dimension | v1 (Sequential) | v2 (Agent Teams) |
|---|---|---|
| Worker execution | One at a time | Simultaneous |
| Orchestrator role | Traffic cop at every handoff | Planner + exception handler only |
| Worker communication | Via orchestrator only | Direct messaging (SendMessage) |
| Work discovery | Orchestrator assigns explicitly | Workers claim from shared board |
| Progress visibility | Orchestrator has it; developer doesn't | Task board is transparent to all |
| Failure recovery | Orchestrator re-spawns manually | Tasks become unclaimed; any worker can pick up |
| Feature delivery time | Sum of all worker times | Critical path time only |

### 2.2 Orchestration: Ad-hoc → Structured

v1 had no orchestrator — it described one but did not define how it works.

v2 has a concrete model: the orchestrator creates tasks with explicit dependencies using `addBlockedBy`. This means:
- Work that must be sequential is enforced (security audit blocked until API route exists)
- Work that can be parallel is automatically available to multiple workers simultaneously
- The dependency graph IS the implementation plan, made executable

### 2.3 Quality Checks: Sequential → Parallel

v1 described quality as a sequential pipeline: implement → test → audit.

v2 enables continuous parallel quality:
- Security auditor claims audit tasks the moment implementation tasks complete
- Test worker writes tests as implementation workers produce code (not after)
- Multiple quality agents run simultaneously, not one after another
- A new bug introduced by Worker A can be caught by the quality worker BEFORE Worker B builds on it

### 2.4 What v1 Got Wrong

v1 described the orchestrator as spawning workers, waiting, then spawning the next worker. Under agent teams, this is the anti-pattern — it recreates the sequential bottleneck using the new primitives. The correct model: create all tasks upfront with dependency chains, spawn all workers simultaneously, let the task board coordinate.

---

## 3. Current Inventory — Honest Assessment

### 3.1 What Exists and Is Usable Now

| Layer | Asset | Location | Status |
|---|---|---|---|
| **Team primitive** | TeamCreate, TaskCreate, TaskList, TaskUpdate, SendMessage | Claude Code built-in | **Enabled — ready to use** |
| **Skills** | 9 reasoning personas | `.claude/skills/` | Mature |
| **Named agents** | 5 specialists (debugger, security-auditor, etc.) | `.claude/agents/` | Defined, manually invoked |
| **Planning pipeline** | 6-phase feature pipeline | `.claude/prompts/` | Exists, rarely used |
| **Intent tests** | 22 tests, 5 pages | `__tests__/intent/` | Active, all passing |
| **Impact mapper** | File → test mapping | `shadow-agent/mapper.ts` | Works, ready for hooks |
| **Pre-commit hook** | Intent tests on commit | `.husky/pre-commit` | Active |
| **705+ tests** | Unit, integration, component | `__tests__/` | Active, CI-ready |
| **CLAUDE.md rules** | Non-negotiable guardrails | `/CLAUDE.md` | Active |
| **Memory** | Cross-session learning | `MEMORY.md` | Active |

### 3.2 What Has Been Done With Agent Teams So Far

In this project, multi-agent work has happened informally via the Task tool (subagent delegation), but NOT yet using the full team primitives. Specifically:

- **Used:** Task tool to spawn subagents (implement in Bash subagent, etc.)
- **Used:** Multiple agents in sequence (SDET debate → Bash implementation → verify)
- **NOT YET USED:** TeamCreate with shared task board
- **NOT YET USED:** Parallel workers claiming tasks autonomously
- **NOT YET USED:** SendMessage between running workers
- **NOT YET USED:** Task dependencies blocking/unblocking work

The gap is not conceptual — it is structural. The team primitives exist but no workflow has been designed around them.

### 3.3 What Is Missing That v1 Also Identified (Still True)

- Layer 2 quality gates (PostToolUse hooks) — still the highest-priority gap
- Intent test coverage (5/11 pages covered)
- Documented orchestration patterns
- Automated PR review agent
- Staging smoke tests

These gaps are AMPLIFIED by agent teams. Parallel workers producing parallel changes with no in-session quality validation is riskier than sequential changes with no validation.

---

## 4. Gap Analysis — What Is Still Missing

### Gap 1: No Team Compositions Defined (New in v2)

**The problem:** Agent teams require knowing upfront: how many workers, what roles, what tasks, what dependencies. Without this, the orchestrator must improvise every time, producing inconsistent results.

**What is needed:**
```
Team composition templates:
  - "ui-only feature"     → orchestrator + ui-worker + test-worker
  - "api-only feature"    → orchestrator + api-worker + security-worker + test-worker
  - "full-stack feature"  → orchestrator + api-worker + ui-worker + db-worker + security-worker + test-worker
  - "bug fix"             → orchestrator + debugger + test-worker
  - "migration"           → orchestrator + db-worker + migration-reviewer
```

Each template defines: worker names, their task scope, communication protocols, and escalation rules.

**Status:** Not defined anywhere.

---

### Gap 2: No Worker Agent Instructions (New in v2)

**The problem:** Workers spawned into a team need to know: how to read the task board, how to claim tasks, what "done" means for their role, when to message other workers vs the orchestrator, when to escalate.

**What is needed:** `.claude/agents/` definitions for each worker type:
- `api-worker.md` — claims api/ tasks, runs security hooks after each file, messages test-worker when done
- `ui-worker.md` — claims page/ tasks, self-validates via intent tests, does not modify api/ files
- `test-worker.md` — writes tests for every completed implementation task, updates mapper.ts
- `security-worker.md` — audits api/ changes as they appear, blocks orchestrator on finding critical issues
- `db-worker.md` — writes migrations only, never modifies src/, immediately messages migration-reviewer

**Status:** Current `.claude/agents/` files describe specialist agents (debugger, auditor) but not team-worker agents.

---

### Gap 3: No Inter-Agent Communication Protocol (New in v2)

**The problem:** Workers messaging each other without a defined protocol produces ambiguous handoffs. If API worker messages test-worker "done," does test-worker know which files were changed? Which endpoint was created? What the payload shape is?

**What is needed:** A structured message format for handoffs:
```
Worker handoff message format:
  FROM: api-worker
  TO: test-worker
  EVENT: task-complete
  TASK: "Implement POST /api/availability/export"
  FILES_CHANGED: ["src/app/api/availability/export/route.ts"]
  ENDPOINT: "POST /api/availability/export"
  PAYLOAD: "{ memberId: string, format: 'csv' | 'json' }"
  RESPONSE: "{ data: string, filename: string }"
  NOTES: "Tenant-scoped. Requires Admin or Coordinator role."
```

This allows the receiving worker to act without needing to re-read the orchestrator's context.

**Status:** Not defined.

---

### Gap 4: Layer 2 Quality Gates Still Empty (Carried from v1, Now More Urgent)

**The problem:** With sequential subagents, a quality failure stops one worker. With parallel agent teams, Worker A's bug can be silently incorporated by Workers B and C before the quality gate fires. The blast radius of an undetected bug is multiplied.

**Example failure scenario without hooks:**
```
api-worker adds route without tenant_id filter (IDOR bug)
  ↓ simultaneously
ui-worker builds UI that calls this route
  ↓ simultaneously
test-worker writes tests that mock the route (mocks hide the bug)
  ↓ all three complete
orchestrator assembles PR
  ↓
security audit happens at PR review stage (too late)
  ↓
bug ships to production
```

**With PostToolUse hooks:**
```
api-worker adds route without tenant_id filter
  ↓ immediately
PostToolUse hook fires → security auditor agent runs
  ↓
Hook returns: "BLOCK: missing .eq('tenant_id', tenantId) on line 12"
  ↓
api-worker fixes before reporting task complete
  ↓
ui-worker and test-worker never see the broken version
```

**The PostToolUse hooks are THE highest priority item before agent teams are used at scale.**

**Status:** Still not implemented.

---

### Gap 5: No Task Board Design Patterns (New in v2)

**The problem:** Poorly designed task breakdowns cause workers to block each other unnecessarily or — worse — to work on overlapping file scope simultaneously (merge conflicts, contradictory changes).

**Rule 1:** Tasks that touch the same file must be sequential (one blocks the other).
**Rule 2:** Tasks that touch different files can be parallel.
**Rule 3:** Quality audit tasks must be blocked by the implementation task they audit.
**Rule 4:** The PR creation task must be blocked by ALL other tasks.
**Rule 5:** Every task must have a "definition of done" that the worker can verify autonomously.

**Status:** Not documented. Needs to be in the orchestrator agent instructions.

---

### Gap 6: No Human Checkpoint Protocol (Carried + Amplified from v1)

**The problem:** In a parallel team, it is less obvious when to pause for human review. In v1, the orchestrator could pause between sequential steps. In v2, work is happening on multiple fronts — when does the developer look?

**The needed protocol:**
```
Mandatory human checkpoints:
  1. After spec + plan are complete — before spawning any workers
  2. If any security-worker reports a CRITICAL finding
  3. If any migration is involved — before db-worker applies it
  4. Before PR is created — orchestrator summarises all worker reports

Non-mandatory checkpoints (orchestrator uses judgement):
  - If task board shows 2+ tasks blocked by the same issue
  - If a worker has been in_progress on a task for more than its estimated time
  - If a worker reports an ambiguity that affects architectural decisions
```

**Status:** Not defined.

---

## 5. Quality Control Architecture — Rethought for Parallel Execution

The 6-layer stack from v1 is correct. What changes is the urgency of each layer and the new risk surface that parallel execution introduces.

### The Updated 6-Layer Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 6: PRODUCTION                                                │
│  • Error monitoring (Sentry / Supabase logs)                       │
│  • User feedback                                                    │
│  • Last resort — bugs here cost real users                          │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 5: POST-DEPLOY / STAGING                                     │
│  • Playwright smoke (3-5 paths) [MISSING]                           │
│  • Deploy verification agent [MISSING]                              │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 4: CI / PR MERGE GATE                                        │
│  • Full 705+ test suite                                             │
│  • Intent tests (22 journeys)                                       │
│  • ESLint + TypeScript build                                        │
│  • Automated PR review agent [MISSING]                              │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3: PRE-COMMIT                                                │
│  • Husky: npm run test:intent [EXISTS]                              │
│  • ESLint [CI only — should be pre-commit too]                      │
│  • Migration safety check [MISSING]                                 │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2: IN-SESSION / PER-EDIT             ← CRITICAL GAP          │
│  • PostToolUse intent guard [MISSING]                               │
│  • PostToolUse API security auditor [MISSING]                       │
│  • PostToolUse modal regression guard [MISSING]                     │
│  • PostToolUse migration safety reviewer [MISSING]                  │
│  • NOTE: With parallel workers, Layer 2 failure = N workers         │
│    building on broken code simultaneously                           │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 1: RULES & GUARDRAILS                                        │
│  • CLAUDE.md rules [EXISTS — loaded into every agent context]       │
│  • Role default = null pattern [DOCUMENTED]                         │
│  • Tenant-scoped query rules [DOCUMENTED]                           │
│  • try/catch/finally handler pattern [DOCUMENTED]                   │
└─────────────────────────────────────────────────────────────────────┘
```

### New Risk: Parallel Contamination

This risk did not exist in v1. With agent teams, a bug introduced by Worker A can propagate to Workers B, C, D before any quality gate fires — because they are all running simultaneously.

**Mitigation hierarchy (in order of effectiveness):**

1. **Layer 2 hooks** — catch the bug at the moment of the edit, before any other worker sees the broken file
2. **Task dependency design** — tasks that depend on the same output must be sequential; parallel tasks must not touch shared files
3. **Worker scope discipline** — api-worker never touches UI files; ui-worker never touches API files. No overlap = no contamination
4. **Security worker as parallel quality thread** — security-worker runs alongside api-worker as a dedicated quality thread, not a post-hoc check

### Quality Gates Mapped to Team Roles

| Quality Check | Who Does It | When | How |
|---|---|---|---|
| Intent regression | PostToolUse hook | After every src/ edit | Blocks the editing worker |
| API security (tenant isolation) | security-worker (task) + PostToolUse hook | After every api/ file created | Worker task + hook |
| Modal regression | PostToolUse hook | After every page.tsx edit | Blocks the editing worker |
| Migration safety | migration-reviewer task + PostToolUse hook | After every .sql file created | Worker task + hook |
| Full test suite | CI | On PR creation | Blocks merge |
| Code quality review | code-improvement-advisor (task) | Before PR created | Worker task |
| Staging smoke | Playwright (post-deploy) | After deploy | Blocks "shipped" status |

### The Critical Insight for Agent Teams + Quality

> **The PostToolUse hooks are not just "nice to have" for agent teams. They are the containment layer that prevents parallel contamination. Without them, agent teams produce parallel unvalidated changes, and quality control collapses to a single late-stage gate (CI) that is too slow and too late.**

---

## 6. The Target Architecture — Full Agent Team Workflow

### Team Topology for a Full-Stack Feature

```
Developer: "Add availability export to CSV"
    │
    ▼
TEAM: feature-[name]
    │
    ├── ORCHESTRATOR (team lead)
    │   Responsibilities:
    │   • Run feature-planning-pipeline phases 1-2 (spec + plan)
    │   • Pause for human approval of spec and plan
    │   • Create task board with dependency graph
    │   • Spawn workers with team context
    │   • Monitor task board — do NOT micromanage workers
    │   • Handle escalations (worker blocked, critical finding, scope change)
    │   • Assemble final PR when all tasks complete
    │   • Request human approval before merge
    │
    ├── SHARED TASK BOARD (the coordination substrate)
    │   ┌─────────────────────────────────────────────────────────┐
    │   │ ID  Subject                          Status    Owner    │
    │   │ ─── ───────────────────────────────── ───────── ─────── │
    │   │  1  Write API spec + payload schema  completed  orch   │
    │   │  2  Implement GET /api/avail/export  in_prog   api-w   │
    │   │  3  Audit API route [blocked by 2]   pending    —      │
    │   │  4  Add export button to avail page  in_prog   ui-w    │
    │   │  5  Write intent tests [blocked by 4]pending    —      │
    │   │  6  Run full intent suite [blk by 5] pending    —      │
    │   │  7  Code quality review [blk by 2,4] pending    —      │
    │   │  8  Create PR [blk by 3,6,7]         pending    —      │
    │   └─────────────────────────────────────────────────────────┘
    │
    ├── api-worker
    │   • Claims Task 2
    │   • Implements GET /api/availability/export
    │   • PostToolUse hook fires on every file edit → security auditor
    │   • Messages test-worker: "endpoint ready, payload: {data: Row[], filename: string}"
    │   • Messages orchestrator if scope ambiguity arises
    │   • Marks Task 2 complete → Task 3 unblocks automatically
    │
    ├── ui-worker
    │   • Claims Task 4 (no blockers — runs in parallel with api-worker)
    │   • Implements export button in availability page
    │   • PostToolUse hook fires on page edit → intent guard runs
    │   • If hook fails: fixes immediately, does not mark task complete with failing tests
    │   • Messages test-worker: "UI component ready"
    │   • Marks Task 4 complete → Task 5 unblocks
    │
    ├── test-worker
    │   • Waits for Task 5 to unblock (blocked by Task 4)
    │   • Claims Task 5 when ui-worker completes Task 4
    │   • Uses spec from Task 1 + handoff messages to write tests
    │   • Writes __tests__/intent/availability.intent.test.tsx
    │   • Updates shadow-agent/mapper.ts
    │   • Claims Task 6: runs npm run test:intent → all pass
    │   • Marks Task 6 complete
    │
    └── security-worker
        • Waits for Task 3 to unblock (blocked by Task 2)
        • Claims Task 3 when api-worker completes Task 2
        • Runs full tenant-security-auditor review on the new route
        • Claims Task 7 (code quality) when Tasks 2 and 4 both complete
        • Runs code-improvement-advisor on all changed files
        • Reports findings to orchestrator before marking Task 7 complete
        • If critical finding: messages orchestrator immediately (does not wait)
```

### The Orchestrator's Job Is Not Coding

This is the most important mental model shift. In v1, the orchestrator could also write code. In v2 with agent teams, the orchestrator's job is:

1. **Understand** the feature deeply enough to break it into unambiguous tasks
2. **Design** the task dependency graph (what blocks what)
3. **Spawn** the right team composition for this feature type
4. **Monitor** the task board passively — only intervene on escalations
5. **Verify** that all quality gates reported green before creating the PR
6. **Escalate** to human at defined checkpoints

If the orchestrator is writing code, the team topology is wrong. The orchestrator should be planning the next feature or monitoring the current one.

---

## 7. SDLC Integration — Every Phase Remapped

### Phase 1: Discovery & Definition (Unchanged from v1)

**Team composition:** Orchestrator only. No workers spawned yet.

```
Orchestrator:
  1. Reads feature description
  2. Uses product-manager skill → user stories + acceptance criteria
  3. Uses systems-thinking skill → dependencies, tenant implications, risks
  4. Writes .claude/context/features/[name]/spec.md

HUMAN CHECKPOINT — spec must be approved before Phase 2.
```

**Quality gate:** Human approval. No code exists yet. This is the cheapest checkpoint.

---

### Phase 2: Architecture & Planning (Orchestrator defines the task graph)

**Team composition:** Orchestrator only. This phase PRODUCES the task board.

```
Orchestrator:
  1. Uses saas-architect skill → data model, API design, tenant isolation
  2. Uses staff-engineer skill → file list, implementation sequence
  3. Uses SDET skill → test strategy, edge cases, acceptance tests
  4. Determines team composition: which worker types needed
  5. Creates ALL tasks upfront with dependency graph (no tasks added during execution)
  6. Writes .claude/context/features/[name]/plan.md

Task graph design rules:
  • Tasks touching same file = sequential (addBlockedBy)
  • Tasks touching different files = parallel
  • Quality audit task = blocked by the implementation task it audits
  • PR task = blocked by ALL other tasks
  • Each task has an explicit "definition of done"

HUMAN CHECKPOINT — plan must be approved before workers are spawned.
```

**Quality gate:** Human approval of implementation plan AND task graph.

---

### Phase 3: Parallel Implementation

**Team composition:** All workers spawned simultaneously after plan approval.

```
Orchestrator spawns in parallel:
  Task tool: { team_name: "feature-x", name: "api-worker",    subagent_type: "general-purpose" }
  Task tool: { team_name: "feature-x", name: "ui-worker",     subagent_type: "general-purpose" }
  Task tool: { team_name: "feature-x", name: "test-worker",   subagent_type: "general-purpose" }
  Task tool: { team_name: "feature-x", name: "security-worker", subagent_type: "general-purpose" }

Each worker on startup:
  1. Reads team config → discovers other workers by name
  2. Reads feature spec and plan
  3. Calls TaskList → finds available unblocked tasks
  4. Claims the lowest-ID available task (TaskUpdate: status=in_progress, owner=self)
  5. Executes task
  6. Self-validates (runs tests, checks hooks passed)
  7. Marks task complete (TaskUpdate: status=completed)
  8. Goes back to TaskList → claims next available task
  9. If no tasks available → messages orchestrator and goes idle

PostToolUse hooks run on every file edit by every worker:
  • src/app/api/** → security auditor hook
  • src/app/admin/**/page.tsx → intent guard hook
  • supabase/migrations/*.sql → migration safety hook

Workers CANNOT mark a task complete if any hook reported failure.
```

**Quality gates:** PostToolUse hooks on every edit (Layer 2). Task self-validation before completion.

---

### Phase 4: Continuous Testing (Runs in Parallel with Implementation)

**Note:** In the team model, testing is not a sequential phase — it is a parallel activity. The test-worker operates concurrently with implementation workers.

```
test-worker behaviour:
  • Reads feature spec → understands what journeys need coverage
  • Monitors task board — as implementation tasks complete, test tasks unblock
  • Writes intent tests for each completed UI task
  • Writes integration tests for each completed API task
  • Updates shadow-agent/mapper.ts for new file mappings
  • Runs npm run test:intent after writing each test file — confirms green
  • Does NOT mark test tasks complete with failing tests

When all implementation tasks complete:
  test-worker claims "Run full suite" task:
  • npm run test:intent → 22+ tests
  • npm run test:integration (targeted to new routes)
  • Reports: X new tests, all passing, coverage maintained
```

**Quality gate:** test-worker cannot complete without all new tests green.

---

### Phase 5: Pre-Merge Review

```
When all tasks except PR are complete, orchestrator:
  1. Reads all worker completion reports from task comments
  2. Verifies: all hooks passed, all tests green, security audit clean
  3. If any gap: creates new task, assigns to appropriate worker, waits
  4. Generates PR body from worker reports (structured summary)
  5. Creates PR via gh pr create
  6. Posts agent team summary as PR comment:
       - Files changed (by which worker)
       - Tests added
       - Hook results (all passed / specific findings)
       - Security audit result
       - Open questions (if any)

CI (unchanged from v1):
  • Full 705+ test suite
  • npm run test:intent
  • npm run lint + build
  • [future] Automated PR review agent

HUMAN CHECKPOINT — PR review. Developer reads agent summary, not raw diffs.
```

**Quality gate:** Human approval. This is the last gate before merge.

---

### Phase 6: Post-Merge (Unchanged from v1, Still Missing)

```
[FUTURE] Post-merge agent:
  • Verifies deployment
  • Playwright smoke tests against staging
  • Posts result to PR
```

---

## 8. Role Plays — Team Model

### 8.1 Building a Feature

**Feature:** "Members can export their roster assignments to a PDF"

```
PHASE 1: DEFINITION (Orchestrator alone)
─────────────────────────────────────────
Orchestrator uses PM skill:
  User story: "As a Musician, I want to download my upcoming roster
               as a PDF so I can keep it offline"
  Acceptance criteria:
    - Export button on portal roster view (not admin)
    - PDF contains: member name, all upcoming dates, assigned role per date
    - Respects the member's magic-link auth (no admin login needed)
    - Tenant-scoped: only the member's own assignments
  Non-goals: admin bulk export, email delivery, historical data

Human approves spec. ✓

PHASE 2: PLANNING (Orchestrator designs task graph)
──────────────────────────────────────────────────
Staff-engineer skill:
  API: GET /api/portal/[token]/roster-export?format=pdf
  UI: export button in src/app/portal/[token]/roster/page.tsx
  Library: use existing html2canvas or server-side approach
  No migration needed (reads existing roster_assignments table)

SDET skill:
  Intent tests: portal member sees export button, download triggers, PDF not empty
  Integration: GET with valid token → 200, invalid token → 401, wrong tenant → 404
  Edge case: member with no assignments → empty PDF with message (not 500)

Task graph created:
  Task 1: Spec complete [completed - orchestrator]
  Task 2: Implement GET /api/portal/[token]/roster-export [api-worker]
  Task 3: Audit portal export API [security-worker, blocked by 2]
  Task 4: Add export button to portal roster page [ui-worker]
  Task 5: Write intent tests for export [test-worker, blocked by 4]
  Task 6: Write integration tests for export API [test-worker, blocked by 2]
  Task 7: Run full intent suite [test-worker, blocked by 5]
  Task 8: Code quality review [security-worker, blocked by 2,4]
  Task 9: Create PR [orchestrator, blocked by 3,7,8]

Human approves plan and task graph. ✓

PHASE 3: PARALLEL EXECUTION
────────────────────────────
Orchestrator spawns simultaneously:
  api-worker, ui-worker, test-worker, security-worker

T+0min: All workers read task board
  api-worker  → claims Task 2 (no blockers)
  ui-worker   → claims Task 4 (no blockers)
  test-worker → no unblocked tasks yet → reads spec, prepares test structure
  security-worker → no unblocked tasks yet → reads spec, prepares audit checklist

T+8min: api-worker completes Task 2
  api-worker marks Task 2 complete
  PostToolUse hook fired twice during implementation:
    Hook 1: "PASS — tenant_id filter confirmed on line 18"
    Hook 2: "PASS — magic-link token validated before data access"
  api-worker messages test-worker:
    "Route ready: GET /api/portal/[token]/roster-export
     Returns: { assignments: [{ date, role, status }], memberName }
     Auth: validates magic_token against members table
     Tenant scope: token lookup is tenant-scoped"
  Task 3 and Task 6 unblock automatically

T+8min: security-worker claims Task 3 (just unblocked)
  Runs full tenant-security-auditor review
  Confirms: token validates tenant, no cross-tenant read possible
  Marks Task 3 complete: "PASS — no IDOR vectors"

T+10min: ui-worker completes Task 4
  PostToolUse hook fired:
    Hook: "PASS — all 3 portal journey intent tests still passing"
  ui-worker messages test-worker:
    "Export button added to portal roster page
     Button calls /api/portal/[token]/roster-export
     Download triggers on success, shows error toast on failure"
  Task 5 unblocks

T+10min: test-worker claims Tasks 5 and 6 (both just unblocked)
  Writes __tests__/intent/portal-roster.intent.test.tsx (Task 5)
  Writes __tests__/integration/portal-roster-export.test.ts (Task 6)
  Claims Task 7: npm run test:intent → 25 tests, all pass
  Marks Tasks 5, 6, 7 complete

T+12min: security-worker claims Task 8 (Tasks 2 and 4 both complete)
  Runs code-improvement-advisor on all changed files
  Finding: "Non-critical — PDF generation could be extracted to utility"
  Marks Task 8 complete, includes finding in report

T+13min: Only Task 9 remains (all others complete)
  Orchestrator reads all task completion reports
  All hooks: PASS
  All tests: PASS (3 new intent tests, 4 new integration tests)
  Security: PASS (one non-critical finding noted)
  Orchestrator creates PR with structured agent summary

T+14min: Developer reviews PR summary (2 minutes)
  Agent summary shows: 3 files changed, all quality gates green
  Developer approves
  Total human time: ~12 minutes
  Total elapsed time: ~16 minutes
```

**What made this faster than v1:**
- Tasks 2 and 4 ran simultaneously (8 minutes, not 16)
- Security audit (Task 3) started the moment Task 2 finished, not after Task 4
- Test worker used the waiting time to prepare test structure
- No orchestrator bottleneck between handoffs

---

### 8.2 Fixing a Bug

**Bug:** "Roster page freezes when saving a draft with unassigned members"

```
TEAM: bugfix-roster-freeze (small team, fast)

Orchestrator creates tasks:
  Task 1: Diagnose root cause [debugger-agent]
  Task 2: Apply fix [dev-worker, blocked by 1]
  Task 3: Verify fix with intent tests [test-worker, blocked by 2]
  Task 4: Create PR [orchestrator, blocked by 3]

Spawns: debugger-agent, dev-worker, test-worker

debugger-agent claims Task 1:
  Reads roster/page.tsx → handleSaveDraft
  Finds: assignments.map(a => a.role.id) — TypeError when role is null
  Finds: try/catch missing, setBusy(false) before await loadRoster()
  Messages dev-worker:
    "Three issues found (all CLAUDE.md Rule 7 violations):
     1. Line 287: a.role.id — null guard missing
     2. No try/catch around handler
     3. setBusy(false) at line 301 should be in finally
     Fix: filter nulls, wrap in try/catch/finally, move setBusy to finally"
  Marks Task 1 complete

dev-worker claims Task 2:
  Applies the three fixes
  PostToolUse hook fires after edit:
    Intent guard: PASS — roster journey tests all green
    async-handler-auditor: PASS — try/catch/finally confirmed correct
  Marks Task 2 complete

test-worker claims Task 3:
  Runs npm run test:intent → 22/22 pass
  Verifies: no regression in roster tests
  Marks Task 3 complete

Orchestrator creates PR:
  "fix: guard roster save against null role — prevents dark screen"
  PR body includes debugger's root cause analysis
  3 violations fixed, all intent tests green

Total elapsed: ~8 minutes
Human intervention: approve PR (2 minutes)
```

---

### 8.3 Testing a Feature (Quality Team Pattern)

**Scenario:** A new Handbook edit permissions feature needs full quality coverage.

```
TEAM: qa-handbook-permissions

Orchestrator creates tasks:
  Task 1: Analyse feature scope and identify test matrix [SDET-worker]
  Task 2: Write unit tests [test-worker, blocked by 1]
  Task 3: Write integration tests [test-worker, blocked by 1]
  Task 4: Write intent tests [test-worker, blocked by 1]
  Task 5: Security audit of handbook permissions API [security-worker, blocked by 1]
  Task 6: Run full test suite [test-worker, blocked by 2,3,4]
  Task 7: Report QA summary to orchestrator [orchestrator, blocked by 5,6]

Spawns: SDET-worker, test-worker, security-worker

SDET-worker claims Task 1:
  Analyses feature, produces test matrix:
    Unit: 4 tests for hasHandbookEditPermission()
    Integration: 6 tests for PUT /api/settings/handbook-permissions
    Intent: 6 tests across settings + handbook pages
    Open risk flagged: Admin-removes-Admin not server-side validated
  Messages test-worker + security-worker with matrix
  Marks Task 1 complete → Tasks 2,3,4,5 unblock

test-worker + security-worker claim in parallel:
  test-worker: Claims Task 2 (unit tests)
  security-worker: Claims Task 5 (security audit)

test-worker (sequential, each blocks next by convention):
  Task 2: 4 unit tests — all pass ✓
  Task 3: 6 integration tests — all pass ✓
  Task 4: 6 intent tests — 5 pass, 1 fail
    FAIL: "WorshipLeader sees edit controls" → button not rendered
    test-worker messages orchestrator:
      "Intent test failure: WorshipLeader role not in default permitted roles.
       Feature may be incomplete or spec ambiguous. Human review needed."

HUMAN CHECKPOINT — orchestrator escalates to developer:
  "Should WorshipLeader have handbook edit by default? Test says no."
  Developer: "Yes, add WorshipLeader to default permitted roles"

  dev-worker added to team, fixes default roles
  PostToolUse hook fires → intent test now passes
  test-worker marks Task 4 complete

security-worker (Task 5):
  Finds: Admin-removes-Admin bug (UI-only guard)
  Messages orchestrator: "CRITICAL: server-side guard missing"
  Orchestrator creates Task 8: "Add server-side Admin-always-permitted guard"
  dev-worker claims Task 8, implements guard
  security-worker re-runs audit: PASS

test-worker claims Task 6:
  Full suite: 718 tests (13 new), all pass

Orchestrator writes QA report:
  13 tests added | 1 critical bug found and fixed | 1 spec ambiguity resolved
  All tests green | Feature safe to ship
```

**What agent teams added here:**
- SDET, testing, and security ran in parallel (not sequential)
- Critical bug found by security-worker while test-worker was still writing tests
- Spec ambiguity surfaced and resolved before PR was created
- Test failure escalated to human at the right moment, not buried in CI output

---

## 9. Roadmap — How to Get There with Teams

### The Correct Sequencing

The order matters. Building agent teams before closing Layer 2 (hooks) is the wrong order. Parallel workers without quality hooks = parallel unvalidated changes.

```
MUST DO BEFORE AGENT TEAMS AT SCALE:
  ✓ Phase A: Close Layer 2 (PostToolUse hooks)

PARALLEL WITH EARLY TEAM EXPERIMENTS:
  Phase B: Define team compositions + worker agent instructions

AFTER TEAM PATTERNS ARE WORKING:
  Phase C: Automated PR workflow
  Phase D: Full orchestrator + PR assembly
  Phase E: Staging validation
```

---

### Phase A — Close Layer 2 (Do First, Before Teams)

| Item | What | Priority |
|---|---|---|
| A1 | PostToolUse intent guard hook | **Now — highest priority** |
| A2 | PostToolUse API security hook | Now |
| A3 | PostToolUse modal regression hook | This week |
| A4 | PostToolUse migration safety hook | This week |
| A5 | Add ESLint to pre-commit (not just CI) | This week |

**Implementation:** `.claude/settings.json` + `.claude/hooks/` scripts using existing `shadow-agent/mapper.ts`.

---

### Phase B — Define Team Compositions + Worker Instructions

| Item | What | Where |
|---|---|---|
| B1 | Write `api-worker.md` agent instructions | `.claude/agents/` |
| B2 | Write `ui-worker.md` agent instructions | `.claude/agents/` |
| B3 | Write `test-worker.md` agent instructions | `.claude/agents/` |
| B4 | Write `security-worker.md` agent instructions | `.claude/agents/` |
| B5 | Write `db-worker.md` agent instructions | `.claude/agents/` |
| B6 | Write team composition templates | `.claude/context/TEAM-COMPOSITIONS.md` |
| B7 | Define inter-agent message format | `.claude/context/AGENT-PROTOCOL.md` |
| B8 | Write orchestrator instructions | `.claude/agents/orchestrator.md` |
| B9 | Expand intent tests to all 11 pages | `__tests__/intent/` |

---

### Phase C — Automated PR Workflow

| Item | What |
|---|---|
| C1 | Orchestrator assembles agent team reports into structured PR body |
| C2 | GitHub Actions: Claude API reviews PR, posts structured comment |
| C3 | PR impact script: map diff → targeted test run in CI |

---

### Phase D — Full Orchestrator + Staging

| Item | What |
|---|---|
| D1 | Orchestrator agent that runs full feature planning pipeline autonomously |
| D2 | Playwright smoke suite (5 tests against staging) |
| D3 | Post-deploy verification agent |

---

### Timeline for This Project as Learning Bed

```
Week 1:   Phase A (all 5 hooks) ← containment before teams
Week 2:   Phase B1-B5 (worker agent definitions)
Week 3:   Phase B6-B8 (team compositions + orchestrator)
          First real team run: simple bug fix with 2 workers
Week 4:   Phase B9 (full intent coverage: 5→11 pages)
Month 2:  Phase C (PR workflow automation)
          Second team run: full-stack feature with 4 workers
Month 3:  Phase D (orchestrator planning autonomy + staging)
          Goal: full feature built by team with human reviewing only spec + PR
```

---

## 10. The Ultimate Goal — What Full Autonomous Looks Like

This is the target state. Not "Claude assists a developer" but "a team of agents builds a feature and a developer reviews the output."

### The Vision

```
Developer types in Claude Code:
  "Add a feature where worship leaders can see the song stats
   for the last 6 months — which songs were used, how many times,
   and which categories are over/under-represented"

Claude Code (orchestrator):
  1. Creates feature team
  2. Runs full planning pipeline autonomously (PM + SaaS Architect + Staff Eng + SDET)
  3. Outputs spec.md and plan.md to .claude/context/features/
  4. PAUSES: "Spec ready for review — approve to proceed?"

Developer reviews spec (5 minutes): "Looks good, go ahead"

Orchestrator:
  5. Spawns 5 workers simultaneously
  6. Creates 12-task board with dependency graph
  7. Workers self-direct: claim, implement, validate, report
  8. PostToolUse hooks validate every edit
  9. Security worker audits API routes as they appear
  10. Test worker writes tests as UI is built
  11. All tasks complete in ~20 minutes
  12. Orchestrator assembles PR with full agent report
  13. PAUSES: "PR #47 ready — all quality gates green. Review and merge?"

Developer reviews PR summary (5 minutes):
  "12 tasks completed by 5 agents
   4 files changed
   8 new tests (3 intent, 5 integration)
   Security audit: PASS
   Coverage: maintained above 60%
   One non-critical suggestion: extract song stats calculation to a service layer"
  Developer: "Accept the suggestion and merge"

Orchestrator:
  14. Creates new task for the suggestion
  15. dev-worker implements refactor
  16. PR updated
  17. Merged

Total developer time: 12 minutes
Total elapsed time: 35 minutes
A feature that took 3 hours manually.
```

### What Makes This Safe (The Quality Architecture in This Vision)

```
Developer time spent:               Automated quality gates:
  Spec review: 5 min                  PostToolUse hooks: every edit
  PR review: 5 min                    Pre-commit: intent tests
  Merge: 2 min                        CI: full 705+ test suite
  Total: 12 min                       Security audit: every API route
                                      Test coverage: maintained
                                      Staging smoke: post-deploy
                                      Human final gate: PR approval
```

The developer is not reviewing code. They are reviewing:
1. Does the spec match what I asked for?
2. Does the agent summary tell me all quality gates are green?
3. Are there any open risks flagged?

If the answer to all three is yes — merge.

### What Is NOT Autonomous (Human Gates That Stay)

| Decision | Why Human |
|---|---|
| Feature spec approval | Scope decisions require product judgement |
| Architecture plan approval | Architectural choices have long-term implications |
| PR merge | Final accountability before production |
| Database migrations | Irreversible, high-risk |
| Production deployments | External impact |
| Security finding resolution | "Is this an acceptable risk?" requires human judgement |
| Scope changes mid-feature | New scope = new spec approval |

---

## 11. Team Introduction Playbook — Updated

### The 3 Demos to Run for Your Team

**Demo 1: The Hook in Action (Day 1)**
Start a Claude Code session, add an API route without `tenant_id`, watch the PostToolUse hook fire and block Claude. Show the team: "Claude caught its own bug before it moved to the next file."

**Demo 2: A Two-Worker Bug Fix (Day 2)**
Create a small team with debugger-agent + dev-worker. File a bug. Watch the task board: Task 1 (diagnose) → Task 2 (fix) → Task 3 (verify). Show the team: "Two agents coordinate via a shared task board. The developer only reviews the PR."

**Demo 3: A Four-Worker Feature (Week 2)**
Build a small UI-only feature with the full team pattern. Show the team the task board in real time. Show the PR summary generated by the orchestrator. Ask them: "How much of this did I write?" Answer: "Only the feature description."

### What Your Team Needs to Provide

For agent teams to work, every developer on the team must maintain:

1. **Intent tests for every new page or journey** — this is the quality contract agents validate against
2. **Clear agent descriptions** in `.claude/agents/` — vague worker instructions produce vague work
3. **Discipline on human checkpoints** — don't skip spec or plan approval to "save time"
4. **CLAUDE.md updates for new patterns** — when a new anti-pattern is found, add it immediately

### The Mindset Shift to Teach

> **v0 (traditional):** Developer writes code, Claude assists
> **v1 (single-agent):** Claude writes code, developer reviews
> **v2 (agent teams):** A team of agents builds features, developer reviews outputs and approves decisions

The developer's job shifts from coding to:
- Writing clear feature descriptions (input quality)
- Maintaining the quality infrastructure (intent tests, hooks, agent instructions)
- Approving checkpoints and reviewing summaries (output quality)
- Escalating when agents surface ambiguities

The higher the quality of the input (spec, rules, tests), the less the developer needs to review.

---

## Summary — v1 vs v2

| Dimension | v1 (Sequential Subagents) | v2 (Agent Teams) |
|---|---|---|
| Worker execution | Sequential, one at a time | Parallel, simultaneous |
| Coordination | Via orchestrator at every step | Via shared task board + direct messaging |
| Orchestrator role | Traffic cop | Planner + exception handler |
| Quality checking | Sequential (after implementation) | Parallel (concurrent with implementation) |
| Failure blast radius | One worker's output | Contained by task dependencies + Layer 2 hooks |
| Feature delivery speed | Sum of worker times | Critical path time (3-4x faster) |
| Developer visibility | Orchestrator reports | Live task board |
| Biggest gap | Layer 2 hooks | Layer 2 hooks (MORE urgent now) |
| Readiness | 40% | 40% + team primitives available |

**The opportunity:** The team primitives are available right now. The missing piece before using them at scale is Layer 2 (PostToolUse hooks). Build the hooks first, then the team compositions, and the full autonomous workflow becomes reachable within 2 months on this project.

---

*Document version: 2.0 — March 2026*
*Supersedes: AGENTIC_WORKFLOW_PLAN_SDLC.md v1.0*
*Next action: Implement Phase A1 (PostToolUse intent guard hook)*
