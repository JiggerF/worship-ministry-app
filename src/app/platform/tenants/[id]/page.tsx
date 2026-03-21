"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

interface OrgMemberRow {
  member_id: string;
  app_role: string;
  is_active: boolean;
  joined_at: string;
  members: { id: string; name: string; email: string } | null;
}

interface TenantDetail {
  org: OrgDetail;
  members: OrgMemberRow[];
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadDetail() {
    try {
      const res = await fetch(`/api/platform/tenants/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tenant");
      const data: TenantDetail = await res.json();
      setDetail(data);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDetail(); }, [id]);

  async function handleResendInvite(email: string) {
    if (resendingEmail) return;
    setResendingEmail(email);
    try {
      const res = await fetch(`/api/platform/tenants/${id}/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        showToast(json?.error ?? "Failed to send invite", "error");
        return;
      }
      showToast(`Invite sent to ${email}`);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setResendingEmail(null);
    }
  }

  async function handleToggleActive() {
    if (!detail || toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !detail.org.is_active }),
      });
      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        showToast(json?.error ?? "Failed to update", "error");
        return;
      }
      await loadDetail();
      showToast(detail.org.is_active ? "Tenant deactivated" : "Tenant activated");
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!detail) return null;

  const { org, members } = detail;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/platform/tenants" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Tenants
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{org.slug}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                org.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {org.is_active ? "Active" : "Inactive"}
            </span>
            <button
              onClick={handleToggleActive}
              disabled={toggling}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                org.is_active
                  ? "border-red-300 text-red-600 bg-white hover:bg-red-50"
                  : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              }`}
            >
              {toggling ? "…" : org.is_active ? "Deactivate" : "Activate"}
            </button>
            <a
              href={`/platform/tenants/${id}/features`}
              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
            >
              Feature Flags →
            </a>
          </div>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Members ({members.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-5 py-3 font-medium">Email</th>
              <th className="text-left px-5 py-3 font-medium">Role</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => (
              <tr key={m.member_id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">
                  {m.members?.name ?? "—"}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{m.members?.email ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {m.app_role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs ${m.is_active ? "text-green-600" : "text-gray-400"}`}
                  >
                    {m.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {m.members?.email && (
                    <button
                      onClick={() => handleResendInvite(m.members!.email)}
                      disabled={resendingEmail === m.members?.email}
                      className="px-2.5 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {resendingEmail === m.members?.email ? "Sending…" : "Resend Invite"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-gray-400">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
