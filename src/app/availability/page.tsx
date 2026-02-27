"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useCurrentMember } from "./useCurrentMember";

export const dynamic = "force-dynamic";
import { ROLES } from "@/lib/constants/roles";
import { getSundaysInMonth, formatDateDMY } from "@/lib/utils/dates";
import type { MemberRole } from "@/lib/types/database";

type DbRole = { id: number; name: string };

type AvailabilityRow = {
  date: string; // YYYY-MM-DD
  status: "AVAILABLE" | "UNAVAILABLE";
  preferred_role: number | null;
  notes: string | null;
  submitted_at?: string;
};

const MELBOURNE_TZ = "Australia/Melbourne";

function getMelbourneNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: MELBOURNE_TZ }));
}

function addMonths(year: number, monthIndex0: number, delta: number) {
  const d = new Date(year, monthIndex0, 1);
  d.setMonth(d.getMonth() + delta);
  return { year: d.getFullYear(), month: d.getMonth() }; // monthIndex0
}

function toMonthStartISO(year: number, monthIndex0: number): string {
  const y = String(year);
  const m = String(monthIndex0 + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AvailabilityPage() {
  const { member: currentUser, loading: memberLoading } = useCurrentMember();
  // Hide page for Worship Lead and Music Coordinator
  if (!memberLoading && currentUser && ["WorshipLeader", "MusicCoordinator"].includes(currentUser.app_role)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm text-gray-700">Availability tracking is managed by your Coordinator.</p>
        </div>
      </div>
    );
  }
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
  const periodId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("period") : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [member, setMember] = useState<{ id: string; name: string } | null>(
    null
  );

  // Roles returned from API MUST be member-scoped
  const [memberRoles, setMemberRoles] = useState<DbRole[]>([]);

  const [preferredRoleId, setPreferredRoleId] = useState<number | "">("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  // Sundays driven by API when in period mode; computed from targetMonth otherwise
  const [apiSundays, setApiSundays] = useState<string[] | null>(null);

  // MVP: targetMonth = T+1 (next month, Melbourne time)
  const targetMonth = useMemo(() => {
    const now = getMelbourneNow();
    const next = addMonths(now.getFullYear(), now.getMonth(), 1);
    return toMonthStartISO(next.year, next.month);
  }, []);

  const targetMonthLabel = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-01$/.exec(targetMonth);
    if (!m) return targetMonth;
    const year = Number(m[1]);
    const monthIndex0 = Number(m[2]) - 1;
    return new Date(year, monthIndex0, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [targetMonth]);

  const sundays = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-01$/.exec(targetMonth);
    if (!m) return [];
    const year = Number(m[1]);
    const monthIndex0 = Number(m[2]) - 1;
    return getSundaysInMonth(year, monthIndex0).map(toISODate);
  }, [targetMonth]);

  // Map role_id -> label using your ROLES labels where possible
  const roleIdToLabel = useMemo(() => {
    const nameToLabel = new Map<MemberRole, string>(
      ROLES.map((r) => [r.value, r.label])
    );
    const map = new Map<number, string>();
    memberRoles.forEach((r) => {
      map.set(r.id, nameToLabel.get(r.name as MemberRole) ?? r.name);
    });
    return map;
  }, [memberRoles]);

  useEffect(() => {
    if (!token) {
      setError("Missing token");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const queryParam = periodId
          ? `periodId=${periodId}`
          : `targetMonth=${targetMonth}`;

        const res = await fetch(
          `/api/availability/${token}?${queryParam}`
        );
        const json = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(json.error || "Failed to load availability");

        if (!json.member) throw new Error("Invalid or inactive link");

        setMember(json.member);
        setIsLockedOut(json.lockout?.locked ?? false);
        if (json.periodLabel) setPeriodLabel(json.periodLabel);
        if (json.sundays) setApiSundays(json.sundays);

        // Member-scoped roles from API
        setMemberRoles(json.roles ?? []);

        const rows: AvailabilityRow[] = (json.availability ?? []).sort(
          (a: AvailabilityRow, b: AvailabilityRow) => a.date.localeCompare(b.date)
        );

        // Effective sundays: API-provided (period mode) or locally computed (T+1 mode)
        const effectiveSundays: string[] = json.sundays ?? sundays;

        // Hydrate selected dates
        const availableDates = rows
          .filter((r) => r.status === "AVAILABLE")
          .map((r) => r.date)
          .filter((d) => effectiveSundays.includes(d));

        setSelectedDates(new Set(availableDates));

        // Hydrate preferred role: period mode uses top-level json.preferredRoleId
        const pref =
          json.preferredRoleId ??
          rows.find((r) => r.preferred_role != null)?.preferred_role ??
          null;

        if (pref != null) setPreferredRoleId(pref);

        // Hydrate notes
        const n =
          rows.find((r) => (r.notes ?? "").trim().length > 0)?.notes ?? "";

        setNotes(n ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, targetMonth, sundays, periodId]);

  function toggleDate(dateIso: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateIso)) next.delete(dateIso);
      else next.add(dateIso);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (preferredRoleId === "") {
      alert("Please select your primary role.");
      return;
    }

    // NOTE: you previously required at least 1 date. Keep or remove as desired.
    if (selectedDates.size === 0) {
      alert("Please select at least one available date.");
      return;
    }

    const queryParam = periodId
      ? `periodId=${periodId}`
      : `targetMonth=${targetMonth}`;

    const res = await fetch(
      `/api/availability/${token}?${queryParam}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferred_role_id: preferredRoleId == null ? null : preferredRoleId,
          available_dates: Array.from(selectedDates),
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error || "Submission failed");
      return;
    }

    setSubmitted(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm text-gray-700">{error || "Invalid link"}</p>
        </div>
      </div>
    );
  }

  if (isLockedOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            WCC Worship Team Availability
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            No more edits allowed since schedule is already being finalised!
          </p>
          <p className="text-sm text-gray-500">
            Pls contact your rostering coordinator (Jigger/Alona).
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Availability Submitted!
          </h1>
          <p className="text-sm text-gray-500">
            Thanks {member.name}! You can revisit this link to update your
            submission.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📅</div>
          <h1 className="text-xl font-bold text-gray-900">
            WCC Worship Team Availability
          </h1>
          <p className="text-sm text-gray-500 mt-1">{periodLabel ?? targetMonthLabel}</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-dashed border-gray-300 p-6 space-y-5"
        >
          <p className="text-sm text-gray-600">
            Hi {member.name}! Please select the dates you are available to
            serve.
          </p>

          {/* Primary Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">
              Primary Role <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={preferredRoleId}
              onChange={(e) =>
                setPreferredRoleId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
            >
              <option value="">Select your primary role</option>
              {memberRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleIdToLabel.get(r.id) ?? r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sundays */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Availability for Sundays <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Check all dates you are available to serve
            </p>

            <div className="space-y-2">
              {(apiSundays ?? sundays).map((dateStr) => (
                <label
                  key={dateStr}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDates.has(dateStr)}
                    onChange={() => toggleDate(dateStr)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">
                    {formatDateDMY(dateStr)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information or special requests..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold transition-colors"
          >
            Submit Availability
          </button>
        </form>
        </div>
      </div>
    </Suspense>
  );
}