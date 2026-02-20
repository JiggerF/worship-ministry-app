-- 004_songs.sql
-- Song library: songs and chord_charts tables

-- Table: songs
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  status text not null default 'approved' check (status in ('approved', 'new_song_learning')),
  categories text[],
  youtube_url text,
  scripture_anchor text,
  created_at timestamptz not null default now()
);

-- Table: chord_charts (one row per key per song)
create table if not exists public.chord_charts (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  key text not null,
  file_url text,
  storage_path text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists songs_title_idx on public.songs (title);
create index if not exists chord_charts_song_id_idx on public.chord_charts (song_id);

-- Enable RLS
alter table public.songs enable row level security;
alter table public.chord_charts enable row level security;

-- Songs: public read, server-only writes (service role bypasses RLS)
create policy "songs_select_public" on public.songs
  for select using (true);

create policy "songs_no_client_write" on public.songs
  for all using (false) with check (false);

-- Chord charts: same pattern
create policy "chord_charts_select_public" on public.chord_charts
  for select using (true);

create policy "chord_charts_no_client_write" on public.chord_charts
  for all using (false) with check (false);
