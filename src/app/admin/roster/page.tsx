"use client";

import { useState } from "react";
import { ROSTER_COLUMN_ORDER, ROLE_LABEL_MAP } from "@/lib/constants/roles";
import { formatSundayDate } from "@/lib/utils/dates";
import { RosterBadge } from "@/components/status-badge";
import { MOCK_ROSTER } from "@/lib/mock-data";
import type { SundayRoster, RosterAssignmentWithMember, MemberRole } from "@/lib/types/database";

const MONTHS = [
  { label: "February 2026", value: "2026-02" },
  { label: "March 2026", value: "2026-03" },
];

// Mock available members per role (would come from availability + members table)
const MOCK_AVAILABLE: Record<string, { id: string; name: string }[]> = {
  worship_lead: [{ id: "m1", name: "John Moore" }, { id: "m7", name: "James Taylor" }],
  backup_vocals_1: [{ id: "m2", name: "Sarah Johnson" }, { id: "m8", name: "Peter Patter" }],
  backup_vocals_2: [{ id: "m2", name: "Sarah Johnson" }],
  acoustic_guitar: [{ id: "m3", name: "David Chen" }, { id: "m9", name: "Andre Garie" }],
  electric_guitar: [{ id: "m6", name: "Chris Martinez" }, { id: "m10", name: "Ryon Janice" }],
  bass: [{ id: "m6", name: "Chris Martinez" }],
  keyboard: [{ id: "m4", name: "Emily Rodriguez" }, { id: "m3", name: "David Chen" }, { id: "m11", name: "Mango" }],
  drums: [{ id: "m5", name: "Michael Thompson" }, { id: "m3", name: "David Chen" }],
  percussion: [{ id: "m5", name: "Michael Thompson" }],
  setup: [],
  sound: [],
};

export default function AdminRosterPage() {
  const [activeMonth, setActiveMonth] = useState(MONTHS[0].value);
  const [roster, setRoster] = useState<SundayRoster[]>(MOCK_ROSTER);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const filteredRoster = roster.filter((r) => r.date.startsWith(activeMonth));

  // Mock availability response tracking
  const respondedCount = 8;
  const totalMembers = 12;
  const nonRespondents = ["Peter Morris", "Andre Garie", "Alex Kim", "Mango"];

  function getAssignment(sunday: SundayRoster, role: MemberRole): RosterAssignmentWithMember | undefined {
    return sunday.assignments.find((a) => a.role === role);
  }

  function handleAssign(date: string, role: MemberRole, memberId: string, memberName: string) {
    setRoster((prev) =>
      prev.map((sunday) => {
        if (sunday.date !== date) return sunday;
        const existing = sunday.assignments.findIndex((a) => a.role === role);
        const newAssignment: RosterAssignmentWithMember = {
          id: `new-${Date.now()}`,
          member_id: memberId,
          date,
          role,
          status: "draft",
          assigned_by: null,
          assigned_at: new Date().toISOString(),
          locked_at: null,
          member: { id: memberId, name: memberName },
        };
        const newAssignments = [...sunday.assignments];
        if (existing >= 0) {
          newAssignments[existing] = newAssignment;
        } else {
          newAssignments.push(newAssignment);
        }
        return { ...sunday, assignments: newAssignments, status: "draft" as const };
      })
    );
  }

  function handleRemove(date: string, role: MemberRole) {
    setRoster((prev) =>
      prev.map((sunday) => {
        if (sunday.date !== date) return sunday;
        return {
          ...sunday,
          assignments: sunday.assignments.filter((a) => a.role !== role),
        };
      })
    );
  }

  // Count burnout (3+ assignments in the month)
  function getBurnoutMembers(): Set<string> {
    const counts: Record<string, number> = {};
    filteredRoster.forEach((sunday) => {
      sunday.assignments.forEach((a) => {
        counts[a.member_id] = (counts[a.member_id] || 0) + 1;
      });
    });
    return new Set(
      Object.entries(counts)
        .filter(([, count]) => count >= 3)
        .map(([id]) => id)
    );
  }

  const burnoutMembers = getBurnoutMembers();

  // Count unfilled roles
  function getConflicts(): string[] {
    const conflicts: string[] = [];
    filteredRoster.forEach((sunday) => {
      ROSTER_COLUMN_ORDER.forEach((role) => {
        if (!sunday.assignments.find((a) => a.role === role)) {
          conflicts.push(`${ROLE_LABEL_MAP[role]} needed for ${formatSundayDate(sunday.date)}`);
        }
      });
    });
    return conflicts;
  }

  const conflicts = getConflicts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Worship Ministry Rostering
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Action Buttons */}
          <button className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Save Draft
          </button>
          <button className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
            ✓ PUBLISH
          </button>
        </div>
      </div>

      {/* Availability Tracker */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Availability Responses
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-green-600 font-semibold text-lg">{respondedCount}</span>
            <span className="text-sm text-gray-500">/ {totalMembers} responded</span>
          </div>
          {nonRespondents.length > 0 && (
            <div className="text-sm text-gray-400">
              Not responded:{" "}
              <span className="text-red-500 font-medium">
                {nonRespondents.join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Roster Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-3 py-3 font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[120px]">
                Date
              </th>
              {ROSTER_COLUMN_ORDER.map((role) => (
                <th
                  key={role}
                  className="text-left px-2 py-3 font-medium text-gray-500 min-w-[110px]"
                >
                  {ROLE_LABEL_MAP[role]}
                </th>
              ))}
              <th className="text-left px-2 py-3 font-medium text-gray-500 min-w-[40px]">

              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRoster.map((sunday) => (
              <>
                <tr key={sunday.date} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 sticky left-0 bg-white">
                    <button
                      onClick={() =>
                        setExpandedDate(
                          expandedDate === sunday.date ? null : sunday.date
                        )
                      }
                      className="flex items-center gap-1 font-medium text-gray-900"
                    >
                      <span className="text-gray-400 text-xs">
                        {expandedDate === sunday.date ? "▼" : "▶"}
                      </span>
                      {formatSundayDate(sunday.date)}
                    </button>
                  </td>
                  {ROSTER_COLUMN_ORDER.map((role) => {
                    const assignment = getAssignment(sunday, role);
                    const isBurnout = assignment && burnoutMembers.has(assignment.member_id);
                    return (
                      <td key={role} className="px-2 py-2">
                        {assignment ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={assignment.member_id}
                              onChange={(e) => {
                                if (e.target.value === "__remove__") {
                                  handleRemove(sunday.date, role);
                                } else {
                                  const member = MOCK_AVAILABLE[role]?.find(
                                    (m) => m.id === e.target.value
                                  );
                                  if (member) {
                                    handleAssign(sunday.date, role, member.id, member.name);
                                  }
                                }
                              }}
                              className={`px-2 py-1 rounded border text-xs font-medium max-w-[100px] ${
                                assignment.status === "locked"
                                  ? "border-green-300 bg-green-50"
                                  : "border-amber-300 bg-amber-50"
                              }`}
                            >
                              <option value={assignment.member_id}>
                                {assignment.member.name}
                              </option>
                              {MOCK_AVAILABLE[role]
                                ?.filter((m) => m.id !== assignment.member_id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              <option value="__remove__">— Remove —</option>
                            </select>
                            {isBurnout && (
                              <span title="Rostered 3+ times this month" className="text-amber-500">
                                ⚠
                              </span>
                            )}
                          </div>
                        ) : (
                          <select
                            value=""
                            onChange={(e) => {
                              const member = MOCK_AVAILABLE[role]?.find(
                                (m) => m.id === e.target.value
                              );
                              if (member) {
                                handleAssign(sunday.date, role, member.id, member.name);
                              }
                            }}
                            className="px-2 py-1 rounded border border-dashed border-gray-300 text-xs text-gray-400 max-w-[100px]"
                          >
                            <option value="">—</option>
                            {MOCK_AVAILABLE[role]?.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-gray-400 cursor-pointer hover:text-gray-600">
                    ···
                  </td>
                </tr>

                {/* Expanded Row: Setlist + Notes */}
                {expandedDate === sunday.date && (
                  <tr key={`${sunday.date}-expanded`} className="border-b border-gray-100 bg-gray-50">
                    <td colSpan={ROSTER_COLUMN_ORDER.length + 2} className="px-6 py-4">
                      <div className="max-w-xl space-y-4">
                        {/* Setlist */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">
                            Setlist for {formatSundayDate(sunday.date)} — Sunday Morning
                          </h4>
                          {sunday.setlist.length > 0 ? (
                            <ol className="space-y-1.5">
                              {sunday.setlist.map((item) => (
                                <li key={item.id} className="text-sm text-gray-700">
                                  {item.position}. {item.song.title}
                                  {item.song.artist && (
                                    <span className="text-gray-400 ml-1">
                                      · {item.song.artist}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-gray-400 italic">
                              No songs assigned yet
                            </p>
                          )}
                        </div>

                        {/* PDF Bundle */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">
                            Bundled PDF
                          </h4>
                          {sunday.setlist.length > 0 ? (
                            <div className="flex items-center gap-3">
                              <button className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors">
                                Generate PDF
                              </button>
                              <span className="text-xs text-gray-400">
                                View v1 | Download
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              Add songs to generate PDF
                            </p>
                          )}
                        </div>

                        {/* Notes */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">
                            Notes
                          </h4>
                          <input
                            type="text"
                            defaultValue={sunday.notes || ""}
                            placeholder="Add notes..."
                            className="w-full px-3 py-1.5 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conflict Alerts */}
      {conflicts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Conflict Alerts
          </h3>
          <div className="space-y-2">
            {conflicts.slice(0, 5).map((conflict, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-red-500">⚠</span>
                <span className="text-gray-700">{conflict}</span>
              </div>
            ))}
            {conflicts.length > 5 && (
              <p className="text-xs text-gray-400">
                +{conflicts.length - 5} more alerts
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
