"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROSTER_COLUMN_ORDER, ROLE_LABEL_MAP, ROLES } from "@/lib/constants/roles";
import { getSundaysInMonth, toISODate } from "@/lib/utils/dates";
import { RosterBadge } from "@/components/status-badge";
import makeDevRoster from "@/lib/mocks/devRoster";
import type { MemberRole, RosterStatus, SundayRoster, MemberWithRoles, RosterAssignmentWithDetails } from "@/lib/types/database";

function useCurrentMember() {
  const [member, setMember] = useState<{ app_role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setMember(data ?? null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { member, loading };
}

interface ApiAssignment {
  id: string;
  member_id: string;
  date: string;
  role: { id: number; name: MemberRole } | MemberRole;
  status: RosterStatus;
  assigned_at: string;
  locked_at: string | null;
  member?: { id: string; name: string };
  members?: { id: string; name: string };
}

interface ApiRosterResponse {
  assignments?: ApiAssignment[];
  notes?: string;
  error?: string;
}

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
  const { member, loading: memberLoading } = useCurrentMember();
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);
  // Only Admin and Coordinator can edit the roster grid.
  // Default to false (restrictive) while loading to prevent flash of edit controls.
  const canEditRoster = !memberLoading && member !== null &&
    (member.app_role === "Admin" || member.app_role === "Coordinator");

  const [activeMonth, setActiveMonth] = useState(getCurrentMonth);
  const [roster, setRoster] = useState<SundayRoster[]>([]);
  const [membersList, setMembersList] = useState<MemberWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [monthNotes, setMonthNotes] = useState("");
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  // A deferred action (navigation or month switch) waiting for user confirmation
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  // Ref mirrors isDirty so mount-only effects always read the live value
  const isDirtyRef = useRef(false);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, Record<string, boolean>>>({});
  // Navigation upper bound — starts at T+2, extended if an open period ends later
  const currentMonth = getCurrentMonth();
  const [maxMonth, setMaxMonth] = useState(() => addMonths(currentMonth, 2));

  function showToast(message: string, type: "success" | "error" = "success") {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 3000);
  }

  // Keep ref in sync so mount-only effects always read the latest isDirty value
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Unsaved-changes guard — installed once on mount
  useEffect(() => {
    // 1. Browser close / refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 2. In-app navigation: intercept anchor clicks in capture phase BEFORE Next.js sees them.
    //    This is more reliable than patching window.history.pushState because Next.js App Router
    //    uses React transitions that can bypass or reorder pushState calls.
    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href === window.location.pathname) return;
      // Only intercept same-origin in-app links
      if (anchor.target === "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      setPendingAction(() => () => routerRef.current.push(href));
    };
    document.addEventListener("click", handleAnchorClick, true); // capture phase

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorClick, true);
    };
  }, []); // mount-only — reads isDirtyRef; no stale closure risk

  // On mount: fetch open availability periods, extend maxMonth, and jump activeMonth
  // to the earliest open period's start month (so Feb/Mar finalized months are skipped).
  useEffect(() => {
    fetch("/api/availability/periods")
      .then((r) => r.ok ? r.json() : [])
      .then((periods: Array<{ starts_on: string; ends_on: string; closed_at: string | null }>) => {
        const open = (periods ?? []).filter((p) => !p.closed_at);
        if (open.length === 0) return;

        const startMonths = open.map((p) => p.starts_on.slice(0, 7)).sort();
        const endMonths   = open.map((p) => p.ends_on.slice(0, 7)).sort();
        const earliest = startMonths[0];
        const latest   = endMonths.at(-1)!;

        // Jump to the first open period's month if it's after the current month
        if (earliest > currentMonth) setActiveMonth(earliest);

        const defaultMax = addMonths(currentMonth, 2);
        if (latest > defaultMax) setMaxMonth(latest);
      })
      .catch(() => { /* keep defaults */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------- */
  /* Load Roster                   */
  /* ----------------------------- */

  // Navigation bounds relative to today
  const minMonth = addMonths(currentMonth, -6);
  // maxMonth is state — computed once on mount from open availability periods


  async function loadRoster() {
    setLoading(true);

    const res = await fetch(`/api/roster?month=${activeMonth}`);
    let json: ApiRosterResponse | null = null;
    try {
      json = await res.json() as ApiRosterResponse;
    } catch {
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
        (json?.assignments ?? [])
          .filter((a) => a.date === iso)
          .map((a): RosterAssignmentWithDetails => ({
            id: a.id,
            member_id: a.member_id,
            date: a.date,
            role_id: typeof a.role === "string" ? ROLE_ID_MAP[a.role as MemberRole] : a.role.id,
            // Normalize role shape: server mock may send a string like 'worship_lead',
            // while real DB rows include a role object { id, name } under the alias.
            role: typeof a.role === "string"
              ? { id: ROLE_ID_MAP[a.role as MemberRole], name: a.role }
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
            role_id: ROLE_ID_MAP[a.role as MemberRole],
            member_id: a.member?.id ?? null,
            status: a.status,
            assigned_by: null,
            assigned_at: new Date().toISOString(),
            locked_at: null,
            role: { id: ROLE_ID_MAP[a.role as MemberRole], name: a.role },
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

    async function loadMembers() {
      try {
        const res = await fetch('/api/members');
        if (!res.ok) throw new Error('Failed to load members');
        const data = await res.json();
        if (Array.isArray(data)) setMembersList(data as MemberWithRoles[]);
      } catch (e) {
        console.warn('Could not load members for roster selects', e);
        setMembersList([]);
      }
    }

    async function loadAvailability() {
      try {
        const [y, mo] = activeMonth.split("-").map(Number);
        const firstDay = `${activeMonth}-01`;
        const lastDayDate = new Date(y, mo, 0);
        const lastDay = `${y}-${String(mo).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

        const periodsRes = await fetch("/api/availability/periods");
        if (!periodsRes.ok) return;
        const allPeriods: Array<{ id: string; starts_on: string; ends_on: string; closed_at: string | null }> = await periodsRes.json();

        const matching = allPeriods.filter(
          (p) => p.starts_on <= lastDay && p.ends_on >= firstDay
        );
        if (matching.length === 0) { setAvailabilityMap({}); return; }

        const map: Record<string, Record<string, boolean>> = {};
        await Promise.all(
          matching.map(async (p) => {
            const detailRes = await fetch(`/api/availability/periods/${p.id}`);
            if (!detailRes.ok) return;
            const detail: { members: Array<{ member_id: string; dates: Array<{ date: string; available: boolean }> }> } = await detailRes.json();
            for (const m of detail.members) {
              for (const d of m.dates) {
                if (!map[d.date]) map[d.date] = {};
                map[d.date][m.member_id] = d.available;
              }
            }
          })
        );
        setAvailabilityMap(map);
      } catch {
        // non-critical — availability hints simply won't show
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRoster(); loadMembers(); loadAvailability(); }, [activeMonth]);

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

  // Guard month navigation when there are unsaved changes
  function navigateMonth(fn: () => void) {
    if (isDirty) {
      setPendingAction(() => fn);
      return;
    }
    setIsDirty(false);
    fn();
  }

  async function handleSaveDraft() {
    if (saving) return;

    setSaving(true);
    try {
      const flatAssignments = roster.flatMap((sunday) =>
        sunday.assignments
          .filter((a) => a.role != null)
          .map((a) => ({
            member_id: a.member_id,
            date: a.date,
            role_id: a.role.id ?? ROLE_ID_MAP[a.role.name as MemberRole],
          }))
      );

      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: flatAssignments }),
      });

      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }

      if (!res.ok) {
        showToast(json?.error ?? "Failed to save draft", "error");
        return;
      }

      await loadRoster();
      setIsDirty(false);
      showToast("Draft saved");
    } catch (err) {
      console.error("handleSaveDraft error:", err);
      showToast("An unexpected error occurred while saving", "error");
    } finally {
      setSaving(false);
    }
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
    try {
      // Save draft first, then lock
      await handleSaveDraft();

      const res = await fetch("/api/roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: activeMonth }),
      });

      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }

      if (!res.ok) {
        showToast(json?.error ?? "Failed to finalise", "error");
        return;
      }

      await loadRoster();
      setIsDirty(false);
      showToast("Roster finalised and locked");
    } catch (err) {
      console.error("handleFinalise error:", err);
      showToast("An unexpected error occurred while finalising", "error");
    } finally {
      setFinalising(false);
    }
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
    try {

    const res = await fetch("/api/roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: activeMonth, action: "revert" }),
      });

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
        showToast("Reverted to draft (offline)");
        return;
      }

      await loadRoster();
      setIsDirty(false);
      showToast("Roster reverted to draft");
    } catch (err) {
      console.error("handleRevertToDraft error:", err);
      showToast("An unexpected error occurred while reverting", "error");
    } finally {
      setReverting(false);
    }
  }

  /* ----------------------------- */
  /* UI                            */
  /* ----------------------------- */

  return (
    <div className="space-y-4">

      {/* Page Title */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Roster Manager</h1>
        <p className="text-sm text-gray-500 mt-0.5">Schedule and assign musicians for each Sunday</p>
      </div>

      {/* Month Navigation + Status */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: month nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(() => { setMonthNotes(""); setActiveMonth((m) => addMonths(m, -1)); })}
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
            onClick={() => navigateMonth(() => { setMonthNotes(""); setActiveMonth((m) => addMonths(m, 1)); })}
            disabled={monthToNumber(activeMonth) >= monthToNumber(maxMonth)}
            className={`p-1.5 rounded-md transition-colors ${monthToNumber(activeMonth) >= monthToNumber(maxMonth) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            aria-label="Next month"
          >
            →
          </button>

          {/* hide jump when already on current month */}
          {activeMonth !== currentMonth && (
            <button
              onClick={() => navigateMonth(() => { setMonthNotes(""); setActiveMonth(currentMonth); })}
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

      {/* Unsaved-changes navigation guard modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Unsaved changes</h2>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved roster changes. If you leave now your changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Stay &amp; keep editing
              </button>
              <button
                onClick={() => {
                  const action = pendingAction;
                  setPendingAction(null);
                  setIsDirty(false);
                  action();
                }}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {saveToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            saveToast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-gray-900 text-white"
          }`}
        >
          {saveToast.message}
        </div>
      )}

      {/* Note modal handled via icon — keep table area uncluttered */}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading roster…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
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
                <tr key={sunday.date} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-medium text-gray-900">
                    {new Date(sunday.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  {ROSTER_COLUMN_ORDER.map((role) => {
                    const assignment = sunday.assignments.find(
                      (a) => a.role.name === role
                    );
                    // lock all fields when the month is locked
                    const lockedForMonth = monthIsLocked;
                    // Only show members who have this role (instrument)
                    const candidates = membersList.filter((m) => m.roles?.includes(role as MemberRole));

                    // Split candidates by availability for this Sunday
                    const dateAvail = availabilityMap[sunday.date] ?? {};
                    const available   = candidates.filter((m) => dateAvail[m.id] === true);
                    const noResponse  = candidates.filter((m) => dateAvail[m.id] === undefined);
                    const unavailable = candidates.filter((m) => dateAvail[m.id] === false);

                    // Option D: warn if the currently assigned member is unavailable
                    const assignedId = assignment?.member_id ?? null;
                    const assignedIsUnavailable = assignedId != null && dateAvail[assignedId] === false;

                    // Warn if assigned member hasn't submitted availability for this date
                    // (only when an availability period actually covers this date)
                    const dateHasAvailabilityData = Object.keys(dateAvail).length > 0;
                    const assignedHasNoResponse =
                      assignedId != null &&
                      dateHasAvailabilityData &&
                      dateAvail[assignedId] === undefined;

                    // Double-booking: this member is already assigned to another role this Sunday.
                    // "setup" and "sound" are exempt — one person can cover both if needed.
                    const MULTI_OK_ROLES: string[] = ["setup", "sound"];
                    const isCurrentRoleExempt = MULTI_OK_ROLES.includes(role);
                    const assignedToOtherRoles = new Set(
                      sunday.assignments
                        .filter(
                          (a) =>
                            a.role?.name != null &&
                            a.role.name !== role &&
                            a.member_id != null &&
                            !MULTI_OK_ROLES.includes(a.role.name)
                        )
                        .map((a) => a.member_id!)
                    );
                    const assignedIsDoubleBooked =
                      !isCurrentRoleExempt &&
                      assignedId != null &&
                      assignedToOtherRoles.has(assignedId);
                    const otherRoleLabels = assignedIsDoubleBooked
                      ? sunday.assignments
                          .filter((a) => a.role?.name != null && a.role.name !== role && a.member_id === assignedId)
                          .map((a) => ROLE_LABEL_MAP[a.role.name] ?? a.role.name)
                      : [];

                    return (
                      <td key={role} className="px-2 py-2">
                        { !canEditRoster || (lockedForMonth) || (assignment && assignment.status === 'LOCKED') ? (
                          <span className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${assignedIsDoubleBooked ? "bg-red-50 text-gray-700" : assignedHasNoResponse ? "bg-blue-50 text-gray-700" : "bg-gray-100 text-gray-700"}`}>
                            {assignment?.member?.name ?? "—"}
                            {assignedIsDoubleBooked && (
                              <span title={`Also assigned to: ${otherRoleLabels.join(", ")}`} className="text-red-500">⚠</span>
                            )}
                            {assignedIsUnavailable && (
                              <span title="Marked unavailable for this date" className="text-amber-500">⚠</span>
                            )}
                            {assignedHasNoResponse && !assignedIsUnavailable && (
                              <span title="Hasn't responded to availability form" className="text-blue-500">?</span>
                            )}
                          </span>
                        ) : (
                          <div>
                            {assignedIsDoubleBooked && (
                              <p className="text-red-600 text-xs mb-0.5 flex items-center gap-0.5">
                                <span>⚠</span> Also booked: {otherRoleLabels.join(", ")}
                              </p>
                            )}
                            {assignedIsUnavailable && (
                              <p className="text-amber-600 text-xs mb-0.5 flex items-center gap-0.5">
                                <span>⚠</span> Unavailable
                              </p>
                            )}
                            {assignedHasNoResponse && !assignedIsUnavailable && (
                              <p className="text-blue-600 text-xs mb-0.5 flex items-center gap-0.5">
                                <span>?</span> No availability response
                              </p>
                            )}
                          <select
                            aria-label={`Assign ${ROLE_LABEL_MAP[role]}`}
                            value={assignment?.member_id ?? ""}
                            className={`w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 text-gray-800 bg-white ${
                              assignedIsDoubleBooked
                                ? "border-red-400 focus:ring-red-200"
                                : assignedIsUnavailable
                                ? "border-amber-400 focus:ring-amber-200"
                                : assignedHasNoResponse
                                ? "border-blue-400 focus:ring-blue-200"
                                : "border-gray-300 focus:ring-green-200"
                            }`}
                            onChange={(e) => {
                              setIsDirty(true);
                              const memberId = e.target.value || null;
                              const memberFull = candidates.find((m) => m.id === memberId) || undefined;
                              const member = memberFull ? { id: memberFull.id, name: memberFull.name } : undefined;

                              setRoster((prev) =>
                                prev.map((s) => {
                                  if (s.date !== sunday.date) return s;

                                  const existingIdx = s.assignments.findIndex((a) => a.role?.name === role);

                                  if (existingIdx >= 0) {
                                    const updated = s.assignments.map((a) => {
                                      if (a.role?.name !== role) return a;

                                      const newStatus: RosterStatus = a.status === 'LOCKED' ? 'LOCKED' : 'DRAFT';

                                      return {
                                        ...a,
                                        member_id: memberId,
                                        member,
                                        status: newStatus,
                                      };
                                    });
                                    return { ...s, assignments: updated };
                                  }

                                  // create a new assignment for this role (client-side draft)
                                  const newAssignment: RosterAssignmentWithDetails = {
                                    id: "",
                                    role_id: ROLE_ID_MAP[role as MemberRole],
                                    member_id: memberId,
                                    date: s.date,
                                    role: { id: ROLE_ID_MAP[role as MemberRole], name: role as MemberRole },
                                    status: 'DRAFT' as RosterStatus,
                                    assigned_by: null,
                                    assigned_at: new Date().toISOString(),
                                    locked_at: null,
                                    member,
                                  };

                                  return { ...s, assignments: [...s.assignments, newAssignment] };
                                })
                              );
                            }}
                          >
                            <option value="">— Unassigned —</option>
                            {available.length > 0 && (
                              <optgroup label="✓ Available">
                                {available.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}{assignedToOtherRoles.has(m.id) ? " (also booked)" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {noResponse.length > 0 && (
                              <optgroup label="— No response">
                                {noResponse.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}{assignedToOtherRoles.has(m.id) ? " (also booked)" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {unavailable.length > 0 && (
                              <optgroup label="✗ Unavailable">
                                {unavailable.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}{assignedToOtherRoles.has(m.id) ? " (also booked)" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          </div>
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

      {/* Bottom action buttons (Save / Finalise) — only visible to Admin and Coordinator */}
      {!loading && canEditRoster && (
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
                  } catch {
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
