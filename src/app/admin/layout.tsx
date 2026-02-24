"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Member } from "@/lib/types/database";

function useCurrentMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // cache: "no-store" prevents the browser from serving a stale identity
    // after a login swap (e.g. Admin → Coordinator without a page reload).
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
  // Re-run on every navigation — the layout never unmounts in App Router,
  // so pathname is the only reliable signal that a login switch may have
  // occurred.
  }, [pathname]);
  return { member, loading };
}

const SIDEBAR_ITEMS = [
  { href: "/admin/roster", label: "Roster", icon: "📋" },
  { href: "/admin/setlist", label: "Setlist", icon: "🎶" },
  { href: "/admin/songs", label: "Songs", icon: "🎵" },
  { href: "/admin/people", label: "People", icon: "👥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/admin/audit", label: "Audit Log", icon: "🔍" },
];

// Pages that Coordinators cannot access
const COORDINATOR_HIDDEN = ["/admin/settings", "/admin/audit"];


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { member, loading: memberLoading } = useCurrentMember();

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Hide Settings and Audit Log nav for Coordinator (only filter once role is confirmed)
  const filteredSidebar = !memberLoading && member?.app_role === "Coordinator"
    ? SIDEBAR_ITEMS.filter((item) => !COORDINATOR_HIDDEN.includes(item.href))
    : SIDEBAR_ITEMS;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-sm font-bold text-gray-900">
            Worship Ministry
          </h1>
          <p className="text-xs text-gray-600">Rostering Admin</p>
        </div>

        <nav className="flex-1 p-2">
          {filteredSidebar.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
              👤
            </div>
            <div>
              {/* Show logged-in user's name and role tag */}
              {memberLoading ? (
                <p className="text-sm font-medium text-gray-400">—</p>
              ) : member ? (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    {member.name} <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-50 text-yellow-700">{member.app_role}</span>
                  </p>
                  <Link
                    href="/admin/login"
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Sign out
                  </Link>
                </>
              ) : (
                <Link
                  href="/admin/login"
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
