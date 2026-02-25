
"use client";
import { useMemo, useState, useEffect } from "react";

function useCurrentMember() {
  const [member, setMember] = useState<{ app_role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setMember(data ?? null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { member, loading };
}

import { MOCK_SONGS } from "@/lib/mocks/mockSongs";
import type { SongWithCharts, SongCategory, SongStatus } from "@/lib/types/database";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { SongStatusBadge } from "@/components/status-badge";
// using native table markup directly (avoid nested table wrapper)
import { Pagination } from "@/components/ui/Pagination";

const CATEGORIES = [
  "All Categories",
  "assurance_of_grace",
  "call_to_worship",
  "communion",
  "confession_repentance",
  "adoration_worship",
  "gospel_salvation",
  "praise_upbeat",
  "response_commitment",
  "thanksgiving",
];

const STATUSES = ["All Statuses", "learning", "in_review", "published"] as const;

const ITEMS_PER_PAGE = 20;

const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true";

export default function AdminSongsPage() {
  const { member, loading: memberLoading } = useCurrentMember();
  // canEditSong: can edit existing songs (Admin + Coordinator + MusicCoordinator)
  const canEditSong = !memberLoading && member !== null &&
    member.app_role !== "WorshipLeader";
  // canAddDeleteSong: can add new or delete songs (Admin + Coordinator)
  const canAddDeleteSong = !memberLoading && member !== null &&
    member.app_role !== "WorshipLeader" &&
    member.app_role !== "MusicCoordinator";
  const initial = IS_MOCK ? MOCK_SONGS : ([] as SongWithCharts[]);

  const [songs, setSongs] = useState<SongWithCharts[]>(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>(CATEGORIES[0]);
  const [filterStatus, setFilterStatus] = useState<string>(STATUSES[0]);
  const [sortField] = useState<keyof SongWithCharts>("title");
  const [sortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<SongWithCharts | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<SongWithCharts | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (IS_MOCK) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/songs');
        if (!res.ok) throw new Error('Failed to fetch songs');
        const data: unknown = await res.json();
        if (!cancelled && Array.isArray(data)) setSongs(data as SongWithCharts[]);
      } catch (err) {
        console.warn('Could not load /api/songs, keeping local state.', err);
        if (process.env.NODE_ENV === 'development') setSongs(MOCK_SONGS);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const list = Array.isArray(songs) ? songs : [];
    return list.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        q === "" || s.title.toLowerCase().includes(q) || (s.artist ?? "").toLowerCase().includes(q);
      const matchesCategory =
        filterCategory === CATEGORIES[0] || (s.categories ?? []).includes(filterCategory as SongCategory);
      // normalize legacy status values (internal_approved -> in_review) for UI filtering
      const songStatus = s.status === "internal_approved" ? "in_review" : s.status;
      const matchesStatus = filterStatus === STATUSES[0] || songStatus === filterStatus;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [songs, searchQuery, filterCategory, filterStatus]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = (a[sortField] ?? "") as string | number;
      const bVal = (b[sortField] ?? "") as string | number;
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
    if (!canAddDeleteSong) return;
    setEditing(null);
    setSaveError(null);
    setIsEditOpen(true);
  }

  function openEdit(song: SongWithCharts) {
    if (!canEditSong) return;
    setEditing(song);
    setSaveError(null);
    setIsEditOpen(true);
  }

  async function saveSong(payload: Partial<SongWithCharts>) {
    if (!canEditSong) return;
    // Mock mode: local state only
    if (IS_MOCK) {
      if (editing) {
        setSongs((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...payload } as SongWithCharts : s)));
      } else {
        const newSong: SongWithCharts = {
          id: Date.now().toString(),
          title: payload.title ?? "Untitled",
          artist: payload.artist ?? null,
          status: payload.status ?? "published",
          categories: payload.categories ?? null,
          youtube_url: payload.youtube_url ?? null,
          scripture_anchor: payload.scripture_anchor ?? null,
          created_at: new Date().toISOString(),
          chord_charts: payload.chord_charts ?? [],
        };
        setSongs((prev) => [newSong, ...prev]);
      }
      setIsEditOpen(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const { chord_charts, ...songFields } = payload;
      // Map UI status "in_review" back to DB enum "internal_approved"
      const normalizedFields = {
        ...songFields,
        ...(songFields.status === ("in_review" as string)
          ? { status: "internal_approved" as const }
          : {}),
      };
      const body = { ...normalizedFields, chord_charts };

      if (editing) {
        const res = await fetch(`/api/songs/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update song");
        }
        await res.json();
        // Re-fetch to get joined chord_charts
        const refreshed: unknown = await fetch('/api/songs').then((r) => r.json());
        if (Array.isArray(refreshed)) setSongs(refreshed as SongWithCharts[]);
      } else {
        const res = await fetch('/api/songs', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create song");
        }
        const refreshed: unknown = await fetch('/api/songs').then((r) => r.json());
        if (Array.isArray(refreshed)) setSongs(refreshed as SongWithCharts[]);
      }
      setIsEditOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;

    if (IS_MOCK) {
      setSongs((prev) => prev.filter((s) => s.id !== deleting.id));
      setDeleting(null);
      setIsDeleteOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/songs/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete song");
      }
      setSongs((prev) => prev.filter((s) => s.id !== deleting.id));
      setDeleting(null);
      setIsDeleteOpen(false);
    } catch (err) {
      // Show error inline in the delete dialog
      alert(err instanceof Error ? err.message : "Failed to delete song");
    } finally {
      setIsDeleting(false);
    }
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
            {canAddDeleteSong && (
              <Button onClick={openAdd} className="bg-[#071027] text-white px-4 py-2">+ Add Song</Button>
            )}
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

          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium text-gray-900">{paginated.length}</span> of <span className="font-medium text-gray-900">{filtered.length}</span> song{filtered.length !== 1 ? "s" : ""}
              {songs.length !== filtered.length ? ` (filtered from ${songs.length})` : ""}
              {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ""}
            </div>
            {totalPages > 1 && (
              <Pagination className="" page={currentPage} total={totalPages} onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))} onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} />
            )}
          </div>

          <div className="mt-3">
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
                        <td className="px-3 py-3"><SongStatusBadge status={song.status} /></td>
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
                            {canEditSong && (
                              <button onClick={() => openEdit(song)} className="px-3 py-1 text-sm border rounded text-gray-700 bg-white">Edit</button>
                            )}
                            {canAddDeleteSong && (
                              <button onClick={() => { setDeleting(song); setIsDeleteOpen(true); }} className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded">Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center">
              <Pagination page={currentPage} total={totalPages} onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))} onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="" />
            </div>
          )}

        </Card>
      </div>

      {/* Edit / Add Modal */}
      {isEditOpen && canEditSong && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[900px] max-w-full p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-black">{editing ? "Edit Song" : "Add Song"}</h2>
            {saveError && (
              <div className="mb-4 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">{saveError}</div>
            )}
            <EditForm song={editing} isSaving={isSaving} onCancel={() => setIsEditOpen(false)} onSave={(p) => saveSong(p)} />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {isDeleteOpen && deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[420px]">
            <h3 className="font-semibold">Delete Song?</h3>
          <p className="text-sm text-gray-600 mt-2">Are you sure you want to delete &quot;{deleting.title}&quot;? This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={isDeleting} onClick={() => { setIsDeleteOpen(false); setDeleting(null); }} className="px-3 py-1 border rounded">Cancel</button>
              <button disabled={isDeleting} onClick={confirmDelete} className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50">
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditForm({ song, isSaving, onCancel, onSave }: { song: SongWithCharts | null; isSaving: boolean; onCancel: () => void; onSave: (p: Partial<SongWithCharts>) => void }) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const initialStatus = song?.status === "internal_approved" ? "in_review" : song?.status ?? "published";
  const [status, setStatus] = useState<SongWithCharts["status"]>(initialStatus as SongWithCharts["status"]);
  const [category, setCategory] = useState<string>((song?.categories && song.categories[0]) ?? "assurance_of_grace");
  const [scripture, setScripture] = useState<string>(song?.scripture_anchor ?? "");
  const [youtube, setYoutube] = useState<string>(song?.youtube_url ?? "");
  const [keys, setKeys] = useState<string>((song?.chord_charts || []).map((c) => c.key).join(", ") ?? "");
  // Pre-populate from the first chart's existing file_url (Google Drive / any link)
  const [chordLink, setChordLink] = useState<string>((song?.chord_charts || []).find((c) => c.file_url)?.file_url ?? "");

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
          <select className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800" value={status} onChange={(e) => setStatus(e.target.value as SongStatus)}>
            <option value="learning">New Song – Learning</option>
            <option value="in_review">In Review</option>
            <option value="published">Published</option>
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
            <label className="block text-sm mb-1 text-gray-800">Chord sheet link <span className="text-xs text-gray-400">(Google Drive URL)</span></label>
            <input
              type="url"
              placeholder="https://drive.google.com/…"
              className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 placeholder-gray-400 h-12"
              value={chordLink}
              onChange={(e) => setChordLink(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Paste the Google Drive (or any) link to the chord sheet.</p>
          </div>
      </div>

      <div className="flex justify-end gap-2">
        <button disabled={isSaving} onClick={onCancel} className="px-3 py-1 border border-gray-300 rounded text-gray-700 bg-white disabled:opacity-50">Cancel</button>
        <button
          disabled={isSaving}
          onClick={() => {
            const chartKeys = keys.split(",").map((k) => k.trim()).filter(Boolean);
            const chord_charts = chartKeys.map((k, i) => ({ id: (Date.now() + i).toString(), song_id: song?.id ?? "new", key: k, file_url: null as string | null, storage_path: null as string | null, created_at: new Date().toISOString() }));
            // Attach the chord sheet link to the first key's chart entry
            if (chordLink.trim() && chord_charts[0]) {
              chord_charts[0] = { ...chord_charts[0], file_url: chordLink.trim() };
            }
            onSave({ title, artist, status, categories: [category as SongCategory], scripture_anchor: scripture, youtube_url: youtube, chord_charts });
          }}
          className="px-3 py-1 bg-[#071027] text-white rounded disabled:opacity-50"
        >
          {isSaving ? "Saving..." : song ? "Update Song" : "Add Song"}
        </button>
      </div>
    </div>
  );
}
