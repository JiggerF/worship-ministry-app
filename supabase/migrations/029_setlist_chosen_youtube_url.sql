-- Migration 029: per-setlist YouTube URL override
-- Add chosen_youtube_url column to sunday_setlist
-- Mirrors the existing chosen_key pattern.
-- NULL = fall back to songs.youtube_url at render time.

ALTER TABLE public.sunday_setlist
  ADD COLUMN IF NOT EXISTS chosen_youtube_url text NULL;

COMMENT ON COLUMN public.sunday_setlist.chosen_youtube_url IS
  'Optional per-setlist YouTube URL override. NULL = use songs.youtube_url.';
