-- supabase/migrations/002_index.sql

-- roster
create index if not exists roster_date_idx on public.roster (date);
create index if not exists roster_role_id_idx on public.roster (role_id);
create index if not exists roster_member_id_idx on public.roster (member_id);

-- availability
create index if not exists availability_date_idx on public.availability (date);
create index if not exists availability_member_id_idx on public.availability (member_id);

-- NOTE:
-- Do NOT create a (date, role) unique index. Your schema enforces uniqueness via:
--   unique (date, role_id) on public.roster