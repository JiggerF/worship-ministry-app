"use client";

import { useEffect, useMemo, useState } from "react";
import { ROSTER_COLUMN_ORDER, ROLE_LABEL_MAP, ROLES } from "@/lib/constants/roles";
import { formatSundayDate, getSundaysInMonth, toISODate } from "@/lib/utils/dates";
import { RosterBadge } from "@/components/status-badge";
import makeDevRoster from "@/lib/mocks/devRoster";
import type { MemberRole, RosterStatus, SundayRoster } from "@/lib/types/database";

const ROLE_ID_MAP: Record<MemberRole, number> = Object.fromEntries(
  ROLES.map((r, i) => [r.value, i + 1])
) as Record<MemberRole, number>;

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function monthToNumber(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return y * 12 + m;
}

export default function AdminRosterPage() {
  const [activeMonth, setActiveMonth] = useState(getCurrentMonth);
  const [roster, setRoster] = useState<SundayRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [monthNotes, setMonthNotes] = useState("");
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  /* ----------------------------- */
  /* Load Roster                   */
  /* ----------------------------- */

  // Navigation bounds relative to today
  const currentMonth = getCurrentMonth();
  const minMonth = addMonths(currentMonth, -6);
  const maxMonth = addMonths(currentMonth, 2);


  async function loadRoster() {
    setLoading(true);

    const res = await fetch(`/api/roster?month=${activeMonth}`);
    let json: any = null;
    try {
      json = await res.json();
    } catch (err) {
      // empty or invalid JSON response
      json = null;
    }

    if (!res.ok) {
      const err = json?.error ?? res.statusText ?? 'Request failed';
      console.error(err);
      setLoading(false);
      return;
    }

    // read any note saved for this month
    setMonthNotes(json?.notes ?? "");

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
            // Normalize role shape: server mock may send a string like 'worship_lead',
            // while real DB rows include a role object { id, name } under the alias.
            role: typeof a.role === "string"
              ? { id: ROLE_ID_MAP[a.role as any], name: a.role }
              : a.role,
            status: a.status,
            assigned_by: null,
            assigned_at: a.assigned_at,
            locked_at: a.locked_at,
            member: a.member ?? a.members,
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

    // Development mock: inject fake roster when API returns nothing and
    // the developer has explicitly opted in via `NEXT_PUBLIC_USE_MOCK_ROSTER=true`.
    if (
      (process.env.NEXT_PUBLIC_USE_MOCK_ROSTER === "true") &&
      structured.every((s) => s.status === "EMPTY")
    ) {
      const mockSundayIsos = sundays.map(toISODate);
      const { assignments: mockAssignments } = makeDevRoster(mockSundayIsos);

      const mockedStructured: SundayRoster[] = sundays.map((dateObj) => {
        const iso = toISODate(dateObj);
        const dayAssignments = mockAssignments
          .filter((a) => a.date === iso)
          .map((a) => ({
            id: a.id,
            date: a.date,
            role_id: ROLE_ID_MAP[a.role],
            member_id: a.member?.id ?? null,
            status: a.status,
            assigned_by: null,
            assigned_at: new Date().toISOString(),
            locked_at: null,
            role: { id: ROLE_ID_MAP[a.role], name: a.role },
            member: a.member ?? undefined,
          }));

        const dayStatus: RosterStatus | "EMPTY" =
          dayAssignments.length === 0
            ? "EMPTY"
            : dayAssignments.every((a) => a.status === "LOCKED")
              ? "LOCKED"
              : "DRAFT";

        return { date: iso, status: dayStatus, assignments: dayAssignments, setlist: [], notes: null };
      });

      setRoster(mockedStructured);
      setLoading(false);
      return;
    }

      setRoster(structured);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRoster(); }, [activeMonth]);

  /* ----------------------------- */
  /* Derived State                 */
  /* ----------------------------- */

  const monthIsLocked = useMemo(() => {
    if (roster.length === 0) return false;
    return roster.every((r) => r.status === "LOCKED");
  }, [roster]);

  const monthHasData = useMemo(() => {
    return roster.some((r) => r.status !== "EMPTY");
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

    const confirmed = window.confirm(
      "Finalise this month? This will lock all assignments."
    );
    if (!confirmed) return;

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
  }

  /* ----------------------------- */
  /* Revert to Draft               */
  /* ----------------------------- */

  async function handleRevertToDraft() {
    if (!monthIsLocked || reverting) return;

    const confirmed = window.confirm(
      "Revert this month to Draft? Assignments will be unlocked for editing."
    );
    if (!confirmed) return;

    setReverting(true);

    // TODO: implement PATCH /api/roster with { month, action: "revert" } on the server
    const res = await fetch("/api/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: activeMonth, action: "revert" }),
    });

    setReverting(false);

    if (!res.ok) {
      // Fallback: update local state so the UI reflects the revert in dev/mock mode
      setRoster((prev) =>
        prev.map((s) => ({
          ...s,
          status: "DRAFT" as RosterStatus,
          assignments: s.assignments.map((a) => ({
            ...a,
            status: "DRAFT" as RosterStatus,
            locked_at: null,
          })),
        }))
      );
      return;
    }

    await loadRoster();
  }

  /* ----------------------------- */
  /* UI                            */
  /* ----------------------------- */

  return (
    <div className="space-y-4">

      {/* Page Title */}
      <h1 className="text-xl font-bold text-gray-900">Worship Ministry Rostering</h1>

      {/* Month Navigation + Status */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: month nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMonthNotes(""); setActiveMonth((m) => addMonths(m, -1)); }}
            disabled={monthToNumber(activeMonth) <= monthToNumber(minMonth)}
            className={`p-1.5 rounded-md transition-colors ${monthToNumber(activeMonth) <= monthToNumber(minMonth) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            aria-label="Previous month"
          >
            ←
          </button>

          <span className="text-base font-semibold text-gray-900 min-w-[9rem] text-center">
            {getMonthLabel(activeMonth)}
            {activeMonth === currentMonth && (
              <span className="ml-2 text-xs text-white bg-green-600 px-2 py-0.5 rounded">Current</span>
            )}
          </span>

          <button
            onClick={() => { setMonthNotes(""); setActiveMonth((m) => addMonths(m, 1)); }}
            disabled={monthToNumber(activeMonth) >= monthToNumber(maxMonth)}
            className={`p-1.5 rounded-md transition-colors ${monthToNumber(activeMonth) >= monthToNumber(maxMonth) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            aria-label="Next month"
          >
            →
          </button>

          {/* hide jump when already on current month */}
          {activeMonth !== currentMonth && (
            <button
              onClick={() => { setMonthNotes(""); setActiveMonth(currentMonth); }}
              className="ml-3 px-2 py-1 text-sm rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
              Jump to Current
            </button>
          )}
        </div>

        {/* Right: top status badge + note */}
        {!loading && (
          <div className="flex items-center gap-4">
            <RosterBadge status={monthIsLocked ? "LOCKED" : "DRAFT"} />

            <div>
              <button
                onClick={() => setIsNoteOpen(true)}
                title={monthNotes ? 'View note' : 'Add note'}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-transparent hover:bg-gray-100"
              >
                {/* simple note icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                  <path d="M21 15v4a1 1 0 0 1-1 1H6l-5-5V5a1 1 0 0 1 1-1h14"></path>
                  <path d="M17 8h.01"></path>
                </svg>
                {monthNotes ? (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 text-[11px] font-semibold text-amber-900 bg-amber-300 rounded-full">1</span>
                ) : null}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Note modal handled via icon — keep table area uncluttered */}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading roster…</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                {ROSTER_COLUMN_ORDER.map((role) => (
                  <th key={role} className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {ROLE_LABEL_MAP[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((sunday) => (
                <tr key={sunday.date} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {formatSundayDate(sunday.date)}
                  </td>

                  {ROSTER_COLUMN_ORDER.map((role) => {
                    const assignment = sunday.assignments.find(
                      (a) => a.role.name === role
                    );

                    return (
                      <td key={role} className="px-2 py-2">
                        {assignment ? (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {assignment.member?.name ?? "—"}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom action buttons (Save / Finalise) — moved to bottom right */}
      {!loading && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleSaveDraft}
            disabled={saving || monthIsLocked}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>

          {monthIsLocked ? (
            <button
              onClick={handleRevertToDraft}
              disabled={reverting}
              className="px-4 py-2 rounded-lg text-sm text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {reverting ? "Reverting..." : "Revert to Draft"}
            </button>
          ) : (
            <button
              onClick={handleFinalise}
              disabled={finalising || !monthHasData}
              className="px-4 py-2 rounded-lg text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {finalising ? "Finalising..." : "✓ Finalise"}
            </button>
          )}
        </div>
      )}
      {/* Note edit/view modal */}
      {isNoteOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[720px] max-w-full p-6 border border-gray-200">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">{monthNotes ? 'View / Edit Note' : 'Add Note'}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsNoteOpen(false)} className="text-sm text-gray-500">Close</button>
              </div>
            </div>

            <div className="mt-4">
              <textarea
                value={monthNotes}
                onChange={(e) => setMonthNotes(e.target.value)}
                rows={8}
                className={`w-full text-sm ${monthIsLocked ? 'text-gray-600 bg-gray-50' : 'text-gray-800 bg-white'} border border-gray-200 rounded px-3 py-2`}
                readOnly={monthIsLocked}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsNoteOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button
                onClick={async () => {
                  if (monthIsLocked) { setIsNoteOpen(false); return; }
                  try {
                    const res = await fetch('/api/roster', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: activeMonth, notes: monthNotes }) });
                    if (!res.ok) throw new Error('Save failed');
                    setIsNoteOpen(false);
                    // reload roster to pick up any changes
                    await loadRoster();
                  } catch (err) {
                    alert('Failed to save note');
                  }
                }}
                disabled={monthIsLocked}
                className={`px-3 py-1 bg-[#071027] text-white rounded ${monthIsLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// notes are saved via modal control in the page; no standalone button needed
