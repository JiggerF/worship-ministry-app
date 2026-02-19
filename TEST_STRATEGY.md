# Test Strategy

## Philosophy

**Local-first testing:** All tests run against local Supabase stack before CI. Developers should never push code that fails locally.

**Test pyramid approach:**
- Many fast unit tests
- Moderate integration tests
- Few critical E2E tests

## Test Layers

### 1. Unit Tests (Vitest)

**What:** Pure functions, utilities, business logic.

**Examples:**
- Date calculations (roster period logic, 15th/20th rule)
- Magic token generation/validation
- Burnout score calculation
- Conflict detection helpers

**Run:**
```bash
npm run test:unit
npm run test:unit:watch  # Watch mode during development
```

**Location:** `*.test.ts` or `*.spec.ts` next to source files.

### 2. Integration Tests (Vitest + Supabase Local)

**What:** Database interactions, RLS policies, API routes.

**Examples:**
- POST `/api/people` creates member + inserts into `members` table
- RLS policy blocks unauthenticated access to roster data
- Magic link token validation against DB
- Availability submission updates DB correctly

**Setup:**
```typescript
beforeAll(async () => {
  await supabase.rpc('reset_test_data')
})
```

**Run:**
```bash
supabase start  # Must be running
npm run test:integration
```

**Location:** `__tests__/integration/` or `*.integration.test.ts`

### 3. E2E Tests (Playwright)

**What:** Critical user journeys, browser automation.

**Examples:**
- Admin logs in → creates member → generates magic link
- Musician clicks magic link → submits availability → sees confirmation
- Admin publishes roster → musicians receive email notification (stub)
- Chord chart upload → PDF bundle generation → download

**Run:**
```bash
supabase start
npm run build
npm run test:e2e
npm run test:e2e:ui  # Interactive mode
```

**Location:** `e2e/` directory.

**Browser matrix:** Chromium only (expand to Firefox/Safari if needed).

### 4. Contract Tests (Optional)

**What:** Verify third-party API expectations (Resend, Vercel Cron).

**Examples:**
- Email payload structure matches Resend API spec
- Cron trigger response format

**Tooling:** Pact or manual mocks.

**Run:** In CI only, or with feature flag locally.

## What to Test vs. What to Skip

| Scenario                                  | Test?  | Why                                                |
|-------------------------------------------|--------|----------------------------------------------------|
| Business logic (burnout, conflicts)       | ✅ Yes | Core domain, high value                            |
| RLS policies                              | ✅ Yes | Security-critical                                  |
| API route logic                           | ✅ Yes | Integration points                                 |
| Critical user flows (magic link, publish) | ✅ Yes | High risk if broken                                |
| UI layout (pixel-perfect styling)         | ❌ No  | Visual regression out of scope                     |
| Third-party library internals             | ❌ No  | Trust library tests                                |
| Trivial getters/setters                   | ❌ No  | Low value, noise                                   |

## CI Pipeline

**GitHub Actions workflow:**
1. Checkout code
2. Install dependencies
3. Start Supabase local stack (`supabase start`)
4. Run unit tests
5. Run integration tests
6. Build Next.js app
7. Run E2E tests (headless)
8. Upload Playwright report (on failure)

**Coverage target:** 80% for business logic, not enforced globally.

## Local Development Workflow

```bash
# Start services
supabase start
npm run dev

# Run tests in watch mode (separate terminal)
npm run test:unit:watch

# Before committing
npm run test:all  # Runs unit + integration + E2E
```

## Tooling

| Layer          | Framework                          | Config File             |
|----------------|------------------------------------|-------------------------|
| Unit           | Vitest                             | `vitest.config.ts`      |
| Integration    | Vitest + `@supabase/supabase-js`   | `vitest.config.ts`      |
| E2E            | Playwright                         | `playwright.config.ts`  |
| Assertions     | Vitest (expect) / Playwright       | —                       |
| Mocking        | Vitest mocks / MSW (if needed)     | —                       |

## Seed Data Strategy

**For integration/E2E tests:** Use deterministic seed data.

**Approach:**
1. Create `supabase/seed.sql` with:
   - Test admin user (known credentials)
   - 3-5 test musicians (known IDs)
   - 2 months of roster data (past + future)
   - Sample songs with chord charts

2. Reset before test runs:
   ```bash
   supabase db reset  # Runs migrations + seed.sql
   ```

**Idempotency:** Seed script must be re-runnable (use `ON CONFLICT` or `TRUNCATE CASCADE`).

## Future Enhancements

- Visual regression testing (Chromatic or Percy) for Portal UI
- Performance testing (Lighthouse CI for bundle size)
- Load testing (if cron jobs scale up)
- Contract tests with Pact for Resend email provider


## Five Steps Implementation
5-Step Implementation Order
  1. Initialize Supabase Local Stack

  supabase init
  supabase start


  Deliverables: supabase/config.toml, local Supabase running, Studio UI accessible

  2. Create Environment Template

  Deliverables: .env.example with:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - RESEND_API_KEY (placeholder)

  3. Create Seed Data

  Deliverables: supabase/seed.sql with:
  - Test admin user (known credentials)
  - 3-5 test musicians
  - Sample roles, roster periods

  4. Install Test Dependencies

  npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom playwright @playwright/test


  Deliverables: Updated package.json with test deps

  5. Configure Test Infrastructure

  Deliverables:
  - vitest.config.ts (unit + integration)
  - playwright.config.ts (e2e against localhost:3000)
  - Add scripts to package.json: test:unit, test:integration, test:e2e, test:all
  - Create __tests__/ directory structure
  - Create e2e/ directory
  - Write 1 smoke test per layer (unit, integration, e2e) to validate setup
