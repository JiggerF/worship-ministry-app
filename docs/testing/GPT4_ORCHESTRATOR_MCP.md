# Intent-Based Testing with GPT-4.1 + Momentic.ai + Playwright MCP

> **Status:** Proposal (Alternative to Claude Code + Playwright MCP)
> **Author:** Architecture / QA
> **Date:** 2026-02-26
> **Branch:** `intent-based-testing`
> **Companion doc:** [INTENT_BASED_TESTING_CLAUDE_MCP.md](./INTENT_BASED_TESTING_CLAUDE_MCP.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Why GPT-4.1 + Momentic Instead of Claude](#2-why-gpt-41--momentic-instead-of-claude)
3. [Tool Selection: Why Momentic Over TestSprite](#3-tool-selection-why-momentic-over-testsprite)
4. [Architecture Overview](#4-architecture-overview)
5. [Cost Analysis: The Real Reason This Matters](#5-cost-analysis-the-real-reason-this-matters)
6. [Installation & Setup](#6-installation--setup)
7. [Configuration](#7-configuration)
8. [Session Context & Auth Preservation](#8-session-context--auth-preservation)
9. [Workflow Integration](#9-workflow-integration)
10. [Writing Intent Scenarios](#10-writing-intent-scenarios)
11. [Typical Use Case Walkthrough](#11-typical-use-case-walkthrough)
12. [Bug Discovery & Self-Healing](#12-bug-discovery--self-healing)
13. [Reporting & Artifacts](#13-reporting--artifacts)
14. [Scaling Strategy](#14-scaling-strategy)
15. [Impact on DX & Testing Workflow](#15-impact-on-dx--testing-workflow)
16. [Limitations & Risks](#16-limitations--risks)
17. [Rollout Plan](#17-rollout-plan)
18. [Appendix A: Tool Landscape Comparison](#appendix-a-tool-landscape-comparison)
19. [Appendix B: DIY Alternative with OpenAI Agents SDK](#appendix-b-diy-alternative-with-openai-agents-sdk)
20. [Appendix C: Scenario Template](#appendix-c-scenario-template)

---

## 1. Executive Summary

This document proposes a **cost-effective alternative** to the Claude Code + Playwright MCP strategy described in [INTENT_BASED_TESTING_CLAUDE_MCP.md](./INTENT_BASED_TESTING_CLAUDE_MCP.md). Instead of using Claude (which is powerful but expensive at team scale), we use:

| Component | Role | Why This One |
|-----------|------|-------------|
| **GPT-4.1** | AI brain that interprets test intents | 60-85% cheaper than Claude, better at coding tasks, 1M token context |
| **Momentic.ai** | Orchestrator that manages test execution, self-healing, reporting | Y Combinator-backed, supports localhost, has CLI + MCP, real customers (Notion, Webflow) |
| **Playwright MCP** | Browser automation layer | Industry standard, accessibility-tree-based, works with any AI |

**The core pitch:** When 3-5 developers are running intent-based tests daily, Claude Opus costs ~$170/month vs GPT-4.1 at ~$60/month vs a GPT-4.1 hybrid strategy at ~$19/month. At team scale over a year, that is the difference between $2,000 and $228. Momentic adds a polished orchestration layer on top so you do not have to build your own test runner, reporter, or self-healing logic.

**Key constraint (same as Claude approach):** This runs on local developer machines against `localhost:3000`. It is not a CI replacement — it is a developer-driven testing layer.

---

## 2. Why GPT-4.1 + Momentic Instead of Claude

### For Stakeholders New to This

If you have only heard of "ChatGPT" and think GPT-4o is not viable for developer tooling, here is what changed:

**April 2025:** OpenAI released **GPT-4.1**, a model specifically optimized for coding and instruction-following. It is not the chatbot you know — it is a developer tool.

**Key facts:**
- GPT-4.1 scores **54.6%** on SWE-bench (real-world software engineering tasks) vs GPT-4o's 33.2%
- Unintended code changes dropped from **9% to 2%** — critical for test reliability
- Native **MCP support** means it can drive browsers via Playwright MCP, just like Claude
- **1M token context window** — can hold entire page DOM snapshots without truncation
- **26% cheaper** than GPT-4o, and **70% cheaper** than Claude Sonnet

**March 2025:** OpenAI officially adopted **MCP** (Model Context Protocol), the same standard Claude uses. This means the Playwright MCP server works identically with both Claude and GPT-4.1. Your intent scenarios are portable — they work with either AI.

**December 2025:** MCP was donated to the **Linux Foundation** with OpenAI, Anthropic, and Block as co-founders. It is now an industry standard, not a vendor bet.

### When Claude Is Still Better

| Scenario | Use Claude | Use GPT-4.1 |
|----------|-----------|-------------|
| Single developer, occasional use | Yes (Claude Code is seamless) | Overkill to set up |
| Team of 3-5, daily runs | Expensive | Yes — cost scales linearly |
| Complex multi-page reasoning | Slightly better | Good enough (54.6% SWE-bench) |
| Simple page-load / CRUD checks | Overpowered | Use GPT-4.1 nano ($0.10/1M input) |
| CI/CD integration needed | Neither (use scripted E2E) | Neither |

**Recommendation:** Start with Claude Code + Playwright MCP (simpler setup) for proof of concept. Migrate to GPT-4.1 + Momentic when the team scales beyond 2 developers or runs exceed 20 scenarios/day.

---

## 3. Tool Selection: Why Momentic Over TestSprite

We evaluated five AI testing orchestrators. Here is the honest comparison:

### Candidates Evaluated

| Tool | Type | Local Execution | NL Tests | Self-Healing | Reporting | MCP Support | Maturity |
|------|------|----------------|----------|-------------|-----------|-------------|---------|
| **Momentic.ai** | Commercial (YC-backed) | Yes (CLI) | Yes | Yes | Yes (screenshots, traces) | Yes (v2.17+) | Strong (Notion, Webflow, Retool use it) |
| **TestSprite** | SaaS | No (cloud only) | Partial | Limited | Basic | Yes (MCP server) | Weak (false positives, credit burn) |
| **Shortest** (Antiwork) | Open source | Yes | Yes | No | Basic (terminal) | No | Early (5.2k GitHub stars, Claude-locked) |
| **Cypress cy.prompt()** | Framework feature | Yes | Yes | No | Via Cypress Cloud | No | Experimental (launched 2025) |
| **DIY (Agents SDK + MCP)** | Custom | Yes | Yes | You build it | You build it | Yes | Depends on you |

### Why Momentic Wins

1. **Localhost support:** The CLI runs the browser on your machine, sends AI analysis to Momentic's servers. You can test `http://localhost:3000` directly — critical for our dev workflow.

2. **Real self-healing:** When your DOM changes (button renamed, element moved), Momentic's AI updates locators automatically. TestSprite claims this but reviewers report frequent false positives.

3. **Production customers:** Notion, Xero, Webflow, Retool — these are serious engineering teams, not just demo users.

4. **MCP integration:** As of v2.17.1, Momentic provides its own MCP server. AI assistants in Cursor, Claude Desktop, or Codex can create and modify Momentic test suites directly.

5. **CI/CD support:** When you are ready to graduate tests to CI, Momentic has GitHub Actions, CircleCI, and GitLab integrations built in.

6. **$15M Series A (Nov 2025):** This is a well-funded company with a clear roadmap — not a side project that might disappear.

### Why Not TestSprite

A September 2025 community review ("TestSprite: Promise vs Reality") found:
- **Frequent false positives** that reduce confidence in results
- **Credit consumption burns fast** — the $69/month Starter plan runs out quickly with regular use
- **Cloud-only execution** — cannot test localhost without tunneling
- Test pass rates "from 42% to 93%" come from TestSprite's own benchmarks, not independent validation

### Why Not Shortest (Yet)

Shortest is the most promising open-source option, but:
- **Locked to Claude API** — no GPT-4o/4.1 support, defeating our cost goal
- **No self-healing** — if your UI changes, tests break
- **No reporting UI** — terminal output only
- **Early stage** — breaking changes expected

If Shortest adds multi-model support and self-healing, it would become the top recommendation. Watch the [GitHub repo](https://github.com/antiwork/shortest) for updates.

---

## 4. Architecture Overview

### Option A: Momentic.ai (Recommended — Managed Orchestration)

```
┌──────────────────────────────────────────────────────────┐
│                    Developer Machine                      │
│                                                          │
│  ┌──────────┐    momentic run     ┌──────────────────┐  │
│  │ Developer │ ──────────────────►│  Momentic CLI    │  │
│  │ (writes   │                    │  (@momentic/cli) │  │
│  │  intents) │                    └────────┬─────────┘  │
│  └──────────┘                              │            │
│                                   ┌────────┴─────────┐  │
│                                   │    Chromium       │  │
│                                   │    Browser        │  │
│                                   └────────┬─────────┘  │
│                                            │ HTTP       │
│                                            ▼            │
│                                   ┌──────────────────┐  │
│                                   │  Next.js Dev     │  │
│                                   │  localhost:3000   │  │
│                                   └──────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │ AI analysis (HTTPS)
                           ▼
                  ┌──────────────────┐
                  │  Momentic Cloud  │
                  │  (GPT-4.1 or    │
                  │   proprietary    │
                  │   AI inference)  │
                  └──────────────────┘
```

**Data flow:**
1. Developer writes natural-language test steps in Momentic's format
2. `momentic run` launches a local Chromium browser
3. Each step is sent to Momentic's cloud for AI interpretation
4. The AI determines which element to interact with (semantic, not selector-based)
5. Browser actions execute locally against `localhost:3000`
6. Results (screenshots, traces, pass/fail) are returned to the developer

### Option B: DIY with OpenAI Agents SDK + Playwright MCP (Full Control)

```
┌──────────────────────────────────────────────────────────┐
│                    Developer Machine                      │
│                                                          │
│  ┌──────────────┐  MCP Protocol  ┌──────────────────┐   │
│  │ OpenAI Codex │◄─────────────►│  Playwright MCP  │   │
│  │ CLI or       │  (tool calls)  │  Server          │   │
│  │ Agents SDK   │               │  (@playwright/    │   │
│  │ (GPT-4.1)    │               │   mcp)           │   │
│  └──────┬───────┘               └────────┬─────────┘   │
│         │                                │              │
│         │ reads                          │ controls     │
│         ▼                                ▼              │
│  ┌──────────────┐              ┌──────────────────┐    │
│  │ specs/intents │              │   Chromium        │    │
│  │ (.md files)   │              │   Browser         │    │
│  └──────────────┘              └────────┬─────────┘    │
│                                         │ HTTP         │
│                                         ▼              │
│                               ┌──────────────────┐     │
│                               │  Next.js Dev     │     │
│                               │  localhost:3000   │     │
│                               └──────────────────┘     │
└─────────────────────────┬────────────────────────────────┘
                          │ API calls (HTTPS)
                          ▼
                 ┌──────────────────┐
                 │  OpenAI API      │
                 │  (GPT-4.1)       │
                 └──────────────────┘
```

**When to use which:**

| Use Momentic (Option A) when... | Use DIY (Option B) when... |
|-------------------------------|--------------------------|
| You want self-healing out of the box | You want zero vendor dependency |
| You need CI/CD integration later | You want maximum cost control |
| You prefer a polished reporting UI | You are comfortable building a runner |
| Team members are not deeply technical | The team is all senior engineers |
| Budget allows Momentic's pricing | Budget is extremely tight |

**This document focuses on Option A (Momentic).** Option B is covered in [Appendix B](#appendix-b-diy-alternative-with-openai-agents-sdk).

---

## 5. Cost Analysis: The Real Reason This Matters

### The Problem at Scale

One developer running intent tests occasionally is fine on any model. But when 3-5 developers run 10-15 scenarios daily, costs diverge sharply:

### Monthly Cost: 50 Scenarios Run Daily (30 days)

**Assumptions per scenario:**
- ~10,000 input tokens (intent description + accessibility tree snapshots)
- ~2,500 output tokens (actions, assertions, reporting)
- ~5 LLM round-trips per scenario
- Total monthly: **15M input + 3.75M output tokens**

| Model | Input Cost | Output Cost | **Monthly Total** | vs Claude Opus |
|-------|-----------|-------------|-------------------|----------------|
| Claude Opus 4.6 | $75.00 | $93.75 | **$168.75** | baseline |
| Claude Sonnet 4.6 | $45.00 | $56.25 | **$101.25** | 40% savings |
| GPT-4o | $37.50 | $37.50 | **$75.00** | 56% savings |
| GPT-4.1 | $30.00 | $30.00 | **$60.00** | 64% savings |
| GPT-4o-mini | $2.25 | $2.25 | **$4.50** | 97% savings |
| GPT-4.1 mini | $6.00 | $6.00 | **$12.00** | 93% savings |
| GPT-4.1 nano | $1.50 | $1.50 | **$3.00** | 98% savings |

### The Hybrid Strategy (Recommended)

Not every test step needs the smartest model. Use the right model for the right task:

| Step Complexity | Model | Use Case | % of Steps |
|----------------|-------|----------|-----------|
| **Complex reasoning** | GPT-4.1 ($2.00/$8.00) | Multi-step flows, form validation, role comparison | ~20% |
| **Standard interaction** | GPT-4.1 mini ($0.40/$1.60) | Click button, fill form, verify text | ~50% |
| **Simple verification** | GPT-4.1 nano ($0.10/$0.40) | Page loads, element exists, no console errors | ~30% |

**Hybrid monthly cost: ~$18.90** vs $168.75 for Claude Opus = **89% savings**

### Annual Projection (Team of 4 Developers)

| Strategy | Monthly | Annual | Annual Savings vs Claude |
|----------|---------|--------|------------------------|
| Claude Opus (current doc) | $168.75 | $2,025 | — |
| Claude Sonnet | $101.25 | $1,215 | $810 |
| GPT-4.1 (flat) | $60.00 | $720 | $1,305 |
| GPT-4.1 (hybrid) | $18.90 | $227 | **$1,798** |
| Momentic (add platform cost) | TBD* | TBD* | — |

*Momentic pricing is quote-based. The AI model cost above is for the DIY option. Momentic bundles its own AI inference — you pay their platform fee instead of direct API costs. Request a quote for your team size.*

### Cost Comparison Summary for Stakeholders

```
Claude Opus    ████████████████████████████████████████  $2,025/year
Claude Sonnet  ████████████████████████                  $1,215/year
GPT-4.1 flat   ██████████████                            $720/year
GPT-4.1 hybrid ████                                      $227/year
```

**Bottom line:** GPT-4.1 is the practical choice for 2026 because it delivers 90%+ of Claude's quality at 15-35% of the cost. When you are running hundreds of test executions per month, that gap becomes budget-significant.

---

## 6. Installation & Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- A running dev server (`npm run dev` → `http://localhost:3000`)

---

### Path A: Momentic.ai Setup

#### Step 1: Install Momentic CLI

```bash
npm install -g @momentic/cli
```

#### Step 2: Create Momentic Account

Go to [momentic.ai](https://momentic.ai) and sign up. You will get:
- An API key for the CLI
- Access to the Momentic dashboard (web UI)

#### Step 3: Initialize in Your Project

```bash
cd /path/to/worship-ministry-app
momentic init
```

This creates:
- `momentic.config.yaml` — project configuration
- `.momentic/` — local state directory

#### Step 4: Authenticate the CLI

```bash
momentic login
# Follow the browser-based auth flow
```

#### Step 5: Verify Setup

```bash
# Start your dev server in one terminal
npm run dev

# In another terminal, create and run a quick test
momentic run --base-url http://localhost:3000
```

#### Step 6: (Optional) Add Momentic MCP Server

For IDE integration (Cursor, Claude Desktop, Codex):

```json
// .mcp.json (project root)
{
  "mcpServers": {
    "momentic": {
      "command": "npx",
      "args": ["@momentic/mcp-server"]
    }
  }
}
```

This lets your AI assistant create and modify Momentic tests directly from the IDE.

---

### Path B: OpenAI Codex CLI + Playwright MCP (DIY)

#### Step 1: Install OpenAI Codex CLI

```bash
npm install -g @openai/codex
```

#### Step 2: Configure Codex with Your API Key

```bash
export OPENAI_API_KEY="sk-..."
```

Or add to `~/.codex/config.toml`:

```toml
model = "gpt-4.1"
```

#### Step 3: Add Playwright MCP Server

```bash
codex mcp add playwright -- npx @playwright/mcp@latest
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.playwright]
type = "stdio"
command = ["npx", "@playwright/mcp@latest"]
```

#### Step 4: Create Project-Level MCP Config

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

#### Step 5: Verify Setup

```bash
# Start dev server
npm run dev

# In another terminal
codex

# In the Codex session:
# > "Use playwright MCP to navigate to http://localhost:3000/admin/login and take a snapshot"
```

---

## 7. Configuration

### Momentic Configuration: `momentic.config.yaml`

```yaml
# Base configuration for worship ministry app testing
baseUrl: "http://localhost:3000"
browser: chromium
ignoreHTTPSErrors: true

# Viewport matching our app's target
viewport:
  width: 1280
  height: 720

# Timeout settings (Next.js cold start can be slow)
timeout: 30000
actionTimeout: 5000

# Screenshot on failure for debugging
screenshotOnFailure: true

# Environment-specific overrides
environments:
  local:
    baseUrl: "http://localhost:3000"
  staging:
    baseUrl: "https://staging.worship-app.example.com"
```

### OpenAI Codex Config: `~/.codex/config.toml`

```toml
# Default model — GPT-4.1 for best cost/quality ratio
model = "gpt-4.1"

# MCP servers
[mcp_servers.playwright]
type = "stdio"
command = ["npx", "@playwright/mcp@latest", "--browser", "chrome", "--viewport-size", "1280x720"]
```

### Playwright MCP Flags (Same as Claude Document)

| Flag | Our Value | Why |
|------|-----------|-----|
| `--browser` | `chrome` | Matches our user base |
| `--viewport-size` | `1280x720` | Standard desktop viewport |
| `--headless` | (omitted) | We want to see the browser during runs |
| `--timeout-action` | `5000` | 5s per click/type action |
| `--timeout-navigation` | `30000` | 30s for page loads |
| `--save-trace` | (per-run) | Enable when debugging failures |
| `--storage-state` | `test-storage-state.json` | Pre-load dev_auth cookie |

---

## 8. Session Context & Auth Preservation

### The Problem (Same as Claude Approach)

Each test session starts fresh. Our app requires authentication. We need to avoid logging in at the start of every scenario.

### Solution 1: Dev Auth Bypass via Storage State (Recommended)

Create `test-storage-state.json`:

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

**For Momentic:** Pass via CLI flag:

```bash
momentic run --storage-state test-storage-state.json
```

**For Codex + Playwright MCP:** Include in `.mcp.json` args:

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

### Solution 2: Momentic's Built-in Auth Module

Momentic supports reusable "modules" — shared step sequences that run before tests:

```yaml
# .momentic/modules/auth-admin.yaml
name: "Auth as Admin"
steps:
  - navigate: "http://localhost:3000/admin/login"
  - description: "The dev_auth cookie should auto-bypass login"
  - assert: "The admin sidebar navigation is visible"
```

Reference in any test:

```yaml
# tests/admin-add-member.yaml
name: "Add a new member as Admin"
module: "auth-admin"  # runs the auth steps first
steps:
  - navigate: "/admin/people"
  - click: "the Add Member button"
  # ...
```

### Solution 3: Persistent Browser Profile (Codex + MCP Only)

By default, Playwright MCP uses a persistent Chrome profile. Cookies survive between sessions. Log in once, stay logged in across multiple Codex sessions.

**Recommended approach:** Use Solution 1 (storage state) — it is deterministic and does not accumulate stale state.

---

## 9. Workflow Integration

### When to Run (Same Triggers as Claude Approach)

| Trigger | What to Run | Tool |
|---------|-------------|------|
| Before a PR | Smoke suite (3-5 scenarios) | `momentic run --suite smoke` |
| After UI refactor | All scenarios for affected pages | `momentic run --tag people` |
| After role/permission changes | Role-comparison scenarios | `momentic run --tag roles` |
| New feature complete | Write + run new scenario | `momentic run tests/new-feature.yaml` |
| Bug report received | Write reproducer scenario | `momentic run tests/bug-123.yaml` |
| Pre-deploy | Full regression suite | `momentic run --suite regression` |

### Developer Workflow: Momentic Path

```
1. Start dev server:             npm run dev
2. Run smoke tests:              momentic run --suite smoke
3. See results in terminal + Momentic dashboard
4. Fix any failures
5. Re-run:                       momentic run tests/failing-test.yaml
6. Push PR
```

### Developer Workflow: Codex + MCP Path

```
1. Start dev server:             npm run dev
2. Open Codex CLI:               codex
3. Run a scenario:               "Run the intent in specs/intents/admin-add-member.md"
4. See results in terminal
5. Fix failures
6. Push PR
```

### npm Script Integration

```json
{
  "scripts": {
    "test:intents": "momentic run --suite smoke",
    "test:intents:full": "momentic run --suite regression",
    "test:intents:ci": "momentic run --suite smoke --headless --reporter json"
  }
}
```

Unlike the Claude approach, Momentic tests **can** be run via `npm test` because the CLI is non-interactive.

### Suggested Execution Cadence

```
Every commit:     npm run test (unit + component + integration)     ← CI (Vitest)
Every PR:         npm run test + npm run test:intents               ← local (Momentic)
Every release:    npm run test + npm run test:intents:full          ← local + CI
Exploratory:      codex → "explore the app and report issues"      ← local, ad-hoc
```

---

## 10. Writing Intent Scenarios

### Momentic Format

Momentic tests are YAML files with natural-language steps:

```yaml
# tests/admin-add-member.yaml
name: "Add a new member as Admin"
tags: [people, crud, smoke]
module: "auth-admin"

steps:
  - navigate: "/admin/people"
  - assert: "The member list is visible with at least one member"
  - click: "The '+ Add Member' button"
  - assert: "A modal dialog opens with a form"
  - assert: "The form has a 'Full name' input field"
  - assert: "The form has an 'email' input field"
  - assert: "The form has an App Role selector with options Admin, Coordinator, Musician"
  - assert: "The form has worship role toggles"
  - type:
      element: "Full name input"
      text: "Test User"
  - type:
      element: "Email input"
      text: "test@example.com"
  - click: "The 'Musician' role option"
  - click: "The 'Vocalist' toggle"
  - click: "The 'Acoustic Guitar' toggle"
  - click: "The Save or submit button"
  - assert: "The modal closes"
  - assert: "'Test User' appears in the member list"
  - assert: "A success message is shown"
```

### Markdown Format (For Codex + MCP Path)

Same format as the Claude approach — see [INTENT_BASED_TESTING_CLAUDE_MCP.md Section 9](./INTENT_BASED_TESTING_CLAUDE_MCP.md#9-writing-intent-scenarios):

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
4. Verify the modal opens with all form fields
5. Fill in: name "Test User", email "test@example.com"
...
```

### File Structure

```
tests/                          # Momentic YAML tests
  suites/
    smoke.yaml                  # Suite definition: which tests to include
    regression.yaml
  admin-add-member.yaml
  admin-add-song.yaml
  coordinator-readonly.yaml
  sidebar-navigation.yaml
  role-based-access.yaml
  login-flow.yaml
  roster-management.yaml

specs/intents/                  # Markdown intents (for Codex + MCP path)
  smoke/
    login-flow.md
    sidebar-navigation.md
    basic-crud.md
  regression/
    admin-add-member.md
    coordinator-readonly.md
    ...

.momentic/
  modules/
    auth-admin.yaml             # Reusable auth module
    auth-coordinator.yaml
```

### Suite Definitions

```yaml
# tests/suites/smoke.yaml
name: "Smoke Suite"
description: "Quick sanity check before every PR (~5 min)"
tests:
  - tests/login-flow.yaml
  - tests/sidebar-navigation.yaml
  - tests/admin-add-member.yaml

# tests/suites/regression.yaml
name: "Regression Suite"
description: "Full regression before releases (~15 min)"
tests:
  - tests/login-flow.yaml
  - tests/sidebar-navigation.yaml
  - tests/admin-add-member.yaml
  - tests/admin-add-song.yaml
  - tests/coordinator-readonly.yaml
  - tests/role-based-access.yaml
  - tests/roster-management.yaml
```

---

## 11. Typical Use Case Walkthrough

### Scenario: Catching the Blank Modal Bug

This is our most infamous recurring bug (see CLAUDE.md Rule 5). Here is how each tool catches it.

**Background:** A developer removes `isSaving` and `ROLES` from `people/page.tsx` to fix a lint warning, not realizing the modal form body was a placeholder `{/* ...existing code... */}`. The modal is now blank.

#### Momentic Catches It:

```bash
$ momentic run tests/admin-add-member.yaml

  admin-add-member
    ✓ Navigate to /admin/people
    ✓ Assert: member list visible
    ✓ Click: "+ Add Member" button
    ✗ Assert: form has 'Full name' input field
      FAILED: No input matching 'Full name' found in the modal.
      The modal dialog is visible but contains no form elements.

      Screenshot saved: .momentic/screenshots/admin-add-member-step4.png

  Result: FAIL (3/16 steps passed)
```

#### Codex + MCP Catches It:

```
Developer: "Run specs/intents/admin-add-member.md"

Codex (GPT-4.1):
  1. browser_navigate → http://localhost:3000/admin/people
  2. browser_snapshot → sees member list, finds "+ Add Member" button
  3. browser_click → clicks "+ Add Member"
  4. browser_snapshot → reads the modal

  Reports:
  "FAILURE at step 4: The modal opened but contains no form fields.
   Expected: Full name input, email input, role selector, worship role toggles.
   Actual: The modal is empty — the form body has no interactive elements.

   This looks like the known blank modal regression (CLAUDE.md Rule 5).
   Check src/app/admin/people/page.tsx for placeholder comments in the <form>."
```

**Both tools catch the same bug.** Momentic provides a screenshot artifact; Codex provides natural-language root-cause analysis with file references.

---

### Scenario: Role-Based Access Regression

A middleware change accidentally lets Coordinators see the Settings page.

#### Momentic:

```yaml
# tests/coordinator-readonly.yaml
name: "Coordinator cannot access Settings"
tags: [roles, security]
module: "auth-coordinator"

steps:
  - navigate: "/admin/settings"
  - assert: "The page redirects to /admin/roster OR shows a 403 error"
  - assert: "No admin settings controls are visible"
```

```bash
$ momentic run tests/coordinator-readonly.yaml

  coordinator-readonly
    ✓ Navigate to /admin/settings
    ✗ Assert: page redirects or shows 403
      FAILED: The Settings page rendered with full admin controls.
      No redirect occurred. The page displays all settings options.

  Result: FAIL
```

---

## 12. Bug Discovery & Self-Healing

### How Intent-Based Tests Find Bugs

(Same categories as the Claude approach — the AI model does not change what bugs can be found)

| Bug Category | How Detected | Example |
|-------------|-------------|---------|
| Blank/broken modals | Form has no interactive elements | Placeholder comment bug |
| Missing buttons (role-gating) | Element not found by semantic label | canEdit logic regression |
| Wrong page routing | URL does not match expected after navigation | Middleware misconfiguration |
| Broken form submission | No success indicator after submit | API route 500 error |
| Invisible buttons | Element present but has no discernible text/color | Missing `text-` / `bg-` classes |
| Cross-page state loss | Data disappears after navigation | State management bug |
| Console errors | Browser console checked for exceptions | Unhandled promise rejection |
| Accessibility issues | Missing labels, roles, ARIA attributes | Semantic HTML violations |

### Self-Healing: Momentic vs DIY

#### Momentic Self-Healing (Automatic)

Momentic maintains a **semantic understanding** of each element, not just a CSS selector. When the DOM changes:

```
Before: <button class="btn-primary">+ Add Song</button>
After:  <button class="action-btn new-song">New Song</button>
```

- **Script-based test:** FAILS (selector `.btn-primary` not found)
- **Momentic:** PASSES (finds the button by semantic role + proximity to "Songs" context)
- **Momentic logs:** "Locator updated: button '+ Add Song' → button 'New Song' (self-healed)"

This is automatic — no developer intervention needed.

#### Codex + MCP Self-Healing (Inherent)

When using Codex + Playwright MCP, self-healing is inherent because the AI reads the accessibility tree fresh every time. There is nothing to "heal" because there are no stored selectors.

#### Playwright Healer Agent (For Generated Specs)

If you use Playwright Agents to generate `.spec.ts` files from intents:

```bash
# A generated test fails
npx playwright test tests/add-song.spec.ts
# → FAIL: locator('.song-title-input') not found

# The Healer agent fixes it:
# In Codex CLI:
# > "The add-song test is failing. Use the healer agent to fix it."

# Healer: opens app via MCP, finds correct selector, updates .spec.ts, re-runs
```

---

## 13. Reporting & Artifacts

### Momentic Reporting

Momentic provides three reporting layers:

#### 1. Terminal Output (Every Run)

```bash
$ momentic run --suite smoke

  Smoke Suite (3 tests)

  ✓ login-flow (8 steps, 12.3s)
  ✓ sidebar-navigation (7 steps, 9.1s)
  ✗ admin-add-member (3/16 steps, FAILED at step 4)
    └─ Assert failed: No 'Full name' input found in modal

  Results: 2 passed, 1 failed (31.4s)
  Report: https://app.momentic.ai/runs/abc123
```

#### 2. Dashboard (Web UI)

Each test run is logged in the Momentic dashboard with:
- Step-by-step timeline with screenshots
- AI-generated failure explanations
- DOM snapshots at each step
- Self-healing audit log (which locators were updated)
- Trend graphs (pass rate over time)

#### 3. CI Reporters

```bash
# JSON output for CI integration
momentic run --suite smoke --reporter json --output test-results/momentic.json

# JUnit XML for GitHub Actions annotations
momentic run --suite smoke --reporter junit --output test-results/momentic.xml
```

### Codex + MCP Reporting

Same as the Claude approach — Codex reports conversationally in the terminal. Ask it to write a structured report:

```
> "Run all intent scenarios and write results to test-results/intent-report.md"
```

### Artifact Comparison

| Artifact | Momentic | Codex + MCP |
|----------|---------|-------------|
| Terminal pass/fail | Yes (structured) | Yes (conversational) |
| Screenshots | Automatic on failure | Manual (request `browser_screenshot`) |
| Web dashboard | Yes | No |
| JSON/JUnit reports | Yes | No (write custom) |
| Playwright traces | Configurable | Via `--save-trace` flag |
| Session video | Configurable | Via `--save-video` flag |
| Self-healing audit log | Yes | N/A (no stored selectors) |
| Trend/history graphs | Yes (dashboard) | No (manual tracking) |

---

## 14. Scaling Strategy

### Challenge: Same as Claude — Many Scenarios = Time + Cost

### Strategy 1: Tiered Suites (Same Structure)

```
tests/
  suites/
    smoke.yaml          # 3-5 tests, ~5 min, every PR
    regression.yaml     # 10-15 tests, ~15 min, every release
    exploratory.yaml    # Open-ended, ad-hoc
```

### Strategy 2: Model Tiering (GPT-4.1 Hybrid — Unique to This Approach)

This is the key advantage over Claude: you can use different GPT models for different test complexities.

**With Codex + Agents SDK (DIY path):**

```python
# test_runner.py — custom runner with model tiering
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

playwright = MCPServerStdio(command="npx", args=["@playwright/mcp@latest"])

# Tier 1: Complex multi-step reasoning
complex_agent = Agent(
    name="ComplexTester",
    model="gpt-4.1",
    instructions="Execute complex multi-step test scenarios with detailed assertions.",
    mcp_servers=[playwright]
)

# Tier 2: Standard interactions
standard_agent = Agent(
    name="StandardTester",
    model="gpt-4.1-mini",
    instructions="Execute standard test steps: click, type, verify.",
    mcp_servers=[playwright]
)

# Tier 3: Simple page verification
simple_agent = Agent(
    name="SimpleTester",
    model="gpt-4.1-nano",
    instructions="Navigate to a URL and verify the page loads without errors.",
    mcp_servers=[playwright]
)
```

**With Momentic:** Momentic manages its own model selection internally. You pay the platform fee and Momentic optimizes which model to use per step.

### Strategy 3: Graduate Stable Intents to Scripted E2E

Same graduation path as the Claude approach:

```
Intent (natural language) → Stable after 5+ runs → Generate .spec.ts → Move to CI
```

Momentic supports exporting tests as Playwright scripts. The Playwright Generator agent can also convert markdown intents to `.spec.ts` files.

### Strategy 4: Parallel Execution

**Momentic:**
```bash
# Run tests in parallel (Momentic handles browser instances)
momentic run --suite regression --parallel 3
```

**Codex + MCP:**
```bash
# Multiple terminal windows, each with its own Codex session
# Terminal 1: codex → "Run specs/intents/smoke/login-flow.md"
# Terminal 2: codex → "Run specs/intents/smoke/sidebar-navigation.md"
```

### Scaling Cost Projection

| Scale | Scenarios/Day | GPT-4.1 Hybrid/Month | Momentic/Month* | Claude Opus/Month |
|-------|--------------|----------------------|-----------------|-------------------|
| 1 dev, occasional | 5-10 | $2-4 | Platform fee | $17-34 |
| 2 devs, daily | 20-30 | $8-12 | Platform fee | $68-101 |
| 4 devs, daily | 40-60 | $15-23 | Platform fee | $135-203 |
| Team CI + local | 100+ | $38-57 | Platform fee | $338-507 |

*Momentic pricing is quote-based. The GPT-4.1 column is for the DIY approach where you pay API costs directly.*

---

## 15. Impact on DX & Testing Workflow

### What Changes vs the Claude Approach

| Aspect | Claude + MCP | GPT-4.1 + Momentic | GPT-4.1 + MCP (DIY) |
|--------|-------------|--------------------|--------------------|
| Setup complexity | Low (one command) | Medium (account + CLI) | Medium (Codex + config) |
| Day-to-day DX | Interactive conversation | `momentic run` command | Interactive conversation |
| Cost at scale | High ($168/mo) | Platform fee (TBD) | Low ($19-60/mo) |
| Self-healing | Manual (agent adapts) | Automatic (stored locators updated) | Manual (agent adapts) |
| CI/CD integration | No | Yes (built-in) | No |
| Reporting | Terminal only | Dashboard + screenshots + JSON | Terminal only |
| Determinism | Mostly | Higher (Momentic stabilizes) | Mostly |
| Vendor lock-in | Anthropic API | Momentic platform | OpenAI API |
| Offline capability | No (needs API) | No (cloud AI inference) | No (needs API) |

### DX Improvements Over Claude Approach

1. **`npm run test:intents` works** — Momentic CLI is non-interactive, unlike Claude Code sessions
2. **Screenshots on failure** — see exactly what the browser showed when a test failed
3. **CI/CD path** — when ready, move intent tests to GitHub Actions without changing them
4. **Cost transparency** — know exactly what you are spending (fixed platform fee vs per-token)
5. **Self-healing audit trail** — see which locators were updated and when

### DX Tradeoffs

1. **Less conversational** — Momentic is a test runner, not a chat partner. You cannot say "what else looks broken?"
2. **Vendor dependency** — Momentic is a startup. If they shut down, your tests are YAML files (portable, but the AI layer is gone)
3. **Quote-based pricing** — harder to budget without knowing the exact number upfront
4. **Learning curve** — new YAML format, new CLI, new dashboard (but simpler than writing Playwright scripts)

### Recommended Developer Workflow

```
Feature development:
  1. Write code
  2. npm run test                    ← fast, deterministic (Vitest)
  3. npm run lint
  4. npm run test:intents            ← Momentic smoke suite (~5 min)
  5. Fix any failures
  6. Push PR

Pre-release:
  1. npm run test                    ← full Vitest suite
  2. npm run test:intents:full       ← Momentic regression suite (~15 min)
  3. Fix failures
  4. Deploy

Exploratory (ad-hoc):
  1. codex                           ← OpenAI Codex CLI
  2. "Explore the app as Admin and report anything broken"
  3. Review findings, file bugs
```

---

## 16. Limitations & Risks

### Technical Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **Momentic requires internet** | AI inference is cloud-based; no offline testing | Acceptable for dev workflow; not a blocker |
| **Quote-based pricing** | Hard to predict costs before signing up | Request trial, benchmark with 10-20 scenarios |
| **Startup risk** | Momentic is a 2-year-old company | Tests are YAML (portable); have DIY backup plan |
| **AI inference latency** | Each step has cloud round-trip | 2-5s per step; acceptable for intent-based layer |
| **GPT-4.1 vs Claude reasoning** | Claude may be slightly better at complex reasoning | GPT-4.1 scores 54.6% SWE-bench; good enough for testing |
| **No fully local AI** | Both paths require cloud API calls | Accept this; local LLMs are not good enough for browser testing yet |
| **MCP version changes** | Playwright MCP may have breaking changes | Pin version in config |

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Momentic pricing too high | Medium | High | Have DIY (Codex + MCP) as backup |
| GPT-4.1 quality insufficient | Low | Medium | Fall back to GPT-4o or Claude Sonnet |
| Developers do not adopt | High | Medium | Make smoke suite < 5 min, add to PR checklist |
| False positives erode trust | Medium | Medium | Refine scenarios, use Momentic's dashboard to review |
| Momentic shuts down | Low | High | Tests are YAML (portable); DIY path is always available |
| MCP standard diverges between vendors | Low | Low | MCP is now Linux Foundation governed |

---

## 17. Rollout Plan

### Phase 0: Decision Point (Week 0)

- [ ] Read this document and [INTENT_BASED_TESTING_CLAUDE_MCP.md](./INTENT_BASED_TESTING_CLAUDE_MCP.md)
- [ ] Decide: start with Claude (simpler POC) or GPT-4.1 + Momentic (cost-optimized)?
- [ ] If Momentic: request a quote from [momentic.ai](https://momentic.ai)
- [ ] If DIY: ensure team has OpenAI API keys and Codex CLI installed

### Phase 1: Foundation (Week 1)

**Momentic Path:**
- [ ] Install Momentic CLI (`npm install -g @momentic/cli`)
- [ ] Create `momentic.config.yaml`
- [ ] Create `test-storage-state.json` for dev_auth bypass
- [ ] Create `.momentic/modules/auth-admin.yaml` auth module
- [ ] Write 3 smoke tests:
  - `tests/login-flow.yaml`
  - `tests/sidebar-navigation.yaml`
  - `tests/admin-add-member.yaml`
- [ ] Run and validate: `momentic run --suite smoke`

**DIY Path:**
- [ ] Install Codex CLI (`npm install -g @openai/codex`)
- [ ] Configure Playwright MCP (`codex mcp add playwright`)
- [ ] Create `.mcp.json` project config
- [ ] Create `test-storage-state.json`
- [ ] Create `specs/intents/` directory
- [ ] Write 3 smoke scenarios (markdown)
- [ ] Run and validate manually via Codex

### Phase 2: Core Scenarios (Week 2)

- [ ] Write regression scenarios for all critical pages:
  - Admin: add member, add song, roster management
  - Coordinator: read-only verification, settings blocked
  - Role comparison: Admin vs Coordinator on same page
- [ ] Define suite files (`smoke.yaml`, `regression.yaml`)
- [ ] Benchmark: timing, cost per run, failure accuracy
- [ ] Refine scenarios based on false positives/negatives

### Phase 3: npm Integration (Week 3)

- [ ] Add npm scripts:
  ```json
  {
    "test:intents": "momentic run --suite smoke",
    "test:intents:full": "momentic run --suite regression",
    "test:intents:ci": "momentic run --suite smoke --headless --reporter junit"
  }
  ```
- [ ] Add `npm run test:intents` to PR checklist
- [ ] Document the workflow in project README or CONTRIBUTING.md

### Phase 4: Team Adoption + CI Graduation (Week 4+)

- [ ] Team walkthrough: demo smoke suite, show dashboard, explain YAML format
- [ ] Each developer writes one intent test for their current feature
- [ ] Evaluate graduating 2-3 stable intents to `.spec.ts` files for CI
- [ ] Set up GitHub Actions step for `npm run test:intents:ci` (optional)
- [ ] Monthly review: cost tracking, scenario maintenance, promotion to scripted E2E

---

## Appendix A: Tool Landscape Comparison

### Full Comparison Matrix (2025-2026)

| Feature | Claude + MCP | Codex + MCP | Momentic | TestSprite | Shortest | Cypress cy.prompt() |
|---------|-------------|-------------|---------|-----------|---------|-------------------|
| **AI Model** | Claude (any) | GPT-4.1 (any) | Proprietary | Proprietary | Claude only | Proprietary |
| **NL Test Input** | Markdown | Markdown | YAML + NL steps | URL-based | TypeScript + NL | Cypress + NL |
| **Local Execution** | Yes | Yes | Yes (CLI) | No (cloud) | Yes | Yes |
| **localhost Testing** | Yes | Yes | Yes | No (needs tunnel) | Yes | Yes |
| **Self-Healing** | Inherent (AI adapts) | Inherent (AI adapts) | Automatic (stored locators) | Claimed (unreliable) | No | No |
| **CI/CD Integration** | No | No | Yes (GH Actions, etc.) | Yes | Basic | Yes (Cypress Cloud) |
| **Reporting UI** | Terminal | Terminal | Web dashboard | Web dashboard | Terminal | Cypress Cloud |
| **Screenshots** | Manual | Manual | Automatic on failure | Yes | No | Yes |
| **Open Source** | Claude Code is not | Codex is not | No | No | Yes (5.2k stars) | Partial |
| **Pricing** | API tokens | API tokens | Quote-based | $69+/mo + credits | Free (API key) | Free + Cloud |
| **Maturity** | High | Medium | Medium-High | Low | Early | Experimental |
| **Best For** | Single dev, POC | Cost-conscious teams | Teams wanting managed solution | Avoid | Claude-only shops | Cypress users |

---

## Appendix B: DIY Alternative with OpenAI Agents SDK

If Momentic's pricing does not work for your team, here is a fully DIY approach using the OpenAI Agents SDK (Python or TypeScript):

### Python Implementation

```python
# intent_runner.py — Custom intent-based test runner
import asyncio
import json
import sys
from pathlib import Path
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

# Playwright MCP server
playwright = MCPServerStdio(
    command="npx",
    args=[
        "@playwright/mcp@latest",
        "--browser", "chrome",
        "--storage-state", "test-storage-state.json",
        "--viewport-size", "1280x720"
    ]
)

# Test agent using GPT-4.1
tester = Agent(
    name="IntentTester",
    model="gpt-4.1",
    instructions="""You are a QA tester for a Next.js worship ministry admin app.

Given a test scenario in natural language, execute each step using the Playwright
MCP browser tools. After each step, take a browser_snapshot to verify the result.

Report results in this format:
- Step N: [description] → PASS or FAIL
- If FAIL: describe what was expected vs what was found
- At the end: overall PASS/FAIL with summary

The app runs at http://localhost:3000. Auth is pre-configured via dev_auth cookie.
""",
    mcp_servers=[playwright]
)

async def run_intent(scenario_path: str):
    scenario = Path(scenario_path).read_text()
    result = await Runner.run(tester, f"Execute this test scenario:\n\n{scenario}")
    print(result.final_output)
    return result

if __name__ == "__main__":
    scenario = sys.argv[1] if len(sys.argv) > 1 else "specs/intents/smoke/login-flow.md"
    asyncio.run(run_intent(scenario))
```

### Running

```bash
# Single scenario
python intent_runner.py specs/intents/admin-add-member.md

# All smoke scenarios
for f in specs/intents/smoke/*.md; do python intent_runner.py "$f"; done
```

### TypeScript Implementation (via OpenAI Agents SDK)

```typescript
// intent-runner.ts
import { Agent, Runner } from "@openai/agents";
import { MCPServerStdio } from "@openai/agents/mcp";
import { readFileSync } from "fs";

const playwright = new MCPServerStdio({
  command: "npx",
  args: ["@playwright/mcp@latest", "--browser", "chrome",
         "--storage-state", "test-storage-state.json"]
});

const tester = new Agent({
  name: "IntentTester",
  model: "gpt-4.1",
  instructions: `You are a QA tester. Execute test scenarios step by step
    using Playwright MCP. Report PASS/FAIL for each step.`,
  mcpServers: [playwright]
});

async function runIntent(scenarioPath: string) {
  const scenario = readFileSync(scenarioPath, "utf-8");
  const result = await Runner.run(tester, `Execute:\n\n${scenario}`);
  console.log(result.finalOutput);
}

runIntent(process.argv[2] || "specs/intents/smoke/login-flow.md");
```

### Pros/Cons of DIY

| Pro | Con |
|-----|-----|
| Zero vendor dependency (only OpenAI API) | You build the runner, reporter, CI integration |
| Full cost control (choose model per step) | No self-healing audit trail |
| Maximum flexibility | No web dashboard |
| Can switch models freely | More setup and maintenance |
| ~$19/month at team scale | Need Python or TypeScript expertise |

---

## Appendix C: Scenario Template

### Momentic YAML Template

```yaml
# tests/[scenario-name].yaml
name: "[Short description]"
tags: [page-name, category]
module: "auth-admin"  # or auth-coordinator

steps:
  - navigate: "/admin/[page]"
  - assert: "[Initial state verification]"
  - click: "[Button or element description]"
  - assert: "[Expected result after click]"
  - type:
      element: "[Input field description]"
      text: "[Value to enter]"
  - click: "[Submit button description]"
  - assert: "[Final success state]"
  - assert: "No console errors"
```

### Markdown Intent Template (For Codex + MCP)

```markdown
# Intent: [Short description]

## Context
- App URL: http://localhost:3000
- Auth: [dev_auth bypass | Coordinator role | Admin role]
- Preconditions: [any required data]

## Steps

1. Navigate to [page URL]
2. Verify [initial state]
3. [Action]
4. Verify [result]
...

## Expected Outcomes
- [What should be true after all steps]

## Failure Indicators
- [Symptoms that indicate a bug]

## Related Files
- [src/app/admin/page.tsx]
```

---

## Appendix D: Decision Matrix — Which Path to Choose

Use this to decide between the three approaches:

| Question | Choose Claude + MCP | Choose Momentic | Choose DIY (Codex + MCP) |
|----------|-------------------|----------------|------------------------|
| Team size? | 1-2 devs | 3+ devs | 2-4 devs (technical) |
| Budget sensitivity? | Low | Medium | High |
| Need CI/CD? | No | Yes | No (graduate to scripts) |
| Want a dashboard? | No | Yes | No |
| Self-healing needed? | AI adapts (sufficient) | Yes (automatic + audited) | AI adapts (sufficient) |
| Technical comfort? | High (AI chat) | Medium (CLI + YAML) | High (Python/TS + API) |
| Vendor lock-in concern? | Accept Anthropic | Accept Momentic | Accept OpenAI |
| Monthly cost target? | $100-170 | Quote-based | $19-60 |

**Our recommendation:** Start with **Claude + MCP** (Phase 1, already documented). Evaluate **Momentic** when the team grows to 3+ developers. Keep **DIY (Codex + MCP)** as the fallback if costs need to be  minimized.
