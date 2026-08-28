"use client";

import { useEffect, useRef, useState } from "react";
import type { SundayRecordingWithTeam } from "@/lib/types/database";
import { ROLE_LABEL_MAP } from "@/lib/constants/roles";
import type { MemberRole } from "@/lib/types/database";
import { formatDuration } from "@/lib/utils/recordings";

import type { Permissions } from "@/lib/permissions";

function useCurrentMember() {
  const [member, setMember] = useState<{ app_role: string } | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) { setMember(data ?? null); setPermissions(data?.permissions ?? null); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { member, permissions, loading };
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function getDateVariants(isoDate: string): string[] {
  const d = new Date(isoDate + "T00:00:00");
  return [
    isoDate,
    d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
    d.toLocaleDateString("en-AU", { day: "numeric", month: "long" }),
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
    d.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
    d.toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
    d.toLocaleDateString("en-AU", { year: "numeric" }),
    d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }),
    d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
    String(d.getDate()),
    String(d.getFullYear()),
  ].map((s) => s.toLowerCase());
}

function matchesSearch(recording: SundayRecordingWithTeam, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  if (recording.title.toLowerCase().includes(q)) return true;
  if (getDateVariants(recording.sunday_date).some((v) => v.includes(q))) return true;
  if (recording.featured_members.some((m) => m.name.toLowerCase().includes(q))) return true;
  return false;
}

/** Duration in seconds → "MM:SS" string for pre-filling the edit form. */
function secondsToMMSS(s: number | null): string {
  if (s == null) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function AdminRecordingsPage() {
  const { member, permissions, loading: memberLoading } = useCurrentMember();
  const canUpload = !memberLoading && member !== null &&
    !!permissions?.recordings?.includes("write");

  const [recordings, setRecordings] = useState<SundayRecordingWithTeam[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<SundayRecordingWithTeam | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<SundayRecordingWithTeam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadRecordings() {
    const res = await fetch("/api/recordings");
    if (!res.ok) {
      let msg = `Failed to load recordings (${res.status})`;
      try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
      setLoadError(msg);
      return;
    }
    const data: unknown = await res.json();
    if (Array.isArray(data)) setRecordings(data as SundayRecordingWithTeam[]);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/recordings");
        if (!res.ok) {
          let msg = `Failed to load recordings (${res.status})`;
          try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
          if (!cancelled) setLoadError(msg);
          return;
        }
        const data: unknown = await res.json();
        if (!cancelled && Array.isArray(data)) setRecordings(data as SundayRecordingWithTeam[]);
      } catch (err) {
        console.error("Could not load /api/recordings:", err);
        if (!cancelled) setLoadError("Network error — could not load recordings.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleUpload(payload: RecordingFormValues) {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        setSaveError(json?.error ?? "Failed to upload recording");
        return;
      }
      await loadRecordings();
      setIsUploadOpen(false);
      showToast("Recording uploaded successfully");
    } catch (err) {
      console.error("handleUpload error:", err);
      setSaveError("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit(payload: RecordingFormValues) {
    if (!editing || isEditing) return;
    setIsEditing(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/recordings/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        setEditError(json?.error ?? "Failed to save changes");
        return;
      }
      await loadRecordings();
      setIsEditOpen(false);
      setEditing(null);
      showToast("Recording updated");
    } catch (err) {
      console.error("handleEdit error:", err);
      setEditError("An unexpected error occurred");
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDelete() {
    if (!deleting || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recordings/${deleting.id}`, { method: "DELETE" });
      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        showToast(json?.error ?? "Failed to delete recording", "error");
        return;
      }
      setRecordings((prev) => prev.filter((r) => r.id !== deleting.id));
      setIsDeleteOpen(false);
      setDeleting(null);
      showToast("Recording deleted");
    } catch (err) {
      console.error("handleDelete error:", err);
      showToast("An unexpected error occurred", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredRecordings = recordings.filter((r) => matchesSearch(r, searchQuery));

  if (loadError) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-sm text-red-700 max-w-md text-center">
          <p className="font-medium mb-1">Could not load recordings</p>
          <p className="text-red-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">Sunday Recordings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Upload and manage post-service recordings</p>
          </div>
          <div className="flex items-center gap-3 flex-1 justify-end">
            {recordings.length > 0 && (
              <input
                type="search"
                aria-label="Search recordings"
                placeholder="Search by title, date, or member…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            )}
            {canUpload && (
              <button
                onClick={() => { setSaveError(null); setIsUploadOpen(true); }}
                className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shrink-0"
              >
                + Upload Recording
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
          {recordings.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No recordings yet. Upload one to get started.
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No recordings found for &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs border-b border-gray-100">
                  <th className="px-4 py-3 text-gray-600 font-medium">Title</th>
                  <th className="px-4 py-3 text-gray-600 font-medium">Date</th>
                  <th className="px-4 py-3 text-gray-600 font-medium">Type</th>
                  <th className="px-4 py-3 text-gray-600 font-medium">Duration</th>
                  <th className="px-4 py-3 text-gray-600 font-medium">Musicians</th>
                  <th className="px-4 py-3 text-gray-600 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecordings.map((rec) => (
                  <tr key={rec.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{rec.title}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(rec.sunday_date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 uppercase tracking-wide">
                        {rec.recording_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {formatDuration(rec.duration_seconds) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {rec.featured_members.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rec.featured_members.map((m) => (
                            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium whitespace-nowrap">
                              {m.name.split(" ")[0]}
                              <span className="text-blue-400 font-normal">· {m.instrument}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center">
                        <a
                          href={rec.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Open
                        </a>
                        {canUpload && (
                          <>
                            <button
                              onClick={() => {
                                setEditError(null);
                                setEditing(rec);
                                setIsEditOpen(true);
                              }}
                              className="px-3 py-1 rounded border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setDeleting(rec); setIsDeleteOpen(true); }}
                              className="px-3 py-1 rounded border border-red-300 text-xs text-red-600 bg-white hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && canUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Upload Recording</h2>
            </div>
            {saveError && (
              <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {saveError}
              </div>
            )}
            <div className="px-6 py-5">
              <RecordingForm
                isSaving={isSaving}
                onCancel={() => setIsUploadOpen(false)}
                onSave={handleUpload}
                fetchRosterOnDateChange
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && editing && canUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Edit Recording</h2>
            </div>
            {editError && (
              <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {editError}
              </div>
            )}
            <div className="px-6 py-5">
              <RecordingForm
                isSaving={isEditing}
                onCancel={() => { setIsEditOpen(false); setEditing(null); }}
                onSave={handleEdit}
                initialValues={{
                  title: editing.title,
                  sunday_date: editing.sunday_date,
                  recording_type: editing.recording_type,
                  drive_url: editing.drive_url,
                  duration: secondsToMMSS(editing.duration_seconds),
                }}
                initialMembers={editing.featured_members.map(({ name, instrument }) => ({ name, instrument }))}
                submitLabel="Save Changes"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteOpen && deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Delete Recording?</h3>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to delete &quot;{deleting.title}&quot;? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => { setIsDeleteOpen(false); setDeleting(null); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg border border-red-300 text-sm text-red-600 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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

interface LineupMember {
  name: string;
  instrument: string;
}

interface RecordingFormValues {
  title: string;
  sunday_date: string;
  recording_type: "audio" | "video";
  drive_url: string;
  duration: string;
  featured_members_override: LineupMember[] | null;
}

const NON_MUSICIAN_ROLES = new Set(["sound", "setup"]);

function RecordingForm({
  isSaving,
  onCancel,
  onSave,
  initialValues,
  initialMembers,
  fetchRosterOnDateChange = false,
  submitLabel = "Upload",
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSave: (p: RecordingFormValues) => void;
  initialValues?: Partial<Omit<RecordingFormValues, "featured_members_override">>;
  initialMembers?: LineupMember[] | null;
  fetchRosterOnDateChange?: boolean;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [sundayDate, setSundayDate] = useState(initialValues?.sunday_date ?? "");
  const [recordingType, setRecordingType] = useState<"audio" | "video">(initialValues?.recording_type ?? "audio");
  const [driveUrl, setDriveUrl] = useState(initialValues?.drive_url ?? "");
  const [duration, setDuration] = useState(initialValues?.duration ?? "");

  // Always show lineup editor; null = not yet loaded, [] = empty
  const [lineup, setLineup] = useState<LineupMember[] | null>(
    initialMembers !== undefined ? (initialMembers ?? []) : (fetchRosterOnDateChange ? [] : null)
  );
  const lastFetchedDate = useRef<string | null>(null);

  // Auto-populate lineup from roster when date changes (Upload mode only)
  useEffect(() => {
    if (!fetchRosterOnDateChange || !sundayDate || sundayDate === lastFetchedDate.current) return;
    lastFetchedDate.current = sundayDate;
    const month = sundayDate.slice(0, 7); // YYYY-MM
    fetch(`/api/roster?month=${month}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { assignments?: { date: string; role: { name: string } | null; member: { id: string; name: string } | null }[] } | null) => {
        if (!data?.assignments) return;
        const seen = new Set<string>();
        const members: LineupMember[] = [];
        for (const a of data.assignments) {
          if (a.date !== sundayDate || !a.member || !a.role) continue;
          if (NON_MUSICIAN_ROLES.has(a.role.name)) continue;
          if (seen.has(a.member.id)) continue;
          seen.add(a.member.id);
          const roleKey = a.role.name as MemberRole;
          members.push({ name: a.member.name, instrument: ROLE_LABEL_MAP[roleKey] ?? a.role.name });
        }
        setLineup(members);
      })
      .catch(() => { /* silently leave lineup as-is */ });
  }, [sundayDate, fetchRosterOnDateChange]);

  function updateMember(index: number, field: keyof LineupMember, value: string) {
    setLineup((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeMember(index: number) {
    setLineup((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  }

  function addMember() {
    setLineup((prev) => prev ? [...prev, { name: "", instrument: "" }] : [{ name: "", instrument: "" }]);
  }

  const featured_members_override = lineup !== null
    ? lineup.filter((m) => m.name.trim())
    : null;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
        <input
          className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="e.g. Sunday Morning Service - Live Mix"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Date + Type row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sunday Date</label>
          <input
            type="date"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={sundayDate}
            onChange={(e) => setSundayDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <select
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={recordingType}
            onChange={(e) => setRecordingType(e.target.value as "audio" | "video")}
          >
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
        </div>
      </div>

      {/* Google Drive URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Google Drive URL
        </label>
        <input
          type="url"
          className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="https://drive.google.com/file/d/…/view"
          value={driveUrl}
          onChange={(e) => setDriveUrl(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-400">Paste the share link from Google Drive</p>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Duration <span className="text-gray-400 font-normal">(optional, MM:SS)</span>
        </label>
        <input
          className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="e.g. 45:22"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>

      {/* Lineup editor — only shown in Edit modal */}
      {lineup !== null && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Musicians <span className="text-gray-400 font-normal">(overrides the roster lineup)</span>
          </label>
          <div className="space-y-2">
            {lineup.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Name"
                  value={m.name}
                  onChange={(e) => updateMember(i, "name", e.target.value)}
                />
                <input
                  className="w-36 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Instrument"
                  value={m.instrument}
                  onChange={(e) => updateMember(i, "instrument", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  className="px-2 py-2 rounded-lg border border-red-300 text-xs text-red-600 bg-white hover:bg-red-50"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMember}
            className="mt-2 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50"
          >
            + Add musician
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          disabled={isSaving}
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          disabled={isSaving || !title.trim() || !sundayDate || !driveUrl.trim()}
          onClick={() => onSave({ title: title.trim(), sunday_date: sundayDate, recording_type: recordingType, drive_url: driveUrl.trim(), duration: duration.trim(), featured_members_override })}
          className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
