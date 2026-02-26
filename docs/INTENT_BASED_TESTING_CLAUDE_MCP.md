# Intent-Based Testing with Claude Code + Playwright MCP

> **Status:** Proposal
> **Author:** Architecture / QA
> **Date:** 2026-02-26
> **Branch:** `intent-based-testing`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Is Intent-Based Testing?](#2-what-is-intent-based-testing)
3. [How It Fits the Test Pyramid](#3-how-it-fits-the-test-pyramid)
4. [Architecture Overview](#4-architecture-overview)
5. [Installation & Setup](#5-installation--setup)
6. [Configuration](#6-configuration)
7. [Session Context Preservation](#7-session-context-preservation)
8. [Workflow Integration](#8-workflow-integration)
9. [Writing Intent Scenarios](#9-writing-intent-scenarios)
10. [Typical Use Case Walkthrough](#10-typical-use-case-walkthrough)
11. [Bug Discovery & Self-Healing](#11-bug-discovery--self-healing)
12. [Reporting & Artifacts](#12-reporting--artifacts)
13. [Scaling Strategy](#13-scaling-strategy)
14. [Impact on DX & Testing Workflow](#14-impact-on-dx--testing-workflow)
15. [Limitations & Risks](#15-limitations--risks)
16. [Rollout Plan](#16-rollout-plan)
17. [Appendix: Tool Reference](#appendix-a-playwright-mcp-tool-reference)

---

## 1. Executive Summary

Intent-based testing is a new testing paradigm where an AI agent (Claude Code) drives a real browser via the Playwright MCP server, executing tests described in **natural language** rather than coded selectors and assertions. Instead of `page.click('#submit-btn')`, you write:

> "Log in as an Admin, navigate to the Songs page, add a new song called 'Amazing Grace', and verify it appears in the list."

The AI reads the live accessibility tree, finds the right elements, interacts with them, and validates outcomes — all without hardcoded selectors. When the UI changes, the intent still works because the agent adapts to what it sees on screen.

**This is not a replacement for our existing test layers.** It is a new layer that sits between our component/integration tests and manual QA, catching the class of bugs that slip through both: visual regressions, flow breakages, role-based access violations in the real browser, and cross-page state issues.

**Key constraint:** This runs on local developer machines only — not in CI. It is a developer-driven exploratory and regression tool.

---

## 2. What Is Intent-Based Testing?

### Traditional Script-Based Test

```typescript
// songs-page.spec.ts — brittle, selector-dependent
await page.goto('http://localhost:3000/admin/songs');
await page.click('button:has-text("+ Add Song")');
await page.fill('input[placeholder="Song title"]', 'Amazing Grace');
await page.selectOption('select[name="category"]', 'Hymn');
await page.click('button[type="submit"]');
await expect(page.locator('text=Amazing Grace')).toBeVisible();
```

**Problems:** Breaks when selectors change. Breaks when layout shifts. No understanding of *what* the test is verifying — only *how*.

### Intent-Based Test

```markdown
## Intent: Add a new song as Admin

1. Log in as Admin (use dev_auth bypass)
2. Navigate to the Songs page
3. Click the "Add Song" button
4. Fill in: title "Amazing Grace", category "Hymn"
5. Submit the form
6. Verify "Amazing Grace" appears in the song list
7. Verify the success feedback is shown
```

**How it works:** Claude Code receives this intent, connects to the running app via Playwright MCP, reads the accessibility tree to find elements by their semantic meaning (labels, roles, text content), and executes the flow. If a button label changes from "+ Add Song" to "New Song", Claude still finds it because it reads the page structure, not a hardcoded selector.

### The Key Differences

| Aspect | Script-Based | Intent-Based |
|--------|-------------|--------------|
| Selector dependency | High — breaks on DOM changes | None — uses accessibility tree |
| Maintenance cost | Manual updates per UI change | Zero — agent adapts |
| What it tests | Exact implementation | User-visible behavior |
| Who can write tests | Developers only | Anyone who can describe the flow |
| Determinism | 100% reproducible | High but not guaranteed (AI variance) |
| Speed | Fast (ms per action) | Slower (seconds per action, LLM round-trip) |
| CI/CD ready | Yes | No (local only) |

---

## 3. How It Fits the Test Pyramid

Our current pyramid (from `TEST_STRATEGY.md`):

```
            ┌─────────┐
            │  E2E    │  ← Playwright scripts (planned, not yet built)
            │ (few)   │
           ┌┴─────────┴┐
           │ Integration │  ← 15 API route tests (Vitest + mocks)
           │ (moderate)  │
          ┌┴─────────────┴┐
          │   Component    │  ← 8 component tests (Vitest + RTL)
          │   (moderate)   │
         ┌┴───────────────┴┐
         │      Unit        │  ← 6 unit tests (Vitest)
         │     (many)       │
         └─────────────────┘
```

Intent-based testing adds a **new layer** that sits alongside (not replacing) E2E:

```
          ┌───────────────────┐
          │   Intent-Based    │  ← Claude + Playwright MCP (local, on-demand)
          │  (exploratory +   │     Natural language scenarios
          │   regression)     │     Developer-triggered
          ├───────────────────┤
          │    E2E Scripts    │  ← Standard Playwright .spec.ts (CI-ready)
          │   (critical paths)│     Deterministic, fast
          ├───────────────────┤
          │   Integration     │  ← API route tests
          ├───────────────────┤
          │    Component      │  ← UI rendering tests
          ├───────────────────┤
          │      Unit         │  ← Pure logic tests
          └───────────────────┘
```

### What Each Layer Catches

| Layer | Catches | Misses |
|-------|---------|--------|
| Unit | Logic bugs (date calc, transpose) | UI, integration, auth |
| Component | Render bugs, modal regressions, role-gating UI | Real API calls, browser behavior |
| Integration | API logic, auth headers, DB operations | UI rendering, browser state |
| E2E Scripts | Critical flow regressions (deterministic) | Exploratory issues, edge cases |
| **Intent-Based** | **Cross-page flows, visual regressions, role-based access in real browser, unexpected UI states, accessibility issues** | Performance, load, pixel-perfect styling |

### When Intent-Based Testing Adds Unique Value

1. **After a UI refactor** — verify all flows still work without updating any selectors
2. **Role-based access validation** — test the same flow as Admin vs Coordinator vs Musician and compare
3. **Exploratory regression** — "try every link in the sidebar and verify each page loads without errors"
4. **Pre-release sanity** — run the full scenario suite before a deploy
5. **New feature validation** — describe the expected behavior before writing E2E scripts

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Developer Machine                   │
│                                                      │
│  ┌──────────┐    MCP Protocol    ┌────────────────┐ │
│  │  Claude   │◄─────────────────►│  Playwright    │ │
│  │  Code     │   (tool calls)    │  MCP Server    │ │
│  │  (Agent)  │                   │  (@playwright/ │ │
│  │           │                   │   mcp)         │ │
│  └────┬──────┘                   └───────┬────────┘ │
│       │                                  │          │
│       │ reads                            │ controls │
│       ▼                                  ▼          │
│  ┌──────────┐                   ┌────────────────┐  │
│  │  specs/   │                  │   Chromium      │  │
│  │  intent   │                  │   Browser       │  │
│  │  files    │                  │   Instance      │  │
│  │  (.md)    │                  └───────┬────────┘  │
│  └──────────┘                           │           │
│                                         │ HTTP      │
│                                         ▼           │
│                                ┌────────────────┐   │
│                                │  Next.js Dev   │   │
│                                │  Server        │   │
│                                │  localhost:3000 │   │
│                                └────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Data flow:**
1. Developer triggers Claude Code with an intent scenario
2. Claude reads the intent file (natural language steps)
3. Claude calls Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`)
4. Playwright MCP drives a real Chromium instance against `localhost:3000`
5. Claude reads accessibility snapshots (structured data, not screenshots) to verify outcomes
6. Claude reports results back to the developer in natural language

---

## 5. Installation & Setup

### Prerequisites

- Node.js 18+
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Active Anthropic API key configured for Claude Code

### Step 1: Add Playwright MCP Server to Claude Code

```bash
# From project root
claude mcp add playwright -- npx @playwright/mcp@latest
```

This registers the MCP server in your Claude Code configuration. The Playwright browser binary is auto-downloaded on first use.

### Step 2: Install Playwright Test Runner (for generated specs)

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Step 3: Initialize Playwright Agents (optional — for test generation)

```bash
npx playwright init-agents --loop=claude
```

This creates:
- `.github/` — Agent definition files (Planner, Generator, Healer)
- `specs/` — Directory for markdown test plans
- `tests/seed.spec.ts` — Bootstrap test providing page context

### Step 4: Create Project-Level MCP Config

Create `.mcp.json` in the project root (shared via git):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser", "chrome",
        "--viewport-size", "1280x720"
      ]
    }
  }
}
```

### Step 5: Create Intent Scenarios Directory

```bash
mkdir -p specs/intents
```

### Step 6: Verify Setup

```bash
# Start your dev server
npm run dev

# In another terminal, start Claude Code
claude

# In the Claude Code session, test the connection:
# > "Use playwright MCP to navigate to http://localhost:3000/admin/login and take a snapshot"
```

You should see a Chromium window open and Claude reporting the page structure.

---

## 6. Configuration

### Project-Level: `.mcp.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser", "chrome",
        "--viewport-size", "1280x720",
        "--timeout-action", "5000",
        "--timeout-navigation", "30000"
      ]
    }
  }
}
```

### Playwright Config: `playwright.config.ts`

For running generated `.spec.ts` files (not needed for pure intent-based MCP testing):

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // sequential for stateful flows
  retries: 1,
  workers: 1,
  reporter: [["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

### MCP Server Flags Reference

| Flag | Our Value | Why |
|------|-----------|-----|
| `--browser` | `chrome` | Matches our user base |
| `--viewport-size` | `1280x720` | Standard desktop viewport |
| `--headless` | (omitted) | We want to SEE the browser during intent runs |
| `--timeout-action` | `5000` | 5s per click/type action |
| `--timeout-navigation` | `30000` | 30s for page loads (Next.js cold start) |
| `--save-trace` | (per-run) | Enable when debugging failures |
| `--save-video` | (per-run) | Enable for demo/review recordings |

---

## 7. Session Context Preservation

### The Problem

Each Claude Code session starts fresh. If an intent scenario requires login, the agent must log in every time. For multi-scenario runs, this wastes time and tokens.

### Solution 1: Dev Auth Bypass (Recommended for Local)

Our app supports `dev_auth=1` cookie in `NODE_ENV=development`. Configure the MCP server to pre-load this:

**Create `test-storage-state.json`:**

```json
{
  "cookies": [
    {
      "name": "dev_auth",
      "value": "1",
      "domain": "localhost",
      "path": "/",
      "httpOnly": false,
      "secure": false,
      "sameSite": "Lax"
    }
  ],
  "origins": []
}
```

**Use it in `.mcp.json`:**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser", "chrome",
        "--storage-state", "test-storage-state.json"
      ]
    }
  }
}
```

Now every MCP browser session starts pre-authenticated.

### Solution 2: Persistent Browser Profile (Default Behavior)

By default, `@playwright/mcp` uses a persistent profile at `~/Library/Caches/ms-playwright/mcp-chrome-profile`. Cookies survive between Claude Code sessions. If you log in once, you stay logged in.

**Caveat:** Profile can get stale. Use `--isolated` + `--storage-state` for reproducibility.

### Solution 3: Scenario Preambles

Include auth steps at the top of every intent file:

```markdown
## Preamble (run before every scenario)
1. Navigate to http://localhost:3000/admin/login
2. The dev_auth cookie should bypass login automatically
3. Verify you see the admin dashboard sidebar
```

### Recommended Approach

Use **Solution 1 (storage state)** for day-to-day work. It is deterministic, does not accumulate stale state, and works immediately on fresh sessions.

---

## 8. Workflow Integration

### When to Run Intent-Based Tests

| Trigger | What to Run | Why |
|---------|-------------|-----|
| Before a PR | Full scenario suite for affected pages | Catch flow regressions |
| After UI refactor | All scenarios | Verify nothing broke without updating selectors |
| After role/permission changes | Role-comparison scenarios | Coordinator vs Admin access |
| New feature complete | Write + run new intent scenario | Validate before writing E2E scripts |
| Bug report received | Write an intent that reproduces the report | Confirm the bug, then confirm the fix |
| Pre-deploy (staging) | Critical path scenarios | Final sanity check |

### Developer Workflow

```
1. Start dev server:           npm run dev
2. Open Claude Code:           claude
3. Run a single scenario:      "Run the intent scenario in specs/intents/admin-add-song.md"
4. Run all scenarios:          "Run all intent scenarios in specs/intents/ and report results"
5. Fix failures:               Claude describes what went wrong — developer fixes code
6. Re-run:                     "Re-run the failing scenario"
```

### npm Script Integration

Add to `package.json`:

```json
{
  "scripts": {
    "test:intents": "echo 'Start Claude Code and run: Execute all intent scenarios in specs/intents/'",
    "test:intents:gen": "npx playwright test tests/ --reporter=html"
  }
}
```

> **Note:** Intent-based tests cannot be run via `npm test` because they require an interactive Claude Code session. The `test:intents` script serves as a reminder.

### Suggested Execution Cadence

```
Every commit:     npm run test (unit + component + integration)  ← CI
Every PR:         npm run test + manual intent run for affected pages  ← local
Every release:    Full intent suite + npm run test  ← local + CI
Exploratory:      Ad-hoc intent scenarios  ← local, anytime
```

---

## 9. Writing Intent Scenarios

### File Structure

```
specs/
  intents/
    _preamble.md              # Shared auth/setup steps
    admin-add-member.md       # Add member flow (Admin)
    admin-add-song.md         # Add song flow (Admin)
    coordinator-readonly.md   # Verify Coordinator restrictions
    sidebar-navigation.md     # All sidebar links load correctly
    role-based-access.md      # Compare Admin vs Coordinator views
    login-flow.md             # Real auth flow (dev:real-auth)
    roster-management.md      # Create/edit roster entries
    song-crud.md              # Full song lifecycle
```

### Scenario Format

```markdown
# Intent: Add a New Member as Admin

## Context
- App URL: http://localhost:3000
- Auth: dev_auth bypass (pre-configured via storage state)
- Role: Admin (full access)

## Steps

1. Navigate to the People page (/admin/people)
2. Verify the page loads and shows the member list
3. Click the "+ Add Member" button
4. Verify the Add Member modal opens with all form fields:
   - Full name input
   - Email input
   - App role selector (Admin, Coordinator, Musician)
   - Worship role toggles (Vocalist, Acoustic Guitar, Electric Guitar, etc.)
5. Fill in: name "Test User", email "test@example.com"
6. Select app role: "Musician"
7. Toggle worship roles: "Vocalist", "Acoustic Guitar"
8. Click "Save" / submit button
9. Verify the modal closes
10. Verify "Test User" appears in the member list
11. Verify the success message is shown

## Expected Outcomes
- Modal renders all fields (not blank — this is a known regression, see CLAUDE.md Rule 5)
- Form submission succeeds
- New member appears in the list
- No console errors

## Failure Indicators
- Modal opens but is blank (placeholder comment bug)
- "Save" button is disabled or missing
- Form fields are missing (name, email, role selector)
- 403 error on form submission
- Member does not appear after save
```

### Parameterized Scenarios (Role Comparison)

```markdown
# Intent: Verify Coordinator Cannot Edit Members

## Context
- Auth: Coordinator role (set via /api/me mock or direct DB)

## Steps

1. Navigate to the People page (/admin/people)
2. Verify the member list loads
3. Verify the "+ Add Member" button is NOT visible
4. For any member row, verify Edit and Deactivate buttons are NOT visible
5. Verify the member details are still readable (names, roles, email)

## Comparison
Run the same steps as Admin and verify:
- Admin DOES see "+ Add Member"
- Admin DOES see Edit/Deactivate on each row
```

### Scenario Complexity Guidelines

| Complexity | Steps | When to Use |
|-----------|-------|-------------|
| Simple | 3-5 | Single-action verification (button visible, page loads) |
| Medium | 6-12 | CRUD flow (add/edit/delete entity) |
| Complex | 12-20 | Multi-page flow (login → navigate → create → verify → cleanup) |
| Exploratory | Open-ended | "Explore the app and report anything that looks broken" |

---

## 10. Typical Use Case Walkthrough

### Scenario: Catching the Blank Modal Bug

This is our most infamous recurring bug (documented in CLAUDE.md Rule 5). Here is exactly how intent-based testing would catch it.

**Background:** A developer fixes a lint warning by removing `isSaving` and `ROLES` from `people/page.tsx`. Unknown to them, the modal form body was a placeholder `{/* ...existing code... */}`, and removing the variables made it compile cleanly — but the modal is now blank.

**Unit/Component tests:** Would catch this IF `npm run test:components` was run. But the developer skipped it (common).

**Intent-based test catches it:**

```
Developer: "Run specs/intents/admin-add-member.md"

Claude Code:
  1. browser_navigate → http://localhost:3000/admin/people
  2. browser_snapshot → sees the page, finds "+ Add Member" button
  3. browser_click → clicks "+ Add Member"
  4. browser_snapshot → reads the modal

  Claude reports:
  "FAILURE at step 4: The modal opened but contains no form fields.
   Expected: Full name input, email input, app role selector, worship role toggles.
   Actual: The modal dialog is visible but its body is completely empty.

   This matches the known 'blank modal' regression pattern documented in CLAUDE.md Rule 5.
   The modal <form> likely contains a placeholder comment instead of real JSX.

   Recommendation: Check the <form> body in src/app/admin/people/page.tsx for
   {/* ...existing code... */} and replace it with the actual form fields."
```

**What happened:**
1. Claude navigated to the real page in a real browser
2. Opened the modal via its button text (no selector)
3. Read the accessibility tree and found an empty form
4. Compared against the expected fields listed in the intent scenario
5. Reported the exact failure with root-cause analysis

**This is the unique value:** Intent-based testing validates the **actual rendered output** in a real browser, catching issues that compile and pass lint but are visually broken.

---

### Scenario: Role-Based Access Regression

A middleware change accidentally allows Coordinators to see the Settings page.

```
Developer: "Run specs/intents/coordinator-readonly.md"

Claude Code:
  1. Sets up Coordinator auth context
  2. browser_navigate → http://localhost:3000/admin/settings
  3. browser_snapshot → reads the page

  Claude reports:
  "FAILURE: Coordinator was able to access /admin/settings.
   Expected: Redirect to /admin/roster or 403 error.
   Actual: The Settings page rendered with full admin controls visible.

   The middleware at src/middleware.ts may not be blocking this route for Coordinators."
```

---

## 11. Bug Discovery & Self-Healing

### How Intent-Based Tests Find Bugs

Intent tests find bugs through **semantic validation** — they check what the user *sees and can do*, not what the DOM looks like:

| Bug Category | How Detected | Example |
|-------------|-------------|---------|
| Blank/broken modals | Accessibility tree shows empty container | The placeholder comment bug |
| Missing buttons (role-gating) | Element not found by label/role | canEdit logic regression |
| Wrong page routing | URL or page content mismatch | Middleware misconfiguration |
| Broken form submission | No success indicator after submit | API route 500 error |
| Invisible buttons | Element exists but has no accessible name | Missing `text-` / `bg-` classes |
| Cross-page state loss | Data not persisting across navigation | State management bug |
| Console errors | Claude can check browser console | Unhandled promise rejection |
| Accessibility issues | Missing labels, roles, ARIA attributes | Semantic HTML violations |

### What "Self-Healing" Means

Self-healing operates at two levels:

#### Level 1: Adaptive Execution (Built-In)

Unlike scripted tests that fail when a selector changes, intent-based tests **adapt automatically**:

- Button renamed from "+ Add Song" to "New Song" → Claude finds it by role `button` and proximity to page context
- Input field moved from a modal to an inline form → Claude finds it by placeholder text or label
- Page layout restructured → Claude reads the new accessibility tree and proceeds

**This is not a fix — it is resilience.** The test still validates the same intent; it just does not break on cosmetic changes.

#### Level 2: Playwright Healer Agent (Generated Tests)

When using Playwright Agents (`npx playwright init-agents --loop=claude`), the **Healer agent** can automatically fix failing `.spec.ts` files:

```bash
# A generated test fails because a selector changed
npx playwright test tests/add-song.spec.ts
# → FAIL: locator('.song-title-input') not found

# The Healer agent:
# 1. Reads the failing test + error output
# 2. Opens the app via MCP to find the correct selector
# 3. Updates the test file with the new selector
# 4. Re-runs to confirm the fix

# Developer triggers this via Claude Code:
# > "The add-song test is failing. Use the healer agent to fix it."
```

#### Level 3: Scenario Refinement (Manual + AI-Assisted)

When an intent scenario itself is ambiguous or outdated:

```
Claude: "Step 5 says 'Select the Hymn category' but I don't see a category
         dropdown on the Add Song form. The form has a 'Genre' field with
         options including 'Hymn'. Should I update the scenario to use 'Genre'?"

Developer: "Yes, update the scenario."

Claude: Updates specs/intents/admin-add-song.md with the corrected field name.
```

---

## 12. Reporting & Artifacts

### Real-Time Reporting (During MCP Session)

Claude reports results conversationally in the terminal:

```
=== Intent Scenario: admin-add-member.md ===

Step 1: Navigate to People page (/admin/people)         ✓ PASS
Step 2: Verify member list loads                         ✓ PASS
Step 3: Click "+ Add Member"                             ✓ PASS
Step 4: Verify modal form fields                         ✗ FAIL
  Expected: Full name input, email input, role selector
  Actual: Modal is empty (no form fields found)

Result: FAIL (4/11 steps completed, 1 failure)
Root cause: Modal form body appears to be empty — likely placeholder comment.
```

### Structured Report File

Ask Claude to write results to a file:

```markdown
> "Run all intent scenarios and write results to test-results/intent-report.md"
```

**Output format (`test-results/intent-report.md`):**

```markdown
# Intent-Based Test Report
**Date:** 2026-02-26 14:30
**Environment:** localhost:3000 (dev mode, dev_auth bypass)
**Browser:** Chrome 130

## Summary
| Status | Count |
|--------|-------|
| PASS   | 6     |
| FAIL   | 2     |
| SKIP   | 0     |
| Total  | 8     |

## Results

### PASS: admin-add-song.md
All 9 steps completed successfully. Song created and visible in list.

### FAIL: admin-add-member.md
Failed at step 4: Modal form is blank.
**Root cause:** Placeholder comment in form body.
**File:** src/app/admin/people/page.tsx

### FAIL: coordinator-readonly.md
Failed at step 2: Coordinator can access Settings page.
**Root cause:** Missing route block in middleware.ts.

### PASS: sidebar-navigation.md
All 7 sidebar links load correctly for Admin role.

...
```

### Trace and Video Artifacts

For debugging failures, enable trace and video capture:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--save-trace", "test-results/traces/trace.zip",
        "--save-video", "test-results/videos/"
      ]
    }
  }
}
```

- **Traces:** Open in [Playwright Trace Viewer](https://trace.playwright.dev/) for step-by-step replay
- **Videos:** Screen recordings of the browser session

### Artifact Summary

| Artifact | Format | When Generated | Viewer |
|----------|--------|---------------|--------|
| Terminal output | Plain text | Every run | Terminal |
| Report file | Markdown | On request | Any editor |
| Playwright trace | `.zip` | When `--save-trace` enabled | trace.playwright.dev |
| Session video | `.webm` | When `--save-video` enabled | Any video player |
| Generated specs | `.spec.ts` | When using Generator agent | Playwright runner |

---

## 13. Scaling Strategy

### Challenge: Many Scenarios = Long Runs + High Token Usage

Each intent scenario requires multiple LLM round-trips (navigate, snapshot, click, snapshot, verify...). A single scenario might use 10-30 tool calls. Running 50 scenarios sequentially could take 30-60 minutes and consume significant API tokens.

### Strategy 1: Tiered Scenario Suites

Organize scenarios by frequency and criticality:

```
specs/intents/
  smoke/                 # 3-5 scenarios, run before every PR (~5 min)
    login-flow.md
    sidebar-navigation.md
    basic-crud.md

  regression/            # 10-15 scenarios, run before releases (~15 min)
    admin-add-member.md
    admin-add-song.md
    coordinator-readonly.md
    role-based-access.md
    roster-management.md
    ...

  exploratory/           # Open-ended, run ad-hoc
    full-app-audit.md
    accessibility-check.md
    edge-cases.md
```

```bash
# Quick smoke check
# > "Run all intent scenarios in specs/intents/smoke/"

# Full regression
# > "Run all intent scenarios in specs/intents/regression/"
```

### Strategy 2: Convert Stable Intents to Playwright Scripts

Once an intent scenario has been stable for several runs and the UI is unlikely to change:

1. Use the **Generator agent** to convert it to a `.spec.ts` file
2. Move the generated test into `tests/` (runs in CI via `npx playwright test`)
3. Keep the intent file as a "source of truth" description
4. The intent version becomes a fallback when the script breaks

```
Intent scenario (human-readable)
        ↓ Generator agent
.spec.ts file (deterministic, CI-ready)
        ↓ If it breaks
Healer agent fixes it, or re-generate from intent
```

This is the **graduation path**: intents start as exploratory, stabilize into scripts.

### Strategy 3: Parallel Scenario Execution

Run multiple Claude Code sessions in parallel (separate terminal windows):

```bash
# Terminal 1
claude --prompt "Run specs/intents/smoke/login-flow.md"

# Terminal 2
claude --prompt "Run specs/intents/smoke/sidebar-navigation.md"

# Terminal 3
claude --prompt "Run specs/intents/smoke/basic-crud.md"
```

Each session gets its own browser instance. Limited by machine resources and API rate limits.

### Strategy 4: Scenario Templating

For repetitive patterns (test the same CRUD flow on different pages):

```markdown
# Template: CRUD Flow
# Variables: $PAGE_NAME, $PAGE_URL, $ADD_BUTTON, $ENTITY_NAME

1. Navigate to $PAGE_URL
2. Click "$ADD_BUTTON"
3. Verify the form modal opens
4. Fill in required fields for a new $ENTITY_NAME
5. Submit
6. Verify the new $ENTITY_NAME appears in the list
```

Instantiate per page:
- `crud-members.md`: `$PAGE_URL=/admin/people, $ADD_BUTTON=+ Add Member, $ENTITY_NAME=member`
- `crud-songs.md`: `$PAGE_URL=/admin/songs, $ADD_BUTTON=+ Add Song, $ENTITY_NAME=song`

### Token Budget Management

| Scenario Type | Estimated Tool Calls | Estimated Tokens | Cost (Approx) |
|--------------|---------------------|-----------------|------|
| Simple (5 steps) | 10-15 | ~20k | ~$0.10 |
| Medium (12 steps) | 25-35 | ~50k | ~$0.25 |
| Complex (20 steps) | 40-60 | ~100k | ~$0.50 |
| Full smoke suite (5 scenarios) | 75-100 | ~150k | ~$0.75 |
| Full regression (15 scenarios) | 250-400 | ~500k | ~$2.50 |

These are rough estimates. Actual costs depend on page complexity (large accessibility trees consume more tokens).

---

## 14. Impact on DX & Testing Workflow

### What Changes for Developers

| Before | After |
|--------|-------|
| Write E2E tests with selectors → maintain them forever | Write intent descriptions → agent adapts |
| Skip E2E for "simple" UI changes | Run smoke intents in 5 min before PR |
| Manual QA for role-based access | Automated role comparison scenarios |
| Bugs found in production after deploy | Bugs caught during pre-PR intent run |
| Test maintenance is a tax | Intent files rarely need updates |

### DX Improvements

1. **Lower barrier to testing:** Anyone can write "navigate to X, click Y, verify Z" — no Playwright API knowledge needed
2. **Faster feedback on UI changes:** Run an intent in Claude Code right after making a change, see results in real-time
3. **Exploratory testing on demand:** "Explore the whole app and report anything broken" — let Claude find bugs you would not think to test for
4. **Living documentation:** Intent files double as human-readable feature specifications
5. **Bridge to E2E:** Intent scenarios can be graduated to scripted E2E tests when stable

### DX Risks

1. **API cost:** Each run costs money (see token budget above). Frequent runs add up.
2. **Non-deterministic results:** The same intent might execute slightly differently each time (different element chosen, different order). Flaky results erode trust.
3. **Slow feedback loop:** Seconds per action vs milliseconds for scripted tests. Not suitable for TDD.
4. **Context window pressure:** Large pages produce enormous accessibility trees that fill Claude's context, causing degraded performance or session drops.
5. **Requires running dev server:** Cannot run intent tests without `npm run dev` active.

### Recommended Developer Workflow

```
Feature development:
  1. Write code
  2. npm run test              ← fast, deterministic (unit + component + integration)
  3. npm run lint
  4. Start Claude Code
  5. "Run smoke intents"       ← catch UI-level regressions in real browser
  6. Fix any failures
  7. Push PR

Pre-release:
  1. npm run test              ← full suite
  2. "Run full regression intents"  ← all scenarios
  3. Fix failures
  4. Deploy
```

---

## 15. Limitations & Risks

### Technical Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **No CI/CD integration** | Cannot gate PRs on intent tests | Use graduated `.spec.ts` files for CI |
| **Token consumption** | Large pages = expensive runs | Use tiered suites, run only affected scenarios |
| **Non-deterministic** | Same intent may produce different actions | Write specific intents with clear expected outcomes |
| **Context window limits** | Complex pages may overflow context | Keep scenarios focused, avoid "test everything" intents |
| **Speed** | 2-5 seconds per action | Accept this for the layer it serves; use scripted E2E for speed-critical paths |
| **Requires API key** | Each developer needs Anthropic API access | Team-shared key or individual keys |
| **Local only** | Results not shared automatically | Write reports to `test-results/` and commit or share |
| **MCP version compatibility** | Breaking changes between versions | Pin `@playwright/mcp` version in `.mcp.json` |

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Developers skip intent tests | High | Medium | Make smoke suite < 5 min, integrate into PR checklist |
| False positives (AI misreads page) | Medium | Medium | Refine intent wording, add explicit expected outcomes |
| False negatives (AI misses a bug) | Medium | Low | Intent tests supplement, not replace, existing layers |
| Cost overrun from heavy usage | Low | Medium | Set monthly token budget, use tiered suites |
| MCP server crashes or hangs | Low | Low | Restart Claude Code session, report upstream |

---

## 16. Rollout Plan

### Phase 1: Foundation (Week 1)

- [ ] Install Playwright MCP server (`claude mcp add playwright`)
- [ ] Create `.mcp.json` project config
- [ ] Create `test-storage-state.json` for dev_auth bypass
- [ ] Create `specs/intents/` directory structure
- [ ] Write 3 smoke scenarios:
  - `smoke/login-flow.md`
  - `smoke/sidebar-navigation.md`
  - `smoke/basic-crud.md`
- [ ] Run scenarios manually, validate setup works
- [ ] Document any setup issues

### Phase 2: Core Scenarios (Week 2)

- [ ] Write regression scenarios for critical pages:
  - `regression/admin-add-member.md`
  - `regression/admin-add-song.md`
  - `regression/coordinator-readonly.md`
  - `regression/role-based-access.md`
  - `regression/roster-management.md`
- [ ] Run full regression suite, benchmark timing and token usage
- [ ] Refine scenario wording based on results
- [ ] Add `test:intents` npm script as a documentation reminder

### Phase 3: Integration & Graduation (Week 3-4)

- [ ] Install `@playwright/test` and configure `playwright.config.ts`
- [ ] Initialize Playwright agents (`npx playwright init-agents --loop=claude`)
- [ ] Use Generator agent to convert 2-3 stable intents to `.spec.ts` files
- [ ] Run generated specs via `npx playwright test` — validate they pass
- [ ] Set up `test:e2e` npm script for generated specs
- [ ] Document the graduation workflow (intent → spec)

### Phase 4: Team Adoption (Week 4+)

- [ ] Team walkthrough: how to write intents, run them, interpret results
- [ ] Add intent-based testing to PR checklist (smoke suite)
- [ ] Establish monthly review: promote stable intents to specs, retire outdated ones
- [ ] Track token usage and adjust budget/cadence

---

## Appendix A: Playwright MCP Tool Reference

Tools available to Claude when connected to the Playwright MCP server:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_go_back` | Go back in browser history |
| `browser_go_forward` | Go forward in browser history |
| `browser_snapshot` | Capture accessibility tree of current page |
| `browser_click` | Click an element (by ref from snapshot) |
| `browser_type` | Type text into an input field |
| `browser_select_option` | Select dropdown option |
| `browser_hover` | Hover over an element |
| `browser_drag` | Drag from one element to another |
| `browser_press_key` | Press a keyboard key |
| `browser_scroll` | Scroll page or element |
| `browser_upload_file` | Upload file to input |
| `browser_handle_dialog` | Accept/dismiss alert/confirm/prompt |
| `browser_tab_list` | List open browser tabs |
| `browser_tab_new` | Open a new tab |
| `browser_tab_select` | Switch to a specific tab |
| `browser_tab_close` | Close a tab |
| `browser_console_messages` | Read browser console output |
| `browser_network_requests` | List network requests |
| `browser_wait` | Wait for a specified duration |
| `browser_close` | Close the browser |
| `browser_resize` | Resize the viewport |
| `browser_pdf` | Save page as PDF (requires `--caps pdf`) |
| `browser_screenshot` | Take a screenshot (requires `--caps vision`) |

> **Note:** Our setup uses accessibility snapshots (structured text), not screenshots. This is faster and more reliable than vision-based approaches.

---

## Appendix B: Scenario Template

```markdown
# Intent: [Short description of what is being tested]

## Context
- App URL: http://localhost:3000
- Auth: [dev_auth bypass | Coordinator role | Admin role | unauthenticated]
- Preconditions: [any data that must exist before the test]

## Steps

1. [Navigate to specific page]
2. [Verify initial state]
3. [Perform action]
4. [Verify result]
...

## Expected Outcomes
- [Bullet list of what should be true after all steps]

## Failure Indicators
- [Bullet list of symptoms that indicate a bug]

## Related Files
- [src/app/admin/page.tsx — the page under test]
- [src/middleware.ts — if testing auth/routing]
```

---

## Appendix C: Comparison with Other Testing Approaches

| Aspect | Vitest Unit | Vitest Component | Vitest Integration | Playwright E2E Script | **Intent-Based (Claude+MCP)** |
|--------|------------|-----------------|-------------------|---------------------|-------------------------------|
| Runs in | Node.js | happy-dom | Node.js | Real browser | Real browser |
| Speed | ~ms | ~100ms | ~100ms | ~seconds | ~seconds (+ LLM latency) |
| Selector dependency | None | Low (RTL queries) | None | High | **None** |
| Maintenance | Low | Low | Medium | High | **Very low** |
| CI/CD ready | Yes | Yes | Yes | Yes | **No (local only)** |
| Deterministic | Yes | Yes | Yes | Yes | **Mostly** |
| Catches visual bugs | No | Partial | No | Yes | **Yes** |
| Catches accessibility | No | Partial | No | Manual | **Built-in** |
| Who can write | Developers | Developers | Developers | Developers | **Anyone** |
| Cost per run | Free | Free | Free | Free | **API tokens** |
| Current count | 6 files | 8 files | 15 files | 0 | **0 (proposed)** |
