"use client";

import { useState } from "react";
import { ROLES, ROLE_LABEL_MAP } from "@/lib/constants/roles";
import type { Member, MemberRole } from "@/lib/types/database";

// Mock members
const INITIAL_MEMBERS: Member[] = [
  { id: "m1", name: "John Moore", email: "john@example.com", phone: "+61400111222", roles: ["worship_lead"], magic_token: "tok-001", is_active: true, created_at: "" },
  { id: "m2", name: "Sarah Johnson", email: "sarah@example.com", phone: null, roles: ["backup_vocals_1", "backup_vocals_2"], magic_token: "tok-002", is_active: true, created_at: "" },
  { id: "m3", name: "David Chen", email: "david@example.com", phone: "+61400333444", roles: ["acoustic_guitar", "keyboard", "drums"], magic_token: "tok-003", is_active: true, created_at: "" },
  { id: "m4", name: "Emily Rodriguez", email: "emily@example.com", phone: null, roles: ["keyboard"], magic_token: "tok-004", is_active: true, created_at: "" },
  { id: "m5", name: "Michael Thompson", email: "michael@example.com", phone: "+61400555666", roles: ["drums", "percussion"], magic_token: "tok-005", is_active: true, created_at: "" },
  { id: "m6", name: "Chris Martinez", email: "chris@example.com", phone: null, roles: ["bass", "electric_guitar"], magic_token: "tok-006", is_active: true, created_at: "" },
  { id: "m7", name: "James Taylor", email: "james@example.com", phone: null, roles: ["worship_lead", "acoustic_guitar"], magic_token: "tok-007", is_active: false, created_at: "" },
];

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  roles: MemberRole[];
}

export default function AdminPeoplePage() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormData>({
    name: "",
    email: "",
    phone: "",
    roles: [],
  });

  function openAddModal() {
    setEditingMember(null);
    setForm({ name: "", email: "", phone: "", roles: [] });
    setShowModal(true);
  }

  function openEditModal(member: Member) {
    setEditingMember(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? { ...m, name: form.name, email: form.email, phone: form.phone || null, roles: form.roles }
            : m
        )
      );
    } else {
      const newMember: Member = {
        id: `m${Date.now()}`,
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        roles: form.roles,
        magic_token: crypto.randomUUID(),
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, newMember]);
    }
    setShowModal(false);
  }

  function toggleActive(memberId: string) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, is_active: !m.is_active } : m
      )
    );
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/availability?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  const activeMembers = members.filter((m) => m.is_active);
  const inactiveMembers = members.filter((m) => !m.is_active);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">People</h1>
          <p className="text-sm text-gray-500">
            {activeMembers.length} active member{activeMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors"
        >
          + Add Member
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Roles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
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
                </td>
                <td className="px-4 py-3 text-gray-500">{member.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {member.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                      >
                        {ROLE_LABEL_MAP[role]}
                      </span>
                    ))}
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
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => copyLink(member.magic_token)}
                      className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                      title="Copy availability link"
                    >
                      {copiedToken === member.magic_token ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      onClick={() => openEditModal(member)}
                      className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(member.id)}
                      className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      {member.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingMember ? "Edit Member" : "Add Member"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="For Viber/SMS reminders"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Roles <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((role) => (
                    <label
                      key={role.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">
                        {role.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={form.roles.length === 0}
                  className="flex-1 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {editingMember ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
