-- Migration 009: Audit log retention policy
--
-- Retention rules (applied probabilistically on insert to avoid overhead):
--   1. Delete entries older than 2 years  (~50-year safety margin at current volume)
--   2. Hard cap at 10,000 rows            (~40-year safety margin at current volume)
--
-- Estimated volume: ~250 events/year (songs + roster mutations for a small team).
-- At that rate the 2-year window holds ~500 rows and the 10,000 hard cap
-- would not be reached for decades.
--
-- The 5% random sampling means cleanup runs roughly once every 20 inserts
-- rather than on every single write. With an index on created_at the
-- DELETE is fast even when it finds nothing to remove.

CREATE OR REPLACE FUNCTION enforce_audit_log_retention()
RETURNS TRIGGER AS $$
BEGIN
  -- Run cleanup with ~5% probability to keep overhead negligible
  IF random() < 0.05 THEN
    -- Rule 1: remove entries older than 2 years
    DELETE FROM audit_log
    WHERE created_at < NOW() - INTERVAL '2 years';

    -- Rule 2: trim to 10,000 rows if the hard cap is exceeded,
    -- keeping the 10,000 most-recent entries and deleting the oldest excess
    DELETE FROM audit_log
    WHERE id IN (
      SELECT id FROM audit_log
      ORDER BY created_at DESC
      OFFSET 10000
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_retention_trigger
AFTER INSERT ON audit_log
FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_retention();
