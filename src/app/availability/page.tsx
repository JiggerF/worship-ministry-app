"use client";

import { useState } from "react";
import { ROLES } from "@/lib/constants/roles";
import { getSundaysInMonth, formatDateDMY, toISODate } from "@/lib/utils/dates";
import type { MemberRole } from "@/lib/types/database";

// Mock member data (would come from magic_token lookup)
const MOCK_MEMBER = {
  id: "m1",
  name: "David Chen",
  roles: ["acoustic_guitar", "keyboard", "drums"] as MemberRole[],
};

// Mock cycle: Feb & March 2026
const CYCLE_MONTHS = [
  { year: 2026, month: 1, label: "February 2026" }, // month is 0-indexed
  { year: 2026, month: 2, label: "March 2026" },
];

const IS_LOCKED_OUT = false; // Would be computed from roster logic

export default function AvailabilityPage() {
  const [preferredRole, setPreferredRole] = useState<MemberRole | "">("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const memberRoles = ROLES.filter((r) =>
    MOCK_MEMBER.roles.includes(r.value)
  );

  function toggleDate(date: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Would submit to Supabase
    setSubmitted(true);
  }

  if (IS_LOCKED_OUT) {
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
            Thanks {MOCK_MEMBER.name}! Your availability has been recorded. You
            can revisit this link to update your submission.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📅</div>
          <h1 className="text-xl font-bold text-gray-900">
            WCC Worship Team Availability
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {CYCLE_MONTHS.map((m) => m.label).join(" & ")}
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-dashed border-gray-300 p-6 space-y-5"
        >
          <p className="text-sm text-gray-600">
            Hi {MOCK_MEMBER.name}! Please fill out your availability for the
            upcoming Sunday services. Select the dates you are available to
            serve.
          </p>

          {/* Primary Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">
              Primary Role <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={preferredRole}
              onChange={(e) =>
                setPreferredRole(e.target.value as MemberRole)
              }
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
            >
              <option value="">Select your primary role</option>
              {memberRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Sundays */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Availability for Sundays{" "}
              <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Check all dates you are available to serve
            </p>

            {CYCLE_MONTHS.map(({ year, month, label }) => {
              const sundays = getSundaysInMonth(year, month);
              return (
                <div key={label} className="mb-4">
                  <p className="text-sm font-semibold text-gray-800 mb-2">
                    {label}
                  </p>
                  <div className="space-y-2">
                    {sundays.map((sunday) => {
                      const dateStr = toISODate(sunday);
                      return (
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
                            {formatDateDMY(sunday)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
  );
}
