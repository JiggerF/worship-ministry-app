-- Migration 010: Worship Lead Types
--
-- NO-OP SQL: This migration is a history marker only.
--
-- 'WorshipLeader' and 'MusicCoordinator' were already added to the
-- app_role enum in migration 006_add_coordinator_to_app_role.sql.
-- No SQL changes are needed here.
--
-- What changed in this slice (TypeScript only, not SQL):
--   - AppRole type updated to include "MusicCoordinator" | "WorshipLeader"
--   - SetlistStatus = "DRAFT" | "PUBLISHED" added
--   - SetlistSong updated with chosen_key, status, created_by, created_at, updated_at

SELECT 1; -- no-op
