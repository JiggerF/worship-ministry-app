# Design 1 vs Design 2: Multi-Tenancy Planning Comparison

> **Date:** March 2026
> **Documents compared:**
> - Design 1: [TECHNICAL_PLAN.md](./Design/TECHNICAL_PLAN.md), [SAAS_ARCHITECTURE_PLAN.md](./Design/SAAS_ARCHITECTURE_PLAN.md), [CHALLENGE_LOG.md](./Design/CHALLENGE_LOG.md)
> - Design 2: [TECHNICAL_PLAN_WRKFLOW2.md](./Design/TECHNICAL_PLAN_WRKFLOW2.md), [SAAS_ARCHITECTURE_WRKFLOW2.md](./Design/SAAS_ARCHITECTURE_WRKFLOW2.md), [CHALLENGE_LOG.md](./Design/CHALLENGE_LOG.md)
> **Review lenses:** Systems Thinking, Staff Software Engineer, SaaS Architect

---

## Three-Lens Analysis

---

### Systems Thinking Perspective

**Focus:** Cross-system dependencies, feedback loops, cascading failures, emergent behavior

#### Where Design 2 is stronger:

1. **Constraint enumeration is exhaustive.** D2 identifies 13 explicit constraints (C1-C13) from the codebase before designing anything. W1 discovers constraints reactively — the challenge log catches things the original plan missed (e.g., H1: `members.email` UNIQUE contradiction, H3: in-memory cache on serverless). W2's upfront constraint discovery is a healthier system design pattern.

2. **Edge Runtime awareness.** D2 explicitly calls out that middleware runs in Edge Runtime and budgets for it (C12, plus the challenge log's C2). W1 doesn't address this until the challenge log flags it as H3 (in-memory cache). This is a systems-level concern that should inform the design, not be discovered after.

3. **Two query pattern recognition.** D2's challenge log (H3) identifies that the codebase has *two* data access patterns — `lib/db/*.ts` helpers AND direct `supabase.from()` calls in API routes. W1's plan only addresses the helper layer. This is a critical systems insight: if you only secure one path, the other leaks.

4. **Legacy fallback path coverage.** D2 catches the legacy `availability` table fallback (H5) — a code path that W1 never mentions. Systems thinking demands tracing ALL data flows, including deprecated ones.

#### Where Design 1 is stronger:

1. **Kill switch design.** D1's challenge log (M2) proposes `MULTI_TENANT_ENABLED` as a graceful degradation mechanism with a clear code pattern (`if (tenantId) query.eq(...)` — falls back to single-tenant). W2 mentions a kill switch (F7) but doesn't detail the degradation pattern until the challenge log. W1's pattern is more operationally mature.

2. **Platform admin risk awareness.** D1 identifies M3 (no rate limiting/audit on platform admin APIs) — a systemic risk W2 doesn't address at all. Platform admin compromise is a system-wide failure mode.

#### Verdict (Systems Thinking): **Design 2 wins.** Its upfront constraint discovery and deeper codebase tracing produce a more complete system model. D1's reactive discovery pattern means critical interactions are found late.

---

### Staff Software Engineer Perspective

**Focus:** Code quality, module boundaries, maintainability, clean APIs, implementation pragmatism

#### Where Design 2 is stronger:

1. **`tenantFrom()` without `.select()` — from the start.** W2's design specifies this correctly in the initial plan. W1 originally baked `.select("*")` into the helper, which the challenge log (H4) had to fix. Getting the API right the first time saves refactoring.

2. **File impact map completeness.** D2's appendix lists 25+ specific files with exact changes per phase. W1's plan is more narrative — you have to read prose to figure out which files need changing. For a staff engineer handing work to a team, D2's format is more actionable.

3. **Pre-flight verification step.** D2 starts Phase 0 with a literal SQL query to verify table naming (`member_roles` vs `member_role_assignments`). This is the kind of "measure twice, cut once" step that prevents cascading errors through all subsequent migrations. W1 doesn't include this.

4. **Explicit test file organization.** D2 names specific test files (`tenant-isolation.test.ts`, `header-spoofing.test.ts`, `multi-org-member.test.ts`, `provisioning.test.ts`) with exact test categories. W1 describes what to test but doesn't specify file organization.

#### Where Design 1 is stronger:

1. **AI agent safety rules.** W1 dedicates a full section to 5 AI agent safety rules with code examples. W2 mentions AI agents as a placeholder. For a project that explicitly plans AI-assisted automation, W1's treatment is more responsible.

2. **Developer experience narrative.** W1 explains *why* decisions were made in a way that helps future contributors understand the architecture. W2 is more mechanical — correct but less educational. For a small team with volunteer contributors, W1's narrative style has onboarding value.

3. **Risk severity matrix.** W1 explicitly rates risks by likelihood x impact with mitigation strategies in a structured table. W2 lists risks but without the same structured assessment framework.

#### Verdict (Staff Engineer): **Design 2 wins on implementation precision.** W1 wins on developer ergonomics and documentation quality. For actually building the feature, W2's precision matters more.

---

### SaaS Architect Perspective

**Focus:** Tenant isolation guarantees, data model correctness, provisioning safety, scale considerations

#### Where Design 2 is stronger:

1. **EXCLUDE constraint handling.** D2 explicitly identifies and fixes the `availability_periods` EXCLUDE constraint (C1 in challenge log). This is a subtle multi-tenant data model issue that W1 never addresses. Getting GiST constraints wrong silently blocks tenant onboarding.

2. **Availability token tenant validation.** D2's challenge log (C3) identifies that the availability token route doesn't validate `periodId` belongs to the correct tenant — a cross-tenant data injection vector. W1 mentions magic tokens but doesn't catch this specific attack path.

3. **`onConflict` clause audit.** D2 systematically identifies every `onConflict` clause that needs `tenant_id` added (F5, plus M2 for `setlist.ts`). W1 mentions this generally but doesn't enumerate each location.

4. **Provisioning stored procedure is more complete.** D2's `provision_tenant()` handles: org creation, member upsert (ON CONFLICT for existing members), org_member link, default features, default settings, handbook seeding — all atomically with proper exception handling. D1's provisioning is described narratively without the complete SQL.

5. **Two-level activation model.** Both plans end up with `members.is_active` (platform) + `organization_members.is_active` (per-tenant), but W2 designs this from the start while D1 adds it via challenge fix (C2).

#### Where Design 1 is stronger:

1. **Feature flag resolution logic is more explicit.** D1 spells out the 4-step resolution: check org override -> check global default -> no definition -> false. Both plans have this, but D1's presentation is clearer with a concrete resolution flowchart.

2. **Zero-downtime migration guarantees table.** D1 has an explicit table mapping each schema change type to its risk level and why it's safe. W2 states the safety principles but doesn't provide this quick-reference table.

3. **`/api/me` backward compatibility.** W1 explicitly calls out that the `/api/me` response evolution is backward-compatible (new fields added, none removed). D2 shows the new response shape but doesn't highlight the compatibility guarantee.

#### Verdict (SaaS Architect): **Design 2 wins.** Its data model analysis is deeper, its constraint handling is more thorough, and its provisioning SQL is production-ready. The EXCLUDE constraint catch alone justifies this — that bug would silently block onboarding.

---

## The Debate

**Systems Thinking:** "W2's upfront constraint discovery is the right engineering approach. You can't design a multi-tenant system by discovering constraints after the architecture is set. W2 found 13 constraints before drawing a single diagram."

**Staff Engineer:** "I agree on precision, but D1's documentation is easier to hand off to a junior developer. W2 reads like a specification; D1 reads like a guide. For a small team, that matters."

**SaaS Architect:** "Documentation style is fixable. Data model bugs are not. D2 catches the EXCLUDE constraint, the availability token injection, the legacy fallback path, and the two query patterns. Any one of those could cause a production incident. D1 missed all four until challenged."

**Staff Engineer:** "Fair point. But D1's AI agent safety rules and kill switch degradation pattern are things we'd need to add to D2 regardless. Those aren't cosmetic — they're architectural."

**Systems Thinking:** "The kill switch is important, but W2's challenge log does address it (F7, then the implementation plan's Phase 3 Step 3.4). It's just discovered later. D1's earlier discovery is better, but both end up in the same place."

**SaaS Architect:** "Here's what matters for a SaaS migration: will this plan, if followed literally, produce correct tenant isolation? D2's answer is more reliably yes. Its migration SQL is complete, its constraint updates are enumerated, and its challenge log catches deeper issues."

**Staff Engineer:** "Then the recommendation is clear: use D2 as the implementation blueprint, but incorporate W1's strengths — the AI agent section, the developer-facing narrative, the zero-downtime table, and the kill switch degradation pattern."

**Systems Thinking:** "Agreed. And one more thing: D2's pipeline approach (6 phases with skills applied throughout) produced a more thorough result than W1's more freeform approach. The structured pipeline caught more issues upfront. That's a process learning worth noting."

---

## Team Conclusion

**Design 2 is the recommended implementation plan**, with the following additions from Design 1:

| Incorporate from W1 | Into W2 location | Reason |
|---------------------|-------------------|--------|
| AI agent safety rules (5 rules with code examples) | TECHNICAL_PLAN Phase 2, Architecture Design | W2 only has placeholders; AI agents are a planned feature |
| Kill switch degradation pattern (`if (tenantId) query.eq(...)`) | SAAS_ARCHITECTURE Phase 3, Step 3.4 | W2 mentions kill switch but doesn't show the graceful degradation code pattern |
| Zero-downtime migration safety table | SAAS_ARCHITECTURE Phase 0 preamble | Quick reference for migration risk assessment |
| Platform admin rate limiting + audit (M3) | SAAS_ARCHITECTURE Phase 2 | W2 has no platform admin hardening |
| `/api/me` backward compatibility note | TECHNICAL_PLAN Phase 2, API section | Explicit guarantee for client consumers |
| Developer onboarding narrative ("why" explanations) | Both docs, as inline commentary | Small team with volunteers benefits from context |

### Why W2 wins:

1. **Deeper codebase analysis** — 13 constraints identified upfront vs discovered reactively
2. **More thorough data model** — EXCLUDE constraint, onConflict audit, legacy fallback path
3. **Better security coverage** — availability token tenant validation, two query pattern awareness
4. **Production-ready SQL** — complete stored procedure, enumerated constraint updates
5. **More actionable format** — file impact map with specific changes per phase
6. **Structured pipeline produced better results** — the 6-phase planning cycle with skill application caught more issues than freeform planning

### Process recommendation:

The feature-planning-pipeline (Design 2's approach) should be the standard for future feature planning. Its structured phase approach with multiple skill perspectives applied throughout produces more thorough, implementation-ready plans than freeform analysis.

---

## Scorecard

| Dimension | D1 | D2 | Winner |
|-----------|----|----|--------|
| Upfront constraint discovery | 7 constraints found reactively | 13 constraints found proactively | D2 |
| Data model correctness | Missed EXCLUDE, onConflict gaps | Complete constraint audit | D2 |
| Security analysis | Header spoofing, `is_active` scope | + token injection, two query patterns, legacy fallback | D2 |
| Migration SQL completeness | Narrative descriptions | Production-ready SQL with stored procedure | D2 |
| File impact map | Prose-based | Tabular, per-phase, 25+ files enumerated | D2 |
| AI agent safety | 5 rules with code examples | Placeholder only | D1 |
| Developer documentation quality | Narrative "why" explanations | Mechanical specification | D1 |
| Kill switch design | Full degradation pattern | Mentioned, not detailed | D1 |
| Platform admin hardening | Rate limiting + audit identified | Not addressed | D1 |
| Test organization | Described conceptually | Named files + categories | D2 |
| Provisioning atomicity | Described narratively | Complete stored procedure | D2 |
| Overall | | | **D2** |

**Final score: Design 2 — 8/11 dimensions. Design 1 — 3/11 dimensions.**

Use D2 as the blueprint. Port D1's four strengths (AI agents, kill switch, platform hardening, dev narrative) into the D2 documents before implementation begins.
