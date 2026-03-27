/**
 * shadow-agent/mapper.ts
 *
 * Impact mapper — maps changed source file paths to the intent test files
 * that cover them. Used by the Phase 3 shadow agent watcher to determine
 * which tests to run after a file change.
 *
 * Usage:
 *   import { getImpactedTests } from "./mapper";
 *   const testFiles = getImpactedTests(["src/app/admin/people/page.tsx"]);
 *   // → ["__tests__/intent/people.intent.test.tsx"]
 *
 * Called directly (for debugging):
 *   npx tsx shadow-agent/mapper.ts src/app/admin/people/page.tsx src/middleware.ts
 */

import { resolve } from "path";

// ─── Intent test file registry ───────────────────────────────────────────────

const INTENT_DIR = "__tests__/intent";

const PEOPLE_TEST   = `${INTENT_DIR}/people.intent.test.tsx`;
const SONGS_TEST    = `${INTENT_DIR}/songs.intent.test.tsx`;
const ROSTER_TEST   = `${INTENT_DIR}/roster.intent.test.tsx`;
const SETTINGS_TEST = `${INTENT_DIR}/settings.intent.test.tsx`;
const COORDINATOR_TEST = `${INTENT_DIR}/coordinator-access.intent.test.tsx`;

const ALL_INTENT_TESTS = [
  PEOPLE_TEST,
  SONGS_TEST,
  ROSTER_TEST,
  SETTINGS_TEST,
  COORDINATOR_TEST,
];

// ─── Impact map ───────────────────────────────────────────────────────────────
//
// Level 1: Direct file → specific test file(s).
// Level 2: Shared files → all intent tests (any shared change = full suite).
//
// Rules:
//   - A changed page file maps to its page test + the coordinator-access test.
//   - A changed API route maps to all tests that mock it.
//   - A changed shared lib (db, types, constants, api/me) maps to ALL tests.
//   - Anything in shadow-agent/ itself → no tests triggered.
//   - Unrecognised paths → no tests triggered (not an error).

type DirectMap = {
  /** Exact file path prefix to match (relative to repo root) */
  prefix: string;
  /** Intent test file paths this file affects */
  tests: string[];
};

const DIRECT_MAP: DirectMap[] = [
  // Pages
  { prefix: "src/app/admin/people",   tests: [PEOPLE_TEST, COORDINATOR_TEST] },
  { prefix: "src/app/admin/songs",    tests: [SONGS_TEST, COORDINATOR_TEST] },
  { prefix: "src/app/admin/roster",   tests: [ROSTER_TEST, COORDINATOR_TEST] },
  { prefix: "src/app/admin/settings", tests: [SETTINGS_TEST] },
  { prefix: "src/app/admin/login",    tests: [] }, // login tests covered by login-page.test.tsx

  // API routes
  { prefix: "src/app/api/members",    tests: [PEOPLE_TEST, COORDINATOR_TEST] },
  { prefix: "src/app/api/songs",      tests: [SONGS_TEST, COORDINATOR_TEST] },
  { prefix: "src/app/api/roster",     tests: [ROSTER_TEST] },
  { prefix: "src/app/api/settings",   tests: [SETTINGS_TEST] },

  // Middleware
  { prefix: "src/middleware",         tests: [COORDINATOR_TEST] },

  // Intent test helpers themselves — run all to verify nothing broke
  { prefix: "__tests__/intent",       tests: ALL_INTENT_TESTS },
];

/** Source paths whose change invalidates every intent test. */
const SHARED_PREFIXES: string[] = [
  "src/app/api/me",
  "src/lib/db",
  "src/lib/types",
  "src/lib/constants",
  "src/components",
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Given a list of changed file paths (relative to repo root or absolute),
 * returns the de-duplicated set of intent test file paths that should run.
 *
 * Returns an empty array if no mapped tests are impacted.
 */
export function getImpactedTests(changedFiles: string[]): string[] {
  const root = resolve(__dirname, "..");
  const impacted = new Set<string>();

  for (const raw of changedFiles) {
    // Normalise to a repo-root-relative path (forward slashes)
    const rel = resolve(raw).startsWith(root)
      ? resolve(raw).slice(root.length + 1).replace(/\\/g, "/")
      : raw.replace(/\\/g, "/");

    // Level 2 — shared lib change → full suite
    if (SHARED_PREFIXES.some((p) => rel.startsWith(p))) {
      ALL_INTENT_TESTS.forEach((t) => impacted.add(t));
      continue;
    }

    // Level 1 — direct map
    for (const entry of DIRECT_MAP) {
      if (rel.startsWith(entry.prefix)) {
        entry.tests.forEach((t) => impacted.add(t));
        break;
      }
    }
    // Unrecognised file → no tests added (silent, not an error)
  }

  return [...impacted];
}

// ─── CLI entry point (debug / manual use) ────────────────────────────────────
// Run: npx tsx shadow-agent/mapper.ts <file1> [file2] ...

if (process.argv[1] && process.argv[1].endsWith("mapper.ts")) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: npx tsx shadow-agent/mapper.ts <changed-file> [...]");
    console.log("\nAll known intent tests:");
    ALL_INTENT_TESTS.forEach((t) => console.log(" ", t));
    process.exit(0);
  }

  const tests = getImpactedTests(args);
  if (tests.length === 0) {
    console.log("[mapper] No intent tests impacted by the changed files.");
  } else {
    console.log(`[mapper] ${tests.length} intent test(s) impacted:`);
    tests.forEach((t) => console.log(" ", t));
  }
}
