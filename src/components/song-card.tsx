"use client";

import { useState } from "react";
import type { SongWithCharts } from "@/lib/types/database";
import { SongStatusBadge } from "@/components/status-badge";
import { CATEGORY_LABEL_MAP } from "@/lib/constants/categories";
import { ChordSheetModal } from "@/components/chord-sheet-modal";

interface SongCardProps {
  song: SongWithCharts;
}

export function SongCard({ song }: SongCardProps) {
  // Tracks the key the musician last selected (card-level feedback)
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Only charts that have a file can be opened in the modal
  const chartsWithFiles = song.chord_charts.filter((c) => c.file_url);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">


      {/* Header: Title + Status badge */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-lg font-bold text-gray-900 leading-tight">
          {song.title}
        </h3>
        <SongStatusBadge status={song.status} />
      </div>

      {/* Artist + Categories on one line */}
      {(song.artist || (song.categories && song.categories.length > 0)) && (
        <div className="flex items-center justify-between mb-1">
          {/* Artist left */}
          <span className="text-sm text-gray-400 mr-2">{song.artist}</span>
          {/* Categories right */}
          {song.categories && song.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {song.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                >
                  {CATEGORY_LABEL_MAP[cat] || cat}
                </span>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Scripture Anchor */}
      {song.scripture_anchor && (
        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
          <span>📖</span>
          {song.scripture_anchor}
        </p>
      )}
      {/* No divider, just spacing above chord chart section */}

      {/* Chord Charts & Musician Actions */}
      <div className="mb-2">
        {/* Section heading row */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 shrink-0">
            <span>🎸</span>
            Chord Charts
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {song.chord_charts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Key pills — each opens the PDF directly */}
            <span className="text-xs font-medium text-gray-500">
              {song.chord_charts.length === 1 ? 'Key:' : 'Available keys:'}
            </span>

            {song.chord_charts.map((chart) =>
              chart.file_url ? (
                <a
                  key={chart.id}
                  href={chart.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  title={`View chord chart — Key of ${chart.key}`}
                >
                  {chart.key}
                  {/* External link icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 opacity-60" viewBox="0 0 24 24"
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
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
                  title={`Key of ${chart.key} — no file uploaded`}
                >
                  {chart.key}
                </span>
              )
            )}

            {/* Divider pip between key pills and Change Key */}
            {chartsWithFiles.length > 0 && (
              <span className="text-gray-300 text-xs select-none">|</span>
            )}

            {/* Change Key — opens the transposition modal */}
            {chartsWithFiles.length > 0 && (
              <ChordSheetModal
                charts={chartsWithFiles}
                songTitle={song.title}
                onKeyChange={setSelectedKey}
              >
                <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  Change Key
                </button>
              </ChordSheetModal>
            )}

            {/* Selected key feedback badge — dismissible */}
            {selectedKey && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {selectedKey}
                <button
                  onClick={() => setSelectedKey(null)}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Dismiss key selection"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-300" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            No chart uploaded yet
          </p>
        )}
      </div>

      {/* YouTube Link */}
      {song.youtube_url && (
        <a
          href={song.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-800 transition-colors mt-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24"
            fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch on YouTube
        </a>
      )}
    </div>
  );
}
