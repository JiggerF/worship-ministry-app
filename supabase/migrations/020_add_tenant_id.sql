-- Migration 020: Add tenant_id to all data tables
--
-- Strategy (zero-downtime, per plan safety principles):
--   1. Add column as NULLABLE with a column DEFAULT pointing to Church #1.
--      Existing rows are immediately backfilled by the DEFAULT — no separate
--      UPDATE needed at write time. Explicit UPDATE ensures no NULLs remain.
--   2. DROP DEFAULT so future inserts must supply tenant_id explicitly
--      (application code is responsible from Phase 1 onward).
--   3. SET NOT NULL once all rows are confirmed non-null.
--   4. Add composite indexes for the primary query patterns.
--
-- Tables NOT receiving tenant_id:
--   members            — global identity (UNIQUE email constraint)
--   roles              — universal musical roles (drums, bass, etc.)
--   chord_charts       — inherits tenant via song_id → songs.tenant_id
--   availability_responses  — inherits via period_id → availability_periods.tenant_id
--   availability_dates      — inherits via response_id chain
--
-- NOTE: member_role_assignments was renamed from member_roles in migration 019.

-- ─────────────────────────────────────────────────────────────────────────────
-- songs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.songs
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.songs SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.songs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.songs ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_songs_tenant_id       ON public.songs(tenant_id);
CREATE INDEX idx_songs_tenant_id_title ON public.songs(tenant_id, title);

-- ─────────────────────────────────────────────────────────────────────────────
-- roster
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.roster
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.roster SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.roster ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.roster ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_roster_tenant_id_date ON public.roster(tenant_id, date);

-- ─────────────────────────────────────────────────────────────────────────────
-- availability (legacy per-sunday table)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.availability SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.availability ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.availability ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_availability_tenant_id ON public.availability(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- availability_periods
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability_periods
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.availability_periods SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.availability_periods ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.availability_periods ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_avail_periods_tenant_id ON public.availability_periods(tenant_id, starts_on DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- sunday_setlist
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sunday_setlist
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.sunday_setlist SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.sunday_setlist ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sunday_setlist ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_sunday_setlist_tenant_id ON public.sunday_setlist(tenant_id, sunday_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.audit_log SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.audit_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_audit_log_tenant_id ON public.audit_log(tenant_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- handbook_documents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.handbook_documents
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.handbook_documents SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.handbook_documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.handbook_documents ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_handbook_tenant_id ON public.handbook_documents(tenant_id, slug);

-- ─────────────────────────────────────────────────────────────────────────────
-- member_role_assignments (renamed from member_roles in migration 019)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.member_role_assignments
  ADD COLUMN tenant_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.member_role_assignments SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

ALTER TABLE public.member_role_assignments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.member_role_assignments ALTER COLUMN tenant_id DROP DEFAULT;

CREATE INDEX idx_member_role_assignments_tenant_id
  ON public.member_role_assignments(tenant_id, member_id);
