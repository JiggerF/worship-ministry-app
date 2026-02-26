"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function AdminSettingsPage() {
  const [futureMonths, setFutureMonths] = useState<number | null>(null);
  const [historyMonths, setHistoryMonths] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ future_months: Number(futureMonths), history_months: Number(historyMonths) }), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Save failed');
      alert('Settings saved');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
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
          </main>
        </div>
      </div>
    </div>
  );
}
