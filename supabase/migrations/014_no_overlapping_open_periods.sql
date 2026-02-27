-- Migration 014: Prevent overlapping open availability periods
--
-- Two open periods with overlapping date ranges corrupt the Roster Manager's
-- availability map (member responses merge with conflicts) and send musicians
-- magic links covering identical Sundays.
--
-- Uses PostgreSQL EXCLUDE constraint with btree_gist to enforce this at DB level.
-- The WHERE (closed_at IS NULL) partial clause means closed periods are exempt
-- (historical overlap across closed periods is acceptable).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE availability_periods
  ADD CONSTRAINT no_overlapping_open_periods
  EXCLUDE USING gist (
    daterange(starts_on, ends_on, '[]') WITH &&
  )
  WHERE (closed_at IS NULL);
