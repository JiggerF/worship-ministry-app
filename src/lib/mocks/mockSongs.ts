import type { SongWithCharts } from "@/lib/types/database";

export const MOCK_SONGS: SongWithCharts[] = [
  {
    id: "sg1",
    title: "How Great Is Our God",
    artist: "Chris Tomlin",
    status: "approved",
    categories: ["call_to_worship"],
    youtube_url: "https://youtube.com/watch?v=example1",
    scripture_anchor: "Psalm 148; Revelation 5:13",
    created_at: "",
    chord_charts: [
      { id: "cc1", song_id: "sg1", key: "C", file_url: "https://docs.google.com/document/example1", storage_path: null, created_at: "" },
      { id: "cc1b", song_id: "sg1", key: "G", file_url: "https://docs.google.com/document/example1b", storage_path: null, created_at: "" },
    ],
  },
  {
    id: "sg2",
    title: "10,000 Reasons",
    artist: "Matt Redman",
    status: "approved",
    categories: ["praise_upbeat", "thanksgiving"],
    youtube_url: "https://youtube.com/watch?v=example2",
    scripture_anchor: "Psalm 103:1-5",
    created_at: "",
    chord_charts: [
      { id: "cc2", song_id: "sg2", key: "G", file_url: "https://docs.google.com/document/example2", storage_path: null, created_at: "" },
    ],
  },
  {
    id: "sg3",
    title: "Build My Life",
    artist: "Pat Barrett",
    status: "approved",
    categories: ["gospel_salvation"],
    youtube_url: "https://youtube.com/watch?v=example3",
    scripture_anchor: null,
    created_at: "",
    chord_charts: [
      { id: "cc3", song_id: "sg3", key: "D", file_url: null, storage_path: null, created_at: "" },
      { id: "cc3b", song_id: "sg3", key: "E", file_url: null, storage_path: null, created_at: "" },
    ],
  },
  {
    id: "sg4",
    title: "All I Have Is Christ",
    artist: "Sovereign Grace Music",
    status: "new_song_learning",
    categories: ["assurance_of_grace", "gospel_salvation"],
    youtube_url: "https://youtube.com/watch?v=example4",
    scripture_anchor: "Romans 3–8, Ephesians 2:1–10, and Titus 3:3–7",
    created_at: "",
    chord_charts: [
      { id: "cc4", song_id: "sg4", key: "B", file_url: "https://docs.google.com/document/example4", storage_path: null, created_at: "" },
    ],
  },
  {
    id: "sg5",
    title: "His Mercy Is More",
    artist: "Sovereign Grace Music",
    status: "new_song_learning",
    categories: ["confession_repentance"],
    youtube_url: "https://youtube.com/watch?v=example5",
    scripture_anchor: "Psalm 103:8–12; Lamentations 3:22–23",
    created_at: "",
    chord_charts: [],
  },
  {
    id: "sg6",
    title: "Above All",
    artist: "Michael Smith",
    status: "approved",
    categories: null,
    youtube_url: null,
    scripture_anchor: null,
    created_at: "",
    chord_charts: [
      { id: "cc6", song_id: "sg6", key: "D", file_url: null, storage_path: null, created_at: "" },
    ],
  },
];

export default MOCK_SONGS;
