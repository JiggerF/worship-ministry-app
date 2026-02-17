import type { RosterStatus, SongStatus } from "@/lib/types/database";

const ROSTER_BADGE_STYLES: Record<string, string> = {
  locked: "bg-green-600 text-white",
  draft: "bg-amber-500 text-white",
  next: "border border-green-600 text-green-600 bg-white",
  empty: "bg-gray-200 text-gray-500",
};

export function RosterBadge({
  status,
}: {
  status: RosterStatus | "next" | "empty";
}) {
  const label =
    status === "locked"
      ? "FINAL"
      : status === "draft"
        ? "DRAFT"
        : status === "next"
          ? "> NEXT"
          : "";

  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROSTER_BADGE_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

const SONG_STATUS_STYLES: Record<SongStatus, string> = {
  approved: "bg-green-600 text-white",
  new_song_learning: "bg-yellow-500 text-white",
};

const SONG_STATUS_LABELS: Record<SongStatus, string> = {
  approved: "Approved",
  new_song_learning: "New Song – Learning",
};

export function SongStatusBadge({ status }: { status: SongStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${SONG_STATUS_STYLES[status]}`}
    >
      {SONG_STATUS_LABELS[status]}
    </span>
  );
}
