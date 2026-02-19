import type { MemberRole, RosterStatus } from "@/lib/types/database";
import { ROLE_SHORT_LABEL_MAP } from "@/lib/constants/roles";
import styles from "../app/styles.module.css";

export type SundayCardAssignment = {
  id: string;
  role: MemberRole;
  member: { id: string; name: string } | null;
};

export type SundayCardRoster = {
  date: string; // YYYY-MM-DD
  status: RosterStatus | "EMPTY";
  assignments: SundayCardAssignment[];
  setlist: any[];
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

export function SundayCard({ roster, isNext }: SundayCardProps) {
  const { status, assignments, setlist } = roster;
  const isEmpty = assignments.length === 0 && status === "EMPTY";

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
          <p className={`${styles.darkerText} text-base mt-0.5`}>
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
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="inline-block w-4 h-4 mr-2 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Team
          </h3>
          {assignments.length > 0 ? (
            <div className="space-y-1.5">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-3">
                  <span className={`text-xs font-medium min-w-[3rem] ${styles.assignmentRole}`}>
                    {ROLE_SHORT_LABEL_MAP[assignment.role]}
                  </span>
                  <span className={`${styles.assignmentName} text-sm`}>
                    {assignment.member?.name ?? "—"}
                  </span>
                </div>
              ))}
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
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-1.5">
            <span className="text-gray-400">🎵</span>
            Songs
          </h3>
          {setlist.length > 0 ? (
            <ol className="space-y-1">
              {setlist.map((item: any, i: number) => (
                <li key={item.id ?? i} className="text-sm text-gray-800">
                  {item.position ?? i + 1}. {item.song?.title ?? "Unknown"}{" "}
                  {item.song?.chord_charts?.[0]?.key
                    ? `(${item.song.chord_charts[0].key})`
                    : ""}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No songs assigned yet
            </p>
          )}
          {/* Download chord charts button */}
          {setlist.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50"
                aria-label="Download chord charts"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M19 12l-7 7-7-7" />
                  <path d="M5 21h14" />
                </svg>
                <span>Download Chord Charts</span>
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
