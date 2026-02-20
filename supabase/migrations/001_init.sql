-- 001_init.sql (fixed)

-- Extensions commonly needed
create extension if not exists pgcrypto;

-- Table: roles (lookup)
create table if not exists public.roles (
  id serial primary key,
  name text unique not null
);

-- Table: members (canonical people table)
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  app_role text not null check (app_role in ('Admin', 'Musician')),
  is_active boolean not null default true,
  magic_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Join table: member_roles (capabilities)
create table if not exists public.member_roles (
  member_id uuid not null references public.members(id) on delete cascade,
  role_id int not null references public.roles(id) on delete cascade,
  primary key (member_id, role_id)
);

-- Table: availability (per member per sunday)
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  status text not null check (status in ('AVAILABLE', 'UNAVAILABLE')),
  preferred_role int references public.roles(id),
  notes text,
  submitted_at timestamptz not null default now(),
  unique (member_id, date)
);

-- Table: roster (assignment per sunday per role)
create table if not exists public.roster (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  role_id int not null references public.roles(id) on delete restrict,
  member_id uuid references public.members(id) on delete set null,
  status text not null check (status in ('DRAFT', 'LOCKED')),
  assigned_by uuid references public.members(id),
  assigned_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (date, role_id)
);

-- Enable RLS
alter table public.members enable row level security;
alter table public.member_roles enable row level security;
alter table public.availability enable row level security;
alter table public.roster enable row level security;

-- Minimal RLS baseline:
-- NOTE: For MVP, all writes are performed server-side using the service role key.
-- RLS should still prevent accidental client-side writes.

-- Members: allow read-only public roster visibility (no email/phone via public views later)
create policy "members_select_public" on public.members
  for select using (true);

-- Lock down writes from anon/authenticated clients (server uses service role and bypasses RLS)
create policy "members_no_client_write" on public.members
  for all using (false) with check (false);

create policy "availability_select_public" on public.availability
  for select using (true);

create policy "availability_no_client_write" on public.availability
  for all using (false) with check (false);

create policy "roster_select_public" on public.roster
  for select using (true);

create policy "roster_no_client_write" on public.roster
  for all using (false) with check (false);

create policy "member_roles_select_public" on public.member_roles
  for select using (true);

create policy "member_roles_no_client_write" on public.member_roles
  for all using (false) with check (false);