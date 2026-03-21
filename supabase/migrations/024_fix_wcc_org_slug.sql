-- Migration 024: Fix WCC organization slug to match production subdomain
--
-- Problem: The WCC organization was seeded with slug = 'wcc' in migration 019,
-- but the production deployment is hosted at worship.gracetoyou.com.au.
-- After MULTI_TENANT_ENABLED was set to true, middleware.resolveTenantId()
-- extracts the first subdomain segment ("worship") and looks up organizations
-- by that slug. Since no org has slug = 'worship', tenantId resolved to null,
-- blocking all authenticated admin routes with a 404 "Organization Not Found".
--
-- Fix: Update WCC's slug from 'wcc' to 'worship' to match the subdomain.
-- This is safe — the slug is only used for tenant resolution from the subdomain;
-- it is not exposed to end users and has no FK references.
--
-- After applying this migration, ensure the code fix in middleware.ts
-- (cookie fallback when slug DB lookup returns no rows) is also deployed —
-- this provides defense-in-depth if the slug ever drifts again.

UPDATE public.organizations
SET slug = 'worship'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND slug = 'wcc';
