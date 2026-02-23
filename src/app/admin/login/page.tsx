"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../styles.module.css";
import { supabase } from "@/lib/supabase";

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

    const res = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error.message);
      return;
    }

    // Persist tokens into cookies so the server-side middleware (createServerClient)
    // can read the session on subsequent requests. This is a testing-friendly
    // approach — in production you should set secure, httpOnly cookies from the
    // server after exchanging credentials.
    try {
      let session: any = null;
      if (res.data && typeof res.data === "object") {
        if ('session' in res.data && res.data.session) {
          session = res.data.session;
        } else if ('user' in res.data && 'session' in res.data && res.data.session) {
          session = res.data.session;
        }
      }
      if (session && typeof document !== "undefined") {
        const access = session.access_token;
        const refresh = session.refresh_token;
        document.cookie = `sb-access-token=${access}; path=/`;
        document.cookie = `sb-refresh-token=${refresh}; path=/`;
        try {
          const serialized = encodeURIComponent(JSON.stringify(session));
          document.cookie = `sb:token=${serialized}; path=/`;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore cookie set errors
    }

    // Ensure middleware + SSR re-evaluate auth state
    router.replace("/admin/roster");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            WCC Worship Ministry Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to manage the roster
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
      </div>
    </div>
  );
}