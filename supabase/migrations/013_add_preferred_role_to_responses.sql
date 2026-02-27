-- Migration 013: Add preferred_role_id to availability_responses
-- Allows period-based availability submissions to capture each musician's
-- preferred role, matching the data captured by the legacy T+1 form.

ALTER TABLE availability_responses
  ADD COLUMN IF NOT EXISTS preferred_role_id integer REFERENCES roles(id) ON DELETE SET NULL;
