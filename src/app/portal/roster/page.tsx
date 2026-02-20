// src/app/portal/roster/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SundayCard, type SundayCardRoster } from "@/components/sunday-card";
import { getSundaysInMonth, toISODate } from "@/lib/utils/dates";
import makeDevRoster from "@/lib/mocks/devRoster";
import type { MemberRole, RosterStatus } from "@/lib/types/database";

/* ----------------------------- */
/* Types                         */
/* ----------------------------- */

type ApiAssignment = {
  id: string;
  date: string;
  member_id: string | null;
  status: RosterStatus;
  role: { id: number; name: MemberRole } | null;
  member: { id: string; name: string } | null;
};

type PortalAssignment = {
  id: string;
  date: string;
  role: MemberRole | null;
  status: RosterStatus;
  member: { id: string; name: string } | null;
};

// Development mock helper: easy place to edit names and songs for local testing.
// When the API returns no assignments (development only), we inject these.
// Edit the generated names and setlists below to customize the dev UI.

/* ----------------------------- */
/* Melbourne-time helpers        */
/* ----------------------------- */

type MelbourneParts = {
  year: number;
  month1to12: number;
  day: number;
  dayOfWeek: number; // 0 = Sunday
  hour: number;
  isoDate: string;
};

function getMelbourneNowParts(): MelbourneParts {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const get = (type: string) => {
    const p = parts.find((p) => p.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  const year = get("year");
  const month1to12 = get("month");
  const day = get("day");
  let hour = get("hour");
  if (hour === 24) hour = 0; // normalize midnight

  // Compute ISO date string for the Melbourne date
  const isoDate = `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Derive day of week (0=Sun) from the local Melbourne date at noon UTC
  const dayOfWeek = new Date(`${isoDate}T12:00:00Z`).getUTCDay();

  return { year, month1to12, day, dayOfWeek, hour, isoDate };
}

function getUpcomingSundayISO(parts: MelbourneParts): string {
  const { dayOfWeek, hour, isoDate } = parts;

  // Rule A: not Sunday, OR Sunday before noon → next Sunday on or after today
  // Rule B: Sunday AND hour >= 12 → +7 days
  let daysToAdd: number;
  if (dayOfWeek === 0 && hour >= 12) {
    daysToAdd = 7; // Rule B
  } else {
    daysToAdd = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Rule A
  }

  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

/* ----------------------------- */
/* Month helpers                 */
/* ----------------------------- */

function getMonthLabel(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMonthValue(year: number, monthIndex0: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

function safeParseMonth(monthValue: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex0 = Number(m[2]) - 1;
  if (monthIndex0 < 0 || monthIndex0 > 11) return null;
  return { year, monthIndex0 };
}

function getMonthSundays(monthValue: string) {
  const parsed = safeParseMonth(monthValue);
  if (!parsed) return [];
  return getSundaysInMonth(parsed.year, parsed.monthIndex0).map(toISODate);
}

/* ----------------------------- */
/* Page Component                */
/* ----------------------------- */

export default function PortalRosterPage() {
  const nextCardRef = useRef<HTMLDivElement>(null);

  // Compute Melbourne-aware upcoming Sunday once on mount
  const [upcomingSundayISO] = useState(() => {
    const parts = getMelbourneNowParts();
    return getUpcomingSundayISO(parts);
  });

  // MONTHS built from Melbourne time
  const MONTHS = useMemo(() => {
    const parts = getMelbourneNowParts();
    const { year, month1to12 } = parts;

    const thisMonth = {
      label: getMonthLabel(year, month1to12 - 1),
      value: getMonthValue(year, month1to12 - 1),
    };

    const nextYear = month1to12 === 12 ? year + 1 : year;
    const nextMonth1 = month1to12 === 12 ? 1 : month1to12 + 1;
    const nextMonth = {
      label: getMonthLabel(nextYear, nextMonth1 - 1),
      value: getMonthValue(nextYear, nextMonth1 - 1),
    };

    return [thisMonth, nextMonth];
  }, []);

  // Auto-select the month containing the upcoming Sunday
  const [activeMonth, setActiveMonth] = useState<string>(
    () => upcomingSundayISO.slice(0, 7)
  );

  const [assignments, setAssignments] = useState<PortalAssignment[]>([]);
  // Dev-only setlists keyed by ISO date (YYYY-MM-DD)
  const [devSetlists, setDevSetlists] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----------------------------- */
  /* Load Roster                   */
  /* ----------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/roster?month=${activeMonth}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.error || "Failed to load roster");
        }

        const raw: ApiAssignment[] = Array.isArray(json.assignments)
          ? json.assignments
          : [];

        let mapped: PortalAssignment[] = raw.map((a) => ({
          id: String(a.id),
          date: String(a.date),
          // Normalize role: accept either { name } object (DB) or string (dev mock)
          role: typeof a.role === "string" ? (a.role as MemberRole) : a.role?.name ?? null,
          status: a.status,
          member: a.member ?? null,
        }));

        // Development helper: if the API returns no assignments, inject
        // a small mock roster so the UI can be tested locally. Controlled
        // by `NEXT_PUBLIC_USE_MOCK_ROSTER` for consistency with admin pages.
        if (mapped.length === 0 && process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true") {
          const mockSundays = getMonthSundays(activeMonth);
          const { assignments: devAssignments, setlists: devSet } = makeDevRoster(mockSundays);
          mapped = devAssignments;

          if (!cancelled) setDevSetlists(devSet);
        }

        if (!cancelled) setAssignments(mapped);
      } catch (e) {
        if (!cancelled) {
          setAssignments([]);
          setError(e instanceof Error ? e.message : "Unexpected error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeMonth]);

  /* ----------------------------- */
  /* Structure by Sunday           */
  /* ----------------------------- */

  const structuredRoster: SundayCardRoster[] = useMemo(() => {
    const sundaysIso = getMonthSundays(activeMonth);
    if (sundaysIso.length === 0) return [];

    return sundaysIso.map((iso) => {
      const dayAssignments = assignments.filter((a) => a.date === iso);

      let status: RosterStatus | "EMPTY" = "EMPTY";
      if (dayAssignments.length > 0) {
        // A Sunday is LOCKED only when every assignment for that day is LOCKED.
        status = dayAssignments.every((a) => a.status === "LOCKED")
          ? "LOCKED"
          : "DRAFT";
      }

      return {
        date: iso,
        status,
        assignments: dayAssignments
          .filter((a) => a.role !== null)
          .map((a) => ({
            id: a.id,
            role: a.role as MemberRole,
            member: a.member,
          })),
        // Use dev-setlists when present for local testing
        setlist: devSetlists[iso] ?? [],
        notes: null,
      };
    });
  }, [assignments, activeMonth]);

  /* ----------------------------- */
  /* Sort: upcoming Sunday first   */
  /* ----------------------------- */

  const sortedRoster = useMemo(() => {
    const upcoming = upcomingSundayISO;
    return [...structuredRoster].sort((a, b) => {
      if (a.date === upcoming) return -1;
      if (b.date === upcoming) return 1;
      // sort newest -> oldest (descending)
      return b.date.localeCompare(a.date);
    });
  }, [structuredRoster, upcomingSundayISO]);

  /* ----------------------------- */
  /* Auto-scroll to upcoming card  */
  /* ----------------------------- */

  useEffect(() => {
    if (nextCardRef.current) {
      nextCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeMonth]);

  /* ----------------------------- */
  /* UI                            */
  /* ----------------------------- */

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading roster...</div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">⚠️</div>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Month Switcher */}
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

      {/* Sunday Cards (Read-Only) */}
      <div className="space-y-4">
        {sortedRoster.map((roster) => {
          const isNext = roster.date === upcomingSundayISO;

          return (
            <div key={roster.date} ref={isNext ? nextCardRef : undefined}>
              <SundayCard roster={roster} isNext={isNext} />
            </div>
          );
        })}

        {sortedRoster.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No roster data for this month yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
