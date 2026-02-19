"use client";

import { useState } from "react";
import { ROLES, ROLE_LABEL_MAP } from "@/lib/constants/roles";
import type {
  MemberWithRoles,
  MemberRole,
} from "@/lib/types/database";

/* -------------------------------------------------- */
/* Mock Members (until API wired)                    */
/* -------------------------------------------------- */

const INITIAL_MEMBERS: MemberWithRoles[] = [
  {
    id: "m1",
    name: "John Moore",
    email: "john@example.com",
    phone: "+61400111222",
    app_role: "Musician",
    magic_token: "tok-001",
    is_active: true,
    created_at: "",
    roles: ["worship_lead"],
  },
  {
    id: "m2",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    phone: null,
    app_role: "Musician",
    magic_token: "tok-002",
    is_active: true,
    created_at: "",
    roles: ["backup_vocals_1", "backup_vocals_2"],
  },
  {
    id: "m3",
    name: "David Chen",
    email: "david@example.com",
    phone: "+61400333444",
    app_role: "Musician",
    magic_token: "tok-003",
    is_active: true,
    created_at: "",
    roles: ["acoustic_guitar", "keyboard", "drums"],
  },
];

/* -------------------------------------------------- */
/* Form Shape                                         */
/* -------------------------------------------------- */

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  roles: MemberRole[];
}

/* -------------------------------------------------- */
/* Component                                          */
/* -------------------------------------------------- */

export default function AdminPeoplePage() {
  const [members, setMembers] =
    useState<MemberWithRoles[]>(INITIAL_MEMBERS);

  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] =
    useState<MemberWithRoles | null>(null);

  const [copiedToken, setCopiedToken] =
    useState<string | null>(null);

  const [form, setForm] = useState<MemberFormData>({
    name: "",
    email: "",
    phone: "",
    roles: [],
  });

  /* ----------------------------- */
  /* Modal Controls                */
  /* ----------------------------- */

  function openAddModal() {
    setEditingMember(null);
    setForm({ name: "", email: "", phone: "", roles: [] });
    setShowModal(true);
  }

  function openEditModal(member: MemberWithRoles) {
    setEditingMember(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      roles: member.roles,
    });
    setShowModal(true);
  }

  /* ----------------------------- */
  /* Role Toggle                   */
  /* ----------------------------- */

  function toggleRole(role: MemberRole) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  }

  /* ----------------------------- */
  /* Save                          */
  /* ----------------------------- */

  function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: form.name,
                email: form.email,
                phone: form.phone || null,
                roles: form.roles,
              }
            : m
        )
      );
    } else {
      const newMember: MemberWithRoles = {
        id: `m${Date.now()}`,
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        app_role: "Musician",
        roles: form.roles,
        magic_token: crypto.randomUUID(),
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setMembers((prev) => [...prev, newMember]);
    }

    setShowModal(false);
  }

  /* ----------------------------- */
  /* Activate / Deactivate         */
  /* ----------------------------- */

  function toggleActive(memberId: string) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, is_active: !m.is_active }
          : m
      )
    );
  }

  /* ----------------------------- */
  /* Copy Link                     */
  /* ----------------------------- */

  async function copyLink(token: string) {
    const url = `${window.location.origin}/availability?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  const activeMembers = members.filter((m) => m.is_active);
  const inactiveMembers = members.filter((m) => !m.is_active);

  /* ----------------------------- */
  /* UI                            */
  /* ----------------------------- */

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            People
          </h1>
          <p className="text-sm text-gray-500">
            {activeMembers.length} active member
            {activeMembers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors"
        >
          + Add Member
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Roles</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {[...activeMembers, ...inactiveMembers].map(
              (member) => (
                <tr
                  key={member.id}
                  className={`border-b border-gray-100 ${
                    !member.is_active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {member.name}
                  </td>

                  <td className="px-4 py-3 text-gray-500">
                    {member.email}
                  </td>

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
                      {member.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          copyLink(member.magic_token)
                        }
                        className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {copiedToken === member.magic_token
                          ? "Copied!"
                          : "Copy Link"}
                      </button>

                      <button
                        onClick={() =>
                          openEditModal(member)
                        }
                        className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          toggleActive(member.id)
                        }
                        className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {member.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Modal remains unchanged from your original */}
      {/* (No type conflicts anymore) */}
    </div>
  );
}