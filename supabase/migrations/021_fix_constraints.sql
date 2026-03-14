-- Migration 021: Fix UNIQUE constraints and app_settings PK for multi-tenancy
--
-- This migration completes Phase 0 of the multi-tenant architecture (Design 2).
-- It updates constraints that were globally scoped to be tenant-scoped.
--
-- All changes are backward-compatible for Church #1 (WCC) because all existing
-- rows have tenant_id = '00000000-0000-0000-0000-000000000001'.
--
-- Three categories of change:
--   A. UNIQUE constraints on data tables: include tenant_id so the same
--      (date, role) etc. can exist across different tenants.
--   B. app_settings PK: was (key), becomes (tenant_id, key) so each tenant
--      can have independent settings.
--   C. availability_periods EXCLUDE constraint: recreated using btree_gist
--      with tenant_id so overlapping periods are only blocked within a tenant
--      (CHALLENGE_LOG C1 fix).

-- ─────────────────────────────────────────────────────────────────────────────
-- A1. roster: UNIQUE (date, role_id) → (tenant_id, date, role_id)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.roster
  DROP CONSTRAINT IF EXISTS roster_date_role_id_key;

ALTER TABLE public.roster
  ADD CONSTRAINT roster_tenant_date_role_unique
  UNIQUE (tenant_id, date, role_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- A2. availability (legacy): UNIQUE (member_id, date) → (tenant_id, member_id, date)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.availability
  DROP CONSTRAINT IF EXISTS availability_member_id_date_key;

ALTER TABLE public.availability
  ADD CONSTRAINT availability_tenant_member_date_unique
  UNIQUE (tenant_id, member_id, date);

-- ─────────────────────────────────────────────────────────────────────────────
-- A3. sunday_setlist: UNIQUE (sunday_date, position) → (tenant_id, sunday_date, position)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sunday_setlist
  DROP CONSTRAINT IF EXISTS sunday_setlist_sunday_date_position_key;

ALTER TABLE public.sunday_setlist
  ADD CONSTRAINT sunday_setlist_tenant_date_position_unique
  UNIQUE (tenant_id, sunday_date, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. app_settings: PK (key) → (tenant_id, key)
--    Seed Church #1 settings row with the WCC tenant UUID.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add tenant_id as nullable first (safe: existing rows get the WCC default)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID
  REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

-- Backfill
UPDATE public.app_settings
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.app_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.app_settings ALTER COLUMN tenant_id DROP DEFAULT;

-- Swap PK
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE public.app_settings ADD PRIMARY KEY (tenant_id, key);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. availability_periods EXCLUDE constraint — tenant-scoped (CHALLENGE_LOG C1)
--    Drops the global "no overlapping open periods" constraint that blocks Church B
--    from creating periods that overlap in date range with Church A.
-- ─────────────────────────────────────────────────────────────────────────────

-- DROP the old global EXCLUDE
ALTER TABLE public.availability_periods
  DROP CONSTRAINT IF EXISTS no_overlapping_open_periods;

-- Recreate with tenant_id so overlap is only blocked within the same tenant.
-- btree_gist extension must already be present (installed in migration 014).
ALTER TABLE public.availability_periods
  ADD CONSTRAINT no_overlapping_open_periods
  EXCLUDE USING gist (
    tenant_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  )
  WHERE (closed_at IS NULL);
