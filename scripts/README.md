Create admin user helper
========================

This script creates a Supabase Auth user (admin) and upserts a corresponding `members` row.

Security
- Do NOT store secrets in source control. The script reads sensitive values from environment variables.
- Keep `SUPABASE_SERVICE_ROLE_KEY` in a secure location (CI secret store / local environment only).

1. Required environment variables
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- Optional: `ADMIN_NAME`

or put these in your .env.local

2. Run locally (example):

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
ADMIN_EMAIL=0@0.org \
ADMIN_PASSWORD='StrongPass123!' \
node --experimental-specifier-resolution=node --loader ts-node/esm scripts/create_admin.ts
```

If you prefer, use `npx ts-node scripts/create_admin.ts` (requires ts-node installed).

This script is safe to run multiple times — it will not create duplicate users or members rows.

3. To confirm admin auth is created (manually not part of above script)
query auth.users -> if 0 results, need to create auth users from 
1. Studio  http://localhost:54323
2. Left nav → Auth → Users → New user

```bash
postgres=> SELECT id, email, raw_app_meta_data, created_at
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';
```