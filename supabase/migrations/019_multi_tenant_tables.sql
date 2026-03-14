-- Migration 019: Multi-tenant foundation
--
-- Step 0.1 (from plan): Resolve member_roles vs member_role_assignments naming.
-- Migration 001 created the table as `member_roles` but all application code
-- (lib/db/members.ts) references `member_role_assignments`. Rename first.
--
-- Then creates: organizations, organization_members, feature_flags,
-- organization_features, platform_admins.
-- Seeds Church #1 (WCC) with a deterministic UUID so subsequent migrations
-- can hard-code the backfill value.
-- No behavior change — existing app code is unaffected.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 0.1: Rename member_roles → member_role_assignments
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.member_roles RENAME TO member_role_assignments;

-- RLS policies are table-bound; recreate them under the new name.
DROP POLICY IF EXISTS "member_roles_select_public" ON public.member_role_assignments;
DROP POLICY IF EXISTS "member_roles_no_client_write" ON public.member_role_assignments;

CREATE POLICY "member_role_assignments_select_public" ON public.member_role_assignments
  FOR SELECT USING (true);

CREATE POLICY "member_role_assignments_no_client_write" ON public.member_role_assignments
  FOR ALL USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Organizations (tenant entity)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  settings   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Church #1 with a deterministic UUID.
-- All subsequent migrations use this UUID for backfill.
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'WCC Worship Ministry', 'wcc');

-- ─────────────────────────────────────────────────────────────────────────────
-- Organization members (M:N — per-tenant role + activation)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  app_role        TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, member_id)
);

-- Backfill: every existing member belongs to Church #1 with their current role.
-- is_active comes from members.is_active (same semantics at this point).
INSERT INTO public.organization_members (organization_id, member_id, app_role, is_active)
SELECT '00000000-0000-0000-0000-000000000001', id, app_role, is_active
FROM public.members;

CREATE INDEX idx_org_members_member_id ON public.organization_members(member_id);
CREATE INDEX idx_org_members_org_role  ON public.organization_members(organization_id, app_role);

-- ─────────────────────────────────────────────────────────────────────────────
-- Feature flags (global definitions)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.feature_flags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key        TEXT UNIQUE NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO public.feature_flags (flag_key, label, default_enabled) VALUES
  ('roster',       'Roster Manager',        true),
  ('songs',        'Song Library',          true),
  ('availability', 'Availability Tracking', true),
  ('setlist',      'Setlist Manager',       true),
  ('handbook',     'Team Handbook',         false),
  ('audit_log',    'Audit Log',             false),
  ('chord_sheets', 'Chord Sheet PDFs',      true),
  ('equipment',    'Equipment Tracking',    false),
  ('ai_roster',    'AI Roster Agent',       false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Organization features (per-tenant flag overrides)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.organization_features (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_id         UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, flag_id)
);

-- Enable all features for Church #1.
INSERT INTO public.organization_features (organization_id, flag_id, enabled)
SELECT '00000000-0000-0000-0000-000000000001', id, true FROM public.feature_flags;

-- ─────────────────────────────────────────────────────────────────────────────
-- Platform admins (landlord accounts — separate from church members)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.platform_admins (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS on new tables
-- All writes use service role key (bypasses RLS). RLS is defense-in-depth only.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_public"       ON public.organizations        FOR SELECT USING (true);
CREATE POLICY "organizations_no_client_write"     ON public.organizations        FOR ALL    USING (false) WITH CHECK (false);
CREATE POLICY "org_members_select_public"         ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "org_members_no_client_write"       ON public.organization_members FOR ALL    USING (false) WITH CHECK (false);
CREATE POLICY "feature_flags_select_public"       ON public.feature_flags        FOR SELECT USING (true);
CREATE POLICY "feature_flags_no_client_write"     ON public.feature_flags        FOR ALL    USING (false) WITH CHECK (false);
CREATE POLICY "org_features_select_public"        ON public.organization_features FOR SELECT USING (true);
CREATE POLICY "org_features_no_client_write"      ON public.organization_features FOR ALL    USING (false) WITH CHECK (false);
CREATE POLICY "platform_admins_no_client_access"  ON public.platform_admins      FOR ALL    USING (false) WITH CHECK (false);
