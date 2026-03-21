# CLAUDE.md — Worship Ministry Platform

This is the auto-loaded context file. It is read at the start of every session.
Keep it concise — every line costs tokens on every request.

For full project detail, architecture, and current known gaps: `.claude/context/PROJECT-CONTEXT.md`
For hard engineering rules that must never be broken: `CLAUDE.md` (root)

---

# What This Project Is

A multi-tenant SaaS platform for church worship ministry teams. Next.js 16 App Router, Supabase (PostgreSQL), TypeScript strict, Tailwind v4. Multi-tenancy is implemented and gated behind `MULTI_TENANT_ENABLED=true`. 705 tests (Vitest). See `.claude/context/PROJECT-CONTEXT.md` for full architecture.

---

# Non-Negotiable Rules

These are the most critical rules. Violating them has caused production regressions.

1. **Never write `{/* ...existing code... */}` inside a `<form>` or modal body.** It makes all form state variables appear unused, triggers incorrect lint removals, and leaves the modal blank. Always write the real JSX.

2. **Before removing any symbol flagged as unused on a modal page, read the form body first.** If the form contains a placeholder comment, fix the form — do not remove the symbol. Run `npm run test:components` after any change to a modal page.

3. **Every async button handler must follow try/catch/finally.** `setBusy(false)` goes in `finally`. All errors use `showToast()`. Never use `alert()` for outcomes. An uncaught throw in a handler causes a full dark-screen freeze in dev mode.

4. **Never trust `members.app_role` for per-tenant role decisions.** In multi-tenant mode, always read from `organization_members.app_role` via `actor.tenantId` from `getActorFromRequest(req)`.

5. **Every DB write on a tenant-scoped table must include `.eq("tenant_id", tenantId)`.** This includes DELETEs — an unscoped delete is an IDOR vulnerability.

6. **Never default role to `"Admin"` when it is unknown.** Default to `null` and show a restricted UI. `null !== "Admin"` evaluates to `true` — that bug grants admin access silently.

All detailed rules, anti-patterns, and code examples are in `CLAUDE.md` (root of repo).

---

# Skills — When to Use Each

Skills live in `.claude/skills/`. Invoke knowledge skills by name: *"Use the staff-engineer skill."* Invoke action skills directly with `/skill-name`.

**Knowledge skills** (load for context, guide Claude's reasoning):

| Skill | Use when |
|---|---|
| `staff-engineer` | Implementing features, reviewing code, architecture decisions, refactoring |
| `saas-architect` | Designing new modules, tenant isolation strategy, schema design |
| `SDET-quality-engineer` | Defining test coverage, reviewing edge cases, test strategy before implementation |
| `systems-thinking` | Evaluating cross-system impact, identifying hidden coupling, scaling analysis |
| `product-manager` | Defining feature scope, user stories, MVP vs future scope |
| `ai-system-designer` | Designing AI agents, prompt pipelines, recommendation systems |
| `ux-designer` | Page layout, user flows, low-cognitive-load interface decisions |

**Action skills** (invoke directly — run as forked sub-agents):

| Skill | Use when |
|---|---|
| `/pr-impact-test` | PR raised or before merging — maps diff to targeted test suites, runs them, reports blast radius, and triggers audit agents if needed |

Do not load multiple knowledge skills simultaneously unless the task genuinely spans them.

---

# Sub-Agents — When to Invoke Each

Sub-agents live in `.claude/agents/`. They are autonomous workers for bounded, repetitive tasks. Invoke by name.

| Agent | Invoke when |
|---|---|
| `debugger` | Something is broken in manual testing — blank modal, dark screen, 401/500 error, wrong data, auth loop, build error. Traces browser symptom → root cause → applies fix → runs tests |
| `tenant-security-auditor` | New API route added, before enabling `MULTI_TENANT_ENABLED=true`, after any change to `src/app/api/` or `src/lib/db/` |
| `modal-regression-guard` | Lint error on a modal page, before running `test:components`, any time `isSaving`/`saveError`/`toggleRole`/`ROLES` is flagged unused |
| `migration-safety-reviewer` | New `.sql` file created in `supabase/migrations/`, before applying any migration to staging or production |
| `async-handler-auditor` | New async handler written in an admin page, dark screen reported, reviewing admin page UI reliability |

---

# Prompts — Planning Pipeline

Prompts live in `.claude/prompts/`. Use them for structured planning.

| Prompt | Use when |
|---|---|
| `00_feature-planning-pipeline.md` | Starting a major new feature (runs all 6 phases: definition → architecture → implementation → testing → release → critical review) |
| `architecture-design-review.md` | Reviewing a specific design decision in isolation |
| `01–05` individual phases | When you only need one phase of the pipeline |

Example invocation:
```
Use feature-planning-pipeline.md

Topic: Add equipment asset tracking module with per-tenant inventory
```

---

# Development Commands

```bash
npm run dev               # Dev server (NODE_ENV=development, dev_auth bypass available)
npm run dev:real-auth     # Dev server with production auth (no bypass)
npm run build             # Production build
npm run lint              # ESLint
npm run test              # All tests (vitest run)
npm run test:components   # Component tests only — run after ANY change to a modal page
npm run test:watch        # Watch mode
```