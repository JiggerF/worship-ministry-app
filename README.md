This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Testing

The test suite follows the **test-pyramid** strategy using [Vitest](https://vitest.dev/):

```
        /▲\
       / E2E \      ← Playwright (MVP 2, not yet implemented)
      /─────────\
     / Integration \  ← API route handlers (mocked Supabase)
    /───────────────\
   / Component tests  \  ← React Testing Library + happy-dom
  /───────────────────\
 /    Unit tests        \  ← pure functions (dates, transpose, constants)
/─────────────────────────\
```

### Test structure

```
__tests__/
├── setup.ts                    # jest-dom matchers
├── __mocks__/
│   └── server-only.ts          # stub for Next.js server-only package
├── unit/
│   ├── dates.test.ts           # date utilities
│   ├── transpose.test.ts       # chord transposition logic
│   └── constants.test.ts       # role/category constants
├── components/
│   ├── status-badge.test.tsx   # RosterBadge, SongStatusBadge
│   ├── sunday-card.test.tsx    # SundayCard
│   └── song-card.test.tsx      # SongCard
└── integration/
    ├── _helpers.ts             # shared test helpers
    ├── admin-member-route.test.ts
    ├── availability-route.test.ts
    ├── chord-sheet-route.test.ts
    ├── me-route.test.ts
    ├── members-id-route.test.ts
    ├── members-magic-token-route.test.ts
    ├── members-route.test.ts
    ├── settings-route.test.ts
    ├── songs-id-route.test.ts
    └── songs-route.test.ts
```

### Running tests

| Command | Description |
|---|---|
| `npm test` | Run all tests once |
| `npm run test:all` | Alias for the above |
| `npm run test:watch` | Interactive watch mode |
| `npm run test:unit` | Unit tests only |
| `npm run test:components` | Component tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:coverage` | Full run + coverage report |
| `npm run test:ui` | Vitest browser UI (`localhost:51204`) |

### Coverage report

After running `npm run test:coverage`, open the HTML report:

```bash
open coverage/index.html
```

Or view the summary in the terminal output directly.

**Current coverage targets (all must pass to merge):**

| Metric | Threshold |
|---|---|
| Statements | ≥ 60% |
| Branches | ≥ 60% |
| Functions | ≥ 60% |
| Lines | ≥ 60% |

### No database required for tests

- **Unit & component tests** — no external services needed.
- **Integration tests** — Supabase is fully mocked with `vi.mock`. No running Supabase
  instance is required. Tests run entirely in-process.

### Seeding (local development only)

Integration tests do **not** require seeding. For local development against a real
Supabase instance, see [LOCAL_DEV.md](LOCAL_DEV.md) for the full setup, seeding
steps, and user creation instructions.

