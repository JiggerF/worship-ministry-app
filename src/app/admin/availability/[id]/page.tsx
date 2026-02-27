"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type { AvailabilityPeriod, AvailabilityResponse, AvailabilityDateEntry } from "@/lib/types/database";

interface MemberPeriodDetail {
  member_id: string;
  member_name: string;
  member_magic_token: string;
  responded: boolean;
  response: AvailabilityResponse | null;
  dates: AvailabilityDateEntry[];
}

interface PeriodDetail {
  period: AvailabilityPeriod;
  members: MemberPeriodDetail[];
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** All Sundays between starts_on and ends_on inclusive */
function getSundaysBetween(startsOn: string, endsOn: string): string[] {
  const sundays: string[] = [];
  const end = new Date(endsOn + "T00:00:00");
  const cur = new Date(startsOn + "T00:00:00");
  // Advance to first Sunday
  while (cur.getDay() !== 0) cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    // Use local date parts — toISOString() would shift to UTC and produce the wrong date
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    sundays.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 7);
  }
  return sundays;
}

function buildDateMap(dates: AvailabilityDateEntry[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of dates) map[d.date] = d.available;
  return map;
}

export default function AvailabilityPeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/availability/periods/${id}`)
      .then((res) => {
        if (res.status === 404) { if (!cancelled) { setNotFound(true); setLoading(false); } return null; }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!cancelled && data) { setDetail(data); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function handleClose() {
    if (!detail || closing) return;
    setCloseError(null);
    setClosing(true);
    try {
      const res = await fetch(`/api/availability/periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCloseError(err.error ?? "Failed to close period");
        return;
      }
      // Re-fetch to show updated state
      const updated = await fetch(`/api/availability/periods/${id}`).then((r) => r.json());
      setDetail(updated);
    } catch {
      setCloseError("Network error — please try again");
    } finally {
      setClosing(false);
    }
  }

  function copyMagicLink(token: string) {
    const url = `${window.location.origin}/availability?token=${token}&period=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-8">Loading…</p>;
  }

  if (notFound || !detail) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="text-3xl mb-3">🔍</p>
        <p className="text-sm font-medium">Period not found</p>
        <Link href="/admin/availability" className="text-xs text-gray-500 underline mt-2 inline-block">
          ← Back to Availability
        </Link>
      </div>
    );
  }

  const { period, members } = detail;
  const sundays = getSundaysBetween(period.starts_on, period.ends_on);
  const responded = members.filter((m) => m.responded);
  const notResponded = members.filter((m) => !m.responded);
  const isClosed = !!period.closed_at;

  return (
    <div>
      {/* Back + header */}
      <div className="mb-6">
        <Link href="/admin/availability" className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-3">
          ← Availability
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{period.label}</h1>
              {isClosed ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Closed</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Open</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(period.starts_on)} – {formatDate(period.ends_on)}
              {period.deadline && (
                <span className="ml-3">Response deadline: <span className="font-medium text-gray-700">{formatDate(period.deadline)}</span></span>
              )}
            </p>
          </div>
          {!isClosed && (
            <div className="shrink-0">
              {closeError && <p className="text-xs text-red-600 mb-1">{closeError}</p>}
              <button
                onClick={handleClose}
                disabled={closing}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {closing ? "Closing…" : "Close period"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center min-w-[80px]">
          <p className="text-2xl font-bold text-gray-900">{responded.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">responded</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center min-w-[80px]">
          <p className="text-2xl font-bold text-orange-600">{notResponded.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">pending</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center min-w-[80px]">
          <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">total</p>
        </div>
        {members.length > 0 && (
          <div className="flex-1">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.min(100, (responded.length / members.length) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{Math.round((responded.length / members.length) * 100)}% responded</p>
          </div>
        )}
      </div>

      {/* Response grid */}
      {responded.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Responded ({responded.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-[140px]">
                      Member
                    </th>
                    {sundays.map((s) => (
                      <th key={s} className="px-2 py-2.5 font-medium text-gray-600 text-center min-w-[60px]">
                        {formatDateShort(s)}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-medium text-gray-600 text-left min-w-[120px]">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {responded.map((m, i) => {
                    const dateMap = buildDateMap(m.dates);
                    return (
                      <tr key={m.member_id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className={`px-4 py-2.5 font-medium text-gray-900 sticky left-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                          {m.member_name}
                        </td>
                        {sundays.map((s) => {
                          const val = dateMap[s];
                          return (
                            <td key={s} className="px-2 py-2.5 text-center">
                              {val === true ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold">✓</span>
                              ) : val === false ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold">✗</span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-gray-400">
                          {m.response ? formatDateTime(m.response.updated_at) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 px-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 font-bold text-[9px]">✓</span>
              Available
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 font-bold text-[9px]">✗</span>
              Not available
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-[9px]">—</span>
              No answer for that date
            </span>
          </div>
        </div>
      )}

      {/* Not yet responded */}
      {notResponded.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Not yet responded ({notResponded.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {notResponded.map((m) => (
              <div key={m.member_id} className="flex items-center justify-between px-4 py-3 gap-3">
                <span className="text-sm font-medium text-gray-900">{m.member_name}</span>
                <button
                  onClick={() => copyMagicLink(m.member_magic_token)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    copiedToken === m.member_magic_token
                      ? "border-green-300 text-green-700 bg-green-50"
                      : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                  }`}
                >
                  {copiedToken === m.member_magic_token ? "Copied!" : "Copy magic link"}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 px-1">Copy a link and send it via Viber DM to the musician.</p>
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-3">👥</p>
          <p className="text-sm font-medium">No active musicians found</p>
          <p className="text-xs mt-1">Add active musicians in the People page first</p>
        </div>
      )}
    </div>
  );
}
