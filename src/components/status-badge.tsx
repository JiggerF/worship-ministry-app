import type { RosterStatus, SongStatus } from "@/lib/types/database";

const ROSTER_BADGE_STYLES: Record<string, string> = {
  LOCKED: "bg-green-600 text-white",
  DRAFT: "bg-amber-500 text-white",
  next: "border border-green-600 text-green-600 bg-white",
  EMPTY: "bg-gray-200 text-gray-500",
};

export function RosterBadge({
  status,
}: {
  status: RosterStatus | "next" | "empty";
}) {
  const label =
    status === "LOCKED"
      ? "FINAL"
      : status === "DRAFT"
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
  published: "bg-green-600 text-white",
  learning: "bg-orange-500 text-white",
  internal_approved: "bg-blue-200 text-blue-800",
};

const SONG_STATUS_LABELS: Record<SongStatus, string> = {
  published: "Published",
  learning: "New Song – Learning",
  internal_approved: "In Review",
};

export function SongStatusBadge({ status }: { status: SongStatus }) {
  const style = SONG_STATUS_STYLES[status] ?? "bg-gray-300 text-gray-700";
  const label = SONG_STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
