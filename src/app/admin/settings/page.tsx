"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { AppRole } from "@/lib/types/database";

const HANDBOOK_TOGGLEABLE_ROLES: { role: AppRole; label: string; description: string }[] = [
  { role: "Coordinator", label: "Coordinator", description: "Can edit all handbook sections" },
  { role: "WorshipLeader", label: "Worship Leader", description: "Can edit all handbook sections" },
  { role: "MusicCoordinator", label: "Music Coordinator", description: "Can edit all handbook sections" },
];

const ROLE_LABEL: Record<AppRole, string> = {
  Admin: "Admin",
  Coordinator: "Coordinator",
  WorshipLeader: "Worship Leader",
  MusicCoordinator: "Music Coordinator",
  Musician: "Musician",
};

type MemberOption = { id: string; name: string; app_role: AppRole; is_active: boolean };

export default function AdminSettingsPage() {
  const [futureMonths, setFutureMonths] = useState<number | null>(null);
  const [historyMonths, setHistoryMonths] = useState<number | null>(null);
  const [maxSongsPerSetlist, setMaxSongsPerSetlist] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Handbook permissions
  const [handbookEditorRoles, setHandbookEditorRoles] = useState<AppRole[]>(["Admin", "Coordinator"]);
  const [handbookEditorMemberIds, setHandbookEditorMemberIds] = useState<string[]>([]);
  const [handbookPermLoading, setHandbookPermLoading] = useState(true);
  const [handbookPermSaving, setHandbookPermSaving] = useState(false);
  const [handbookPermError, setHandbookPermError] = useState<string | null>(null);

  // Member list for individual access picker
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (cancelled) return;
        setFutureMonths(json.future_months ?? 2);
        setHistoryMonths(json.history_months ?? 6);
        setMaxSongsPerSetlist(json.max_songs_per_setlist ?? 3);
      } catch (err: unknown) {
        const e = err as { message?: string };
        setError(e?.message || 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    async function loadHandbookPerms() {
      setHandbookPermLoading(true);
      try {
        const res = await fetch('/api/settings/handbook-permissions');
        const json = await res.json();
        if (cancelled) return;
        setHandbookEditorRoles(json.editor_roles ?? ["Admin", "Coordinator"]);
        setHandbookEditorMemberIds(json.editor_member_ids ?? []);
      } catch {
        // keep defaults on error
      } finally {
        if (!cancelled) setHandbookPermLoading(false);
      }
    }
    async function loadMembers() {
      setMembersLoading(true);
      try {
        const res = await fetch('/api/members');
        const json = await res.json();
        if (cancelled) return;
        setAllMembers(
          (json as MemberOption[])
            .filter((m) => m.is_active && m.app_role !== "Admin")
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch {
        // non-critical — picker just stays empty
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }
    load();
    loadHandbookPerms();
    loadMembers();
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          future_months: Number(futureMonths),
          history_months: Number(historyMonths),
          max_songs_per_setlist: Number(maxSongsPerSetlist),
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('Settings saved');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toggleHandbookRole(role: AppRole) {
    setHandbookEditorRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function addMember() {
    if (!selectedMemberId || handbookEditorMemberIds.includes(selectedMemberId)) return;
    setHandbookEditorMemberIds((prev) => [...prev, selectedMemberId]);
    setSelectedMemberId("");
  }

  function removeMember(id: string) {
    setHandbookEditorMemberIds((prev) => prev.filter((m) => m !== id));
  }

  async function saveHandbookPerms() {
    if (handbookPermSaving) return;
    setHandbookPermSaving(true);
    setHandbookPermError(null);
    try {
      const res = await fetch('/api/settings/handbook-permissions', {
        method: 'PUT',
        body: JSON.stringify({
          editor_roles: handbookEditorRoles,
          editor_member_ids: handbookEditorMemberIds,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      let json: { error?: string; editor_roles?: AppRole[]; editor_member_ids?: string[] } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        setHandbookPermError(json?.error ?? 'Failed to save');
        return;
      }
      if (json?.editor_roles) setHandbookEditorRoles(json.editor_roles);
      if (json?.editor_member_ids) setHandbookEditorMemberIds(json.editor_member_ids);
      showToast('Handbook permissions saved');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setHandbookPermError(e?.message ?? 'Failed to save');
    } finally {
      setHandbookPermSaving(false);
    }
  }

  return (
    <>
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Application configuration and feature flags</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar for future settings categories (desktop-first) */}
          <aside className="hidden md:block">
            <nav className="sticky top-6 space-y-2">
              <button className="w-full text-left px-3 py-2 rounded-md bg-gray-50 border border-gray-100 text-sm font-medium">General</button>
              {/* placeholder for future categories */}
              <div className="mt-3 text-xs text-gray-500">More categories will appear here as settings grow.</div>
            </nav>
          </aside>

          {/* Main content */}
          <main className="md:col-span-2">
            <Card className="p-6 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Roster Pagination</h2>
                  <p className="text-sm text-gray-600 mt-1">Control how many months are navigable for admins (future and historical limits).</p>
                </div>
                <div>
                  <Button onClick={save} className="bg-[#071027] text-white" disabled={saving || loading}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-800">Future months</label>
                  <Input type="number" min={0} value={futureMonths ?? ''} onChange={(e) => setFutureMonths(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-800">Historical months</label>
                  <Input type="number" min={0} value={historyMonths ?? ''} onChange={(e) => setHistoryMonths(Number(e.target.value))} />
                </div>
              </div>

              {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

              <div className="mt-6 flex justify-end">
                <Button onClick={save} className="bg-[#071027] text-white" disabled={saving || loading}>{saving ? 'Saving...' : 'Save Settings'}</Button>
              </div>
            </Card>

            <Card className="mt-6 p-6 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Setlist</h2>
                  <p className="text-sm text-gray-600 mt-1">Control the maximum number of songs a Worship Lead can add to a Sunday setlist. Increase this for special Sundays (e.g. Easter, Christmas) that need more songs.</p>
                </div>
                <div>
                  <Button onClick={save} className="bg-[#071027] text-white" disabled={saving || loading}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-800">Max songs per setlist</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxSongsPerSetlist ?? ''}
                    onChange={(e) => setMaxSongsPerSetlist(Number(e.target.value))}
                  />
                  <p className="mt-1 text-xs text-gray-500">Default is 3. Applies globally to all upcoming Sundays.</p>
                </div>
              </div>
            </Card>

            <Card className="mt-6 p-6 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Team Handbook — Edit Permissions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose which roles can edit the Team Handbook. Admin always has edit access and cannot be removed.
                  </p>
                </div>
                <div>
                  <Button
                    onClick={saveHandbookPerms}
                    className="bg-[#071027] text-white"
                    disabled={handbookPermSaving || handbookPermLoading}
                  >
                    {handbookPermSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {/* Admin — always on, locked */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Admin</span>
                    <p className="text-xs text-gray-500 mt-0.5">Always enabled — cannot be removed</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-900 text-white">
                    Always on
                  </span>
                </div>

                {/* Toggleable roles */}
                {HANDBOOK_TOGGLEABLE_ROLES.map(({ role, label, description }) => {
                  const enabled = handbookEditorRoles.includes(role);
                  return (
                    <div
                      key={role}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleHandbookRole(role)}
                        disabled={handbookPermLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                          enabled ? "bg-gray-900" : "bg-gray-200"
                        }`}
                        aria-pressed={enabled}
                        aria-label={`Toggle ${label} edit access`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}

                {/* Musician — always off, informational */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <span className="text-sm font-medium text-gray-400">Musician</span>
                    <p className="text-xs text-gray-400 mt-0.5">Read-only — cannot be granted edit access</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                    Always off
                  </span>
                </div>
              </div>

              {/* Individual access grants */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Individual Access</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Grant edit access to a specific person regardless of their role. Useful when one individual needs access without enabling the whole role.
                </p>

                {/* Picker */}
                <div className="mt-3 flex gap-2">
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    disabled={membersLoading || handbookPermLoading}
                    className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a person…</option>
                    {allMembers
                      .filter((m) => !handbookEditorMemberIds.includes(m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({ROLE_LABEL[m.app_role] ?? m.app_role})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addMember}
                    disabled={!selectedMemberId || membersLoading}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>

                {/* Granted individuals list */}
                {handbookEditorMemberIds.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {handbookEditorMemberIds.map((id) => {
                      const m = allMembers.find((x) => x.id === id);
                      const hasRoleAccess = m && handbookEditorRoles.includes(m.app_role);
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 bg-gray-50"
                        >
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {m?.name ?? id}
                            </span>
                            {m && (
                              <span className="ml-2 text-xs text-gray-500">
                                {ROLE_LABEL[m.app_role] ?? m.app_role}
                              </span>
                            )}
                            {hasRoleAccess && (
                              <span className="ml-2 text-xs text-blue-500">
                                (also has access via role)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMember(id)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {handbookEditorMemberIds.length === 0 && (
                  <p className="mt-3 text-xs text-gray-400 italic">No individual access grants yet.</p>
                )}
              </div>

              {handbookPermError && (
                <div className="mt-4 text-sm text-red-600">{handbookPermError}</div>
              )}
            </Card>
          </main>
        </div>
      </div>
    </div>

    {toast && (
      <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-gray-900 text-white">
        {toast}
      </div>
    )}
    </>
  );
}
