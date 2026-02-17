import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function generateMagicToken(personId: string) {
  const { data, error } = await supabase.rpc('generate_magic_token', { _person_id: personId });
  if (error) throw error;
  return data;
}

export async function getMemberByMagicToken(token: string) {
  const { data, error } = await supabase
    .from('magic_tokens')
    .select('person_id, expires_at, name')
    .eq('token', token)
    .single();

  if (error || !data) return null;
  const now = new Date();
  if (new Date(data.expires_at) < now) return null;

  return {
    id: data.person_id,
    name: data.name,
    person_id: data.person_id,
  };
}

export async function getAvailabilityByMemberId(memberId: string) {
  const { data, error } = await supabase
    .from('availability')
    .select('availability')
    .eq('person_id', memberId)
    .maybeSingle();

  if (error) throw error;
  return data ? data.availability : null;
}

export async function setAvailabilityForMember(memberId: string, availability: any) {
  const { error } = await supabase
    .from('availability')
    .upsert([{ person_id: memberId, availability }], { onConflict: ['person_id'] });

  if (error) throw error;
}