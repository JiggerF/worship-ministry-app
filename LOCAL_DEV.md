# Local Development Setup

## Prerequisites

- Node.js 20+
- Docker Desktop (for Supabase local stack)
- Supabase CLI: `npm install -g supabase`

## Initial Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd worship-ministry-app
   npm install
   ```

2. **Start Supabase local stack:**
   ```bash
   supabase start
   ```
   This starts:
   - Postgres (port 54322)
   - Studio UI (http://localhost:54323)
   - Auth (port 54321)
   - Storage (port 54321)
   - Edge Functions (port 54321)

3. **Copy environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with values from `supabase status`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-status>
   ```

4. **Run migrations and seed data:**
   ```bash
   supabase db reset
   ```

5. **Start Next.js dev server:**
   ```bash
   npm run dev
   ```
   App runs at http://localhost:3000

## Daily Workflow

```bash
# Start services
supabase start
npm run dev

# Stop services (preserves data)
supabase stop

# Reset database (wipes data, re-runs migrations + seed)
supabase db reset
```

## Database Management

**Create migration:**
```bash
supabase migration new <migration-name>
```
Edit the generated file in `supabase/migrations/`, then apply:
```bash
supabase db reset
```

**Access Postgres directly:**
```bash
supabase db shell
```

**View Studio UI:**
http://localhost:54323

## Email (Stub Mode)

By default, emails are **not sent** locally. Links and content are logged to:
- Terminal output
- Studio UI → Auth → Logs

**To test magic links:** Copy the token URL from logs and paste into browser.

## Troubleshooting

**Port conflicts:**
```bash
supabase stop
docker ps  # Check for lingering containers
docker stop <container-id>
```

**Database out of sync:**
```bash
supabase db reset --hard
```

**Clear all Supabase data:**
```bash
supabase stop --no-backup
supabase start
```

## Production Parity

| Concern        | Local                          | Production           |
|----------------|--------------------------------|----------------------|
| Database       | Postgres 15 (Docker)           | Supabase hosted PG   |
| Auth           | Supabase local auth            | Supabase Auth        |
| Storage        | Local S3-compatible storage    | Supabase Storage     |
| Email          | Stub (logged, not sent)        | Resend               |
| Cron jobs      | Manual trigger (API routes)    | Vercel Cron          |
| Environment    | `.env.local`                   | Vercel env vars      |


# POSTRESQL
To connect to postgresql docker container
```bash
docker exec -it supabase_db_worship-ministry-app psql -U postgres
```

To show tables
```bash
\dt
```
Disable Pager first before query table
```bash
\pset pager off
```
To show all table data
```bash
\d+ public.members
\d+ public.roles
\d+ public.member_roles
\d+ public.availability
\d+ public.roster
```

To query members row
```bash
SELECT id, name, email, app_role, is_active, created_at
FROM public.members
WHERE email = 'YOUR_EMAIL_HERE';
```
TO query auth.users -> if 0 results, need to create auth users from 
1. Studio  http://localhost:54323
2. Left nav → Auth → Users → New user
```bash
postgres=> SELECT id, email, raw_app_meta_data, created_at
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';
```

## Start for development

Use these steps to start the full local stack and app for day-to-day development.

1. Start Supabase local services (Postgres, Auth, Studio):

```bash
supabase start
```

2. Ensure `.env.local` contains the local values printed by `supabase status` (anon key, service role key, and local URLs).

3. Start Next.js in development mode (fast refresh + client mocks):

```bash
cd /Users/jiggerfantonial/src/worship-ministry-app
npm install      # if not already installed
npm run dev
# Open http://localhost:3000
```

Notes:
- Use `NEXT_PUBLIC_USE_MOCK_ROSTER=true` during UI work to inject mock roster data client-side.
- Local auth magic links are logged in the terminal and visible in Studio → Auth → Logs.


# Supabase Commands
To show status
```bash
supabase status 
```
To create admin user for testing integration:
scripts/README.md