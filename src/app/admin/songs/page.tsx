"use client";

import { useMemo, useState, useEffect } from "react";
import { MOCK_SONGS } from "@/lib/mocks/mockSongs";
import type { SongWithCharts } from "@/lib/types/database";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
// using native table markup directly (avoid nested table wrapper)
import { Pagination } from "@/components/ui/Pagination";

const CATEGORIES = [
  "All Categories",
  "assurance_of_grace",
  "call_to_worship",
  "confession_repentance",
  "gospel_salvation",
  "praise_upbeat",
  "thanksgiving",
];

const STATUSES = ["All Statuses", "approved", "new_song_learning"] as const;

const ITEMS_PER_PAGE = 12;

export default function AdminSongsPage() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true";
  const initial = useMock ? MOCK_SONGS : ([] as SongWithCharts[]);

  const [songs, setSongs] = useState<SongWithCharts[]>(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>(CATEGORIES[0]);
  const [filterStatus, setFilterStatus] = useState<string>(STATUSES[0]);
  const [sortField, setSortField] = useState<keyof SongWithCharts>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<SongWithCharts | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<SongWithCharts | null>(null);

  useEffect(() => {
    if (useMock) return; // when using mock data we already seed with MOCK_SONGS above
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/songs');
        if (!res.ok) throw new Error('Failed to fetch songs');
        const data: SongWithCharts[] = await res.json();
        if (!cancelled) setSongs(data);
      } catch (err) {
        console.warn('Could not load /api/songs, keeping local state.', err);
        if (isDev) setSongs(MOCK_SONGS);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return songs.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        q === "" || s.title.toLowerCase().includes(q) || (s.artist ?? "").toLowerCase().includes(q);
      const matchesCategory =
        filterCategory === CATEGORIES[0] || (s.categories ?? []).includes(filterCategory as any);
      const matchesStatus = filterStatus === STATUSES[0] || s.status === filterStatus;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [songs, searchQuery, filterCategory, filterStatus]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = (a[sortField] ?? "") as any;
      const bVal = (b[sortField] ?? "") as any;
      if (sortDirection === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    return arr;
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  function openAdd() {
    setEditing(null);
    setIsEditOpen(true);
  }

  function openEdit(song: SongWithCharts) {
    setEditing(song);
    setIsEditOpen(true);
  }

  function saveSong(payload: Partial<SongWithCharts>) {
    if (editing) {
      setSongs((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...payload } as SongWithCharts : s)));
    } else {
      const newSong: SongWithCharts = {
        id: Date.now().toString(),
        title: (payload.title as string) || "Untitled",
        artist: (payload.artist as string) || null,
        status: (payload.status as any) || "approved",
        categories: (payload.categories as any) || null,
        youtube_url: (payload.youtube_url as any) || null,
        scripture_anchor: (payload.scripture_anchor as any) || null,
        created_at: new Date().toISOString(),
        chord_charts: (payload.chord_charts as any) ?? [],
      };
      setSongs((prev) => [newSong, ...prev]);
    }
    setIsEditOpen(false);
  }

  function confirmDelete() {
    if (!deleting) return;
    setSongs((prev) => prev.filter((s) => s.id !== deleting.id));
    setDeleting(null);
    setIsDeleteOpen(false);
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Song Library</h1>
            <p className="text-sm text-gray-700">Manage worship songs and chord charts</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={openAdd} className="bg-[#071027] text-white px-4 py-2">+ Add Song</Button>
          </div>
        </div>

        <Card className="p-6 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex gap-4 items-center">
            <Input
              className="bg-white border border-gray-200 text-gray-800 placeholder-gray-400"
              placeholder="Search by title or artist..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />

            <div className="w-56">
              <Select className="bg-white border border-gray-200 text-gray-800" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="w-44">
              <Select className="bg-white border border-gray-200 text-gray-800" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            </div>

            <div className="ml-1 text-sm text-gray-700">Showing {filtered.length} of {songs.length} songs</div>

          <div className="mt-4">
            <div className="relative w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs">
                    <th className="px-3 py-2 text-gray-700 font-medium">Title</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Artist</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Status</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Keys</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Scripture</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Video</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Chord Sheet</th>
                    <th className="px-3 py-2 text-gray-700 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={8} className="p-6 text-center text-gray-500">No songs</td></tr>
                  ) : (
                    paginated.map((song) => (
                      <tr key={song.id} className="border-t">
                        <td className="px-3 py-3 font-medium text-gray-800">{song.title}</td>
                        <td className="px-3 py-3 text-gray-800">{song.artist ?? "—"}</td>
                        <td className="px-3 py-3"><Badge>{song.status === 'approved' ? 'Approved' : 'Learning'}</Badge></td>
                        <td className="px-3 py-3 text-gray-800">{(song.chord_charts || []).map((c) => c.key).join(", ") || "—"}</td>
                        <td className="px-3 py-3 text-gray-800">{song.scripture_anchor ?? "—"}</td>
                        <td className="px-3 py-3 text-gray-800">{song.youtube_url ? (
                          <a href={song.youtube_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Video</a>
                        ) : (
                          "—"
                        )}</td>
                        <td className="px-3 py-3 text-gray-800">{(song.chord_charts || []).find((c) => c.file_url) ? (
                          <a href={(song.chord_charts || []).find((c) => c.file_url)!.file_url!} target="_blank" rel="noreferrer" className="text-blue-600 underline">Download</a>
                        ) : (
                          "—"
                        )}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(song)} className="px-3 py-1 text-sm border rounded text-gray-700 bg-white">Edit</button>
                            <button onClick={() => { setDeleting(song); setIsDeleteOpen(true); }} className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">Showing {paginated.length} of {filtered.length}</div>
            <Pagination page={currentPage} total={totalPages} onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))} onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} />
          </div>
        </Card>
      </div>

      {/* Edit / Add Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[900px] max-w-full p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-black">{editing ? "Edit Song" : "Add Song"}</h2>
            <EditForm song={editing} onCancel={() => setIsEditOpen(false)} onSave={(p) => saveSong(p)} />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {isDeleteOpen && deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[420px]">
            <h3 className="font-semibold">Delete Song?</h3>
            <p className="text-sm text-gray-600 mt-2">Are you sure you want to delete "{deleting.title}"? This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setIsDeleteOpen(false); setDeleting(null); }} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={confirmDelete} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditForm({ song, onCancel, onSave }: { song: SongWithCharts | null; onCancel: () => void; onSave: (p: Partial<SongWithCharts>) => void }) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [status, setStatus] = useState<SongWithCharts["status"]>(song?.status ?? "approved");
  const [category, setCategory] = useState<string>((song?.categories && song.categories[0]) ?? "assurance_of_grace");
  const [scripture, setScripture] = useState<string>(song?.scripture_anchor ?? "");
  const [youtube, setYoutube] = useState<string>(song?.youtube_url ?? "");
  const [keys, setKeys] = useState<string>((song?.chord_charts || []).map((c) => c.key).join(", ") ?? "");
  const [chordFile, setChordFile] = useState<File | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1 text-gray-800">Title</label>
          <input className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 placeholder-gray-400" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Artist</label>
          <input className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 placeholder-gray-400" value={artist ?? ""} onChange={(e) => setArtist(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1 text-gray-800">Status</label>
          <select className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="approved">approved</option>
            <option value="new_song_learning">new_song_learning</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-800">Category</label>
          <select className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col items-start">
            <label className="block text-sm mb-1 text-gray-800">Keys (comma separated)</label>
            <input className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 h-12" value={keys} onChange={(e) => setKeys(e.target.value)} />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-sm mb-1 text-gray-800">Scripture</label>
            <input className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 h-12" value={scripture} onChange={(e) => setScripture(e.target.value)} />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-sm mb-1 text-gray-800">Video Ref (YouTube URL)</label>
            <input className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 h-12" value={youtube} onChange={(e) => setYoutube(e.target.value)} />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-sm mb-1 text-gray-800">Upload chord sheet <span className="text-xs text-gray-400">(PDF, PNG, JPG)</span></label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="chord-file-modal"
                className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
              >
                Select file
              </label>
              <input
                id="chord-file-modal"
                type="file"
                accept=".pdf,.png,.jpg"
                className="sr-only"
                onChange={(e) => setChordFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-sm text-gray-600">{chordFile ? chordFile.name : "No file chosen"}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Upload a PDF or image of the chord sheet for performers.</p>
          </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 border border-gray-300 rounded text-gray-700 bg-white">Cancel</button>
        <button
          onClick={() => {
            const chartKeys = keys.split(",").map((k) => k.trim()).filter(Boolean);
            const chord_charts = chartKeys.map((k, i) => ({ id: (Date.now() + i).toString(), song_id: song?.id ?? "new", key: k, file_url: null as string | null, storage_path: null as string | null, created_at: new Date().toISOString() }));
            if (chordFile) {
              // create a temporary object URL for dev preview
              chord_charts[0] = { ...chord_charts[0], file_url: URL.createObjectURL(chordFile) };
            }
            onSave({ title, artist, status, categories: [category as any], scripture_anchor: scripture, youtube_url: youtube, chord_charts });
          }}
          className="px-3 py-1 bg-[#071027] text-white rounded"
        >
          {song ? "Update Song" : "Add Song"}
        </button>
      </div>
    </div>
  );
}
