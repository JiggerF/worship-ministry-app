"use client";

import { useState } from "react";
import { ChordSheetModal } from "@/components/chord-sheet-modal";
import type { MemberRole, RosterStatus } from "@/lib/types/database";
import { ROLE_SHORT_LABEL_MAP } from "@/lib/constants/roles";
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
  // Track the transposed key the musician last selected, per song index


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
      className={`rounded-xl border-2 bg-white p-5 ${
        isNext ? "border-gray-400" : "border-border"
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
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-medium border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                aria-label="Download all chord charts PDF"
              >
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
                <span>Download All Chord Charts [PDF]</span>
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
