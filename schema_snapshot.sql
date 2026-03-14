-- =============================================================================
-- schema_snapshot.sql
--
-- Full DDL snapshot of the WCC Worship Ministry database.
-- Reflects applied migrations: 000 → 021 (Phase 0 + Phase 1 multi-tenant).
--
-- Last updated: 2026-03-14
-- Branch:       feature-tenancy-phase-1
--
-- This file is for documentation and disaster-recovery only.
-- Do NOT run this against a live database that already has these tables —
-- use the numbered migration files in supabase/migrations/ instead.
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_net"            WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql"         WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"           WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault"     WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"          WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- required for availability_periods EXCLUDE (migration 014)

COMMENT ON SCHEMA "public" IS 'standard public schema';

SET default_tablespace = '';
SET default_table_access_method = "heap";


-- =============================================================================
-- SECTION 1: LOOKUP / REFERENCE TABLES
-- No tenant_id — these are globally shared across all tenants.
-- =============================================================================

-- roles: musical instrument / service roles (Guitar, Bass, Drums, etc.)
-- No tenant_id: universal lookup, shared by all churches.
CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id"   integer NOT NULL,
    "name" text    NOT NULL,
    CONSTRAINT "roles_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "roles_name_key" UNIQUE ("name")
);

CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";
ALTER TABLE ONLY "public"."roles"
    ALTER COLUMN "id" SET DEFAULT nextval('"public"."roles_id_seq"'::regclass);


-- =============================================================================
-- SECTION 2: MULTI-TENANT FOUNDATION (migration 019)
-- =============================================================================

-- organizations: one row per church / tenant
CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id"         uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "name"       text                     NOT NULL,
    "slug"       text                     NOT NULL,
    "is_active"  boolean                  NOT NULL DEFAULT true,
    "settings"   jsonb                    DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "organizations_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "organizations_slug_key" UNIQUE ("slug")
);
-- Seed row: ('00000000-0000-0000-0000-000000000001', 'WCC Worship Ministry', 'wcc')


-- organization_members: per-tenant membership, role, and activation state.
-- app_role and is_active here are the AUTHORITATIVE values from Phase 1 onward.
-- members.app_role is a legacy field kept for backward compatibility.
CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "organization_id" uuid                     NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "member_id"       uuid                     NOT NULL,  -- FK declared after members table below
    "app_role"        text                     NOT NULL,
    "is_active"       boolean                  NOT NULL DEFAULT true,
    "joined_at"       timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id", "member_id")
);

CREATE INDEX "idx_org_members_member_id" ON "public"."organization_members" ("member_id");
CREATE INDEX "idx_org_members_org_role"  ON "public"."organization_members" ("organization_id", "app_role");


-- feature_flags: global catalog of toggleable product features
CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id"              uuid    DEFAULT gen_random_uuid() NOT NULL,
    "flag_key"        text    NOT NULL,
    "label"           text    NOT NULL,
    "description"     text,
    "default_enabled" boolean NOT NULL DEFAULT false,
    CONSTRAINT "feature_flags_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "feature_flags_flag_key_key" UNIQUE ("flag_key")
);
-- Seeded: roster, songs, availability, setlist, chord_sheets (ON); handbook, audit_log, equipment, ai_roster (OFF)


-- organization_features: per-tenant feature flag overrides
CREATE TABLE IF NOT EXISTS "public"."organization_features" (
    "organization_id" uuid    NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "flag_id"         uuid    NOT NULL REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE,
    "enabled"         boolean NOT NULL DEFAULT true,
    CONSTRAINT "organization_features_pkey" PRIMARY KEY ("organization_id", "flag_id")
);


-- platform_admins: landlord-level accounts (separate from church members)
CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "id"         uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "email"      text                     NOT NULL,
    "name"       text                     NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "platform_admins_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "platform_admins_email_key" UNIQUE ("email")
);


-- =============================================================================
-- SECTION 3: CORE DATA TABLES
-- All have tenant_id (migration 020) except members — see note below.
-- =============================================================================

-- members: global identity table.
-- Intentionally NO tenant_id column.
-- Tenancy is resolved via organization_members (M:N relationship).
-- members.app_role is a LEGACY column — organization_members.app_role is
-- authoritative from Phase 1 onward. The check constraint was removed in 007.
CREATE TABLE IF NOT EXISTS "public"."members" (
    "id"          uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "email"       text                     NOT NULL,
    "name"        text                     NOT NULL,
    "phone"       text,
    "app_role"    text                     NOT NULL,  -- legacy; see organization_members.app_role
    "is_active"   boolean                  NOT NULL DEFAULT true,
    "magic_token" uuid                     NOT NULL  DEFAULT gen_random_uuid(),
    "created_at"  timestamp with time zone NOT NULL  DEFAULT now(),
    CONSTRAINT "members_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "members_email_key"       UNIQUE ("email"),
    CONSTRAINT "members_magic_token_key" UNIQUE ("magic_token")
    -- members_app_role_check was DROPPED in migration 007
);


-- Deferred FK: organization_members.member_id → members.id
ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;


-- member_role_assignments: which musical roles a member can play.
-- Renamed from member_roles in migration 019.
CREATE TABLE IF NOT EXISTS "public"."member_role_assignments" (
    "member_id" uuid    NOT NULL REFERENCES "public"."members"("id") ON DELETE CASCADE,
    "role_id"   integer NOT NULL REFERENCES "public"."roles"("id")   ON DELETE CASCADE,
    "tenant_id" uuid    NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "member_role_assignments_pkey" PRIMARY KEY ("member_id", "role_id")
);

CREATE INDEX "idx_member_role_assignments_tenant_id" ON "public"."member_role_assignments" ("tenant_id", "member_id");


-- songs: tenant-scoped song library.
-- Status values changed in migration 005: approved→published, new_song_learning→learning.
CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id"               uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "title"            text                     NOT NULL,
    "artist"           text,
    "status"           text                     NOT NULL DEFAULT 'published',
    "categories"       text[],
    "youtube_url"      text,
    "scripture_anchor" text,
    "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
    "tenant_id"        uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "songs_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "songs_status_check" CHECK (status IN ('learning', 'internal_approved', 'published'))
);

CREATE INDEX "songs_title_idx"           ON "public"."songs" ("title");
CREATE INDEX "idx_songs_tenant_id"       ON "public"."songs" ("tenant_id");
CREATE INDEX "idx_songs_tenant_id_title" ON "public"."songs" ("tenant_id", "title");


-- chord_charts: one row per key per song.
-- No tenant_id — inherits tenant via song_id → songs.tenant_id.
CREATE TABLE IF NOT EXISTS "public"."chord_charts" (
    "id"           uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "song_id"      uuid                     NOT NULL REFERENCES "public"."songs"("id") ON DELETE CASCADE,
    "key"          text                     NOT NULL,
    "file_url"     text,
    "storage_path" text,
    "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "chord_charts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chord_charts_song_id_idx" ON "public"."chord_charts" ("song_id");


-- roster: per-Sunday role assignment.
-- UNIQUE constraint is tenant-scoped (migration 021).
CREATE TABLE IF NOT EXISTS "public"."roster" (
    "id"          uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "date"        date                     NOT NULL,
    "role_id"     integer                  NOT NULL REFERENCES "public"."roles"("id")   ON DELETE RESTRICT,
    "member_id"   uuid                     REFERENCES "public"."members"("id") ON DELETE SET NULL,
    "status"      text                     NOT NULL,
    "assigned_by" uuid                     REFERENCES "public"."members"("id"),
    "assigned_at" timestamp with time zone NOT NULL DEFAULT now(),
    "locked_at"   timestamp with time zone,
    "tenant_id"   uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "roster_pkey"                   PRIMARY KEY ("id"),
    CONSTRAINT "roster_tenant_date_role_unique" UNIQUE ("tenant_id", "date", "role_id"),
    CONSTRAINT "roster_status_check"            CHECK (status IN ('DRAFT', 'LOCKED'))
);

CREATE INDEX "idx_roster_tenant_id_date" ON "public"."roster" ("tenant_id", "date");


-- availability: legacy per-member per-Sunday availability.
-- UNIQUE constraint is tenant-scoped (migration 021).
CREATE TABLE IF NOT EXISTS "public"."availability" (
    "id"             uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "member_id"      uuid                     NOT NULL REFERENCES "public"."members"("id") ON DELETE CASCADE,
    "date"           date                     NOT NULL,
    "status"         text                     NOT NULL,
    "preferred_role" integer                  REFERENCES "public"."roles"("id"),
    "notes"          text,
    "submitted_at"   timestamp with time zone NOT NULL DEFAULT now(),
    "tenant_id"      uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "availability_pkey"                      PRIMARY KEY ("id"),
    CONSTRAINT "availability_tenant_member_date_unique" UNIQUE ("tenant_id", "member_id", "date"),
    CONSTRAINT "availability_status_check"              CHECK (status IN ('AVAILABLE', 'UNAVAILABLE'))
);

CREATE INDEX "idx_availability_tenant_id" ON "public"."availability" ("tenant_id");


-- app_settings: per-tenant key/value configuration store.
-- PK changed from (key) to (tenant_id, key) in migration 021.
CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key"        text                     NOT NULL,
    "value"      jsonb                    NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "tenant_id"  uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("tenant_id", "key")
);
-- Default rows seeded per-tenant:
--   ('roster_pagination', '{"future_months": 2, "history_months": 6}')
--   ('setlist',           '{"max_songs": 3}')
--   ('handbook_permissions', '{"editor_roles": ["Admin","Coordinator"], "editor_member_ids": []}')


-- audit_log: immutable mutation log for Admin/Coordinator actions.
-- Retention: 2-year window + 10k row hard cap enforced by trigger (migration 009).
CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id"          uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
    "actor_id"    uuid                     REFERENCES "public"."members"("id") ON DELETE SET NULL,
    "actor_name"  text                     NOT NULL,
    "actor_role"  text                     NOT NULL,
    "action"      text                     NOT NULL,
    "entity_type" text                     NOT NULL,
    "entity_id"   text,
    "summary"     text                     NOT NULL,
    "tenant_id"   uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_created_at_idx" ON "public"."audit_log" ("created_at" DESC);
CREATE INDEX "idx_audit_log_tenant_id"  ON "public"."audit_log" ("tenant_id", "created_at" DESC);


-- sunday_setlist: worship leader's per-Sunday song selections.
-- position CHECK widened to 1–10 in migration 015 (matches configurable max_songs_per_setlist).
-- UNIQUE constraint is tenant-scoped (migration 021).
CREATE TABLE IF NOT EXISTS "public"."sunday_setlist" (
    "id"          uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "sunday_date" date                     NOT NULL,
    "song_id"     uuid                     NOT NULL REFERENCES "public"."songs"("id") ON DELETE CASCADE,
    "position"    integer                  NOT NULL,
    "chosen_key"  text,
    "status"      text                     NOT NULL DEFAULT 'DRAFT',
    "created_by"  uuid                     REFERENCES "public"."members"("id") ON DELETE SET NULL,
    "created_at"  timestamp with time zone DEFAULT now(),
    "updated_at"  timestamp with time zone DEFAULT now(),
    "tenant_id"   uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "sunday_setlist_pkey"                        PRIMARY KEY ("id"),
    CONSTRAINT "sunday_setlist_tenant_date_position_unique" UNIQUE ("tenant_id", "sunday_date", "position"),
    CONSTRAINT "sunday_setlist_position_check"              CHECK (position BETWEEN 1 AND 10),
    CONSTRAINT "sunday_setlist_status_check"                CHECK (status IN ('DRAFT', 'PUBLISHED'))
);

CREATE INDEX "idx_sunday_setlist_tenant_id" ON "public"."sunday_setlist" ("tenant_id", "sunday_date");


-- =============================================================================
-- SECTION 4: AVAILABILITY PERIODS SYSTEM (migrations 012–014)
-- =============================================================================

-- availability_periods: coordinator-managed availability collection rounds.
-- EXCLUDE constraint is tenant-scoped (migration 021) — overlapping open periods
-- are blocked only within the same tenant (not globally).
CREATE TABLE IF NOT EXISTS "public"."availability_periods" (
    "id"         uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" uuid                     REFERENCES "public"."members"("id") ON DELETE SET NULL,
    "label"      text                     NOT NULL,
    "starts_on"  date                     NOT NULL,
    "ends_on"    date                     NOT NULL,
    "deadline"   date,
    "closed_at"  timestamp with time zone,
    "tenant_id"  uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "availability_periods_pkey" PRIMARY KEY ("id"),
    -- Tenant-scoped: no two open periods may overlap in date range within the same tenant
    CONSTRAINT "no_overlapping_open_periods" EXCLUDE USING gist (
        "tenant_id" WITH =,
        daterange("starts_on", "ends_on", '[]') WITH &&
    ) WHERE ("closed_at" IS NULL)
);

CREATE INDEX "availability_periods_starts_on_idx" ON "public"."availability_periods" ("starts_on" DESC);
CREATE INDEX "idx_avail_periods_tenant_id"         ON "public"."availability_periods" ("tenant_id", "starts_on" DESC);


-- availability_responses: one row per musician per period.
-- No tenant_id — inherits via period_id → availability_periods.tenant_id.
CREATE TABLE IF NOT EXISTS "public"."availability_responses" (
    "id"                uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "submitted_at"      timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
    "period_id"         uuid                     NOT NULL REFERENCES "public"."availability_periods"("id") ON DELETE CASCADE,
    "member_id"         uuid                     NOT NULL REFERENCES "public"."members"("id") ON DELETE CASCADE,
    "notes"             text,
    "preferred_role_id" integer                  REFERENCES "public"."roles"("id") ON DELETE SET NULL,
    CONSTRAINT "availability_responses_pkey"              PRIMARY KEY ("id"),
    CONSTRAINT "availability_responses_period_member_key" UNIQUE ("period_id", "member_id")
);

CREATE INDEX "availability_responses_period_id_idx" ON "public"."availability_responses" ("period_id");
CREATE INDEX "availability_responses_member_id_idx" ON "public"."availability_responses" ("member_id");


-- availability_dates: per-Sunday answer within a response.
-- No tenant_id — inherits via response_id → availability_responses → period → tenant.
CREATE TABLE IF NOT EXISTS "public"."availability_dates" (
    "id"          uuid    DEFAULT gen_random_uuid() NOT NULL,
    "response_id" uuid    NOT NULL REFERENCES "public"."availability_responses"("id") ON DELETE CASCADE,
    "date"        date    NOT NULL,
    "available"   boolean NOT NULL,
    CONSTRAINT "availability_dates_pkey"              PRIMARY KEY ("id"),
    CONSTRAINT "availability_dates_response_date_key" UNIQUE ("response_id", "date")
);

CREATE INDEX "availability_dates_response_id_idx" ON "public"."availability_dates" ("response_id");


-- =============================================================================
-- SECTION 5: TEAM HANDBOOK (migrations 016–018)
-- =============================================================================

-- handbook_documents: versioned markdown documents, append-only.
-- is_current=true row is the live version; older rows are retained for history.
CREATE TABLE IF NOT EXISTS "public"."handbook_documents" (
    "id"              uuid                     DEFAULT gen_random_uuid() NOT NULL,
    "slug"            text                     NOT NULL,
    "title"           text                     NOT NULL,
    "content"         text                     NOT NULL DEFAULT '',
    "major_version"   integer                  NOT NULL DEFAULT 1,
    "minor_version"   integer                  NOT NULL DEFAULT 0,
    "is_current"      boolean                  NOT NULL DEFAULT false,
    "created_by"      uuid                     REFERENCES auth.users("id"),
    "created_by_name" text,
    "created_at"      timestamp with time zone DEFAULT now(),
    "change_type"     text                     DEFAULT 'minor',
    "what_changed"    text[]                   DEFAULT '{}',
    "why_changed"     text                     DEFAULT '',
    "tenant_id"       uuid                     NOT NULL REFERENCES "public"."organizations"("id"),
    CONSTRAINT "handbook_documents_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "handbook_documents_change_type" CHECK (change_type IN ('minor', 'major'))
);

CREATE INDEX "idx_handbook_slug_current" ON "public"."handbook_documents" ("slug", "is_current");
CREATE INDEX "idx_handbook_slug_history" ON "public"."handbook_documents" ("slug", "major_version" DESC, "minor_version" DESC);
CREATE INDEX "idx_handbook_tenant_id"    ON "public"."handbook_documents" ("tenant_id", "slug");
-- Slugs seeded per migrations 016+018 (all v1.0, is_current=true, empty content):
--   vision-values, roles-worship-lead, roles-worship-coordinator,
--   roles-music-coordinator, roles-tech-coordinator, weekly-rhythm, decision-rights


-- =============================================================================
-- SECTION 6: FUNCTIONS & TRIGGERS
-- =============================================================================

-- app_settings: auto-update updated_at on any change (migration 003)
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "app_settings_timestamp"
    BEFORE UPDATE ON "public"."app_settings"
    FOR EACH ROW EXECUTE PROCEDURE public.set_timestamp();


-- sunday_setlist: auto-update updated_at (migration 011)
CREATE OR REPLACE FUNCTION public.update_sunday_setlist_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_sunday_setlist_updated_at"
    BEFORE UPDATE ON "public"."sunday_setlist"
    FOR EACH ROW EXECUTE FUNCTION public.update_sunday_setlist_updated_at();


-- audit_log: probabilistic retention (5% chance per insert)
-- Keeps 2-year window and hard-caps at 10k rows (migration 009)
CREATE OR REPLACE FUNCTION public.enforce_audit_log_retention()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF random() < 0.05 THEN
    DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '2 years';
    DELETE FROM audit_log WHERE id IN (
      SELECT id FROM audit_log ORDER BY created_at DESC OFFSET 10000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "audit_log_retention_trigger"
    AFTER INSERT ON "public"."audit_log"
    FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_log_retention();


-- =============================================================================
-- SECTION 7: ROW LEVEL SECURITY
-- All writes use the service role key (bypasses RLS).
-- RLS is defense-in-depth: anon/authenticated clients cannot write anything.
-- =============================================================================

ALTER TABLE "public"."roles"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."members"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."member_role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."availability"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roster"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_settings"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."songs"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chord_charts"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_log"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sunday_setlist"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."availability_periods"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."availability_responses"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."availability_dates"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."handbook_documents"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organizations"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_members"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."feature_flags"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_features"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."platform_admins"         ENABLE ROW LEVEL SECURITY;

-- Standard pattern: public read / no client write
CREATE POLICY "roles_select_public"                     ON "public"."roles"                   FOR SELECT USING (true);
CREATE POLICY "roles_no_client_write"                   ON "public"."roles"                   FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "members_select_public"                   ON "public"."members"                 FOR SELECT USING (true);
CREATE POLICY "members_no_client_write"                 ON "public"."members"                 FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "member_role_assignments_select_public"   ON "public"."member_role_assignments" FOR SELECT USING (true);
CREATE POLICY "member_role_assignments_no_client_write" ON "public"."member_role_assignments" FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "availability_select_public"              ON "public"."availability"             FOR SELECT USING (true);
CREATE POLICY "availability_no_client_write"            ON "public"."availability"             FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "roster_select_public"                    ON "public"."roster"                  FOR SELECT USING (true);
CREATE POLICY "roster_no_client_write"                  ON "public"."roster"                  FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "songs_select_public"                     ON "public"."songs"                   FOR SELECT USING (true);
CREATE POLICY "songs_no_client_write"                   ON "public"."songs"                   FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "chord_charts_select_public"              ON "public"."chord_charts"            FOR SELECT USING (true);
CREATE POLICY "chord_charts_no_client_write"            ON "public"."chord_charts"            FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "sunday_setlist_select_public"            ON "public"."sunday_setlist"          FOR SELECT USING (true);
CREATE POLICY "sunday_setlist_no_client_write"          ON "public"."sunday_setlist"          FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "availability_periods_select_public"      ON "public"."availability_periods"    FOR SELECT USING (true);
CREATE POLICY "availability_periods_no_client_write"    ON "public"."availability_periods"    FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "availability_responses_select_public"    ON "public"."availability_responses"  FOR SELECT USING (true);
CREATE POLICY "availability_responses_no_client_write"  ON "public"."availability_responses"  FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "availability_dates_select_public"        ON "public"."availability_dates"      FOR SELECT USING (true);
CREATE POLICY "availability_dates_no_client_write"      ON "public"."availability_dates"      FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "handbook_documents_select_public"        ON "public"."handbook_documents"      FOR SELECT USING (true);
CREATE POLICY "handbook_documents_no_client_write"      ON "public"."handbook_documents"      FOR ALL    USING (false) WITH CHECK (false);

-- Multi-tenant infrastructure: public read / no client write
CREATE POLICY "organizations_select_public"             ON "public"."organizations"           FOR SELECT USING (true);
CREATE POLICY "organizations_no_client_write"           ON "public"."organizations"           FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "org_members_select_public"               ON "public"."organization_members"    FOR SELECT USING (true);
CREATE POLICY "org_members_no_client_write"             ON "public"."organization_members"    FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "feature_flags_select_public"             ON "public"."feature_flags"           FOR SELECT USING (true);
CREATE POLICY "feature_flags_no_client_write"           ON "public"."feature_flags"           FOR ALL    USING (false) WITH CHECK (false);

CREATE POLICY "org_features_select_public"              ON "public"."organization_features"   FOR SELECT USING (true);
CREATE POLICY "org_features_no_client_write"            ON "public"."organization_features"   FOR ALL    USING (false) WITH CHECK (false);

-- No client access at all (server-only / landlord tables)
CREATE POLICY "platform_admins_no_client_access"        ON "public"."platform_admins"         FOR ALL    USING (false) WITH CHECK (false);
CREATE POLICY "audit_log_no_client_access"              ON "public"."audit_log"               FOR ALL    USING (false) WITH CHECK (false);
CREATE POLICY "app_settings_no_client_access"           ON "public"."app_settings"            FOR ALL    USING (false) WITH CHECK (false);


-- =============================================================================
-- SECTION 8: GRANTS
-- =============================================================================

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON TABLE "public"."roles"                   TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."members"                 TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."member_role_assignments" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."availability"            TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."roster"                  TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."app_settings"            TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."songs"                   TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."chord_charts"            TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."audit_log"               TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."sunday_setlist"          TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."availability_periods"    TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."availability_responses"  TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."availability_dates"      TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."handbook_documents"      TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."organizations"           TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."organization_members"    TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."feature_flags"           TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."organization_features"   TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."platform_admins"         TO "anon", "authenticated", "service_role";

GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres", "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres", "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES    TO "postgres", "anon", "authenticated", "service_role";































