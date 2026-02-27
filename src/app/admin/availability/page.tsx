"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AvailabilityPeriod } from "@/lib/types/database";

type PeriodWithCounts = AvailabilityPeriod & {
  response_count: number;
  total_musicians: number;
};

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

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Compute the next 2-month window from the day after a period ends. */
function suggestNextPeriod(lastEndsOn: string): { label: string; starts_on: string; ends_on: string } {
  const lastEnd = new Date(lastEndsOn + "T00:00:00");
  // Start month = month after the period ends
  const startMonth = new Date(lastEnd.getFullYear(), lastEnd.getMonth() + 1, 1);
  // Last day of the month after startMonth
  const endMonthLastDay = new Date(startMonth.getFullYear(), startMonth.getMonth() + 2, 0);

  // First Sunday on-or-after 1st of start month
  const firstSunday = new Date(startMonth);
  while (firstSunday.getDay() !== 0) firstSunday.setDate(firstSunday.getDate() + 1);

  // Last Sunday on-or-before last day of end month
  const lastSunday = new Date(endMonthLastDay);
  while (lastSunday.getDay() !== 0) lastSunday.setDate(lastSunday.getDate() - 1);

  const startMon = MONTHS[firstSunday.getMonth()];
  const endMon = MONTHS[lastSunday.getMonth()];
  const year = lastSunday.getFullYear();
  const label = startMon === endMon ? `${startMon} ${year}` : `${startMon}–${endMon} ${year}`;

  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { label, starts_on: toISO(firstSunday), ends_on: toISO(lastSunday) };
}

function deadlineStatus(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + "T00:00:00");
  const diff = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: "text-red-600" };
  if (diff === 0) return { label: "Due today", color: "text-orange-600" };
  if (diff <= 3) return { label: `Due in ${diff}d`, color: "text-orange-500" };
  return { label: `Due in ${diff}d`, color: "text-gray-500" };
}

export default function AdminAvailabilityPage() {
  const { member, loading: memberLoading } = useCurrentMember();
  const BLOCKED_ROLES = ["WorshipLeader", "MusicCoordinator"];
  const isBlocked = !memberLoading && member !== null && BLOCKED_ROLES.includes(member.app_role);
  const canEdit = !memberLoading && member !== null &&
    member.app_role !== "WorshipLeader" &&
    member.app_role !== "MusicCoordinator";

  const router = useRouter();

  const [periods, setPeriods] = useState<PeriodWithCounts[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New / edit period form state
  const [editingPeriod, setEditingPeriod] = useState<PeriodWithCounts | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formStartsOn, setFormStartsOn] = useState("");
  const [formEndsOn, setFormEndsOn] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete busy state — holds the id currently being deleted
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/availability/periods")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled) { setPeriods(data); setListLoading(false); } })
      .catch(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openModal(prefill?: { label?: string; starts_on?: string; ends_on?: string }) {
    setEditingPeriod(null);
    setFormLabel(prefill?.label ?? "");
    setFormStartsOn(prefill?.starts_on ?? "");
    setFormEndsOn(prefill?.ends_on ?? "");
    setFormDeadline("");
    setSaveError(null);
    setShowModal(true);
  }

  function openEditModal(period: PeriodWithCounts) {
    setEditingPeriod(period);
    setFormLabel(period.label);
    setFormStartsOn(period.starts_on);
    setFormEndsOn(period.ends_on);
    setFormDeadline(period.deadline ?? "");
    setSaveError(null);
    setShowModal(true);
  }

  function closeModal() {
    if (isSaving) return;
    setShowModal(false);
    setEditingPeriod(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaveError(null);

    const isEditing = editingPeriod !== null;
    const datesLocked = isEditing && (editingPeriod?.response_count ?? 0) > 0;

    if (!isEditing) {
      // Create mode: client-side overlap check (edit mode skips this since dates may be unchanged)
      const openPeriods = periods.filter((p) => !p.closed_at);
      const clientConflict = openPeriods.find(
        (p) => formStartsOn <= p.ends_on && formEndsOn >= p.starts_on
      );
      if (clientConflict) {
        setSaveError(
          `Date range overlaps "${clientConflict.label}" (${clientConflict.starts_on} – ${clientConflict.ends_on}). Close it first or choose non-overlapping dates.`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      let res: Response;
      if (isEditing) {
        res = await fetch(`/api/availability/periods/${editingPeriod!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formLabel.trim(),
            // Only send dates when they haven't been locked (no responses yet)
            ...(!datesLocked && { starts_on: formStartsOn, ends_on: formEndsOn }),
            deadline: formDeadline || null,
          }),
        });
      } else {
        res = await fetch("/api/availability/periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formLabel.trim(),
            starts_on: formStartsOn,
            ends_on: formEndsOn,
            deadline: formDeadline || null,
          }),
        });
      }
      if (!res.ok) {
        let err: { error?: string } | null = null;
        try { err = await res.json(); } catch { /* ignore */ }
        setSaveError(err?.error ?? (isEditing ? "Failed to save changes" : "Failed to create period"));
        return;
      }
      const updated = await fetch("/api/availability/periods").then((r) => r.json()).catch(() => []);
      setPeriods(updated);
      closeModal();
      showToast(isEditing ? "Period updated" : "Period created");
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeletePeriod(period: PeriodWithCounts, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (period.response_count > 0) return;
    if (!window.confirm(`Delete "${period.label}"? This cannot be undone.`)) return;
    setDeletingId(period.id);
    try {
      const res = await fetch(`/api/availability/periods/${period.id}`, { method: "DELETE" });
      if (!res.ok) {
        let err: { error?: string } | null = null;
        try { err = await res.json(); } catch { /* ignore */ }
        showToast(err?.error ?? "Failed to delete", "error");
        return;
      }
      const updated = await fetch("/api/availability/periods").then((r) => r.json()).catch(() => []);
      setPeriods(updated);
      showToast(`"${period.label}" deleted`);
    } catch {
      showToast("Network error", "error");
    } finally {
      setDeletingId(null);
    }
  }

  // Status card logic — compute nextOpen first so lastClosed can reference it.
  const nextOpen: PeriodWithCounts | null = !listLoading
    ? (periods
        .filter((p) => !p.closed_at)
        .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null)
    : null;

  // "Last round" = the most recently-ended closed period that predates the current round.
  // Sort by ends_on (not closed_at) so a same-cycle duplicate that was closed doesn't appear here.
  const closedByEndDate = !listLoading
    ? periods
        .filter((p) => !!p.closed_at)
        .sort((a, b) => b.ends_on.localeCompare(a.ends_on))
    : [];
  const lastClosed: PeriodWithCounts | null = nextOpen
    ? (closedByEndDate.find((p) => p.ends_on < nextOpen.starts_on) ?? null)
    : (closedByEndDate[0] ?? null);

  // Suggestion only relevant when there's no open period and we have at least one closed period
  const suggestion = !nextOpen && lastClosed ? suggestNextPeriod(lastClosed.ends_on) : null;

  if (isBlocked) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-sm w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Access restricted</h2>
          <p className="text-sm text-gray-500">Availability management is handled by your Coordinator.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Availability</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage availability rounds and track responses</p>
        </div>
        {canEdit && (
          <button
            onClick={() => openModal()}
            className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium"
          >
            + New Period
          </button>
        )}
      </div>

      {/* Round Status Card */}
      {!listLoading && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Round Status</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200">

            {/* LEFT — Last closed round */}
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Last round</p>
              {lastClosed ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900" data-testid="last-period-label">{lastClosed.label}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Closed</span>
                    {lastClosed.response_count >= lastClosed.total_musicians && lastClosed.total_musicians > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">All responded</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDate(lastClosed.starts_on)} – {formatDate(lastClosed.ends_on)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {lastClosed.response_count} / {lastClosed.total_musicians} responses
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No completed rounds yet</p>
              )}
            </div>

            {/* RIGHT — Current round (open or suggested) */}
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Current round</p>
              {nextOpen ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900" data-testid="next-period-label">{nextOpen.label}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Open</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDate(nextOpen.starts_on)} – {formatDate(nextOpen.ends_on)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {nextOpen.response_count} / {nextOpen.total_musicians} responses so far
                  </p>
                </div>
              ) : suggestion ? (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{suggestion.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">Suggested</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(suggestion.starts_on)} – {formatDate(suggestion.ends_on)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Based on the last closed round</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => openModal(suggestion)}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium"
                    >
                      Start this round →
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No upcoming round — use <span className="font-medium text-gray-600">+ New Period</span> above to start one.</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Periods list */}
      {listLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : periods.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm font-medium">No availability periods yet</p>
          {canEdit && (
            <p className="text-xs mt-1">Click <span className="font-medium">+ New Period</span> to get started</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => {
            const isClosed = !!period.closed_at;
            const responded = period.response_count;
            const total = period.total_musicians;
            const allResponded = responded >= total && total > 0;
            const dl = deadlineStatus(period.deadline);
            const isBeingDeleted = deletingId === period.id;

            return (
              <div
                key={period.id}
                onClick={() => router.push(`/admin/availability/${period.id}`)}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{period.label}</span>
                      {isClosed ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Closed</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Open</span>
                      )}
                      {!isClosed && allResponded && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">All responded</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(period.starts_on)} – {formatDate(period.ends_on)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    {/* Response count */}
                    <div>
                      <p className={`text-sm font-semibold ${allResponded ? "text-green-700" : "text-gray-900"}`}>
                        {responded} / {total}
                      </p>
                      <p className="text-xs text-gray-400">responded</p>
                    </div>
                    {/* Deadline */}
                    {period.deadline && (
                      <div>
                        <p className={`text-xs font-medium ${dl?.color ?? "text-gray-500"}`}>{dl?.label}</p>
                        <p className="text-xs text-gray-400">{formatDate(period.deadline)}</p>
                      </div>
                    )}
                    {/* Actions — stopPropagation so clicking buttons doesn't navigate */}
                    {canEdit && (
                      <div
                        className="flex items-center gap-1 pl-2 border-l border-gray-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEditModal(period)}
                          className="px-2.5 py-1 rounded-lg border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        {responded === 0 && (
                          <button
                            onClick={(e) => handleDeletePeriod(period, e)}
                            disabled={isBeingDeleted}
                            className="px-2.5 py-1 rounded-lg border border-red-300 text-xs text-red-600 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isBeingDeleted ? "…" : "Delete"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${Math.min(100, (responded / total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Period Modal */}
      {showModal && canEdit && (() => {
        const isEditing = editingPeriod !== null;
        const datesLocked = isEditing && (editingPeriod?.response_count ?? 0) > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">
                  {isEditing ? "Edit Period" : "New Availability Period"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEditing
                    ? "Update the label or deadline. Date range is locked once responses are collected."
                    : "Define the date range and deadline for this round"}
                </p>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                {saveError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
                )}

                {/* Live overlap warning — create mode only */}
                {!isEditing && !saveError && formStartsOn && formEndsOn && (() => {
                  const conflict = periods.filter((p) => !p.closed_at).find(
                    (p) => formStartsOn <= p.ends_on && formEndsOn >= p.starts_on
                  );
                  return conflict ? (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="text-amber-500 mt-0.5">⚠</span>
                      <p className="text-xs text-amber-700">
                        These dates overlap the open period <strong>{conflict.label}</strong> ({conflict.starts_on} – {conflict.ends_on}). Close it first or pick non-overlapping dates.
                      </p>
                    </div>
                  ) : null;
                })()}

                {/* Date-locked notice — edit mode with responses */}
                {datesLocked && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-amber-500 mt-0.5">🔒</span>
                    <p className="text-xs text-amber-700">
                      Date range is locked — {editingPeriod!.response_count} response{editingPeriod!.response_count !== 1 ? "s" : ""} already collected. Only label and deadline can be changed.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. April–May 2026"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    required
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      First Sunday {!datesLocked && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="date"
                      value={formStartsOn}
                      onChange={(e) => setFormStartsOn(e.target.value)}
                      required={!datesLocked}
                      disabled={datesLocked}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Last Sunday {!datesLocked && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="date"
                      value={formEndsOn}
                      onChange={(e) => setFormEndsOn(e.target.value)}
                      required={!datesLocked}
                      disabled={datesLocked}
                      className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Response deadline <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (isEditing ? "Saving…" : "Creating…") : (isEditing ? "Save Changes" : "Create Period")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
