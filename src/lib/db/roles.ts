import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
}
if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceKey);

export type DbRole = { id: number; name: string };

export async function getRoles(): Promise<DbRole[]> {
  const { data, error } = await supabase.from("roles").select("id, name").order("id");
  if (error) throw error;
  return (data ?? []) as DbRole[];
}

export async function getRoleIdByName(roleName: string): Promise<number> {
  const { data, error } = await supabase
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .single();

  if (error) throw error;
  return (data as { id: number }).id;
}

export async function getRoleNameToIdMap(): Promise<Record<string, number>> {
  const roles = await getRoles();
  return Object.fromEntries(roles.map((r) => [r.name, r.id]));
}