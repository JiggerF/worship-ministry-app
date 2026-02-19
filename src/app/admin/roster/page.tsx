"use client";

import { useEffect, useMemo, useState } from "react";
import { ROSTER_COLUMN_ORDER, ROLE_LABEL_MAP } from "@/lib/constants/roles";
import { formatSundayDate, getSundaysInMonth, toISODate } from "@/lib/utils/dates";
import { RosterBadge } from "@/components/status-badge";
import type { SundayRoster } from "@/lib/types/database";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminRosterPage() {
  const [activeMonth] = useState(getCurrentMonth());
  const [roster, setRoster] = useState<SundayRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalising, setFinalising] = useState(false);

  /* ----------------------------- */
  /* Load Roster                   */
  /* ----------------------------- */

  async function loadRoster() {
    setLoading(true);

    const res = await fetch(`/api/roster?month=${activeMonth}`);
    const json = await res.json();

    if (!res.ok) {
      console.error(json.error);
      setLoading(false);
      return;
    }

    const sundays = getSundaysInMonth(
      Number(activeMonth.split("-")[0]),
      Number(activeMonth.split("-")[1]) - 1
    );

    const structured: SundayRoster[] = sundays.map((dateObj) => {
      const iso = toISODate(dateObj);

      const assignments =
        (json.assignments ?? [])
          .filter((a: any) => a.date === iso)
          .map((a: any) => ({
            id: a.id,
            member_id: a.member_id,
            date: a.date,
            role: a.role,
            status: a.status,
            assigned_by: null,
            assigned_at: a.assigned_at,
            locked_at: a.locked_at,
            member: a.members,
          })) ?? [];

      const status: RosterStatus | "EMPTY" = assignments.length === 0
        ? "EMPTY"
        : assignments.every((a) => a.status === "LOCKED")
          ? "LOCKED"
          : "DRAFT";

      return {
        date: iso,
        status,
        assignments,
        setlist: [],
        notes: null,
      };
    });

    setRoster(structured);
    setLoading(false);
  }

  useEffect(() => {
    loadRoster();
  }, []);

  /* ----------------------------- */
  /* Derived State                 */
  /* ----------------------------- */

  const monthIsLocked = useMemo(() => {
    if (roster.length === 0) return false;
    return roster.every((r) => r.status === "LOCKED");
  }, [roster]);

  /* ----------------------------- */
  /* Save Draft                    */
  /* ----------------------------- */

  async function handleSaveDraft() {
    if (saving) return;

    setSaving(true);

    const flatAssignments = roster.flatMap((sunday) =>
      sunday.assignments.map((a) => ({
        member_id: a.member_id,
        date: a.date,
        role: a.role,
      }))
    );

    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments: flatAssignments }),
    });

    setSaving(false);

    if (!res.ok) {
      alert("Failed to save draft");
      return;
    }

    await loadRoster();
    alert("Draft saved");
  }

  /* ----------------------------- */
  /* Finalise                      */
  /* ----------------------------- */

  async function handleFinalise() {
    if (monthIsLocked || finalising) return;

    const confirm = window.confirm(
      "Finalise this month? This will lock all assignments."
    );
    if (!confirm) return;

    setFinalising(true);

    const res = await fetch("/api/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: activeMonth }),
    });

    setFinalising(false);

    if (!res.ok) {
      alert("Failed to finalise");
      return;
    }

    await loadRoster();
    alert("Month finalised");
  }

  /* ----------------------------- */
  /* UI                            */
  /* ----------------------------- */

  if (loading) {
    return (
      <div className="p-10 text-center">Loading roster...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            Worship Ministry Rostering
          </h1>

          {monthIsLocked ? (
            <RosterBadge status="LOCKED" />
          ) : (
            <RosterBadge status="DRAFT" />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button
            onClick={handleFinalise}
            disabled={monthIsLocked || finalising}
            className={`px-4 py-2 rounded-lg text-sm text-white ${monthIsLocked
                ? "bg-gray-400"
                : "bg-green-600 hover:bg-green-700"
              }`}
          >
            {monthIsLocked
              ? "Finalised"
              : finalising
                ? "Finalising..."
                : "✓ FINALISE"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-3 text-left">Date</th>
              {ROSTER_COLUMN_ORDER.map((role) => (
                <th key={role} className="px-2 py-3 text-left">
                  {ROLE_LABEL_MAP[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map((sunday) => (
              <tr key={sunday.date} className="border-b">
                <td className="px-3 py-3 font-medium">
                  {formatSundayDate(sunday.date)}
                </td>

                {ROSTER_COLUMN_ORDER.map((role) => {
                  const assignment = sunday.assignments.find(
                    (a) => a.role.name === role // compare string to string
                  );

                  return (
                    <td key={role} className="px-2 py-2">
                      {assignment ? (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {assignment.member?.name ?? "—"}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}