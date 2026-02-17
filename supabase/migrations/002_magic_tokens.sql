-- Magic Tokens Table
create table if not exists public.magic_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Function to generate a magic token for a person
create or replace function public.generate_magic_token(_person_id uuid, _expires_in_minutes int default 60)
returns text
language plpgsql
as $$
declare
  _token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into public.magic_tokens (person_id, token, expires_at)
  values (_person_id, _token, now() + (_expires_in_minutes || ' minutes')::interval);
  return _token;
end;
$$;

-- Enable RLS
alter table public.magic_tokens enable row level security;

-- RLS Policies

-- Anyone can select (for token verification)
create policy "MagicTokens: Public select" on public.magic_tokens
  for select
  using (true);

-- View to join magic_tokens with people for name lookup
create or replace view public.magic_tokens_with_name as
select
  mt.*,
  p.name
from
  public.magic_tokens mt
  join public.people p on mt.person_id = p.id;

-- (Optional) If you want to add a policy for the view (not always required)
-- create policy "MagicTokensWithName: Public select" on public.magic_tokens_with_name
--   for select
--   using (true);