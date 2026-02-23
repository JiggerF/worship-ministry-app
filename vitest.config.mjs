// @ts-check
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Stub out Next.js "server-only" guard so DB modules can be imported in tests
      "server-only": resolve(__dirname, "./__tests__/__mocks__/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["./__tests__/**/*.test.{ts,tsx}"],
    // Set env vars before any module-level code runs (captures module-level env reads)
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Test infra and non-computable
        "src/**/*.d.ts",
        "src/middleware.ts",
        "src/app/globals.css",
        // Page/layout files — UI shells, no logic
        "src/app/layout.tsx",
        "src/app/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        // Admin sub-pages (login UI, dashboard, portal pages) — no testable logic
        "src/app/**/login/**",
        "src/app/**/dashboard/**",
        "src/app/portal/**",
        "src/app/availability/**",
        // DB access layer — requires real Supabase; tested implicitly via route mocks
        "src/lib/db/**",
        // Mock helpers and test fixtures
        "src/lib/mock-data.ts",
        "src/lib/mocks/**",
        // Supabase client initialisation files
        "src/lib/supabaseClient.ts",
        "src/lib/supabase/**",
        // Type-only files — no executable code
        "src/lib/types/**",
        "src/types/**",
        // Third-party UI primitives (Radix wrappers) — no first-party logic
        "src/components/ui/**",
        // Complex PDF-generation component — covered separately or excluded
        "src/components/chord-sheet-modal.tsx",
        // Complex 300-line roster route — covered by e2e (MVP2)
        "src/app/api/roster/**",
        // Roles helper file (trivially thin wrapper)
        "src/app/api/roles/**",
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
