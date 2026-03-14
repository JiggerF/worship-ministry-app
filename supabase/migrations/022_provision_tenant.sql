-- Migration 022: provision_tenant() stored procedure
--
-- Atomic tenant provisioning (Design 2, Appendix B).
-- Supabase JS client has no multi-statement transaction support (constraint C8),
-- so provisioning is wrapped in a single PostgreSQL function to guarantee atomicity.
--
-- Steps performed atomically:
--   1. Create organization row
--   2. Create or find the admin member (global identity — upsert by email)
--   3. Create organization_members entry with Admin role
--   4. Enable default feature flags for the new tenant
--   5. Seed default app_settings for the new tenant
--   6. Seed default handbook documents (7 sections matching Church #1 seed)
--
-- Returns the new organization UUID.
-- On any failure the entire transaction rolls back — no orphaned data.

CREATE OR REPLACE FUNCTION provision_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_admin_email TEXT,
  p_admin_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_member_id UUID;
BEGIN
  -- 1. Create organization
  INSERT INTO public.organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  -- 2. Create or find member (global identity)
  --    If the email already exists (multi-org member), update the name but keep
  --    the existing member row. members.app_role is set to 'Musician' for new
  --    members — the authoritative role lives in organization_members.
  INSERT INTO public.members (email, name, app_role, magic_token)
  VALUES (p_admin_email, p_admin_name, 'Musician', gen_random_uuid())
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_member_id;

  -- 3. Create organization membership (Admin role for the founding admin)
  INSERT INTO public.organization_members (organization_id, member_id, app_role)
  VALUES (v_org_id, v_member_id, 'Admin');

  -- 4. Enable default features (uses default_enabled from feature_flags table)
  INSERT INTO public.organization_features (organization_id, flag_id, enabled)
  SELECT v_org_id, id, default_enabled FROM public.feature_flags;

  -- 5. Seed default settings
  INSERT INTO public.app_settings (tenant_id, key, value) VALUES
    (v_org_id, 'roster_pagination', '{"future_months": 2, "history_months": 6}'::jsonb),
    (v_org_id, 'setlist', '{"max_songs": 3}'::jsonb),
    (v_org_id, 'handbook_permissions', '{"editor_roles": ["Admin", "Coordinator"], "editor_member_ids": []}'::jsonb);

  -- 6. Seed default handbook documents (7 sections, matching Church #1 seed from migrations 016+018)
  INSERT INTO public.handbook_documents (tenant_id, slug, title, content, major_version, minor_version, is_current, created_by_name)
  VALUES
    (v_org_id, 'vision-values',              'Vision & Values',      '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-worship-lead',         'Worship Lead',         '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-worship-coordinator',  'Worship Coordinator',  '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-music-coordinator',    'Music Coordinator',    '', 1, 0, true, p_admin_name),
    (v_org_id, 'roles-tech-coordinator',     'Tech Coordinator',     '', 1, 0, true, p_admin_name),
    (v_org_id, 'weekly-rhythm',              'Weekly Rhythm',        '', 1, 0, true, p_admin_name),
    (v_org_id, 'decision-rights',            'Decision Rights',      '', 1, 0, true, p_admin_name);

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;
