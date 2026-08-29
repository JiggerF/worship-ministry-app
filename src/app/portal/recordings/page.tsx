"use client";

import { useEffect, useMemo, useState } from "react";
import type { SundayRecordingWithTeam } from "@/lib/types/database";
import { driveEmbedUrl, driveDownloadUrl, formatDuration } from "@/lib/utils/recordings";

function formatMonthHeading(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "long", year: "numeric" }).toUpperCase();
}

function formatCardDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function monthKey(isoDate: string) {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

/**
 * Produces every human-readable date representation for an ISO date string
 * so that partial natural-language queries ("22 Mar", "March 22", "March 2026",
 * "2026-03-22") all resolve to the same recording.
 */
function getDateVariants(isoDate: string): string[] {
  const d = new Date(isoDate + "T00:00:00");
  return [
    isoDate,                                                                                          // "2026-03-22"
    d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),               // "22 March 2026"
    d.toLocaleDateString("en-AU", { day: "numeric", month: "long" }),                                // "22 March"
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),              // "22 Mar 2026"
    d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),                               // "22 Mar"
    d.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),                               // "March 2026"
    d.toLocaleDateString("en-AU", { month: "short", year: "numeric" }),                              // "Mar 2026"
    d.toLocaleDateString("en-AU", { year: "numeric" }),                                              // "2026"
    d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }),               // "March 22, 2026"
    d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),              // "Mar 22, 2026"
    d.toLocaleDateString("en-US", { day: "numeric", month: "long" }),                                // "March 22"
    String(d.getDate()),                                                                              // "22"
    String(d.getFullYear()),                                                                          // "2026"
  ].map((s) => s.toLowerCase());
}

/**
 * Returns true when the recording matches the trimmed, lower-cased query.
 *
 * Matching strategy (all OR — first hit wins):
 *   1. Query is a substring of the title (case-insensitive).
 *   2. Query is a substring of any date variant for sunday_date.
 *   3. Query is a substring of any featured member's full name (case-insensitive).
 */
function matchesSearch(recording: SundayRecordingWithTeam, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (recording.title.toLowerCase().includes(q)) return true;

  if (getDateVariants(recording.sunday_date).some((v) => v.includes(q))) return true;

  if (recording.featured_members.some((m) => m.name.toLowerCase().includes(q))) return true;

  return false;
}

export default function PortalTrackPage() {
  const [recordings, setRecordings] = useState<SundayRecordingWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Read ?org= from the portal URL so API calls carry tenant context in dev.
  // In production (subdomain routing), ?org= is not needed — the subdomain resolves the tenant.
  const [orgSlug] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("org");
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/recordings${orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : ""}`);
        if (!res.ok) {
          let msg = `Failed to load recordings (${res.status})`;
          try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
          if (!cancelled) setLoadError(msg);
          return;
        }
        const data: unknown = await res.json();
        if (!cancelled && Array.isArray(data)) setRecordings(data as SundayRecordingWithTeam[]);
      } catch (err) {
        console.error("Could not load recordings:", err);
        if (!cancelled) setLoadError("Network error — could not load recordings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return recordings.filter((r) => matchesSearch(r, search));
  }, [recordings, search]);

  // Group by month (newest first, already sorted by API)
  const byMonth = useMemo(() => {
    const groups: { month: string; monthKey: string; items: SundayRecordingWithTeam[] }[] = [];
    for (const rec of filtered) {
      const mk = monthKey(rec.sunday_date);
      const last = groups[groups.length - 1];
      if (!last || last.monthKey !== mk) {
        groups.push({ month: formatMonthHeading(rec.sunday_date), monthKey: mk, items: [rec] });
      } else {
        last.items.push(rec);
      }
    }
    return groups;
  }, [filtered]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">Loading recordings…</div>
    );
  }

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-sm text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quote */}
      <p className="text-sm italic text-gray-500 text-center">
        &ldquo;As each has received a gift, use it to serve one another, as good stewards of God&apos;s varied grace.&rdquo;
        <br />
        <span className="block mt-1 text-xs not-italic text-gray-400">- 1 Peter 4:10</span>
      </p>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Search by date or team member..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {recordings.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">
          No recordings available yet.
        </div>
      )}

      {filtered.length === 0 && recordings.length > 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          No recordings match &quot;{search}&quot;.
        </div>
      )}

      {/* Month groups */}
      {byMonth.map((group) => (
        <div key={group.monthKey} className="space-y-4">
          {/* Month heading */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-widest text-gray-400">{group.month}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Recording cards */}
          {group.items.map((rec) => (
            <RecordingCard key={rec.id} rec={rec} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RecordingCard({ rec }: { rec: SundayRecordingWithTeam }) {
  const [showPlayer, setShowPlayer] = useState(false);
  const duration = formatDuration(rec.duration_seconds);
  const embedUrl = driveEmbedUrl(rec.drive_url);
  const downloadUrl = driveDownloadUrl(rec.drive_url);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Top meta row */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          🎧 {rec.recording_type}
        </span>
        {duration && (
          <span className="text-sm text-gray-500 tabular-nums">{duration}</span>
        )}
      </div>

      {/* Title + date */}
      <div>
        <h3 className="text-base font-bold text-gray-900">{rec.title}</h3>
        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
          <span>📅</span>
          {formatCardDate(rec.sunday_date)}
        </p>
      </div>

      {/* Embedded player */}
      {showPlayer ? (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          <iframe
            src={embedUrl}
            width="100%"
            height="80"
            allow="autoplay"
            className="block"
            title={rec.title}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowPlayer(true)}
          className="w-full flex items-center gap-4 bg-gray-50 rounded-xl px-5 py-4 hover:bg-gray-100 transition-colors"
        >
          <span className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm flex-shrink-0">
            ▶
          </span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full" />
          {duration && (
            <span className="text-sm text-gray-500 tabular-nums flex-shrink-0">{duration}</span>
          )}
        </button>
      )}

      {/* Featured musicians */}
      {rec.featured_members.length > 0 && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase flex items-center gap-1.5 mb-2">
            🎵 On Stage
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rec.featured_members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-800"
              >
                {m.name.split(" ")[0]}
                <span className="text-gray-400 font-normal">· {m.instrument}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Download */}
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
      >
        <span>⬇</span> Download {rec.recording_type === "video" ? "Video" : "Audio"}
      </a>
    </div>
  );
}
