-- Migration 023: Add CHECK constraint on organization_members.app_role
--
-- GAP-5 from Phase 0 code review: organization_members.app_role is TEXT with
-- no validation. The TypeScript AppRole union allows exactly 5 values.
-- Without a DB constraint, any string could be inserted — bypassing type safety
-- at the persistence layer.
--
-- This CHECK mirrors the AppRole type in src/lib/types/database.ts:
--   "Admin" | "Coordinator" | "Musician" | "MusicCoordinator" | "WorshipLeader"
--
-- Safe to apply: all existing rows were backfilled from members.app_role which
-- only contains values from this set.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_members_app_role_check'
      AND table_name = 'organization_members'
  ) THEN
    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_app_role_check
      CHECK (app_role IN ('Admin', 'Coordinator', 'Musician', 'MusicCoordinator', 'WorshipLeader'));
  END IF;
END $$;
