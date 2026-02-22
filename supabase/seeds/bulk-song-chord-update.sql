-- ═══════════════════════════════════════════════════════════════════════════
-- Bulk Song Upsert + Chord Charts Import
-- Source: ChordSheet-Keys-Update.csv  (47 songs, 51 chord chart rows)
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: "What an Awesone God" spelling preserved from source CSV.
-- NOTE: Songs above all, Be With You, Christ Alone have no chart/video data
--       and will only be inserted as songs if they don't already exist.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- Temp table 1: one row per unique song (title + artist + youtube_url)
-- Multiple CSV rows for the same song (different keys) are collapsed here;
-- the first non-null youtube_url is used.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _import_songs (title text, artist text, youtube_url text) ON COMMIT DROP;

INSERT INTO _import_songs (title, artist, youtube_url) VALUES
  ('Above All',                                   'Michael Smith',                    NULL),
  ('Ancient of Days/Open the Eyes of my Heart',   'Called Out Music',                 'https://youtu.be/Jv_4BfyH7Dg?si=xcoYbT_M3q88xrRw'),
  ('Awesome God',                                  'Michael W Smith',                  'https://youtu.be/tuwwh4oUXAE?si=BXoiYNWXt7iLTyV0'),
  ('Be With You',                                  'Sendy Stepvina, City Harvest',     NULL),
  ('Breathe + Holy and Anointed One',              'Passion Music',                    'https://youtu.be/vtDPiYsZAg8?si=i-j6Cp71t-6bPgFs'),
  ('Christ Alone',                                 'Brian Littrell',                   NULL),
  ('Endless Praise',                               'Charity Gayle',                    'https://youtu.be/xjQfe6OwH64?si=U42y8gDX3UGCa9KG'),
  ('God So Loved',                                 'We The Kingdom',                   NULL),
  ('Goodness of God',                              'Cece Winans',                      'https://www.youtube.com/watch?v=9sE5kEnitqE'),
  ('Heart of Worship + You are My All in All',     'Steven Moctezuma',                 'https://youtu.be/OUFU4BzsZ04?si=fu9twgtHe29YQ8dX'),
  ('Here I am to Worship',                         'MBL Worship',                      'https://youtu.be/Us_uzAtSa-A?si=waU_MRVLOpot4yWZ'),
  ('House of the Lord',                            'Phil Wickham',                     'https://youtu.be/h8uKldEUrPE?si=UVNDhTq_v5mC568t'),
  ('How Great is Our God',                         'Chris Tomlin',                     'https://www.youtube.com/watch?v=KBD18rsVJHk'),
  ('How Great is Our God',                         'Josie Buchanan',                   'https://youtu.be/DLXX7O-KpiE?si=cVEMAGN_IoJMaTVD'),
  ('I am Free',                                    'Newsboys',                         'https://www.youtube.com/watch?v=4dCYUEW18UM'),
  ('I Speak Jesus',                                'Charity Gayle',                    'https://youtu.be/PcmqSfr1ENY?si=mYVH_wiZkOcoAphm'),
  ('I Speak Jesus',                                'Pasion',                           'https://youtu.be/ddkOsZDWk18?si=wl1hJeN5DBOV5_nt'),
  ('I Speak Jesus + Ancient of Days',              'Faith CC',                         'https://www.youtube.com/watch?v=mXbRa5Nm6mM'),
  ('I Stand in Awe',                               'Parachute Band',                   'https://youtu.be/xBwlj3OmyiI?si=l65oljkd1WzP66OJ'),
  ('I''ve Witnessed It',                           'Passion, Melodie Malone',          'https://www.youtube.com/watch?v=H5xH9ZUTLsM'),
  ('In Christ Alone',                              'Natashia Midori',                  'https://youtu.be/SqKQYbQM4ks?si=LYsOB6qIJtlidH3A'),
  ('In Jesus Name',                                'Darlene Zschech',                  'https://youtu.be/TVsRM55_jsE?si=4YOiwQQQfWgd46pV'),
  ('Jesus My Everything',                          'Common Gathering',                 'https://www.youtube.com/watch?v=DDF9T4_4FLM'),
  ('Living Hope',                                  'Abegail Ginsterblum',              'https://www.youtube.com/watch?v=rc5wtRjgaI8'),
  ('Living Sacrifice',                             'Chris Christian',                  'https://www.youtube.com/watch?v=EGt92P5ApWQ'),
  ('Lord I Lift Your Name on High',                'The Katinas',                      'https://youtu.be/s0yZBAKf3Ys?si=luih_1QPnDXSoZMc'),
  ('Lord I Need You',                              'Matt Maher',                       'https://youtu.be/iaVPupbNFAo?si=FcEJTxUeDUKFUHYj'),
  ('Make Room',                                    'Chase Oaks Worship',               'https://www.youtube.com/watch?v=kjrdTfAzdB4'),
  ('Mighty Name of Jesus',                         'Hope Darst',                       'https://youtu.be/CFfQFwjfTPY?si=CUd_27WCdnqgG-NK'),
  ('O Come to the Altar',                          'Common Gathering',                 'https://youtu.be/rILi_dcUhM4?si=rSEZsyIDkP0tBd30'),
  ('Run to the Father',                            'Cody Carnes',                      'https://www.youtube.com/watch?v=HTHS4W1bPj8'),
  ('Thank You Jesus for the Blood',                'Charity Gayle',                    'https://youtu.be/dhU-Omwg2rU?si=MrIvViEzjgyB2A7b'),
  ('The Blood',                                    'Jazzy Smith, Jonathan Wong',       'https://youtu.be/ru74vlXhwk0?si=9aZlQIstUwqCdDJm'),
  ('The Joy',                                      'The Belonging Co ft David Dennis', 'https://www.youtube.com/watch?v=WYcpL6otp_Y'),
  ('The Lord is By My Side',                       'CityAlight',                       'https://www.youtube.com/watch?v=5S_4TJJOvAk'),
  ('The More I Seek You',                          NULL,                               NULL),
  ('Trust in God + Blessed Assurance',             'Genavieve Linkowski',              'https://youtu.be/R8DZoMjphAs?si=2n0-lj9l014iyvWQ'),
  ('Way Maker',                                    'Leeland',                          'https://www.youtube.com/watch?v=iJCV_2H9xD0'),
  ('We Give You Glory',                            'Don Moen',                         'https://youtu.be/3Kqw1B61uFc?si=YdY7pMr7qNGFfd3O'),
  ('What an Awesone God',                          'Phil Wickham',                     'https://youtu.be/3Kqw1B61uFc?si=YdY7pMr7qNGFfd3O'),
  ('Who Else',                                     'Gateway Worship ft Claire Smith',  'https://youtu.be/Q-Ahi8ScH6c?si=OPSgs4jvJ4xMD_Rx'),
  ('Worthy of it All + Holy Forever',              'Danny Gokey',                      'https://youtu.be/EERoSPXJrq4?si=pX-H9ZN7AqAp90wx'),
  ('Yes Again',                                    'Darlene Zschech',                  'https://youtu.be/EERoSPXJrq4?si=pX-H9ZN7AqAp90wx'),
  ('Yes Not I But Through Christ In Me',           'CityAlight',                       'https://youtu.be/hwc2d1Xt8gM?si=oaMNGpSljoxUEjL-'),
  ('You Are My Hiding Place',                      'Selah',                            'https://www.youtube.com/watch?v=iukRJ9Wnr6A'),
  ('Your Grace is Enough',                         'City Worship',                     'https://youtu.be/K4FGeYJ_vaA?si=N34ZnsrtwkYGPmJz'),
  ('Your Grace is Enough',                         'Matt Maher',                       'https://www.youtube.com/watch?v=d7dW6d2-6B0');


-- ─────────────────────────────────────────────────────────────────────────
-- Temp table 2: one row per chord chart (51 rows)
-- Songs with 2 keys have 2 rows here.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _import_charts (title text, artist text, key text, file_url text) ON COMMIT DROP;

INSERT INTO _import_charts (title, artist, key, file_url) VALUES
  ('Ancient of Days/Open the Eyes of my Heart', 'Called Out Music',                 'B',       'https://docs.google.com/document/d/1ZODycmf3BF_vAfAhOXeVcX5bOoTub0Mi6F128v3Q6SI/edit?usp=sharing'),
  ('Awesome God',                                'Michael W Smith',                  'C',       'https://docs.google.com/document/d/1DrowCIgkcl4go1D_e82zFfATOlbndOC--Z2QSZEgRrE/edit?usp=sharing'),
  ('Breathe + Holy and Anointed One',            'Passion Music',                    'F',       'https://docs.google.com/document/d/18KI6AKQ8w95v4IP9nsUw7tLqrlNNfJlh8pWxSEBNjAw/edit?usp=sharing'),
  ('Endless Praise',                             'Charity Gayle',                    'Gb',      'https://docs.google.com/document/d/1oXLtkOxA1U_hQ2LVOwUXJyLem8LM-8Bs5TR3Jywbz40/edit?usp=sharing'),
  ('God So Loved',                               'We The Kingdom',                   'B',       'https://docs.google.com/document/d/1sHIpzydlFAIIWv_XbqI5_Ja2MtJtmMRJYfHrCbQpfs4/edit?tab=t.0'),
  ('Goodness of God',                            'Cece Winans',                      'D',       'https://docs.google.com/document/d/1mgu4K96cCZ23DRSiSlj85f24zhEI5LtBoQ5BGA472rg/edit?tab=t.0'),
  ('Goodness of God',                            'Cece Winans',                      'G',       'https://docs.google.com/document/d/1Y1eXwKub17cwlOIpP4uzSBNwpHYfGMPCreUrfkySLdA/edit?tab=t.0'),
  ('Heart of Worship + You are My All in All',   'Steven Moctezuma',                 'D',       'https://docs.google.com/document/d/1B0-H_OCd48H4HazygZClIE6rtKymTbksqUOFv7NNi38/edit?tab=t.0'),
  ('Here I am to Worship',                       'MBL Worship',                      'D',       'https://docs.google.com/document/d/1dRcjmEry0VQSkC-TNJvh0MlZZNOWpgo-EY0aubAxS-0/edit?tab=t.0'),
  ('House of the Lord',                          'Phil Wickham',                     'Bb',      'https://docs.google.com/document/d/1aLLKcSDQq15Q60Jpp-FgyTN6pkoOzWKtMuvyT_c4Zb0/edit?tab=t.0'),
  ('How Great is Our God',                       'Chris Tomlin',                     'G',       'https://docs.google.com/document/d/1hkGtaIwdB96KKdK9wdB_3_vBQYy5rUTwqk6oMGDRulM/edit?tab=t.0'),
  ('How Great is Our God',                       'Josie Buchanan',                   'Gb',      'https://docs.google.com/document/d/1FpnxQsSmw2VyU7Go8Ec_IDpJFK7Ny0Xz6dRbCWgeoJE/edit?tab=t.0'),
  ('I am Free',                                  'Newsboys',                         'D',       'https://docs.google.com/document/d/17FXVyJyt9MDIq0S3eiXmWanhPXIwzWMS2ydba9AOTBQ/edit?tab=t.0'),
  ('I Speak Jesus',                              'Charity Gayle',                    'E',       'https://docs.google.com/document/d/1hChpdp1DAGjmuieVqS915X8fpbW0dtiYy9CdDnasSdM/edit?tab=t.0'),
  ('I Speak Jesus',                              'Charity Gayle',                    'D',       'https://docs.google.com/document/d/1tj-U9-k8Fy3xCHv-by5U4PWBC_-ZQBe5qH-S8X-PCcg/edit?tab=t.0'),
  ('I Speak Jesus',                              'Pasion',                           'E, Capo4','https://docs.google.com/document/d/1tj-U9-k8Fy3xCHv-by5U4PWBC_-ZQBe5qH-S8X-PCcg/edit?tab=t.0'),
  ('I Speak Jesus',                              'Pasion',                           'E',       'https://docs.google.com/document/d/13N9laF1KUZmvqg4XbamEvmkWaqUa0H7-3acvGycfE5Y/edit?tab=t.0'),
  ('I Speak Jesus + Ancient of Days',            'Faith CC',                         'A',       'https://docs.google.com/document/d/1sLTYKVzfybxIjmvVg_VvfHgzlEtOWn8-hA6trn_O5KY/edit?tab=t.0'),
  ('I Stand in Awe',                             'Parachute Band',                   'C',       'https://docs.google.com/document/d/1muAkjwp1i4eXcSZNjb0xyJWH4fE03-VJ9HEIWLLZrX8/edit?tab=t.0'),
  ('I''ve Witnessed It',                         'Passion, Melodie Malone',          'D',       'https://docs.google.com/document/d/157hfvTODVkuWNla_mKlTa3z3VCg7l3BCa4e1E9xcYxY/edit?tab=t.0'),
  ('In Christ Alone',                            'Natashia Midori',                  'G',       'https://docs.google.com/document/d/1rGCbYndhrJ_EfJNoQVQ_KPgJQzsRzSWJoCuKUfz5EMY/edit?tab=t.0'),
  ('In Jesus Name',                              'Darlene Zschech',                  'C',       'https://docs.google.com/document/d/1tSQwrfTeDGstYNqXwlj_iwkyaL_UrP-9vvZnuRXt7rU/edit?usp=drive_web&ouid=117034650716542059022'),
  ('Jesus My Everything',                        'Common Gathering',                 'B',       'https://docs.google.com/document/d/1GCUO47ERnDJBggy1c5N-M89NzJWMPHCljob6qiDni7M/edit?usp=drive_web&ouid=117034650716542059022'),
  ('Living Hope',                                'Abegail Ginsterblum',              'Ab',      'https://docs.google.com/document/d/1WSUXtOL777fBlzlS9FKKMJtLVow__lNcj7AoVyoKTIw/edit?tab=t.0'),
  ('Living Sacrifice',                           'Chris Christian',                  'D',       'https://docs.google.com/document/d/1OH1QiXFZaBSTYffPuIskb44lsCCouAIeFOtJUGCsp6k/edit?tab=t.0'),
  ('Lord I Lift Your Name on High',              'The Katinas',                      'F',       'https://docs.google.com/document/d/1w9NTporrumuyM23ea1pDflY7CZcgpOyIMYCQP5HtikE/edit?usp=drive_web&ouid=117034650716542059022'),
  ('Lord I Need You',                            'Matt Maher',                       'Bb',      'https://docs.google.com/document/d/1RY4bEFhfEI1vdSrXTrDeA-uBs1Xh4vIgJf1tPZQhaqU/edit?tab=t.0'),
  ('Make Room',                                  'Chase Oaks Worship',               'G',       'https://docs.google.com/document/d/1zZG6XbiJUJ1ew7dvuIWSqpp9IvpW-7bJ-KjhkFspuUo/edit?tab=t.0'),
  ('Make Room',                                  'Chase Oaks Worship',               'Gb',      'https://docs.google.com/document/d/1UVredC3P5lCPqzn60BJGGP3b-k_zcLD29tY6e_BLvkE/edit?usp=drive_web&ouid=117034650716542059022'),
  ('Mighty Name of Jesus',                       'Hope Darst',                       'Eb',      'https://docs.google.com/document/d/10Ooq4CZ60QJvhD9roJmonHj4yRhePgwPrl2EiY5j3ak/edit?tab=t.0'),
  ('Mighty Name of Jesus',                       'Hope Darst',                       'D',       'https://docs.google.com/document/d/10alVFRSCqVE7be3TY2iiE_e0He5EjBBI2PuJdIFTDtM/edit?tab=t.0'),
  ('O Come to the Altar',                        'Common Gathering',                 'D',       'https://docs.google.com/document/d/1c0l48Ggbi47tQsqS3zjtWvQpvlWouW4MrS8gruJCGyo/edit?tab=t.0'),
  ('Run to the Father',                          'Cody Carnes',                      'C',       'https://docs.google.com/document/d/1VNxnMv6asge0iA_nVdiqcaLvJUwch51Qr2SzHJn6ypA/edit?tab=t.0'),
  ('Thank You Jesus for the Blood',              'Charity Gayle',                    'Bb',      'https://docs.google.com/document/d/1oroIjGg3CMYH0QaPIo-aQWprePNxTZO34zHdxdOo0qI/edit?tab=t.0'),
  ('The Blood',                                  'Jazzy Smith, Jonathan Wong',       'B',       'https://docs.google.com/document/d/1AkEUgGNEl-sLghy6-o4zL3s_Nf0FE0DkpEilM_qjUuk/edit?tab=t.0'),
  ('The Joy',                                    'The Belonging Co ft David Dennis', 'D',       'https://docs.google.com/document/d/1b1RW8zIfeWfqIErhXZaU_Hh1v6tqqIMzAUFc10yBHTY/edit?tab=t.0'),
  ('The Joy',                                    'The Belonging Co ft David Dennis', 'Db',      'https://docs.google.com/document/d/1uw4c96YHWK36DXorTTn67ltjSLAeXnz7XNtTvGOdY2o/edit?tab=t.0'),
  ('The Lord is By My Side',                     'CityAlight',                       'E',       'https://docs.google.com/document/d/1mmD-s7YHb12aOSB4SwlCeVpkHaAmb1LjPKx1bCR6GjM/edit?tab=t.0'),
  ('The More I Seek You',                        NULL,                               'C',       'https://docs.google.com/document/d/1XFlYdgK90G3iHux--CiIAfT1ATHFpgPFRmJ7_FlGE_0/edit?usp=drive_web&ouid=117034650716542059022'),
  ('Trust in God + Blessed Assurance',           'Genavieve Linkowski',              'D',       'https://docs.google.com/document/d/1drnbk5Efd8GtE93OtyL0rdZ0lOZ3ITFlL0YMcj7cGsQ/edit?tab=t.0'),
  ('Way Maker',                                  'Leeland',                          'E',       'https://docs.google.com/document/d/1h7YuS4pthrjgsUBCeg4bhuUM8_hiInWte1LjY7jgvA4/edit?tab=t.0'),
  ('We Give You Glory',                          'Don Moen',                         'D',       'https://docs.google.com/document/d/1ZmRh0sDc-itqNJ3P0V8qMYd-3COIP-1jLUgzEMp8Yz0/edit?tab=t.0'),
  ('What an Awesone God',                        'Phil Wickham',                     'D',       'https://docs.google.com/document/d/1irvvCzXXHdQniCN-FPXfJlI4ZpbevR_wtLbZOBV5bgs/edit?tab=t.0'),
  ('Who Else',                                   'Gateway Worship ft Claire Smith',  'G',       'https://docs.google.com/document/d/1KV1C--2EYeYxMlcfS03cLsn58sdf6r7mLUQw96gqfrM/edit?tab=t.0'),
  ('Who Else',                                   'Gateway Worship ft Claire Smith',  'Ab',      'https://docs.google.com/document/d/1zhN1dbTzi_ntmueSHSGxH4Ifnurh9TnmEAYAPfeEL5o/edit?tab=t.0'),
  ('Worthy of it All + Holy Forever',            'Danny Gokey',                      'Db',      'https://docs.google.com/document/d/1vt84iW4u3aITnl3FpYibHMHqtFCdxaIQvz6N2wyOsfU/edit?usp=drive_web&ouid=117034650716542059022'),
  ('Yes Again',                                  'Darlene Zschech',                  'D',       'https://docs.google.com/document/d/1lDXy5egfXdvQLrrwAd-Xy3myB3zHswRMzkkJnJTejFg/edit?tab=t.0'),
  ('Yes Not I But Through Christ In Me',         'CityAlight',                       'C',       'https://docs.google.com/document/d/1jO79OSF0l1EdVD-sH26z0fYAjDkdJSrPNE-Au6FNZAc/edit?tab=t.0'),
  ('You Are My Hiding Place',                    'Selah',                            'Am',      'https://docs.google.com/document/d/1InTkSFzRYPZ8KnbNWVBq0LmjO6WiDb7GTaIECVe3qaI/edit?tab=t.0'),
  ('Your Grace is Enough',                       'City Worship',                     'E',       'https://docs.google.com/document/d/1xTZta2JhFxkxtFPg2I4dE50kyM0iozIIEMRc8kQ2KA4/edit?tab=t.0'),
  ('Your Grace is Enough',                       'Matt Maher',                       'D',       'https://docs.google.com/document/d/1og1y788tpht_TA5pQnz-jFTrulchrypRZqw2Xod3MPg/edit?tab=t.0');


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1: Update youtube_url on existing songs
-- Only overwrites when the import row has a non-null video URL.
-- Match is case-insensitive + whitespace-trimmed on title and artist.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE songs s
SET youtube_url = i.youtube_url
FROM _import_songs i
WHERE LOWER(TRIM(s.title))                      = LOWER(TRIM(i.title))
  AND LOWER(TRIM(COALESCE(s.artist, '')))       = LOWER(TRIM(COALESCE(i.artist, '')))
  AND i.youtube_url IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2: Insert songs that don't yet exist in the songs table
-- Default status = 'published'. Safe to re-run; existing rows are skipped.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO songs (title, artist, status, youtube_url)
SELECT i.title, i.artist, 'published', i.youtube_url
FROM _import_songs i
WHERE NOT EXISTS (
  SELECT 1 FROM songs s
  WHERE LOWER(TRIM(s.title))                = LOWER(TRIM(i.title))
    AND LOWER(TRIM(COALESCE(s.artist, ''))) = LOWER(TRIM(COALESCE(i.artist, '')))
);


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3: Delete existing chord charts for every song in the import set
-- This clears stale/outdated charts before re-inserting the fresh ones.
-- Songs with no chart rows in _import_charts are unaffected.
-- ─────────────────────────────────────────────────────────────────────────
DELETE FROM chord_charts
WHERE song_id IN (
  SELECT s.id
  FROM songs s
  JOIN _import_charts i
    ON LOWER(TRIM(s.title))                      = LOWER(TRIM(i.title))
   AND LOWER(TRIM(COALESCE(s.artist, '')))       = LOWER(TRIM(COALESCE(i.artist, '')))
);


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 4: Insert fresh chord charts (51 rows, including dual-key songs)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO chord_charts (song_id, key, file_url)
SELECT s.id, i.key, i.file_url
FROM _import_charts i
JOIN songs s
  ON LOWER(TRIM(s.title))                      = LOWER(TRIM(i.title))
 AND LOWER(TRIM(COALESCE(s.artist, '')))       = LOWER(TRIM(COALESCE(i.artist, '')));


-- ─────────────────────────────────────────────────────────────────────────
-- Verification queries — review before committing
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  s.title,
  s.artist,
  s.youtube_url IS NOT NULL AS has_video,
  COUNT(cc.id)              AS chart_count,
  STRING_AGG(cc.key, ', ' ORDER BY cc.key) AS keys
FROM songs s
LEFT JOIN chord_charts cc ON cc.song_id = s.id
WHERE LOWER(TRIM(s.title)) IN (SELECT LOWER(TRIM(title)) FROM _import_songs)
GROUP BY s.id, s.title, s.artist, s.youtube_url
ORDER BY s.title, s.artist;

COMMIT;
