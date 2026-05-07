"use client";
import { useMemo, useState, useEffect } from "react";
import type { SongWithCharts } from "@/lib/types/database";
import { Card } from "@/components/ui/Card";

function useCurrentMember() {
  const [member, setMember] = useState<{ app_role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
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

interface HealthMetrics {
  hasChordSheet: boolean;
  hasKeys: boolean;
  hasYoutube: boolean;
  hasScripture: boolean;
}

function computeHealth(song: SongWithCharts): HealthMetrics {
  return {
    hasChordSheet: !!(song.chord_charts || []).find((c) => c.file_url),
    hasKeys: !!(song.chord_charts || []).length,
    hasYoutube: !!song.youtube_url?.trim(),
    hasScripture: !!song.scripture_anchor?.trim(),
  };
}

export default function SongHealthPage() {
  const { member, loading: memberLoading } = useCurrentMember();
  // All admin roles (Admin, Coordinator, MusicCoordinator, WorshipLeader) can edit on Song Health
  const canEditSong = !memberLoading && member !== null;

  const [songs, setSongs] = useState<SongWithCharts[]>([]);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"health" | "urls">("health");
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [isSavingUrls, setIsSavingUrls] = useState(false);
  const [urlUpdateError, setUrlUpdateError] = useState<string | null>(null);
  const [urlUpdateSuccess, setUrlUpdateSuccess] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;
    async function load() {
      const maxRetries = 3;
      let lastError = "";

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const res = await fetch("/api/songs");
          if (!res.ok) {
            let msg = `Failed to load songs (${res.status})`;
            try {
              const j = await res.json();
              msg = j.error ?? msg;
            } catch {}
            if (!cancelled) setLoadError(msg);
            return;
          }
          const data = (await res.json()) as unknown;
          if (!cancelled && Array.isArray(data)) {
            const loaded = data as SongWithCharts[];
            setSongs(loaded);
            return;
          }
        } catch (err) {
          lastError = String(err);
          console.error(`Could not load songs (attempt ${attempt + 1}):`, err);
          if (attempt < maxRetries - 1) {
            // Exponential backoff: 500ms, 1000ms, 2000ms
            const delay = Math.pow(2, attempt) * 500;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!cancelled) {
        setLoadError(
          lastError.includes("timeout")
            ? "Database query timed out — please try refreshing the page"
            : "Network error — could not load songs after 3 attempts."
        );
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!showIncompleteOnly) return songs;
    return songs.filter((s) => {
      const health = computeHealth(s);
      return (
        !health.hasChordSheet ||
        !health.hasKeys ||
        !health.hasYoutube ||
        !health.hasScripture
      );
    });
  }, [songs, showIncompleteOnly]);

  const missingChordCount = useMemo(
    () =>
      songs.filter((s) => !computeHealth(s).hasChordSheet).length
  , [songs]);

  const missingKeysCount = useMemo(
    () =>
      songs.filter((s) => !computeHealth(s).hasKeys).length
  , [songs]);

  const missingYoutubeCount = useMemo(
    () =>
      songs.filter((s) => !computeHealth(s).hasYoutube).length
  , [songs]);

  const missingScriptureCount = useMemo(
    () =>
      songs.filter((s) => !computeHealth(s).hasScripture).length
  , [songs]);


  async function handleSaveUrls() {
    setIsSavingUrls(true);
    setUrlUpdateError(null);
    try {
      const updates = Object.entries(urlInputs)
        .filter(([, url]) => url.trim())
        .map(([songId, url]) => ({ songId, chordUrl: url.trim() }));

      if (updates.length === 0) {
        setUrlUpdateError("No URLs to save");
        setIsSavingUrls(false);
        return;
      }

      const res = await fetch("/api/songs/bulk-update-chords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      let json: { updated?: number; error?: string; errors?: Array<{songId: string; error: string}> } | null = null;
      try {
        json = await res.json();
      } catch {}

      if (!res.ok) {
        setUrlUpdateError(json?.error ?? "Failed to save URLs");
        return;
      }

      // Reload songs to see updated URLs
      const songsRes = await fetch("/api/songs");
      if (songsRes.ok) {
        const data = (await songsRes.json()) as unknown;
        if (Array.isArray(data)) {
          setSongs(data as SongWithCharts[]);
        }
      }

      // Clear inputs and show success
      setUrlInputs({});
      setUrlUpdateError(null);
      setUrlUpdateSuccess(`Saved ${updates.length} URL${updates.length === 1 ? "" : "s"}`);
      setTimeout(() => setUrlUpdateSuccess(null), 3000);
    } catch (err) {
      console.error("handleSaveUrls error:", err);
      setUrlUpdateError("An unexpected error occurred");
    } finally {
      setIsSavingUrls(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-sm text-red-700 max-w-md text-center">
          <p className="font-medium mb-1">Could not load songs</p>
          <p className="text-red-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Song Health</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Inventory of missing song information
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("health")}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === "health"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Health Overview
          </button>
          <button
            onClick={() => setActiveTab("urls")}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === "urls"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Bulk URL Update
          </button>
        </div>

        <Card className="p-6 bg-white border border-gray-100 rounded-lg shadow-sm">
          {/* Health Overview Tab */}
          {activeTab === "health" && (
            <>
          {/* Summary chips */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600">Missing Chords</div>
              <div className="text-lg font-bold text-gray-900">
                {missingChordCount}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600">Missing Keys</div>
              <div className="text-lg font-bold text-gray-900">
                {missingKeysCount}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600">Missing Video</div>
              <div className="text-lg font-bold text-gray-900">
                {missingYoutubeCount}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600">Missing Scripture</div>
              <div className="text-lg font-bold text-gray-900">
                {missingScriptureCount}
              </div>
            </div>
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="showIncomplete"
              checked={showIncompleteOnly}
              onChange={(e) => setShowIncompleteOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <label
              htmlFor="showIncomplete"
              className="text-sm text-gray-700 cursor-pointer"
            >
              Show incomplete only
            </label>
          </div>


          {/* Table */}
          <div className="relative w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs">
                  <th className="px-3 py-2 text-gray-700 font-medium">
                    Title
                  </th>
                  <th className="px-3 py-2 text-gray-700 font-medium">
                    Artist
                  </th>
                  <th className="px-3 py-2 text-gray-700 font-medium">
                    Chord
                  </th>
                  <th className="px-3 py-2 text-gray-700 font-medium">Keys</th>
                  <th className="px-3 py-2 text-gray-700 font-medium">Video</th>
                  <th className="px-3 py-2 text-gray-700 font-medium">
                    Scripture
                  </th>
                  <th className="px-3 py-2 text-gray-700 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-gray-500"
                    >
                      No songs
                    </td>
                  </tr>
                ) : (
                  filtered.map((song) => {
                    const health = computeHealth(song);

                    return (
                      <tr key={song.id} className="border-t border-gray-200">
                        <td className="px-3 py-3 font-medium text-gray-800">
                          {song.title}
                        </td>
                        <td className="px-3 py-3 text-gray-800">
                          {song.artist ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              health.hasChordSheet
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {health.hasChordSheet ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              health.hasKeys
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {health.hasKeys ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              health.hasYoutube
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {health.hasYoutube ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              health.hasScripture
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {health.hasScripture ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            {canEditSong && (
                              <a
                                href={`/admin/songs?edit=${song.id}`}
                                className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                              >
                                Edit
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
            </>
          )}

          {/* Bulk URL Update Tab */}
          {activeTab === "urls" && (
            <>
              {urlUpdateError && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {urlUpdateError}
                </div>
              )}
              {urlUpdateSuccess && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                  ✓ {urlUpdateSuccess}
                </div>
              )}
              <div className="relative w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs">
                      <th className="px-3 py-2 text-gray-700 font-medium">
                        Title
                      </th>
                      <th className="px-3 py-2 text-gray-700 font-medium">
                        Artist
                      </th>
                      <th className="px-3 py-2 text-gray-700 font-medium">
                        Chord Sheet URL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {songs
                      .filter((s) => !computeHealth(s).hasChordSheet)
                      .map((song) => (
                        <tr key={song.id} className="border-t border-gray-200">
                          <td className="px-3 py-3 font-medium text-gray-800">
                            {song.title}
                          </td>
                          <td className="px-3 py-3 text-gray-800">
                            {song.artist ?? "—"}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="url"
                              placeholder="https://drive.google.com/…"
                              value={urlInputs[song.id] ?? ""}
                              onChange={(e) =>
                                setUrlInputs((prev) => ({
                                  ...prev,
                                  [song.id]: e.target.value,
                                }))
                              }
                              className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveUrls}
                  disabled={isSavingUrls || Object.values(urlInputs).every((v) => !v.trim())}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isSavingUrls ? "Saving…" : "Save All Changes"}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
    </>
  );
}
