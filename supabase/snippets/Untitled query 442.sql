-- ═══════════════════════════════════════════════════════════════════════════
-- Song Categories Update + Duplicate Removal
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- VALID CATEGORY VALUES (use these exact strings in the ARRAY below):
--   'call_to_worship'       Call to Worship
--   'praise_upbeat'         Praise (Upbeat)
--   'adoration_worship'     Adoration / Worship
--   'gospel_salvation'      Gospel / Salvation
--   'assurance_of_grace'    Assurance of Grace
--   'confession_repentance' Confession / Repentance
--   'thanksgiving'          Thanksgiving
--   'response_commitment'   Response / Commitment
--   'communion'             Communion
--
-- HOW TO FILL IN:
--   Single category:  ARRAY['call_to_worship']
--   Multiple:         ARRAY['call_to_worship', 'praise_upbeat']
--   No category:      '{}'
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1: Remove duplicate songs (same title + artist)
-- Keeps the first inserted row; cascades to chord_charts via FK.
-- Re-run bulk-song-chord-update.sql after this if charts were lost.
-- ─────────────────────────────────────────────────────────────────────────
WITH keep AS (
  SELECT DISTINCT ON (LOWER(TRIM(title)), LOWER(TRIM(COALESCE(artist, ''))))
    id
  FROM songs
  ORDER BY
    LOWER(TRIM(title)),
    LOWER(TRIM(COALESCE(artist, ''))),
    created_at ASC
)
DELETE FROM songs
WHERE id NOT IN (SELECT id FROM keep);


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2: Category updates
-- ↓↓↓ FILL IN the ARRAY for each song before running ↓↓↓
-- ─────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _cat (title text, artist text, categories text[], scripture_anchor text) ON COMMIT DROP;

INSERT INTO _cat (title, artist, categories, scripture_anchor) VALUES
--  Song Title                                      Artist                              Categories                                                    Scripture
  ('Above All',                                     'Michael Smith',                    ARRAY['adoration_worship'],                                   'Philippians 2:9–11; Colossians 1:15–18'),
  ('Ancient of Days/Open the Eyes of my Heart',     'Called Out Music',                 ARRAY['call_to_worship', 'adoration_worship'],                 'Daniel 7:9; Ephesians 1:18'),
  ('Awesome God',                                   'Michael W Smith',                  ARRAY['praise_upbeat', 'adoration_worship'],                   'Psalm 47:2; Deuteronomy 10:17'),
  ('Be With You',                                   'Sendy Stepvina, City Harvest',     ARRAY['adoration_worship'],                                   'Psalm 139:7–10; Matthew 28:20'),
  ('Breathe + Holy and Anointed One',               'Passion Music',                    ARRAY['adoration_worship', 'response_commitment'],             'John 20:22; Isaiah 6:3'),
  ('Christ Alone',                                  'Brian Littrell',                   ARRAY['gospel_salvation', 'assurance_of_grace'],               'Acts 4:12; 1 Corinthians 3:11'),
  ('Endless Praise',                                'Charity Gayle',                    ARRAY['praise_upbeat', 'thanksgiving'],                        'Psalm 150; Revelation 7:12'),
  ('God So Loved',                                  'We The Kingdom',                   ARRAY['gospel_salvation'],                                    'John 3:16–17'),
  ('Goodness of God',                               'Cece Winans',                      ARRAY['thanksgiving', 'assurance_of_grace'],                   'Psalm 23:6; Lamentations 3:22–23; Romans 8:28'),
  ('Heart of Worship + You are My All in All',      'Steven Moctezuma',                 ARRAY['adoration_worship', 'response_commitment'],             'Psalm 51:17; Philippians 3:8'),
  ('Here I am to Worship',                          'MBL Worship',                      ARRAY['adoration_worship', 'response_commitment'],             'Isaiah 6:1–8; Romans 12:1'),
  ('House of the Lord',                             'Phil Wickham',                     ARRAY['call_to_worship', 'praise_upbeat'],                     'Psalm 122:1; Psalm 84:10'),
  ('How Great is Our God',                          'Chris Tomlin',                     ARRAY['adoration_worship', 'praise_upbeat'],                   'Psalm 145:3; Revelation 4:11'),
  ('How Great is Our God',                          'Josie Buchanan',                   ARRAY['adoration_worship', 'praise_upbeat'],                   'Psalm 145:3; Revelation 4:11'),
  ('I am Free',                                     'Newsboys',                         ARRAY['gospel_salvation', 'assurance_of_grace'],               'John 8:36; Galatians 5:1; Romans 8:2'),
  ('I Speak Jesus',                                 'Charity Gayle',                    ARRAY['praise_upbeat', 'adoration_worship'],                   'Acts 4:12; Philippians 2:10–11'),
  ('I Speak Jesus',                                 'Pasion',                           ARRAY['praise_upbeat', 'adoration_worship'],                   'Acts 4:12; Philippians 2:10–11'),
  ('I Speak Jesus + Ancient of Days',               'Faith CC',                         ARRAY['praise_upbeat', 'adoration_worship'],                   'Acts 4:12; Daniel 7:9'),
  ('I Stand in Awe',                                'Parachute Band',                   ARRAY['adoration_worship'],                                   'Psalm 33:8; Habakkuk 3:2'),
  ('I''ve Witnessed It',                            'Passion, Melodie Malone',          ARRAY['thanksgiving', 'assurance_of_grace'],                   'Psalm 77:11–12; Lamentations 3:22–23'),
  ('In Christ Alone',                               'Natashia Midori',                  ARRAY['gospel_salvation', 'assurance_of_grace'],               'Romans 8:1–4; 1 Corinthians 15:3–4'),
  ('In Jesus Name',                                 'Darlene Zschech',                  ARRAY['adoration_worship', 'response_commitment'],             'John 14:13–14; Acts 3:6'),
  ('Jesus My Everything',                           'Common Gathering',                 ARRAY['adoration_worship', 'response_commitment'],             'Colossians 3:11; Philippians 1:21'),
  ('Living Hope',                                   'Abegail Ginsterblum',              ARRAY['gospel_salvation', 'assurance_of_grace'],               '1 Peter 1:3–5; Romans 5:5'),
  ('Living Sacrifice',                              'Chris Christian',                  ARRAY['response_commitment'],                                  'Romans 12:1–2'),
  ('Lord I Lift Your Name on High',                 'The Katinas',                      ARRAY['praise_upbeat', 'gospel_salvation'],                    'Psalm 30:1; Philippians 2:9'),
  ('Lord I Need You',                               'Matt Maher',                       ARRAY['adoration_worship', 'response_commitment'],             'Psalm 63:1; John 15:5'),
  ('Make Room',                                     'Chase Oaks Worship',               ARRAY['adoration_worship', 'response_commitment'],             'Luke 2:7; Revelation 3:20; Romans 12:1–2'),
  ('Mighty Name of Jesus',                          'Hope Darst',                       ARRAY['praise_upbeat', 'adoration_worship'],                   'Philippians 2:9–11; Acts 4:12'),
  ('O Come to the Altar',                           'Common Gathering',                 ARRAY['confession_repentance', 'response_commitment'],         'Hebrews 4:16; Matthew 11:28–30'),
  ('Run to the Father',                             'Cody Carnes',                      ARRAY['gospel_salvation', 'response_commitment'],              'Luke 15:20; Romans 8:15'),
  ('Thank You Jesus for the Blood',                 'Charity Gayle',                    ARRAY['gospel_salvation', 'thanksgiving', 'communion'],        'Hebrews 9:14; Revelation 1:5; 1 John 1:7'),
  ('The Blood',                                     'Jazzy Smith, Jonathan Wong',       ARRAY['gospel_salvation', 'communion'],                        '1 John 1:7; Hebrews 9:22; Revelation 12:11'),
  ('The Joy',                                       'The Belonging Co ft David Dennis', ARRAY['praise_upbeat', 'adoration_worship'],                   'Nehemiah 8:10; Psalm 16:11'),
  ('The Lord is By My Side',                        'CityAlight',                       ARRAY['assurance_of_grace'],                                  'Psalm 121:5; Isaiah 41:10'),
  ('The More I Seek You',                           NULL,                               ARRAY['adoration_worship', 'response_commitment'],             'Jeremiah 29:13; Psalm 27:4'),
  ('Trust in God + Blessed Assurance',              'Genavieve Linkowski',              ARRAY['assurance_of_grace', 'thanksgiving'],                   'Proverbs 3:5–6; Hebrews 10:22; Romans 8:38–39'),
  ('Way Maker',                                     'Leeland',                          ARRAY['adoration_worship', 'praise_upbeat'],                   'Isaiah 43:16–19; Exodus 14:21–22'),
  ('We Give You Glory',                             'Don Moen',                         ARRAY['adoration_worship', 'thanksgiving'],                    'Psalm 29:2; Revelation 4:11'),
  ('What an Awesone God',                           'Phil Wickham',                     ARRAY['adoration_worship', 'praise_upbeat'],                   'Psalm 47:2; Deuteronomy 10:17'),
  ('Who Else',                                      'Gateway Worship ft Claire Smith',  ARRAY['adoration_worship'],                                   'Psalm 89:6; Isaiah 46:9'),
  ('Worthy of it All + Holy Forever',               'Danny Gokey',                      ARRAY['adoration_worship'],                                   'Revelation 4:11; 5:9; Isaiah 6:3'),
  ('Yes Again',                                     'Darlene Zschech',                  ARRAY['response_commitment', 'thanksgiving'],                  'Romans 12:1; 2 Corinthians 1:20'),
  ('Yes Not I But Through Christ In Me',            'CityAlight',                       ARRAY['gospel_salvation', 'assurance_of_grace'],               'Galatians 2:20'),
  ('You Are My Hiding Place',                       'Selah',                            ARRAY['assurance_of_grace', 'adoration_worship'],              'Psalm 32:7; Psalm 91:2'),
  ('Your Grace is Enough',                          'City Worship',                     ARRAY['assurance_of_grace', 'adoration_worship'],              '2 Corinthians 12:9; Romans 5:20'),
  ('Your Grace is Enough',                          'Matt Maher',                       ARRAY['assurance_of_grace', 'adoration_worship'],              '2 Corinthians 12:9; Romans 5:20');


UPDATE songs s
SET
  categories      = c.categories,
  scripture_anchor = c.scripture_anchor
FROM _cat c
WHERE LOWER(TRIM(s.title))                    = LOWER(TRIM(c.title))
  AND LOWER(TRIM(COALESCE(s.artist, '')))     = LOWER(TRIM(COALESCE(c.artist, '')));


-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
SELECT title, artist, categories
FROM songs
WHERE LOWER(TRIM(title)) IN (SELECT LOWER(TRIM(title)) FROM _cat)
ORDER BY title, artist;

COMMIT;
