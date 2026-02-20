-- =============================================================
-- songs.sql  —  Bulk seed: 60 worship songs
-- Run via: Supabase Dashboard → SQL Editor → paste & run
--
-- Notes:
--   • youtube_url is null for all rows — the CSV hyperlinks did not
--     export as URLs. Add them individually via the Admin UI later.
--   • Source typos preserved (fixable via Admin > Edit):
--       "I Stand in Awer"       → should be "Awe"
--       "What an Awesone God"   → should be "Awesome"
--       "The Lord Almight Reigns" → should be "Almighty"
-- =============================================================

-- Clean up any existing test data first
DELETE FROM songs;

DO $$
DECLARE s uuid;
BEGIN

  -- Above All
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Above All', 'Michael Smith', 'published', '{}')
  RETURNING id INTO s;

  -- All I Have Is Christ
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('All I Have Is Christ', 'Sovereign Grace Music', 'learning',
    ARRAY['assurance_of_grace', 'gospel_salvation'],
    'Romans 3–8, Ephesians 2:1–10, and Titus 3:3–7')
  RETURNING id INTO s;

  -- All Creatures of Our God and King
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('All Creatures of Our God and King', 'Sovereign Grace Music', 'learning',
    ARRAY['call_to_worship', 'praise_upbeat'],
    'Psalm 148; Revelation 5:13')
  RETURNING id INTO s;

  -- Ancient of Days/Open the Eyes of my Heart
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Ancient of Days/Open the Eyes of my Heart', 'Called Out Music', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url)
  VALUES (s, 'B', 'https://docs.google.com/document/d/1ZODycmf3BF_vAfAhOXeVcX5bOoTub0Mi6F128v3Q6SI/edit?usp=sharing');

  -- Awesome God
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Awesome God', 'Michael W Smith', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url)
  VALUES (s, 'C', 'https://docs.google.com/document/d/1DrowCIgkcl4go1D_e82zFfATOlbndOC--Z2QSZEgRrE/edit?usp=sharing');

  -- Be With You
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Be With You', 'Sendy Stepvina, City Harvest', 'published', '{}')
  RETURNING id INTO s;

  -- Breathe + Holy and Anointed One
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Breathe + Holy and Anointed One', 'Passion Music', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url)
  VALUES (s, 'F', 'https://docs.google.com/document/d/18KI6AKQ8w95v4IP9nsUw7tLqrlNNfJlh8pWxSEBNjAw/edit?usp=sharing');

  -- Christ Alone
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Christ Alone', 'Brian Littrell', 'published', '{}')
  RETURNING id INTO s;

  -- Come Behold the Wonderous Mystery
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('Come Behold the Wonderous Mystery', 'Keith & Kristyn Getty, Matt Boswell, Matt Papa', 'learning',
    ARRAY['gospel_salvation'],
    'Colossians 2:2–15; 1 Timothy 3:16')
  RETURNING id INTO s;

  -- Endless Praise
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Endless Praise', 'Charity Gayle', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url)
  VALUES (s, 'Gb', 'https://docs.google.com/document/d/1oXLtkOxA1U_hQ2LVOwUXJyLem8LM-8Bs5TR3Jywbz40/edit?usp=sharing');

  -- God So Loved
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('God So Loved', 'We The Kingdom', 'published', ARRAY['call_to_worship'])
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'B', null);

  -- Goodness of God
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Goodness of God', 'Cece Winans', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'A', null);

  -- Heart of Worship + You are My All in All
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Heart of Worship + You are My All in All', 'Steven Moctezuma', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- Here I am to Worship
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Here I am to Worship', 'MBL Worship', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- His Mercy Is More
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('His Mercy Is More', 'Sovereign Grace Music', 'learning',
    ARRAY['confession_repentance'],
    'Psalm 103:8–12; Lamentations 3:22–23')
  RETURNING id INTO s;

  -- House of the Lord
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('House of the Lord', 'Phil Wickham', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Bb', null);

  -- How Deep The Fathers Love
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('How Deep The Fathers Love', 'Austin Stone Worship', 'learning',
    ARRAY['gospel_salvation', 'thanksgiving'],
    'Romans 5:6–11; Isaiah 53')
  RETURNING id INTO s;

  -- How Great is Our God (Chris Tomlin)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('How Great is Our God', 'Chris Tomlin', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'G', null);

  -- How Great is Our God (Josie Buchanan)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('How Great is Our God', 'Josie Buchanan', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Gb', null);

  -- I am Free
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('I am Free', 'Newsboys', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- I Speak Jesus (Charity Gayle)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('I Speak Jesus', 'Charity Gayle', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- I Speak Jesus (Pasion)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('I Speak Jesus', 'Pasion', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'E', null);
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Capo4', null);

  -- I Speak Jesus + Ancient of Days
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('I Speak Jesus + Ancient of Days', 'Faith CC', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Ab', null);

  -- I Stand in Awer  (source typo — edit to "Awe" via Admin UI)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('I Stand in Awer', 'Parachute Band', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'C', null);

  -- I've Witnessed It
  INSERT INTO songs (title, artist, status, categories)
  VALUES (E'I\u2019ve Witnessed It', 'Passion, Melodie Malone', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- In Christ Alone (Keith & Kristyn Getty)
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('In Christ Alone', 'Keith & Kristyn Getty', 'learning',
    ARRAY['gospel_salvation'],
    'Romans 8:1–4; 1 Corinthians 15:3–4')
  RETURNING id INTO s;

  -- In Christ Alone (Natashia Midori)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('In Christ Alone', 'Natashia Midori', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'G', null);

  -- In Jesus Name
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('In Jesus Name', 'Darlene Zschech', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'C', null);

  -- Jesus My Everything
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Jesus My Everything', 'Common Gathering', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'B', null);

  -- Living Hope
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Living Hope', 'Abegail Ginsterblum', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Ab', null);

  -- Living Sacrifice
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Living Sacrifice', 'Chris Christian', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- Lord I Lift Your Name on High
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Lord I Lift Your Name on High', 'The Katinas', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'F', null);

  -- Lord I Need You
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Lord I Need You', 'Matt Maher', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Bb', null);

  -- Make Room  (source: "G. Gb" — treated as two keys G and Gb)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Make Room', 'Chase Oaks Worship', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'G', null);
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Gb', null);

  -- Mighty Name of Jesus
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Mighty Name of Jesus', 'Hope Darst', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Eb', null);

  -- I set my Hope
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('I set my Hope', 'Keith & Kristyn Getty, Matt Boswell, Matt Papa', 'learning',
    ARRAY['response_commitment'],
    'Psalm 62:5–8; Hebrews 6:18–19')
  RETURNING id INTO s;

  -- O Come to the Altar
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('O Come to the Altar', 'Common Gathering', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- Run to the Father
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Run to the Father', 'Cody Carnes', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'C', null);

  -- Precious Love
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('Precious Love', 'Chris Tomlin', 'learning',
    ARRAY['communion', 'gospel_salvation'],
    'Romans 5:8–9; 1 Peter 1:18–19')
  RETURNING id INTO s;

  -- Psalm 150 (Praise The Lord)
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('Psalm 150 (Praise The Lord)', 'Matt Boswell, Mat Papa', 'learning',
    ARRAY['praise_upbeat', 'thanksgiving'],
    'Psalm 150:1–6')
  RETURNING id INTO s;

  -- Speak Oh Lord
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('Speak Oh Lord', 'Keith & Kristyn Getty', 'learning',
    ARRAY['call_to_worship', 'response_commitment'],
    'Psalm 119:105; Hebrews 4:12')
  RETURNING id INTO s;

  -- Thank You Jesus for the Blood
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Thank You Jesus for the Blood', 'Charity Gayle', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Bb', null);

  -- The Blood
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('The Blood', 'Jazzy Smith, Jonathan Wong', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'B', null);

  -- The Joy
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('The Joy', 'The Belonging Co ft David Dennis', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Db', null);

  -- The Lord is By My Side
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('The Lord is By My Side', 'CityAlight', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'E', null);

  -- The More I Seek You
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('The More I Seek You', null, 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'C', null);

  -- The Lord Almight Reigns  (source typo — edit to "Almighty" via Admin UI)
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('The Lord Almight Reigns', 'Sovereign Grace Music', 'learning',
    ARRAY['praise_upbeat', 'adoration_worship'],
    'Psalm 93; Revelation 19:6')
  RETURNING id INTO s;

  -- The Power of the Cross
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('The Power of the Cross', 'Keith & Kristyn Getty', 'learning',
    ARRAY['communion', 'gospel_salvation'],
    'Colossians 2:13–15; 1 Corinthians 1:18')
  RETURNING id INTO s;

  -- Trust in God + Blessed Assurance
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Trust in God + Blessed Assurance', null, 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- Way Maker
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Way Maker', 'Leeland', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'E', null);

  -- We Give You Glory
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('We Give You Glory', 'Don Moen', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- What an Awesone God  (source typo — edit to "Awesome" via Admin UI)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('What an Awesone God', 'Phil Wickham', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- Who Else
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Who Else', 'Gateway Worship ft Claire Smith', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Ab', null);
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'G', null);

  -- Worthy of it All + Holy Forever
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Worthy of it All + Holy Forever', 'Danny Gokey', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Db', null);

  -- Yes Again
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Yes Again', 'Darlene Zschech', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

  -- Yes Not I But Through Christ In Me
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('Yes Not I But Through Christ In Me', 'CityAlight', 'published', '{}', 'Galatians 2:20')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'C', null);

  -- You Are My Hiding Place
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('You Are My Hiding Place', 'Selah', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'Am', null);

  -- Your Grace is Enough (City Worship)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Your Grace is Enough', 'City Worship', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'E', null);

  -- Your Words Are Wonderful (Psalm 119)
  INSERT INTO songs (title, artist, status, categories, scripture_anchor)
  VALUES ('Your Words Are Wonderful (Psalm 119)', 'Sovereign Grace Music', 'learning',
    ARRAY['call_to_worship', 'thanksgiving'],
    'Psalm 119:18, 129–131')
  RETURNING id INTO s;

  -- Your Grace is Enough (Matt Maher)
  INSERT INTO songs (title, artist, status, categories)
  VALUES ('Your Grace is Enough', 'Matt Maher', 'published', '{}')
  RETURNING id INTO s;
  INSERT INTO chord_charts (song_id, key, file_url) VALUES (s, 'D', null);

END $$;
