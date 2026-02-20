-- 005_song_status.sql
-- Rename song statuses to: learning | internal_approved | published
--
-- Transition:
--   approved         → published
--   new_song_learning → learning
--   (new)              internal_approved  — pastorally cleared, hidden from team
--
-- Run via: Supabase Dashboard → SQL Editor → paste & run

-- 1. Drop the old CHECK constraint
ALTER TABLE public.songs DROP CONSTRAINT IF EXISTS songs_status_check;

-- 2. Migrate existing data to new values
UPDATE public.songs SET status = 'published' WHERE status = 'approved';
UPDATE public.songs SET status = 'learning'  WHERE status = 'new_song_learning';

-- 3. Re-add constraint with all three valid values
ALTER TABLE public.songs
  ADD CONSTRAINT songs_status_check
  CHECK (status IN ('learning', 'internal_approved', 'published'));
