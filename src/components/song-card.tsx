import type { SongWithCharts } from "@/lib/types/database";
import { SongStatusBadge } from "@/components/status-badge";
import { CATEGORY_LABEL_MAP } from "@/lib/constants/categories";

interface SongCardProps {
  song: SongWithCharts;
}

export function SongCard({ song }: SongCardProps) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
      {/* Header: Title + Status */}
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
          <span className="text-gray-400">🎵</span>
          {song.title}
        </h3>
        <SongStatusBadge status={song.status} />
      </div>

      {/* Artist */}
      {song.artist && (
        <p className="text-sm text-gray-500 ml-6 mb-3">{song.artist}</p>
      )}

      {/* Categories */}
      {song.categories && song.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 ml-6">
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
        <p className="text-sm text-gray-500 mb-3 ml-6">
          <span className="text-gray-400">📖</span>{" "}
          {song.scripture_anchor}
        </p>
      )}

      {/* Chord Charts */}
      {song.chord_charts.length > 0 && (
        <div className="mb-3 ml-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            🎸 Chord Charts
          </p>
          <div className="space-y-1">
            {song.chord_charts.map((chart) => (
              <div
                key={chart.id}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-gray-700">
                  Key of {chart.key}
                </span>
                {chart.file_url ? (
                  <a
                    href={chart.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ⬇ Download
                  </a>
                ) : (
                  <span className="text-xs text-gray-300">No file</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {song.chord_charts.length === 0 && (
        <p className="text-sm text-gray-300 italic mb-3 ml-6">
          No chord charts uploaded yet
        </p>
      )}

      {/* YouTube Link */}
      {song.youtube_url && (
        <a
          href={song.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-6 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
        >
          ▶️ Watch on YouTube
        </a>
      )}
    </div>
  );
}
