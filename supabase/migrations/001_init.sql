-- Table: roles
create table public.roles (
  id serial primary key,
  name text unique not null
);

-- Table: people
create table public.people (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  roles text[] not null default '{}'
);

-- Table: availability
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  date date not null,
  status text check (status in ('AVAILABLE', 'UNAVAILABLE', 'DRAFT'))
);

-- Table: roster
create table public.roster (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  role_id int references public.roles(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  status text check (status in ('EMPTY', 'AVAILABLE', 'DRAFT', 'LOCKED'))
);

-- Enable Row Level Security (RLS)
alter table public.people enable row level security;
alter table public.availability enable row level security;
alter table public.roster enable row level security;

-- RLS Policies

-- People: Anyone can select, only admins can insert/update/delete
create policy "People: Public select" on public.people
  for select
  using (true);

create policy "People: Admins insert" on public.people
  for insert
  with check (
    auth.role() = 'authenticated' and
    'Admin' = any(roles)
  );

create policy "People: Admins update" on public.people
  for update
  using (
    auth.role() = 'authenticated' and
    'Admin' = any(roles)
  );

create policy "People: Admins delete" on public.people
  for delete
  using (
    auth.role() = 'authenticated' and
    'Admin' = any(roles)
  );

-- Availability: Anyone can select, only admins can insert/update/delete
create policy "Availability: Public select" on public.availability
  for select
  using (true);

create policy "Availability: Admins insert" on public.availability
  for insert
  with check (
    auth.role() = 'authenticated' and
    'Admin' = any((select roles from public.people where id = auth.uid()))
  );

create policy "Availability: Admins update" on public.availability
  for update
  using (
    auth.role() = 'authenticated' and
    'Admin' = any((select roles from public.people where id = auth.uid()))
  );

create policy "Availability: Admins delete" on public.availability
  for delete
  using (
    auth.role() = 'authenticated' and
    'Admin' = any((select roles from public.people where id = auth.uid()))
  );

-- Roster: Anyone can select, only admins can insert/update/delete
create policy "Roster: Public select" on public.roster
  for select
  using (true);

create policy "Roster: Admins insert" on public.roster
  for insert
  with check (
    auth.role() = 'authenticated' and
    'Admin' = any((select roles from public.people where id = auth.uid()))
  );

create policy "Roster: Admins update" on public.roster
  for update
  using (
    auth.role() = 'authenticated' and
    'Admin' = any((select roles from public.people where id = auth.uid()))
  );

create policy "Roster: Admins delete" on public.roster
  for delete
  using (
    auth.role() = 'authenticated' and
    'Admin' = any((select roles from public.people where id = auth.uid()))
  );