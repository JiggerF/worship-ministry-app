"use client";

import { useState, useEffect } from "react";
import { ROLES, ROLE_LABEL_MAP } from "@/lib/constants/roles";
import type { MemberWithRoles, MemberRole, AppRole } from "@/lib/types/database";

// Define MemberFormData type
interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  app_role: AppRole;
  roles: MemberRole[];
}

function useCurrentMember() {
  const [member, setMember] = useState<MemberWithRoles | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    // Use the server-side /api/me endpoint which reads the session from cookies
    // cache: "no-store" prevents stale identity after a login switch.
    // and queries members via service role key — works regardless of RLS policies.
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setMember(data ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { member, loading };
}

export default function AdminPeoplePage() {
  const { member, loading: memberLoading } = useCurrentMember();
  // Hide action buttons while loading (member is null) AND when role lacks edit permission.
  // Defaulting to hidden prevents a flash of edit buttons before the role is confirmed.
  const canEdit = !memberLoading && member !== null &&
    member.app_role !== "Coordinator" &&
    member.app_role !== "WorshipLeader" &&
    member.app_role !== "MusicCoordinator";
  // Initialize empty when not in mock mode — avoids the mock-data flash on load
  const [members, setMembers] = useState<MemberWithRoles[]>([]);

  // Filter out Admin users for Coordinator, WorshipLeader, and MusicCoordinator
  const READ_ONLY_ROLES = ["Coordinator", "WorshipLeader", "MusicCoordinator"];
  const filteredMembers = member && READ_ONLY_ROLES.includes(member.app_role)
    ? members.filter((m) => m.app_role !== "Admin")
    : members;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/members");
        if (!res.ok) throw new Error("Failed to load members");
        const data: MemberWithRoles[] = await res.json();
        if (!cancelled) setMembers(data);
      } catch (e) {
        console.warn("Could not load /api/members, keeping local mock.", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithRoles | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [form, setForm] = useState<MemberFormData>({
    name: "",
    email: "",
    phone: "",
    app_role: "Musician",
    roles: [],
  });

  const [sortField, setSortField] = useState<"name" | "email" | "roles" | "status">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function toggleSort(field: "name" | "email" | "roles" | "status") {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function openAddModal() {
    if (!canEdit) return;
    setEditingMember(null);
    setSaveError(null);
    setForm({ name: "", email: "", phone: "", app_role: "Musician", roles: [] });
    setShowModal(true);
  }

  function openEditModal(member: MemberWithRoles) {
    if (!canEdit) return;
    setEditingMember(member);
    setSaveError(null);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      app_role: member.app_role,
      roles: member.roles,
    });
    setShowModal(true);
  }

  function toggleRole(role: MemberRole) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    if (!canEdit) return;
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    try {
      const body = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        app_role: form.app_role,
        roles: form.roles,
      };

      if (editingMember) {
        const res = await fetch(`/api/members/${editingMember.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error || "Failed to update member");
        }
        const updated: MemberWithRoles = await res.json();
        setMembers((prev) =>
          prev.map((m) => (m.id === editingMember.id ? updated : m))
        );
      } else {
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, is_active: true }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error || "Failed to create member");
        }
        const created: MemberWithRoles = await res.json();
        setMembers((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(member: MemberWithRoles) {
    const newIsActive = !member.is_active;
    // Optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, is_active: newIsActive } : m))
    );

    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newIsActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, is_active: member.is_active } : m))
        );
      }
    } catch {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, is_active: member.is_active } : m))
      );
    }
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/availability?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  // Use filteredMembers for rendering
  const sortedMembers = (() => {
    const arr = [...filteredMembers];
    arr.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      const get = (m: typeof a) => {
        if (sortField === "name") return (m.name ?? "").toLowerCase();
        if (sortField === "email") return (m.email ?? "").toLowerCase();
        if (sortField === "roles") return (m.roles || []).join(",").toLowerCase();
        if (sortField === "status") return m.is_active ? "active" : "inactive";
        return "";
      };
      const aVal = get(a);
      const bVal = get(b);
      if (aVal > bVal) return 1 * dir;
      if (aVal < bVal) return -1 * dir;
      return 0;
    });
    return arr;
  })();

  const activeMembers = sortedMembers.filter((m) => m.is_active);
  const inactiveMembers = sortedMembers.filter((m) => !m.is_active);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">People</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and manage worship team members</p>
        </div>
        {canEdit && (
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors"
          >
            + Add Member
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                className="text-left px-4 py-3 text-gray-700 font-medium cursor-pointer select-none"
                onClick={() => toggleSort("name")}
                aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              >
                <div className="flex items-center gap-2">
                  <span>Name</span>
                  <span className="text-xs text-gray-400">{sortField === "name" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}</span>
                </div>
              </th>

              <th
                className="text-left px-4 py-3 text-gray-700 font-medium cursor-pointer select-none"
                onClick={() => toggleSort("email")}
                aria-sort={sortField === "email" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              >
                <div className="flex items-center gap-2">
                  <span>Email</span>
                  <span className="text-xs text-gray-400">{sortField === "email" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}</span>
                </div>
              </th>

              <th
                className="text-left px-4 py-3 text-gray-700 font-medium cursor-pointer select-none"
                onClick={() => toggleSort("roles")}
                aria-sort={sortField === "roles" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              >
                <div className="flex items-center gap-2">
                  <span>Roles</span>
                  <span className="text-xs text-gray-400">{sortField === "roles" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}</span>
                </div>
              </th>

              <th
                className="text-left px-4 py-3 text-gray-700 font-medium cursor-pointer select-none"
                onClick={() => toggleSort("status")}
                aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              >
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <span className="text-xs text-gray-400">{sortField === "status" ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}</span>
                </div>
              </th>

              <th className="text-right px-4 py-3 text-gray-700 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...activeMembers, ...inactiveMembers].map((member) => (
              <tr
                key={member.id}
                className={`border-b border-gray-100 ${!member.is_active ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {member.name}
                  {member.app_role === "Admin" && (
                    <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Admin
                    </span>
                  )}
                  {member.app_role === "Coordinator" && (
                    <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">
                      Coordinator
                    </span>
                  )}
                  {member.app_role === "WorshipLeader" && (
                    <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                      Worship Leader
                    </span>
                  )}
                  {member.app_role === "MusicCoordinator" && (
                    <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700">
                      Music Coordinator
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{member.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {member.roles.length === 0 ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      member.roles.map((role: MemberRole) => (
                        <span
                          key={role}
                          className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                        >
                          {ROLE_LABEL_MAP[role]}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      member.is_active
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {member.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Coordinator: show nothing, fully read-only */}
                  {canEdit ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => copyLink(member.magic_token)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {copiedToken === member.magic_token ? "Copied!" : "Copy Link"}
                      </button>
                      {member.app_role !== "Admin" && (
                        <>
                          <button
                            onClick={() => openEditModal(member)}
                            className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(member)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              member.is_active
                                ? "border-red-300 text-red-600 hover:bg-red-50"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {member.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No members yet. Click &ldquo;+ Add Member&rdquo; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && canEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[560px] max-w-full border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              {editingMember ? "Edit Member" : "Add Member"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              {saveError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="+61 4XX XXX XXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Role</label>
                <select
                  value={form.app_role}
                  onChange={(e) => setForm((prev) => ({ ...prev, app_role: e.target.value as AppRole }))}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="Musician">Musician</option>
                  <option value="WorshipLeader">Worship Lead</option>
                  <option value="MusicCoordinator">Music Coordinator</option>
                  <option value="Coordinator">Coordinator</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Worship Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        form.roles.includes(r.value)
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {isSaving ? "Saving…" : editingMember ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
