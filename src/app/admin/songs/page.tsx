
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

const STATUS_LABELS: Record<string, string> = {
  "All Statuses": "All Statuses",
  learning: "Learning",
  in_review: "In Review",
  published: "Published",
};

// Display order: In Review → Learning → Published
const STATUSES_ORDERED = ["All Statuses", "in_review", "learning", "published"] as const;

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

  // Counts across ALL songs (unaffected by current filters) for the quick-stats bar
  const statusCounts = useMemo(() => {
    const list = Array.isArray(songs) ? songs : [];
    return list.reduce(
      (acc, s) => {
        const normalized = s.status === "internal_approved" ? "in_review" : s.status;
        if (normalized === "published") acc.published++;
        else if (normalized === "learning") acc.learning++;
        else if (normalized === "in_review") acc.in_review++;
        return acc;
      },
      { published: 0, learning: 0, in_review: 0 }
    );
  }, [songs]);

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
            <h1 className="text-2xl font-bold text-gray-900">Song Manager</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage worship songs and chord charts</p>
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
                {STATUSES_ORDERED.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            </div>

          {/* Quick-stats bar */}
          <div className="flex items-center gap-1.5 mt-4 text-sm text-gray-600">
            {([
              { label: "In Review", key: "in_review", count: statusCounts.in_review, color: "text-purple-700" },
              { label: "Learning", key: "learning", count: statusCounts.learning, color: "text-blue-700" },
              { label: "Published", key: "published", count: statusCounts.published, color: "text-green-700" },
            ] as const).map(({ label, key, count, color }, i) => (
              <span key={key} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300 select-none">|</span>}
                <button
                  type="button"
                  onClick={() => { setFilterStatus(key); setCurrentPage(1); }}
                  className={`underline underline-offset-2 font-medium hover:opacity-70 transition-opacity ${
                    filterStatus === key ? "opacity-100" : "opacity-80"
                  } ${color}`}
                >
                  {label} ({count})
                </button>
              </span>
            ))}
            {filterStatus !== STATUSES[0] && (
              <button
                type="button"
                onClick={() => { setFilterStatus(STATUSES[0]); setCurrentPage(1); }}
                className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
              >
                Clear filter
              </button>
            )}
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
                      <tr key={song.id} className="border-t border-gray-200">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? "Edit Song" : "Add Song"}</h2>
            </div>
            {saveError && (
              <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{saveError}</div>
            )}
            <div className="px-6 py-5">
              <EditForm song={editing} isSaving={isSaving} onCancel={() => setIsEditOpen(false)} onSave={(p) => saveSong(p)} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {isDeleteOpen && deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Delete Song?</h3>
            <p className="text-sm text-gray-600 mt-2">Are you sure you want to delete &quot;{deleting.title}&quot;? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => { setIsDeleteOpen(false); setDeleting(null); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg border border-red-300 text-sm text-red-600 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Delete"}
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
    <div className="space-y-5">
      {/* Row 1: Title + Artist */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
          <input
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Song title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Artist</label>
          <input
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Artist name"
            value={artist ?? ""}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Status + Category + Keys */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
          <select
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={status}
            onChange={(e) => setStatus(e.target.value as SongStatus)}
          >
            <option value="in_review">In Review</option>
            <option value="learning">Learning</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <select
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Keys <span className="text-gray-400 font-normal">(comma separated)</span></label>
          <input
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. G, A, B♭"
            value={keys}
            onChange={(e) => setKeys(e.target.value)}
          />
        </div>
      </div>

      {/* Row 3: Scripture + YouTube + Chord sheet */}
      <div className="grid grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Scripture</label>
          <input
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. Psalm 100:1–5"
            value={scripture}
            onChange={(e) => setScripture(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Video <span className="text-gray-400 font-normal">(YouTube URL)</span></label>
          <input
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="https://youtu.be/…"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Chord sheet <span className="text-gray-400 font-normal">(Google Drive URL)</span></label>
          <input
            type="url"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="https://drive.google.com/…"
            value={chordLink}
            onChange={(e) => setChordLink(e.target.value)}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          disabled={isSaving}
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          disabled={isSaving}
          onClick={() => {
            const chartKeys = keys.split(",").map((k) => k.trim()).filter(Boolean);
            const chord_charts = chartKeys.map((k, i) => ({ id: (Date.now() + i).toString(), song_id: song?.id ?? "new", key: k, file_url: null as string | null, storage_path: null as string | null, created_at: new Date().toISOString() }));
            if (chordLink.trim() && chord_charts[0]) {
              chord_charts[0] = { ...chord_charts[0], file_url: chordLink.trim() };
            }
            onSave({ title, artist, status, categories: [category as SongCategory], scripture_anchor: scripture, youtube_url: youtube, chord_charts });
          }}
          className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : song ? "Update Song" : "Add Song"}
        </button>
      </div>
    </div>
  );
}
