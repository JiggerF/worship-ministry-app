"use client";

import { useState, useCallback, useMemo } from "react";
import jsPDF from "jspdf";
import { ChordSheetModal } from "@/components/chord-sheet-modal";
import type { MemberRole, RosterStatus } from "@/lib/types/database";
import { ROLE_SHORT_LABEL_MAP } from "@/lib/constants/roles";
import {
  normalizeKey,
  semitonesBetween,
  parseChordSheet,
} from "@/lib/utils/transpose";
import styles from "../app/styles.module.css";

export type SundayCardAssignment = {
  id: string;
  role: MemberRole;
  member: { id: string; name: string } | null;
};

export type SetlistItem = {
  id?: string;
  position?: number;
  chosen_key?: string | null;
  song?: {
    id?: string;
    title: string;
    artist?: string | null;
    youtube_url?: string | null;
    scripture_anchor?: string | null;
    chord_charts?: Array<{ key: string; file_url?: string | null }>;
  };
};

export type SundayCardRoster = {
  date: string; // YYYY-MM-DD
  status: RosterStatus | "EMPTY";
  assignments: SundayCardAssignment[];
  setlist: SetlistItem[];
  notes: string | null;
};

interface SundayCardProps {
  roster: SundayCardRoster;
  isNext: boolean;
}

function formatDayName(dateStr: string): string {
  // Parse at UTC midday to avoid timezone shifts that can move the date
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-AU", {
    weekday: "long",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-AU", { month: "short" });
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

const COL1_ROLES: MemberRole[] = [
  "worship_lead",
  "backup_vocals_1",
  "backup_vocals_2",
  "acoustic_guitar",
  "electric_guitar",
  "bass",
];

const COL2_ROLES: MemberRole[] = [
  "keyboard",
  "drums",
  "sound",
  "setup",
  "percussion",
];

export function SundayCard({ roster, isNext }: SundayCardProps) {
  const { status, assignments, setlist } = roster;
  const isEmpty = assignments.length === 0 && status === "EMPTY";

  // Track which setlist item (by index) is expanded
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Download all chord charts state
  const [isDownloading, setIsDownloading] = useState(false);

  // Compute which setlist songs have at least one downloadable chart
  const downloadableSongs = useMemo(() => {
    return setlist
      .filter((item) => {
        const charts = item.song?.chord_charts ?? [];
        return charts.some((c) => c.file_url);
      })
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [setlist]);

  const hasDownloadableCharts = downloadableSongs.length > 0;

  // Download all chord charts as a single compiled PDF
  const handleDownloadAll = useCallback(async () => {
    if (!hasDownloadableCharts || isDownloading) return;
    setIsDownloading(true);

    try {
      // For each downloadable song, resolve which chart to fetch
      const fetchTasks = downloadableSongs.map((item) => {
        const charts = item.song?.chord_charts ?? [];
        const chosenKey = item.chosen_key;

        // Prefer the chart matching chosen_key, otherwise first chart with a file
        let chart = chosenKey
          ? charts.find((c) => c.file_url && c.key === chosenKey)
          : null;
        if (!chart) {
          chart = charts.find((c) => c.file_url) ?? null;
        }
        if (!chart || !chart.file_url) return null;

        const targetKey = chosenKey ?? chart.key;

        return {
          songTitle: item.song?.title ?? "Unknown",
          chartKey: chart.key,
          targetKey,
          fileUrl: chart.file_url,
        };
      }).filter((t): t is NonNullable<typeof t> => t !== null);

      // Fetch all chord sheet texts in parallel
      const results = await Promise.all(
        fetchTasks.map(async (task) => {
          const res = await fetch(
            `/api/chord-sheet?url=${encodeURIComponent(task.fileUrl)}`
          );
          const data = await res.json();
          if (data.error || !data.text) return { ...task, text: null };
          return { ...task, text: data.text as string };
        })
      );

      const successful = results.filter((r) => r.text !== null);
      if (successful.length === 0) {
        setIsDownloading(false);
        return;
      }

      // Build a single multi-song PDF
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 40;
      const marginBottom = 50;

      successful.forEach((song, songIdx) => {
        if (songIdx > 0) doc.addPage();

        let y = 50;
        const normalizedTarget = normalizeKey(song.targetKey);
        const title = `${song.songTitle} — Key of ${normalizedTarget}`;

        // Title
        doc.setFont("Courier", "bold");
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text(title, marginX, y);
        y += 28;

        // Parse and transpose
        const semitones = semitonesBetween(
          normalizeKey(song.chartKey),
          normalizedTarget
        );
        const lines = parseChordSheet(song.text!, semitones, normalizedTarget);

        doc.setFontSize(12);
        for (const line of lines) {
          // Page break check
          if (y > pageHeight - marginBottom) {
            doc.addPage();
            y = 50;
          }

          if (line.type === "empty") {
            y += 12;
          } else if (line.type === "section") {
            doc.setFont("Courier", "bold");
            doc.setTextColor(55, 65, 81);
            doc.text(line.display, marginX, y);
            y += 18;
          } else if (line.type === "chord") {
            doc.setFont("Courier", "bold");
            doc.setTextColor(180, 83, 9);
            doc.text(line.display, marginX, y);
            y += 16;
          } else {
            doc.setFont("Courier", "normal");
            doc.setTextColor(33, 37, 41);
            // Wrap long lyric lines
            const splitLines = doc.splitTextToSize(
              line.display,
              pageWidth - marginX * 2
            );
            for (const sl of splitLines) {
              if (y > pageHeight - marginBottom) {
                doc.addPage();
                y = 50;
              }
              doc.text(sl, marginX, y);
              y += 15;
            }
          }
        }
      });

      const dateLabel = formatShortDate(roster.date).replace(/ /g, "-");
      doc.save(`Chord-Charts-${dateLabel}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  }, [hasDownloadableCharts, isDownloading, downloadableSongs, roster.date]);

  const col1 = COL1_ROLES.map((role) => ({
    role,
    assignment: assignments.find((a) => a.role === role) ?? null,
  }));

  const col2 = COL2_ROLES.map((role) => ({
    role,
    assignment: assignments.find((a) => a.role === role) ?? null,
  }));

  return (
    <div
      className={`rounded-xl bg-white p-5 ${
        isNext ? "border-2 border-black" : "border-0"
      } ${isEmpty ? "opacity-60" : ""}`}
    >
      {/* "Upcoming" label */}
      {isNext && (
        <div className="mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm">
            THIS WEEK
          </span>
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {formatDayName(roster.date)}
          </p>
          <p className={`${styles.darkerText} text-xl font-bold mt-0.5`}>
            {formatShortDate(roster.date)}
          </p>
        </div>

        {/* Status badge */}
        {status === "LOCKED" && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white">
            FINAL
          </span>
        )}
        {status === "DRAFT" && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">
            DRAFT
          </span>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <p className="text-sm text-center text-muted-foreground italic py-4">
          Roster not yet assigned
        </p>
      )}

      {/* Team Section */}
      {!isEmpty && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Team
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {assignments.length > 0 ? (
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5 min-w-0">
                {col1.map(({ role, assignment }) => (
                  <div key={role} className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-medium w-10 shrink-0 ${styles.assignmentRole}`}>
                      {ROLE_SHORT_LABEL_MAP[role]}
                    </span>
                    <span className={`text-sm truncate ${assignment ? styles.assignmentName : "text-gray-300 italic"}`}>
                      {assignment?.member?.name ?? "none"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {col2.map(({ role, assignment }) => (
                  <div key={role} className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-medium w-10 shrink-0 ${styles.assignmentRole}`}>
                      {ROLE_SHORT_LABEL_MAP[role]}
                    </span>
                    <span className={`text-sm truncate ${assignment ? styles.assignmentName : "text-gray-300 italic"}`}>
                      {assignment?.member?.name ?? "none"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No assignments yet
            </p>
          )}
        </div>
      )}

      {/* Songs Section */}
      {!isEmpty && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <span className="text-gray-400">🎵</span>
              Songs
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {setlist.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {setlist.map((item: SetlistItem, i: number) => {
                const key = item.chosen_key ?? item.song?.chord_charts?.[0]?.key ?? null;
                const isOpen = expandedIdx === i;
                const chartsWithFiles = item.song?.chord_charts?.filter((c) => c.file_url) ?? [];

                return (
                  <div key={item.id ?? i}>
                    {/* ── Collapsed row — always visible ── */}
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(isOpen ? null : i)}
                      className="w-full flex items-center gap-2 py-2 text-left group"
                      aria-expanded={isOpen}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`w-3 h-3 shrink-0 text-gray-400 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className={`flex-1 text-sm font-medium group-hover:underline underline-offset-2 decoration-gray-400 ${styles.assignmentName}`}>
                        {item.song?.title ?? "Unknown"}
                      </span>
                      {item.song?.artist && (
                        <span className="text-xs text-gray-400 truncate max-w-[30%]">
                          {item.song.artist}
                        </span>
                      )}
                      {key && (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                          Key of {key}
                        </span>
                      )}
                    </button>

                    {/* ── Expanded detail ── */}
                    {isOpen && (
                      <div className="pb-3 pl-8 space-y-2">
                        {/* Scripture */}
                        {item.song?.scripture_anchor && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <span>📖</span> {item.song.scripture_anchor}
                          </p>
                        )}

                        {/* Explore other keys */}
                        <div className="flex">
                          {chartsWithFiles.length > 0 ? (
                            <ChordSheetModal
                              charts={chartsWithFiles}
                              songTitle={item.song?.title ?? ""}
                            >
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M9 18V5l12-2v13" />
                                  <circle cx="6" cy="18" r="3" />
                                  <circle cx="18" cy="16" r="3" />
                                </svg>
                                Explore other Keys
                              </button>
                            </ChordSheetModal>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No chord chart uploaded yet</span>
                          )}
                        </div>

                        {/* YouTube */}
                        {item.song?.youtube_url && (
                          <a
                            href={item.song.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Watch on YouTube
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-600 italic">
              No songs assigned yet
            </p>
          )}

          {/* Download chord charts — visible when setlist has at least one song */}
          {setlist.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={!hasDownloadableCharts || isDownloading}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-medium border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Download all chord charts PDF"
              >
                {isDownloading ? (
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3v12" />
                    <path d="M19 12l-7 7-7-7" />
                    <path d="M5 21h14" />
                  </svg>
                )}
                <span>{isDownloading ? "Generating PDF…" : "Download All Chord Charts [PDF]"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {roster.notes && (
        <p className="text-sm text-gray-500 mt-4">{roster.notes}</p>
      )}
    </div>
  );
}
