# Production Environment Setup (PROD_ENV.md)

Purpose
- Capture the exact steps and env settings used to create a production/cloud Supabase admin, apply migrations, seed roles, and verify login integration.

Required environment variables (example keys)
- `SUPABASE_URL` - your Supabase project URL (e.g. https://<project-ref>.supabase.co)
- `NEXT_PUBLIC_SUPABASE_URL` - same as `SUPABASE_URL` used by client-side code
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - the anon/publishable key from Supabase UI
- `SUPABASE_SERVICE_ROLE_KEY` - the service role (secret) key from Supabase UI (server only)
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` - credentials for creating the initial admin user
- `USE_DEV_MOCK_ROSTER` / `NEXT_PUBLIC_USE_MOCK_ROSTER` - set to `false` in prod

Where to get the Service Role Key
1. Open https://app.supabase.com and sign in to your account.
2. Select the project.
3. Left sidebar → Settings → API → API KEYS.
4. Click **Copy service API key** (or **Copy service API key (legacy)** if applicable).
5. Paste the value into your production secret store / `.env.production` / Vercel dashboard as `SUPABASE_SERVICE_ROLE_KEY`.

Important: Do NOT commit `SUPABASE_SERVICE_ROLE_KEY` or any secret keys to source control.

Apply database migrations and seed data
Option A — Supabase UI (recommended for quick apply):
- Open the project → SQL → New query.
- Paste `supabase/migrations/001_init.sql` and run it. Then paste `supabase/seed.sql` and run it.

Option B — CLI / psql (for CI or automated deploys):
- Get the database connection string from Supabase → Settings → Database → Connection string.
- Run locally or via CI:
```bash
# apply migrations file(s)
psql "postgres://<user>:<pass>@<host>:5432/postgres" -f supabase/migrations/001_init.sql
psql "postgres://<user>:<pass>@<host>:5432/postgres" -f supabase/seed.sql
```

Create the initial admin user
- Two options:

- Option 1 — Scripted (recommended for automation):
  - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the environment where you run the script.
  - The project already includes `scripts/create_admin.cjs` which uses both the `Authorization` and `apikey` headers when calling the admin endpoint.
  - Run from the project root:
  ```bash
  ADMIN_EMAIL=admin@wcc.org ADMIN_PASSWORD=dev \
    SUPABASE_URL=https://<your-project>.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY='paste_service_key_here' \
    node scripts/create_admin.cjs
  ```
  - Expected output: either `Auth user created.` or `Unexpected response creating auth user: 422 {"code":422,..."email_exists"...}` (if the user already exists). Then `Members table upserted (created or verified): admin@wcc.org`.

- Option 2 — Manual via Supabase Studio (fast, GUI):
  - Open Supabase → Auth → Users → New user. Create `admin@wcc.org` with your password and mark confirmed if needed.
  - Then run the upsert part of the script or insert the `members` row via the Table Editor / SQL editor.

Verify results
- Auth user: Supabase → Auth → Users should include `admin@wcc.org`.
- Members row: Supabase → Table Editor → `public.members` should include the admin row.
- Roles seeded: `public.roles` should contain the expected role names from `supabase/seed.sql`.

Testing login integration
- With `SUPABASE_URL` and keys pointing to the cloud project, build and start the Next.js app (or deploy to Vercel with the same env vars):
```bash
npm run build
npm start
# or deploy to Vercel and set env vars in the Vercel project settings
```
- Visit `/admin/login` and sign in using the admin credentials. Verify middleware redirects and `public.members` checks succeed.

Start for Production

These instructions run the app in a production-like environment locally or describe what to set in a hosting platform (e.g., Vercel).

1) Run locally (production build)

```bash
cd /Users/jiggerfantonial/src/worship-ministry-app
# Build (creates optimized .next)
npm run build

# Start using the same env vars from your production secrets. If not set in the shell,
# the app will read values from `.env.local` when running locally.
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY='paste_service_key_here' \
NEXT_PUBLIC_SUPABASE_ANON_KEY='paste_anon_key_here' \
npm run start

# Visit http://localhost:3000/admin/login
```

2) Deploy to Vercel (recommended for production)

- In the Vercel project settings add the environment variables (Production scope):
  - `SUPABASE_URL` = https://<your-project>.supabase.co
  - `NEXT_PUBLIC_SUPABASE_URL` = same value
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = <anon key>
  - `SUPABASE_SERVICE_ROLE_KEY` = <service role key> (mark as secret)
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (optional)

- Deploy the repository. Vercel will run `npm run build` automatically and expose the app.

Notes:
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is only set in server-side env (Vercel will not expose it to the client). Use Vercel's Environment variables UI and mark it as secret.
- Rotate the key if it was exposed. Never check secrets into git.


Troubleshooting
- 401 / 403 calling `/auth/v1/admin/users` → your `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_URL` is incorrect or belongs to another project. Re-copy the key from Supabase UI and retry.
- `PGRST205 Could not find the table 'public.members'` → migrations/seed were not applied; run migrations/seed (see above).
- If the script reports `email_exists` for the auth user, create/verify the `members` row exists. The script's upsert will not succeed until the `public.members` table exists.

Security and operational notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Use the anon key on the client.
- Rotate service keys if they are accidentally exposed.
- Use CI secrets or Vercel/Netlify environment variables for production deployments — never store secrets in the repo.

Appendix — quick curl test for the admin endpoint
```bash
export SUPABASE_URL=https://<your-project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY='paste_service_key_here'

curl -i -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"check+1@example.com","password":"P@ssw0rd","email_confirm":true}' \
  "$SUPABASE_URL/auth/v1/admin/users"
```

If you want, I can now run the script (or the curl test) against your cloud project and report the exact results — tell me to proceed.
