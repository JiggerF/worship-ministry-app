-- Allow overriding the auto-derived musician lineup on a recording.
-- When set, this takes precedence over the roster-derived team for that Sunday.
ALTER TABLE sunday_recordings
  ADD COLUMN IF NOT EXISTS featured_members_override jsonb DEFAULT NULL;
