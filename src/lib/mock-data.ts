import type {
  SundayRoster,
  SongWithCharts,
} from "@/lib/types/database";

// Mock roster data for development
export const MOCK_ROSTER: SundayRoster[] = [
  {
    date: "2026-02-15",
    status: "LOCKED",
    notes: null,
    assignments: [
      { id: "1", member_id: "m1", date: "2026-02-15", role_id: 1, role: { id: 1, name: "worship_lead" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m1", name: "John Moore" } },
      { id: "2", member_id: "m2", date: "2026-02-15", role_id: 2, role: { id: 2, name: "backup_vocals_1" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m2", name: "Sarah Johnson" } },
      { id: "3", member_id: "m3", date: "2026-02-15", role_id: 4, role: { id: 4, name: "acoustic_guitar" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m3", name: "David Chen" } },
      { id: "4", member_id: "m4", date: "2026-02-15", role_id: 7, role: { id: 7, name: "keyboard" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m4", name: "Emily Rodriguez" } },
      { id: "5", member_id: "m5", date: "2026-02-15", role_id: 8, role: { id: 8, name: "drums" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m5", name: "Michael Thompson" } },
      { id: "6", member_id: "m6", date: "2026-02-15", role_id: 6, role: { id: 6, name: "bass" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m6", name: "Chris Martinez" } },
    ],
    setlist: [
      { id: "s1", sunday_date: "2026-02-15", song_id: "sg1", position: 1, chosen_key: "C", status: "PUBLISHED" as const, created_by: null, created_at: "", updated_at: "", song: { id: "sg1", title: "How Great Is Our God", artist: "Chris Tomlin", status: "published", categories: ["call_to_worship"], youtube_url: "https://youtube.com/watch?v=example1", scripture_anchor: null, created_at: "", chord_charts: [{ id: "cc1", song_id: "sg1", key: "C", file_url: null, storage_path: null, created_at: "" }] } },
      { id: "s2", sunday_date: "2026-02-15", song_id: "sg2", position: 2, chosen_key: "G", status: "PUBLISHED" as const, created_by: null, created_at: "", updated_at: "", song: { id: "sg2", title: "10,000 Reasons", artist: "Matt Redman", status: "published", categories: ["praise_upbeat"], youtube_url: "https://youtube.com/watch?v=example2", scripture_anchor: null, created_at: "", chord_charts: [{ id: "cc2", song_id: "sg2", key: "G", file_url: null, storage_path: null, created_at: "" }] } },
      { id: "s3", sunday_date: "2026-02-15", song_id: "sg3", position: 3, chosen_key: "D", status: "PUBLISHED" as const, created_by: null, created_at: "", updated_at: "", song: { id: "sg3", title: "Build My Life", artist: "Pat Barrett", status: "published", categories: ["gospel_salvation"], youtube_url: "https://youtube.com/watch?v=example3", scripture_anchor: null, created_at: "", chord_charts: [{ id: "cc3", song_id: "sg3", key: "D", file_url: null, storage_path: null, created_at: "" }] } },
    ],
  },
  {
    date: "2026-02-22",
    status: "LOCKED",
    notes: "Communion Sunday",
    assignments: [
      { id: "7", member_id: "m7", date: "2026-02-22", role_id: 1, role: { id: 1, name: "worship_lead" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m7", name: "James Taylor" } },
      { id: "8", member_id: "m2", date: "2026-02-22", role_id: 2, role: { id: 2, name: "backup_vocals_1" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m2", name: "Peter Patter" } },
      { id: "9", member_id: "m8", date: "2026-02-22", role_id: 5, role: { id: 5, name: "electric_guitar" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m8", name: "Peter Morris" } },
      { id: "10", member_id: "m4", date: "2026-02-22", role_id: 7, role: { id: 7, name: "keyboard" }, status: "LOCKED", assigned_by: null, assigned_at: "", locked_at: "", member: { id: "m4", name: "Mango" } },
    ],
    setlist: [],
  },
  {
    date: "2026-03-01",
    status: "DRAFT",
    notes: null,
    assignments: [
      { id: "11", member_id: "m1", date: "2026-03-01", role_id: 1, role: { id: 1, name: "worship_lead" }, status: "DRAFT", assigned_by: null, assigned_at: "", locked_at: null, member: { id: "m1", name: "John Moore" } },
      { id: "12", member_id: "m3", date: "2026-03-01", role_id: 4, role: { id: 4, name: "acoustic_guitar" }, status: "DRAFT", assigned_by: null, assigned_at: "", locked_at: null, member: { id: "m3", name: "David Chen" } },
    ],
    setlist: [],
  },
  {
    date: "2026-03-08",
    status: "DRAFT",
    notes: "Youth-led service",
    assignments: [],
    setlist: [],
  },
];

// Mock songs for Song Pool page
export const MOCK_SONGS: SongWithCharts[] = [
  {
    id: "sg1",
    title: "How Great Is Our God",
    artist: "Chris Tomlin",
    status: "published",
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
    status: "published",
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
    status: "published",
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
    status: "learning",
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
    status: "learning",
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
    status: "published",
    categories: null,
    youtube_url: null,
    scripture_anchor: null,
    created_at: "",
    chord_charts: [
      { id: "cc6", song_id: "sg6", key: "D", file_url: null, storage_path: null, created_at: "" },
    ],
  },
];

export const MOCK_USER = {
  email: "0@0.com",
  password: "0",
}
