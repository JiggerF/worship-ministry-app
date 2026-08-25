-- 031: Add permission_overrides JSONB column
--
-- Stores per-user permission overrides as JSONB.
-- Shape: { "resource_name": ["view", "write", "delete"], ... }
-- Only resources with overrides are present — missing resources fall back
-- to the role default defined in src/lib/permissions.ts.
--
-- Added to both members (single-tenant fallback) and organization_members
-- (authoritative in multi-tenant mode).

-- Single-tenant column
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb DEFAULT NULL;

-- Multi-tenant column (authoritative when MULTI_TENANT_ENABLED=true)
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN members.permission_overrides IS
  'Per-user permission overrides (JSONB). Shape: { "resource": ["view","write","delete"] }. Null = use role defaults.';
COMMENT ON COLUMN organization_members.permission_overrides IS
  'Per-user permission overrides for this tenant (JSONB). Authoritative in multi-tenant mode. Shape: { "resource": ["view","write","delete"] }. Null = use role defaults.';
