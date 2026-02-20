"use client";

import { useState } from "react";
import { SongCard } from "@/components/song-card";
import { MOCK_SONGS } from "@/lib/mocks/mockSongs";
import { SONG_CATEGORIES } from "@/lib/constants/categories";
import type { SongStatus, SongCategory } from "@/lib/types/database";
import styles from '../../styles.module.css';


const STATUS_OPTIONS: { value: SongStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "new_song_learning", label: "New Song – Learning" },
];

export default function SongPoolPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SongStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<SongCategory | "all">(
    "all"
  );

  // Only use mock data when the developer opts in via `NEXT_PUBLIC_USE_MOCK_ROSTER`
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true";
  const songsSource = useMock ? MOCK_SONGS : [];

  const filteredSongs = songsSource.filter((song) => {
    // Search filter
    const matchesSearch =
      search === "" ||
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      (song.artist?.toLowerCase().includes(search.toLowerCase()) ?? false);

    // Status filter
    const matchesStatus =
      statusFilter === "all" || song.status === statusFilter;

    // Category filter
    const matchesCategory =
      categoryFilter === "all" ||
      (song.categories?.includes(categoryFilter) ?? false);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <input
        type="text"
        className={`${styles.inputDarkText} ${styles.inputDarkPlaceholder} w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent`}
        placeholder="Search by song title or artist..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filter */}
        <select
          className={`${styles.selectDarkText} w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as SongStatus | "all")
          }
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          className={`${styles.selectDarkText} w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900`}
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as SongCategory | "all")
          }
        >
          <option value="all">All Categories</option>
          {SONG_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Song Count */}
      <p className="text-sm text-gray-400">
        {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""}
      </p>

      {/* Song Cards */}
      <div className="space-y-4">
        {filteredSongs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}

        {filteredSongs.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No songs match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
