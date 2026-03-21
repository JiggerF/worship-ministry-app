"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
  song_count: number;
}

export default function PlatformDashboardPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform/tenants", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data: TenantRow[]) => setTenants(data))
      .catch((e: unknown) => setError((e as Error).message ?? "Unknown error"))
      .finally(() => setLoading(false));
  }, []);

  const activeTenants = tenants.filter((t) => t.is_active).length;
  const totalMembers = tenants.reduce((sum, t) => sum + t.member_count, 0);
  const totalSongs = tenants.reduce((sum, t) => sum + t.song_count, 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Dashboard</h1>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Active Tenants", value: activeTenants },
              { label: "Total Members", value: totalMembers },
              { label: "Total Songs", value: totalSongs },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Tenant table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">All Tenants</h2>
              <Link
                href="/platform/tenants/new"
                className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800"
              >
                + New Tenant
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Slug</th>
                  <th className="text-right px-5 py-3 font-medium">Members</th>
                  <th className="text-right px-5 py-3 font-medium">Songs</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{t.slug}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{t.member_count}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{t.song_count}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="text-xs text-gray-500 hover:text-gray-900 font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">
                      No tenants yet.{" "}
                      <Link href="/platform/tenants/new" className="text-gray-700 font-medium underline">
                        Create the first one.
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
