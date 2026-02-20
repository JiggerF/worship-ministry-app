#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing required env vars. See scripts/README.md for details.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) Create auth user via Admin REST endpoint. If user exists, ignore.
  try {
    const resp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true }),
    });

    if (resp.status === 201) {
      console.log('Auth user created.');
    } else if (resp.status === 409) {
      console.log('Auth user already exists.');
    } else {
      const body = await resp.text();
      console.warn('Unexpected response creating auth user:', resp.status, body);
    }
  } catch (err) {
    console.error('Failed to call auth admin endpoint:', err);
    process.exit(1);
  }

  // 2) Upsert members row (idempotent)
  const memberRow = {
    id: randomUUID(),
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    phone: null,
    app_role: 'Admin',
    magic_token: randomUUID(),
    is_active: true,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('members')
      .upsert(memberRow, { onConflict: 'email' })
      .select();

    if (error) throw error;
    console.log('Members table upserted (created or verified):', (data && data[0] && data[0].email) || ADMIN_EMAIL);
  } catch (err) {
    console.error('Failed to upsert members row:', err);
    process.exit(1);
  }

  console.log('Done. Admin is ready to sign in.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
