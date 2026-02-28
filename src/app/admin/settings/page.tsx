"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function AdminSettingsPage() {
  const [futureMonths, setFutureMonths] = useState<number | null>(null);
  const [historyMonths, setHistoryMonths] = useState<number | null>(null);
  const [maxSongsPerSetlist, setMaxSongsPerSetlist] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    load();
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
