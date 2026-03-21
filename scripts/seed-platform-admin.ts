/**
 * One-time script to seed the initial platform admin into public.platform_admins.
 *
 * Run once per environment (local dev, staging, production).
 * Safe to re-run — uses ON CONFLICT (email) DO NOTHING.
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=you@example.com \
 *   PLATFORM_ADMIN_NAME="Your Name" \
 *   NEXT_PUBLIC_SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-platform-admin.ts
 *
 * Or with a .env.local file already configured:
 *   npx tsx --env-file=.env.local scripts/seed-platform-admin.ts
 */

import { createClient } from "@supabase/supabase-js";

const email = process.env.PLATFORM_ADMIN_EMAIL;
const name = process.env.PLATFORM_ADMIN_NAME;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !name || !supabaseUrl || !serviceKey) {
  console.error(
    "Missing required environment variables:\n" +
      "  PLATFORM_ADMIN_EMAIL\n" +
      "  PLATFORM_ADMIN_NAME\n" +
      "  NEXT_PUBLIC_SUPABASE_URL\n" +
      "  SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const { error } = await supabase
  .from("platform_admins")
  .upsert({ email, name }, { onConflict: "email", ignoreDuplicates: true });

if (error) {
  console.error("Failed to seed platform admin:", error.message);
  process.exit(1);
}

const { data } = await supabase
  .from("platform_admins")
  .select("id, email, name, created_at")
  .eq("email", email)
  .single();

console.log("✓ Platform admin seeded:");
console.log(`  email: ${data?.email}`);
console.log(`  name:  ${data?.name}`);
console.log(`  id:    ${data?.id}`);
