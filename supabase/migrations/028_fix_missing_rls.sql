-- Migration 028: Enable RLS on all tables that were missing it.
--
-- Background: Supabase flagged 9 tables in the public schema without RLS enabled,
-- exposing them to direct PostgREST reads/writes by any authenticated client.
--
-- Architecture note: ALL writes in this app go through Next.js API routes using
-- the service role key, which bypasses RLS entirely. These policies are therefore
-- pure defense-in-depth — they prevent a rogue Supabase JS client from reading
-- or writing data while leaving all existing API routes unaffected.
--
-- Policy pattern (consistent with migration 019):
--   SELECT: USING (true)  — allow reads through PostgREST (access control is the API layer's job)
--   ALL:    USING (false) — deny all client-side writes unconditionally
--
-- Exception: audit_log gets no SELECT either — it contains PII-adjacent activity
-- data and should never be readable via the client SDK.
--
-- ROLLBACK (if needed — reverses all 9 tables):
-- DROP POLICY IF EXISTS "roles_select_public"                      ON public.roles;
-- DROP POLICY IF EXISTS "roles_no_client_write"                    ON public.roles;
-- ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "audit_log_no_client_access"               ON public.audit_log;
-- ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "sunday_setlist_select_public"             ON public.sunday_setlist;
-- DROP POLICY IF EXISTS "sunday_setlist_no_client_write"           ON public.sunday_setlist;
-- ALTER TABLE public.sunday_setlist DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "availability_periods_select_public"       ON public.availability_periods;
-- DROP POLICY IF EXISTS "availability_periods_no_client_write"     ON public.availability_periods;
-- ALTER TABLE public.availability_periods DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "availability_responses_select_public"     ON public.availability_responses;
-- DROP POLICY IF EXISTS "availability_responses_no_client_write"   ON public.availability_responses;
-- ALTER TABLE public.availability_responses DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "availability_dates_select_public"         ON public.availability_dates;
-- DROP POLICY IF EXISTS "availability_dates_no_client_write"       ON public.availability_dates;
-- ALTER TABLE public.availability_dates DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "handbook_documents_select_public"         ON public.handbook_documents;
-- DROP POLICY IF EXISTS "handbook_documents_no_client_write"       ON public.handbook_documents;
-- ALTER TABLE public.handbook_documents DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "app_settings_select_public"               ON public.app_settings;
-- DROP POLICY IF EXISTS "app_settings_no_client_write"             ON public.app_settings;
-- ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "sunday_recordings_select_public"          ON public.sunday_recordings;
-- DROP POLICY IF EXISTS "sunday_recordings_no_client_write"        ON public.sunday_recordings;
-- ALTER TABLE public.sunday_recordings DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- roles (lookup table: Guitar, Drums, Vocals, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_public"      ON public.roles FOR SELECT USING (true);
CREATE POLICY "roles_no_client_write"    ON public.roles FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log — full deny: sensitive activity log, no client reads
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_no_client_access" ON public.audit_log FOR ALL USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- sunday_setlist
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sunday_setlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sunday_setlist_select_public"   ON public.sunday_setlist FOR SELECT USING (true);
CREATE POLICY "sunday_setlist_no_client_write" ON public.sunday_setlist FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- availability_periods
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_periods_select_public"   ON public.availability_periods FOR SELECT USING (true);
CREATE POLICY "availability_periods_no_client_write" ON public.availability_periods FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- availability_responses — member answers: allow read (service role handles auth)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_responses_select_public"   ON public.availability_responses FOR SELECT USING (true);
CREATE POLICY "availability_responses_no_client_write" ON public.availability_responses FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- availability_dates
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_dates_select_public"   ON public.availability_dates FOR SELECT USING (true);
CREATE POLICY "availability_dates_no_client_write" ON public.availability_dates FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- handbook_documents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.handbook_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handbook_documents_select_public"   ON public.handbook_documents FOR SELECT USING (true);
CREATE POLICY "handbook_documents_no_client_write" ON public.handbook_documents FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- app_settings — global key/value config; no client writes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_public"   ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_no_client_write" ON public.app_settings FOR ALL    USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- sunday_recordings
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sunday_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sunday_recordings_select_public"   ON public.sunday_recordings FOR SELECT USING (true);
CREATE POLICY "sunday_recordings_no_client_write" ON public.sunday_recordings FOR ALL    USING (false) WITH CHECK (false);
