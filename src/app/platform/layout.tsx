"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PlatformAdmin } from "@/lib/types/database";

function usePlatformAdmin() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  // Track which pathname the last completed fetch belongs to.
  // "loading" is derived: true whenever fetchedFor !== current pathname.
  // This avoids the stale-state race where a pathname change renders once
  // with loading=false from the prior pathname before the new effect fires.
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setAdmin(data ?? null);
          setFetchedFor(pathname);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdmin(null);
          setFetchedFor(pathname);
        }
      });
    return () => { cancelled = true; };
  }, [pathname]);

  // loading=true whenever we don't yet have a result for the current pathname
  const loading = fetchedFor !== pathname;
  return { admin, loading };
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, loading } = usePlatformAdmin();

  // Login page renders without the platform chrome
  if (pathname === "/platform/login") {
    return <>{children}</>;
  }

  // Redirect to login if confirmed non-admin (don't redirect while still loading)
  if (!loading && !admin) {
    router.replace("/platform/login");
    return null;
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.replace("/platform/login");
    router.refresh();
  }

  const NAV_ITEMS = [
    { href: "/platform/dashboard", label: "Dashboard" },
    { href: "/platform/tenants", label: "Tenants" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-52 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Platform Admin</p>
          <p className="text-sm font-bold text-white mt-0.5">Worship SaaS</p>
        </div>

        <nav className="p-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                  isActive
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          {loading ? (
            <p className="text-xs text-gray-500">—</p>
          ) : admin ? (
            <div>
              <p className="text-xs text-white font-medium truncate">{admin.name}</p>
              <p className="text-xs text-gray-400 truncate">{admin.email}</p>
              <button
                onClick={handleSignOut}
                className="mt-2 text-xs text-gray-400 hover:text-white bg-transparent border-none cursor-pointer p-0"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
