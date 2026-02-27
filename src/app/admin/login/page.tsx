"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../styles.module.css";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return; // prevent double submit

    setError(null);
    setLoading(true);

    try {
      // POST to server-side login route — sets cookies server-side and writes
      // a login audit event for all app_roles.
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
    } catch {
      setError("Network error. Please check your connection and try again.");
      return;
    } finally {
      setLoading(false);
    }

    // Ensure middleware + SSR re-evaluate auth state.
    router.replace("/admin/roster");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            WORDCC Worship Ministry
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to manage the worship workflow.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${styles.inputDarkText} w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent`}
              placeholder="admin@wcc.org"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${styles.inputDarkText} w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent`}
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-10 text-center px-2">
          <div className="border-t border-gray-200 pt-8 space-y-3">
            <p className="text-sm italic text-gray-500 leading-relaxed">
              &ldquo;Worthy is the Lamb who was slain,
              <br />
              to receive power and wealth and wisdom and might
              <br />
              and honor and glory and blessing!&rdquo;
            </p>
            <p className="text-sm italic text-gray-500 leading-relaxed">
              &ldquo;To him who sits on the throne and to the Lamb
              <br />
              be blessing and honor and glory and might forever and ever!&rdquo;
            </p>
            <p className="text-xs text-gray-400 mt-2 font-medium tracking-wide uppercase">
              Revelation 5:12–13
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}