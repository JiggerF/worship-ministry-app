-- Migration: widen the position check constraint on sunday_setlist
--
-- Previously: CHECK (position BETWEEN 1 AND 3) — hardcoded 3-song limit
-- Now:        CHECK (position BETWEEN 1 AND 10) — matches the configurable
--             max_songs_per_setlist setting (1–10) stored in app_settings.
--
-- The app layer (API route + UI) still enforces the configured max;
-- the DB constraint is widened so it doesn't block valid higher positions.

ALTER TABLE sunday_setlist
  DROP CONSTRAINT sunday_setlist_position_check;

ALTER TABLE sunday_setlist
  ADD CONSTRAINT sunday_setlist_position_check
  CHECK (position BETWEEN 1 AND 10);
