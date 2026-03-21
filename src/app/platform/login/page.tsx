"use client";

import { useState } from "react";

export default function PlatformLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      // Reuse the same auth/login endpoint — Supabase Auth is the same pool
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign in failed. Please try again.");
        return;
      }

      // Verify caller is actually a platform admin
      const meRes = await fetch("/api/platform/me", { cache: "no-store" });
      if (!meRes.ok) {
        setError("You do not have platform admin access. If you are a church admin, please go to your church's admin login page instead.");
        // Do NOT call logout here — the user may be a valid church admin and
        // destroying their session would lock them out of /admin/* as well.
        return;
      }
    } catch {
      setError("Network error. Please try again.");
      return;
    } finally {
      setLoading(false);
    }

    // Hard navigation — avoids React stale-state race where the platform layout
    // sees loading=false & admin=null from the prior unauthenticated fetch and
    // redirects back to /platform/login before the new /api/platform/me fetch
    // can complete. window.location.href forces a full page load with fresh state.
    window.location.href = "/platform/dashboard";
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Platform Admin
          </p>
          <h1 className="text-2xl font-bold text-white">Worship SaaS</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to manage all tenants.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 space-y-4"
        >
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@worshipapp.com"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
