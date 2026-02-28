-- 016_handbook_documents.sql
-- Team Handbook: versioned markdown documents for 6 sections.
-- Append-only: every save inserts a new row; is_current flips atomically.
-- MVP2 fields (change_type, what_changed, why_changed) are stored from day 1.

CREATE TABLE handbook_documents (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  content          TEXT        NOT NULL DEFAULT '',
  major_version    INT         NOT NULL DEFAULT 1,
  minor_version    INT         NOT NULL DEFAULT 0,
  is_current       BOOLEAN     NOT NULL DEFAULT false,
  created_by       UUID        REFERENCES auth.users(id),
  created_by_name  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  -- change log — required on every save (except initial seed rows)
  change_type      TEXT        CHECK (change_type IN ('minor', 'major')) DEFAULT 'minor',
  what_changed     TEXT[]      DEFAULT '{}',
  why_changed      TEXT        DEFAULT ''
);

CREATE INDEX idx_handbook_slug_current ON handbook_documents (slug, is_current);
CREATE INDEX idx_handbook_slug_history ON handbook_documents (slug, major_version DESC, minor_version DESC);

-- Seed: one initial row per section slug
-- All start at v1.0, is_current = true, empty content (UI shows starter template hint)
INSERT INTO handbook_documents (slug, title, content, major_version, minor_version, is_current, change_type, what_changed, why_changed)
VALUES
  (
    'vision-values',
    'Vision & Values',
    '',
    1, 0, true, 'minor',
    ARRAY['Initial document created', ''],
    'Foundation for the Team Handbook'
  ),
  (
    'roles-worship-lead',
    'Worship Lead',
    '',
    1, 0, true, 'minor',
    ARRAY['Initial document created', ''],
    'Foundation for the Team Handbook'
  ),
  (
    'roles-worship-coordinator',
    'Worship Coordinator',
    '',
    1, 0, true, 'minor',
    ARRAY['Initial document created', ''],
    'Foundation for the Team Handbook'
  ),
  (
    'roles-music-coordinator',
    'Music Coordinator',
    '',
    1, 0, true, 'minor',
    ARRAY['Initial document created', ''],
    'Foundation for the Team Handbook'
  ),
  (
    'weekly-rhythm',
    'Weekly Rhythm',
    '',
    1, 0, true, 'minor',
    ARRAY['Initial document created', ''],
    'Foundation for the Team Handbook'
  ),
  (
    'decision-rights',
    'Decision Rights & Escalation',
    '',
    1, 0, true, 'minor',
    ARRAY['Initial document created', ''],
    'Foundation for the Team Handbook'
  );
