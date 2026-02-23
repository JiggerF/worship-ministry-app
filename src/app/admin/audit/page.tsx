"use client";

import { useEffect, useReducer, useState } from "react";
import type { AuditLogRow, AuditAction } from "@/lib/types/database";

// ── Fetch state reducer — avoids cascading setState calls in useEffect ──────

type FetchState = {
  entries: AuditLogRow[];
  total: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
};

type FetchAction =
  | { type: "start" }
  | { type: "success"; entries: AuditLogRow[]; total: number; pageSize: number }
  | { type: "error"; message: string };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return {
        loading: false,
        error: null,
        entries: action.entries,
        total: action.total,
        pageSize: action.pageSize,
      };
    case "error":
      return { ...state, loading: false, error: action.message };
  }
}

function formatMelbourne(isoString: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

const ACTION_LABELS: Record<AuditAction, string> = {
  create_song: "Created song",
  update_song: "Updated song",
  delete_song: "Deleted song",
  save_roster_draft: "Saved draft",
  finalize_roster: "Finalized roster",
  revert_roster: "Reverted roster",
  save_roster_note: "Updated note",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create_song: "bg-green-100 text-green-800",
  update_song: "bg-amber-100 text-amber-800",
  delete_song: "bg-red-100 text-red-800",
  save_roster_draft: "bg-blue-100 text-blue-800",
  finalize_roster: "bg-purple-100 text-purple-800",
  revert_roster: "bg-orange-100 text-orange-800",
  save_roster_note: "bg-sky-100 text-sky-800",
};

export default function AuditPage() {
  const [{ entries, total, pageSize, loading, error }, dispatch] = useReducer(
    fetchReducer,
    { entries: [], total: 0, pageSize: 50, loading: true, error: null }
  );
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    dispatch({ type: "start" });
    fetch(`/api/audit-log?page=${page}&sort=${sortDir}`)
      .then((res) => {
        if (res.status === 403) throw new Error("Access denied — Admins only.");
        if (!res.ok) throw new Error("Failed to load audit log.");
        return res.json();
      })
      .then((data) => {
        dispatch({
          type: "success",
          entries: data.entries ?? [],
          total: data.total ?? 0,
          pageSize: data.pageSize ?? 50,
        });
      })
      .catch((err: Error) => dispatch({ type: "error", message: err.message }));
  }, [page, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Activity history for songs and roster changes
          </p>
        </div>
        {!loading && !error && total > 0 && (
          <p className="text-sm text-gray-400">{total} entries</p>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          No activity recorded yet.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                          setPage(1);
                        }}
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        Timestamp (Melbourne)
                        <span className="text-gray-400 text-xs">
                          {sortDir === "desc" ? "↓" : "↑"}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                        {formatMelbourne(row.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {row.actor_name}
                        </span>
                        <span
                          className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            row.actor_role === "Admin"
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {row.actor_role}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            ACTION_COLORS[row.action] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ACTION_LABELS[row.action] ?? row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
