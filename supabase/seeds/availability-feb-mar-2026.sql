-- Seed: availability-feb-mar-2026.sql
--
-- Seeds the Feb–Mar 2026 availability period as a completed (closed) record.
-- This covers the round that was collected manually via Google Form before the
-- in-app availability system existed. Seeding it gives the Round Status card
-- a baseline so it can suggest the correct next period (Apr–May 2026).
--
-- Safe to run multiple times — guarded by a WHERE NOT EXISTS check.
-- Run against production with:
--   supabase db execute --file supabase/seeds/availability-feb-mar-2026.sql
--
-- Dates:
--   starts_on  2026-02-01  (first Sunday in February 2026)
--   ends_on    2026-03-29  (last Sunday in March 2026)
--   closed_at  2026-01-31  (responses were collected before the period began)

INSERT INTO availability_periods (label, starts_on, ends_on, deadline, closed_at)
SELECT
  'Feb–Mar 2026',
  '2026-02-01',
  '2026-03-29',
  NULL,                                   -- no in-app deadline (manual round)
  '2026-01-31 00:00:00+00'               -- mark as already closed
WHERE NOT EXISTS (
  SELECT 1
  FROM   availability_periods
  WHERE  starts_on = '2026-02-01'
  AND    ends_on   = '2026-03-29'
);
