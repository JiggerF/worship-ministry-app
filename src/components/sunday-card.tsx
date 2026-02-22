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
  song?: {
    title: string;
    chord_charts?: Array<{ key: string }>;
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
            <ol className="space-y-1.5">
              {setlist.map((item: SetlistItem, i: number) => (
                <li key={item.id ?? i} className="flex items-center justify-between gap-2">
                  <span className={`${styles.assignmentName} text-sm`}>
                    {item.position ?? i + 1}. {item.song?.title ?? "Unknown"}
                  </span>
                  {item.song?.chord_charts?.[0]?.key && (
                    <span className={`text-xs shrink-0 ${styles.assignmentRole}`}>
                      {item.song.chord_charts[0].key}
                    </span>
                  )}
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
