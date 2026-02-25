"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getSundaysInMonth, toISODate } from "@/lib/utils/dates";
import { ALL_KEYS } from "@/lib/utils/transpose";
import { SONG_CATEGORIES, CATEGORY_LABEL_MAP } from "@/lib/constants/categories";
import type { SongWithCharts, SetlistSongWithDetails, SongCategory, SongStatus, MemberWithRoles } from "@/lib/types/database";
import { SongStatusBadge, RosterBadge } from "@/components/status-badge";
import styles from "../../styles.module.css";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getUpcomingSundays(count = 8): string[] {
  const today = new Date();
  const todayIso = toISODate(today);
  const sundays: string[] = [];

  // Scan current month + next 2 months
  for (let mOffset = 0; mOffset <= 2 && sundays.length < count; mOffset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + mOffset, 1);
    const monthSundays = getSundaysInMonth(d.getFullYear(), d.getMonth()).map(toISODate);
    for (const iso of monthSundays) {
      if (iso >= todayIso && sundays.length < count) sundays.push(iso);
    }
  }
  return sundays;
}

function formatSundayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function displayKey(row: SetlistSongWithDetails): string {
  return row.chosen_key ?? row.song?.chord_charts?.[0]?.key ?? "—";
}

// ─────────────────────────────────────────────
// Current member hook
// ─────────────────────────────────────────────

function useCurrentMember() {
  const [member, setMember] = useState<MemberWithRoles | null>(null);
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
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  return { member, loading };
}

// ─────────────────────────────────────────────
// Song Picker Modal
// ─────────────────────────────────────────────

const ITEMS_PER_PAGE = 5;

type StatusFilter = SongStatus | "all";

const STATUS_QUICK_FILTERS: Array<{
  value: StatusFilter;
  label: string;
  activeClass: string;
  inactiveClass: string;
}> = [
  {
    value: "all",
    label: "All",
    activeClass: "bg-gray-900 text-white border-gray-900",
    inactiveClass: "bg-white text-gray-600 border-gray-300 hover:border-gray-500",
  },
  {
    value: "learning",
    label: "🎓 Learning",
    activeClass: "bg-orange-500 text-white border-orange-500",
    inactiveClass: "bg-white text-orange-600 border-orange-300 hover:border-orange-400",
  },
  {
    value: "published",
    label: "Published",
    activeClass: "bg-green-600 text-white border-green-600",
    inactiveClass: "bg-white text-green-600 border-green-300 hover:border-green-400",
  },
  {
    value: "internal_approved",
    label: "In Review",
    activeClass: "bg-blue-200 text-blue-800 border-blue-200",
    inactiveClass: "bg-white text-blue-600 border-blue-200 hover:border-blue-400",
  },
];

interface SongPickerModalProps {
  open: boolean;
  maxPicks: number; // how many more slots are free
  existingIds: Set<string>; // song IDs already in setlist
  onClose: () => void;
  onConfirm: (songs: SongWithCharts[]) => void;
}

function SongPickerModal({ open, maxPicks, existingIds, onClose, onConfirm }: SongPickerModalProps) {
  const [songs, setSongs] = useState<SongWithCharts[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<SongCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Load songs when opened
  useEffect(() => {
    if (!open) return;

    async function load() {
      setPicked(new Set());
      setSearch("");
      setCategoryFilter("all");
      setStatusFilter("all");
      setPage(1);
      setLoadingSongs(true);
      try {
        const r = await fetch("/api/songs?scope=portal");
        const data: unknown = r.ok ? await r.json() : [];
        setSongs(Array.isArray(data) ? (data as SongWithCharts[]) : []);
      } catch {
        // ignore — list stays empty
      } finally {
        setLoadingSongs(false);
      }
    }

    load();
  }, [open]);

  const filtered = useMemo(() => {
    return songs.filter((s) => {
      const matchSearch =
        search === "" ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.artist?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchCat =
        categoryFilter === "all" || (s.categories?.includes(categoryFilter) ?? false);
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [songs, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page]
  );

  function togglePick(song: SongWithCharts) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(song.id)) {
        next.delete(song.id);
      } else if (next.size < maxPicks) {
        next.add(song.id);
      }
      return next;
    });
  }

  function handleConfirm() {
    const selected = songs.filter((s) => picked.has(s.id));
    onConfirm(selected);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pick Songs</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {picked.size === 0
                ? `Choose up to ${maxPicks} song${maxPicks !== 1 ? "s" : ""}`
                : `${picked.size} / ${maxPicks} selected`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-6 py-3 space-y-2 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search by title or artist…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`${styles.inputDarkText} w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900`}
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as SongCategory | "all"); setPage(1); }}
            className={`${styles.selectDarkText} w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
          >
            <option value="all">All Categories</option>
            {SONG_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* Status quick-filter chips */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {STATUS_QUICK_FILTERS.map(({ value, label, activeClass, inactiveClass }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setStatusFilter(value); setPage(1); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === value ? activeClass : inactiveClass
                }`}
                aria-pressed={statusFilter === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Song list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
          {loadingSongs && (
            <p className="text-sm text-gray-400 text-center py-8">Loading songs…</p>
          )}
          {!loadingSongs && paginated.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No songs match your search.</p>
          )}
          {!loadingSongs && paginated.map((song) => {
            const alreadyInSetlist = existingIds.has(song.id);
            const isPicked = picked.has(song.id);
            const isDisabled = alreadyInSetlist || (!isPicked && picked.size >= maxPicks);
            const chartsWithFiles = song.chord_charts?.filter((c) => c.file_url) ?? [];

            return (
              <div
                key={song.id}
                onClick={() => !isDisabled && togglePick(song)}
                className={`rounded-xl border-2 p-4 transition-all ${
                  alreadyInSetlist
                    ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                    : isPicked
                    ? "border-indigo-500 bg-indigo-50 cursor-pointer"
                    : isDisabled
                    ? "border-gray-200 bg-white opacity-50 cursor-not-allowed"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer"
                }`}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Checkbox indicator */}
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        alreadyInSetlist
                          ? "border-gray-300 bg-gray-100 text-gray-400"
                          : isPicked
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {(alreadyInSetlist || isPicked) && "✓"}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">
                      {song.title}
                      {alreadyInSetlist && (
                        <span className="ml-2 text-xs font-normal text-gray-400">Already added</span>
                      )}
                    </h3>
                  </div>
                  <div className="flex-shrink-0">
                    <SongStatusBadge status={song.status} />
                  </div>
                </div>

                {/* Artist + Categories */}
                {(song.artist || (song.categories && song.categories.length > 0)) && (
                  <div className="flex items-center justify-between mb-1 ml-7">
                    <span className="text-xs text-gray-400 mr-2">{song.artist}</span>
                    {song.categories && song.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {song.categories.map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                          >
                            {CATEGORY_LABEL_MAP[cat] || cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Scripture anchor */}
                {song.scripture_anchor && (
                  <p className="text-xs text-gray-500 ml-7 mb-2 flex items-center gap-1">
                    <span>📖</span> {song.scripture_anchor}
                  </p>
                )}

                {/* Chord charts */}
                {(song.chord_charts?.length ?? 0) > 0 && (
                  <div className="ml-7 mt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <span>🎸</span> Chord Charts
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-gray-500">
                        {song.chord_charts.length === 1 ? "Key:" : "Keys:"}
                      </span>
                      {song.chord_charts.map((chart) =>
                        chart.file_url ? (
                          <a
                            key={chart.id}
                            href={chart.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                            title={`View chord chart — Key of ${chart.key}`}
                          >
                            {chart.key}
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 opacity-60" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" strokeWidth="2.5"
                              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        ) : (
                          <span
                            key={chart.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-gray-50 text-gray-300 border border-gray-100"
                            title={`Key of ${chart.key} — no file uploaded`}
                          >
                            {chart.key}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* YouTube link */}
                {song.youtube_url && (
                  <a
                    href={song.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors mt-2 ml-7"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                      fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch on YouTube
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-2 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={picked.size === 0}
            className="px-5 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {picked.size === 0
              ? "Select songs to add"
              : `Add ${picked.size} song${picked.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

interface RosterAssignmentRaw {
  id: string;
  date: string;
  role: { id: number; name: string } | null;
  member: { id: string; name: string } | null;
}

export default function AdminSetlistPage() {
  const upcomingSundays = useMemo(() => getUpcomingSundays(8), []);
  const [selectedDate, setSelectedDate] = useState<string>(upcomingSundays[0] ?? "");

  // ── Current user ─────────────────────────────
  const { member: currentMember, loading: memberLoading } = useCurrentMember();

  // ── Setlist ──────────────────────────────────
  const [setlistRows, setSetlistRows] = useState<SetlistSongWithDetails[]>([]);
  const [loadingSetlist, setLoadingSetlist] = useState(false);
  const [setlistError, setSetlistError] = useState<string | null>(null);

  // ── Worship lead ─────────────────────────────
  const [worshipLeadName, setWorshipLeadName] = useState<string | null>(null);
  const [worshipLeadMemberId, setWorshipLeadMemberId] = useState<string | null>(null);

  // ── My WL dates (all upcoming Sundays where I'm the rostered WL) ────────
  // Fetched once per session (or when member identity changes).
  // Used to mark option labels in the Sunday selector.
  const [myWLDates, setMyWLDates] = useState<Set<string>>(new Set());

  // ── Song picker modal ────────────────────────
  const [showPicker, setShowPicker] = useState(false);

  // ── Mutation state ───────────────────────────
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // ── Inline key editing ───────────────────────
  const [editingKeyFor, setEditingKeyFor] = useState<string | null>(null); // row id

  // ── Publish / revert ─────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [reverting, setReverting] = useState(false);

  // ── Drag reorder ──────────────────────────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  // ─────────────────────────────────────────────
  // Fetch setlist for selected date
  // ─────────────────────────────────────────────
  const fetchSetlist = useCallback(async () => {
    if (!selectedDate) return;
    setLoadingSetlist(true);
    setSetlistError(null);
    try {
      const res = await fetch(`/api/setlist?date=${selectedDate}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load setlist");
      const data: unknown = await res.json();
      setSetlistRows(Array.isArray(data) ? (data as SetlistSongWithDetails[]) : []);
    } catch (e) {
      setSetlistError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoadingSetlist(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchSetlist(); }, [fetchSetlist]);

  // ─────────────────────────────────────────────
  // Bulk-fetch WL assignments for all upcoming months so we can mark the
  // Sunday dropdown with ⭐ for dates where the current user is the WL.
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentMember) return;
    const memberId = currentMember.id;

    const months = [...new Set(upcomingSundays.map((d) => d.slice(0, 7)))];

    async function loadMyWLDates() {
      try {
        const results = await Promise.all(
          months.map(async (month) => {
            const res = await fetch(`/api/roster?month=${month}`, { cache: "no-store" });
            if (!res.ok) return [] as RosterAssignmentRaw[];
            const json = await res.json();
            return (Array.isArray(json.assignments) ? json.assignments : []) as RosterAssignmentRaw[];
          })
        );
        const allAssignments = results.flat();
        const dates = new Set(
          allAssignments
            .filter(
              (a) =>
                (typeof a.role === "string"
                  ? a.role === "worship_lead"
                  : a.role?.name === "worship_lead") &&
                a.member?.id === memberId
            )
            .map((a) => a.date)
        );
        setMyWLDates(dates);
      } catch {
        // ignore — indicator simply won't appear
      }
    }

    loadMyWLDates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMember?.id]);

  // ─────────────────────────────────────────────
  // Fetch worship lead name for selected date
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDate) return;
    const month = selectedDate.slice(0, 7); // YYYY-MM

    async function load() {
      try {
        const res = await fetch(`/api/roster?month=${month}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const assignments: RosterAssignmentRaw[] = Array.isArray(json.assignments)
          ? json.assignments
          : [];
        const wlAssignment = assignments.find(
          (a) =>
            a.date === selectedDate &&
            (typeof a.role === "string"
              ? a.role === "worship_lead"
              : a.role?.name === "worship_lead")
        );
        setWorshipLeadName(wlAssignment?.member?.name ?? null);
        setWorshipLeadMemberId(wlAssignment?.member?.id ?? null);
      } catch {
        setWorshipLeadName(null);
        setWorshipLeadMemberId(null);
      }
    }

    load();
  }, [selectedDate]);

  // ─────────────────────────────────────────────
  // Derived: existing song IDs + free slot count
  // ─────────────────────────────────────────────
  const existingIds = useMemo(
    () => new Set(setlistRows.map((r) => r.song_id)),
    [setlistRows]
  );
  const freeSlots = 3 - setlistRows.length;

  // ─────────────────────────────────────────────
  // Add songs (from modal)
  // ─────────────────────────────────────────────
  async function handleAddSongs(songs: SongWithCharts[]) {
    setShowPicker(false);
    setSaving(true);
    setMutationError(null);
    try {
      // Assign to the next empty positions
      const usedPositions = new Set(setlistRows.map((r) => r.position));
      const freePositions = [1, 2, 3].filter((p) => !usedPositions.has(p));
      await Promise.all(
        songs.slice(0, freePositions.length).map((song, i) =>
          fetch("/api/setlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sunday_date: selectedDate,
              song_id: song.id,
              position: freePositions[i],
              chosen_key: song.chord_charts?.[0]?.key ?? null,
            }),
          })
        )
      );
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to add songs");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Delete one song
  // ─────────────────────────────────────────────
  async function handleDeleteOne(id: string) {
    setSaving(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/setlist/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to delete song");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Delete all songs
  // ─────────────────────────────────────────────
  async function handleDeleteAll() {
    if (!confirm("Remove all songs from this setlist?")) return;
    setSaving(true);
    setMutationError(null);
    try {
      await Promise.all(
        setlistRows.map((r) =>
          fetch(`/api/setlist/${r.id}`, { method: "DELETE" })
        )
      );
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to delete songs");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Change key for a song (upsert with new chosen_key)
  // ─────────────────────────────────────────────
  async function handleKeyChange(row: SetlistSongWithDetails, newKey: string) {
    setEditingKeyFor(null);
    setSaving(true);
    setMutationError(null);
    try {
      const res = await fetch("/api/setlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sunday_date: row.sunday_date,
          song_id: row.song_id,
          position: row.position,
          chosen_key: newKey,
        }),
      });
      if (!res.ok) throw new Error("Key update failed");
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to update key");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Publish setlist
  // ─────────────────────────────────────────────
  async function handlePublish() {
    if (!confirm("Finalise this setlist? Musicians will be able to see it.")) return;
    setPublishing(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/setlist/${selectedDate}/publish`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to publish setlist");
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  // ─────────────────────────────────────────────
  // Revert setlist to DRAFT
  // ─────────────────────────────────────────────
  async function handleRevert() {
    if (!confirm("Revert to Draft? This will hide the setlist from musicians.")) return;
    setReverting(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/setlist/${selectedDate}/revert`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to revert setlist");
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to revert");
    } finally {
      setReverting(false);
    }
  }

  // ─────────────────────────────────────────────
  // Sorted setlist (by position)
  // ─────────────────────────────────────────────
  const sortedRows = useMemo(
    () => [...setlistRows].sort((a, b) => a.position - b.position),
    [setlistRows]
  );

  const isPublished =
    sortedRows.length > 0 && sortedRows.every((r) => r.status === "PUBLISHED");

  // ─────────────────────────────────────────────
  // Display order (live swap while dragging)
  // ─────────────────────────────────────────────
  const displayRows = useMemo(() => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) return sortedRows;
    const result = [...sortedRows];
    const fromIdx = result.findIndex((r) => r.id === draggedId);
    const toIdx = result.findIndex((r) => r.id === dragOverId);
    if (fromIdx === -1 || toIdx === -1) return sortedRows;
    const [moved] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, moved);
    return result;
  }, [sortedRows, draggedId, dragOverId]);

  // ─────────────────────────────────────────────
  // Persist new position order
  // ─────────────────────────────────────────────
  async function handleReorder(newOrder: SetlistSongWithDetails[]) {
    setReordering(true);
    setMutationError(null);
    try {
      await Promise.all(
        newOrder.map((row, i) => {
          const newPos = i + 1;
          if (row.position === newPos) return Promise.resolve();
          return fetch("/api/setlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sunday_date: row.sunday_date,
              song_id: row.song_id,
              position: newPos,
              chosen_key: row.chosen_key ?? row.song?.chord_charts?.[0]?.key ?? null,
            }),
          });
        })
      );
      await fetchSetlist();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to reorder songs");
    } finally {
      setReordering(false);
    }
  }

  // ─────────────────────────────────────────────
  // Edit permission
  // MusicCoordinator and WorshipLeader can only edit if they are the assigned
  // worship lead for this Sunday. Admin and Coordinator always have edit access.
  // Default to false (restrictive) while loading.
  // ─────────────────────────────────────────────
  const isWorshipLeadRole =
    currentMember?.app_role === "WorshipLeader" ||
    currentMember?.app_role === "MusicCoordinator";

  const canEdit =
    !memberLoading &&
    currentMember !== null &&
    (currentMember.app_role === "Admin" ||
      currentMember.app_role === "Coordinator" ||
      (isWorshipLeadRole &&
        currentMember.id === worshipLeadMemberId));

  const isViewOnlyWL =
    !memberLoading &&
    isWorshipLeadRole &&
    !canEdit;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Setlist</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Select songs for each Sunday service
        </p>
      </div>

      {/* Sunday selector */}
      <div>
        <select
          aria-label="Service date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={`${styles.selectDarkText} w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
        >
          {upcomingSundays.map((iso) => (
            <option key={iso} value={iso}>
              {myWLDates.has(iso) ? `⭐ ${formatSundayLabel(iso)}` : formatSundayLabel(iso)}
            </option>
          ))}
        </select>

        {/* Contextual pill — shown when the selected Sunday is one the user is leading */}
        {myWLDates.has(selectedDate) && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
            <span aria-hidden="true">⭐</span>
            You are the Worship Lead for that Sunday
          </p>
        )}
      </div>

      {/* Setlist card */}
      <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
        {/* Card header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {selectedDate === upcomingSundays[0] && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                THIS WEEK
              </span>
            )}
            {sortedRows.length > 0 && (
              <RosterBadge status={isPublished ? "LOCKED" : "DRAFT"} />
            )}
          </div>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {selectedDate
              ? new Date(selectedDate + "T12:00:00Z").toLocaleDateString("en-AU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
          {worshipLeadName && (
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-medium">Worship Lead:</span> {worshipLeadName}
            </p>
          )}
          {isViewOnlyWL && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 max-w-xs">
              You are not the Worship Lead for this Sunday. View only.
            </p>
          )}
        </div>

        {/* Songs list */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              🎵 Setlist
            </span>
            <div className="flex-1 h-px bg-gray-100" />
            {freeSlots > 0 && (
              <span className="text-xs text-gray-400">
                {setlistRows.length} / 3
              </span>
            )}
          </div>

          {loadingSetlist && (
            <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
          )}

          {!loadingSetlist && setlistError && (
            <p className="text-sm text-red-500 py-2">{setlistError}</p>
          )}

          {mutationError && (
            <p className="text-sm text-red-500 py-1">{mutationError}</p>
          )}

          {/* Filled slots */}
          {!loadingSetlist && displayRows.map((row) => {
            const key = displayKey(row);
            const isEditingKey = editingKeyFor === row.id;
            const youtubeUrl = row.song?.youtube_url;
            const isDragging = draggedId === row.id;
            const isDragOver = dragOverId === row.id && draggedId !== row.id;

            return (
              <div
                key={row.id}
                draggable={canEdit && !isEditingKey}
                onDragStart={() => { setDraggedId(row.id); setDragOverId(row.id); }}
                onDragOver={(e) => { e.preventDefault(); if (draggedId) setDragOverId(row.id); }}
                onDragEnd={() => {
                  if (draggedId && dragOverId && draggedId !== dragOverId) {
                    handleReorder(displayRows);
                  }
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  isDragging
                    ? "border-indigo-300 bg-indigo-50 opacity-50 shadow-lg"
                    : isDragOver
                    ? "border-indigo-400 bg-indigo-50/50 shadow-md"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                {/* Drag handle — only for editors */}
                {canEdit && (
                  <div
                    className="flex-shrink-0 flex flex-col items-center justify-center h-6 mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none"
                    title="Drag to reorder"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                )}

                {/* Song details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">
                    {row.song?.title ?? "Unknown"}
                  </p>
                  {row.song?.artist && (
                    <p className="text-xs text-gray-500">Artist: {row.song.artist}</p>
                  )}

                  {/* Key row */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {isEditingKey ? (
                      <div className="flex items-center gap-2">
                        <select
                          autoFocus
                          className={`${styles.selectDarkText} px-2 py-1 rounded-lg border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
                          defaultValue={key}
                          onChange={(e) => handleKeyChange(row, e.target.value)}
                          onBlur={() => setEditingKeyFor(null)}
                        >
                          {ALL_KEYS.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingKeyFor(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                          Key of {key}
                        </span>
                        {canEdit && (
                        <button
                          onClick={() => setEditingKeyFor(row.id)}
                          disabled={saving}
                          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-40"
                        >
                          Change Key
                        </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* YouTube link */}
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 mt-1"
                    >
                      <span>▶</span> Watch on YouTube
                    </a>
                  )}
                </div>

                {/* Delete button — only for editors */}
                {canEdit && (
                <button
                  onClick={() => handleDeleteOne(row.id)}
                  disabled={saving}
                  className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  aria-label={`Remove ${row.song?.title ?? "song"}`}
                  title="Remove"
                >
                  ✕
                </button>
                )}
              </div>
            );
          })}

          {/* Empty slots — only shown to editors */}
          {!loadingSetlist && canEdit && Array.from({ length: freeSlots }).map((_, i) => {
            const position = setlistRows.length + i + 1;
            return (
              <div
                key={`empty-${position}`}
                className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400"
              >
                <span className="text-sm italic">Empty slot</span>
              </div>
            );
          })}

          {/* Add songs button — only when slots are free and user can edit */}
          {!loadingSetlist && freeSlots > 0 && canEdit && (
            <button
              onClick={() => setShowPicker(true)}
              disabled={saving}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-sm font-medium transition-colors disabled:opacity-40"
            >
              <span className="text-lg leading-none">+</span>
              Click to add song{freeSlots > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

          {/* Bottom action buttons — matches roster page layout */}
      {canEdit && (
        <div className="flex justify-end gap-2 mt-4">
          {sortedRows.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={saving || reordering || isPublished}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear all
            </button>
          )}
          {isPublished ? (
            <button
              onClick={handleRevert}
              disabled={reverting || saving || reordering}
              className="px-4 py-2 rounded-lg text-sm text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {reverting ? "Reverting..." : "Revert to Draft"}
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing || saving || reordering || sortedRows.length === 0}
              className="px-4 py-2 rounded-lg text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? "Finalising..." : "\u2713 Finalise"}
            </button>
          )}
        </div>
      )}

      {/* Song Picker Modal */}
      <SongPickerModal
        open={showPicker}
        maxPicks={freeSlots}
        existingIds={existingIds}
        onClose={() => setShowPicker(false)}
        onConfirm={handleAddSongs}
      />
    </div>
  );
}
