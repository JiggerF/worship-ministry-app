-- 003_settings.sql

-- Simple key/value settings table for application-wide configuration
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default roster pagination settings if not present
insert into public.app_settings (key, value)
select 'roster_pagination', jsonb_build_object('future_months', 2, 'history_months', 6)
where not exists (select 1 from public.app_settings where key = 'roster_pagination');

-- Simple trigger to update updated_at on change
create or replace function public.set_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_settings_timestamp
  before update on public.app_settings
  for each row execute procedure public.set_timestamp();
