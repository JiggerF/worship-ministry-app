"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface FlagRow {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  default_enabled: boolean;
  enabled: boolean;
}

export default function TenantFeaturesPage() {
  const { id } = useParams<{ id: string }>();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null); // flag_key being toggled
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadFlags() {
    try {
      const [flagsRes, tenantRes] = await Promise.all([
        fetch(`/api/platform/tenants/${id}/features`, { cache: "no-store" }),
        fetch(`/api/platform/tenants/${id}`, { cache: "no-store" }),
      ]);
      if (!flagsRes.ok) throw new Error("Failed to load feature flags");
      const [flagData, tenantData] = await Promise.all([
        flagsRes.json() as Promise<FlagRow[]>,
        tenantRes.ok ? (tenantRes.json() as Promise<{ org: { name: string } }>) : Promise.resolve(null),
      ]);
      setFlags(flagData);
      if (tenantData?.org?.name) setOrgName(tenantData.org.name);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFlags(); }, [id]);

  async function handleToggle(flagKey: string, currentEnabled: boolean) {
    if (toggling) return;
    setToggling(flagKey);
    try {
      const res = await fetch(`/api/platform/tenants/${id}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_key: flagKey, enabled: !currentEnabled }),
      });
      let json: { error?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        showToast(json?.error ?? "Failed to update flag", "error");
        return;
      }
      // Optimistic update
      setFlags((prev) =>
        prev.map((f) => (f.flag_key === flagKey ? { ...f, enabled: !currentEnabled } : f))
      );
      showToast(`${flagKey} ${!currentEnabled ? "enabled" : "disabled"}`);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <a href={`/platform/tenants/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to {orgName || "Tenant"}
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Feature Flags</h1>
        {orgName && <p className="text-sm text-gray-500 mt-0.5">{orgName}</p>}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {flags.map((flag) => (
            <div key={flag.flag_key} className="flex items-center justify-between px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{flag.label}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{flag.flag_key}</p>
                {flag.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{flag.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4">
                {flag.enabled !== flag.default_enabled && (
                  <span className="text-xs text-gray-400">
                    (default: {flag.default_enabled ? "on" : "off"})
                  </span>
                )}
                <button
                  onClick={() => handleToggle(flag.flag_key, flag.enabled)}
                  disabled={toggling === flag.flag_key}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    flag.enabled ? "bg-gray-900" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={flag.enabled}
                  aria-label={`Toggle ${flag.label}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      flag.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
          {flags.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No feature flags defined.
            </div>
          )}
        </div>
      )}

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
