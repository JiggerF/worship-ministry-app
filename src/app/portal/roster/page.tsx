"use client";

import { useState, useRef, useEffect } from "react";
import { SundayCard } from "@/components/sunday-card";
import { RosterBadge } from "@/components/status-badge";
import { getCurrentSunday, toISODate } from "@/lib/utils/dates";
import { MOCK_ROSTER } from "@/lib/mock-data";

const MONTHS = [
  { label: "February 2026", value: "2026-02" },
  { label: "March 2026", value: "2026-03" },
];

export default function PortalRosterPage() {
  const [activeMonth, setActiveMonth] = useState(MONTHS[0].value);
  const nextCardRef = useRef<HTMLDivElement>(null);

  const currentSunday = toISODate(getCurrentSunday());

  // Filter roster by active month
  const filteredRoster = MOCK_ROSTER.filter((r) =>
    r.date.startsWith(activeMonth)
  );

  // Determine overall status for banner
  const allLocked = filteredRoster.every((r) => r.status === "locked");
  const hasDraft = filteredRoster.some((r) => r.status === "draft");

  // Auto-scroll to the "next" card on mount
  useEffect(() => {
    if (nextCardRef.current) {
      nextCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeMonth]);

  return (
    <div className="space-y-4">
      {/* Month Tab Switcher */}
      <div className="flex rounded-full bg-gray-200 p-1">
        {MONTHS.map((month) => (
          <button
            key={month.value}
            onClick={() => setActiveMonth(month.value)}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${
              activeMonth === month.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {month.label}
          </button>
        ))}
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {allLocked ? (
          <>
            <RosterBadge status="locked" />
            <span>All rosters confirmed</span>
          </>
        ) : hasDraft ? (
          <>
            <RosterBadge status="draft" />
            <span>Roster is being finalised</span>
          </>
        ) : (
          <span className="text-gray-400">No roster data</span>
        )}
      </div>

      {/* Sunday Cards */}
      <div className="space-y-4">
        {filteredRoster.map((roster) => {
          const isNext = roster.date === currentSunday;
          return (
            <div
              key={roster.date}
              ref={isNext ? nextCardRef : undefined}
            >
              <SundayCard roster={roster} isNext={isNext} />
            </div>
          );
        })}

        {filteredRoster.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No roster data for this month yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
