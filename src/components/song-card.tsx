import type { SongWithCharts } from "@/lib/types/database";
import { SongStatusBadge } from "@/components/status-badge";
import { CATEGORY_LABEL_MAP } from "@/lib/constants/categories";

interface SongCardProps {
  song: SongWithCharts;
}

export function SongCard({ song }: SongCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

      {/* Header: Title + Status badge */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-lg font-bold text-gray-900 leading-tight">
          {song.title}
        </h3>
        <SongStatusBadge status={song.status} />
      </div>

      {/* Artist */}
      {song.artist && (
        <p className="text-sm text-gray-400 mb-3">{song.artist}</p>
      )}

      {/* Categories */}
      {song.categories && song.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
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

      {/* Scripture Anchor */}
      {song.scripture_anchor && (
        <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
          <span>📖</span>
          {song.scripture_anchor}
        </p>
      )}

      {/* Chord Charts */}
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
            <span>🎸</span>
            Chord Charts
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {song.chord_charts.length > 0 ? (
          <div className="space-y-2">
            {song.chord_charts.map((chart) => (
              <div key={chart.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">
                  Key of {chart.key}
                </span>
                {chart.file_url ? (
                  <a
                    href={chart.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" />
                      <path d="M19 12l-7 7-7-7" />
                      <path d="M5 21h14" />
                    </svg>
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-gray-300">No file</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-300 italic">No chord charts uploaded yet</p>
        )}
      </div>

      {/* YouTube Link */}
      {song.youtube_url && (
        <>
          <div className="h-px bg-gray-200 mb-3" />
          <a
            href={song.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch on YouTube
          </a>
        </>
      )}
    </div>
  );
}
