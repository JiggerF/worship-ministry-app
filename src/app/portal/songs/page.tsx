"use client";

import { useState, useEffect, useMemo } from "react";
import { SongCard } from "@/components/song-card";
import { MOCK_SONGS } from "@/lib/mocks/mockSongs";
import { SONG_CATEGORIES } from "@/lib/constants/categories";
import type { SongStatus, SongCategory, SongWithCharts } from "@/lib/types/database";
import styles from '../../styles.module.css';

const STATUS_OPTIONS: { value: SongStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Approved" },
  { value: "learning", label: "New Song – Learning" },
];

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true";
const ITEMS_PER_PAGE = 10;

export default function SongPoolPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SongStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<SongCategory | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [songs, setSongs] = useState<SongWithCharts[]>(USE_MOCK ? MOCK_SONGS : []);

  useEffect(() => {
    if (USE_MOCK) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/songs?scope=portal');
        if (!res.ok) throw new Error('Failed to fetch songs');
        const data: unknown = await res.json();
        if (!cancelled && Array.isArray(data)) setSongs(data as SongWithCharts[]);
      } catch (err) {
        console.warn('Could not load /api/songs', err);
        if (process.env.NODE_ENV === 'development') setSongs(MOCK_SONGS);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredSongs = useMemo(() => {
    const list = Array.isArray(songs) ? songs : [];
    return list.filter((song) => {
      const matchesSearch =
        search === "" ||
        song.title.toLowerCase().includes(search.toLowerCase()) ||
        (song.artist?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "all" || song.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" ||
        (song.categories?.includes(categoryFilter) ?? false);

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [songs, search, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / ITEMS_PER_PAGE));

  const paginatedSongs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSongs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSongs, currentPage]);

  const startItem = filteredSongs.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredSongs.length);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <input
        type="text"
        className={`${styles.inputDarkText} ${styles.inputDarkPlaceholder} w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent`}
        placeholder="Search by song title or artist..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          className={`${styles.selectDarkText} w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as SongStatus | "all"); setCurrentPage(1); }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className={`${styles.selectDarkText} w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value as SongCategory | "all"); setCurrentPage(1); }}
        >
          <option value="all">All Categories</option>
          {SONG_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Song Count */}
      <p className="text-sm text-gray-400">
        {filteredSongs.length === 0
          ? "No songs"
          : `${startItem}–${endItem} of ${filteredSongs.length} song${filteredSongs.length !== 1 ? "s" : ""}`}
      </p>

      {/* Song Cards */}
      <div className="space-y-4">
        {paginatedSongs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}

        {filteredSongs.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No songs match your filters.</p>
          </div>
        )}
      </div>

      {/* Mobile-first Pagination — large tap targets, sticky feel */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 pb-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-5 py-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          <span className="text-sm text-gray-500 font-medium">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-5 py-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
