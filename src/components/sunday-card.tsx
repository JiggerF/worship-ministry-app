import type { SundayRoster } from "@/lib/types/database";
import { ROLE_LABEL_MAP } from "@/lib/constants/roles";
import { formatSundayDate } from "@/lib/utils/dates";
import { RosterBadge } from "@/components/status-badge";

interface SundayCardProps {
  roster: SundayRoster;
  isNext: boolean;
}

export function SundayCard({ roster, isNext }: SundayCardProps) {
  const overallStatus = roster.status === "empty" ? "empty" : roster.status;

  return (
    <div
      className={`rounded-xl border-2 bg-white p-5 ${
        isNext ? "border-gray-900 shadow-lg" : "border-gray-200"
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">📅</span>
          <span className="font-semibold text-gray-900">
            {formatSundayDate(roster.date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isNext && <RosterBadge status="next" />}
          <RosterBadge status={overallStatus} />
        </div>
      </div>

      {/* Team Section */}
      {roster.assignments.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <span className="text-gray-400">👥</span> Team
          </h3>
          <div className="space-y-2.5">
            {roster.assignments.map((assignment) => (
              <div key={assignment.id}>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {ROLE_LABEL_MAP[assignment.role]}
                </p>
                <span className="inline-block mt-0.5 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-800">
                  {assignment.member.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {roster.assignments.length === 0 && roster.status !== "empty" && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <span className="text-gray-400">👥</span> Team
          </h3>
          <p className="text-sm text-gray-400 italic">
            No assignments yet
          </p>
        </div>
      )}

      {/* Songs Section */}
      {roster.setlist.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <span className="text-gray-400">🎵</span> Songs
          </h3>
          <ol className="space-y-1.5">
            {roster.setlist.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2">
                <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">
                  {item.position}.
                </span>
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {item.song.title}
                  </span>
                  {(item.song.artist ||
                    item.song.chord_charts.length > 0) && (
                    <span className="text-xs text-gray-400 ml-1.5">
                      {[
                        item.song.artist,
                        item.song.chord_charts[0]?.key
                          ? `Key of ${item.song.chord_charts[0].key}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {roster.notes && (
        <p className="text-sm text-gray-500 mb-4">
          <span className="text-gray-400">📝</span> {roster.notes}
        </p>
      )}

      {/* Download PDF Button */}
      {roster.setlist.length > 0 && (
        <button className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
          <span>⬇</span> Download Chord Charts PDF
        </button>
      )}
    </div>
  );
}
