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
  { href: "/admin/roster", label: "Roster Manager", icon: "📋" },
  { href: "/admin/setlist", label: "Setlist", icon: "🎶" },
  { href: "/admin/songs", label: "Song Manager", icon: "🎵" },
  { href: "/admin/people", label: "People", icon: "👥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/admin/audit", label: "Audit Log", icon: "🔍" },
];

// Pages hidden for Coordinator, WorshipLeader, and MusicCoordinator
const RESTRICTED_NAV_HIDDEN = ["/admin/settings", "/admin/audit"];
const RESTRICTED_ROLES = ["Coordinator", "WorshipLeader", "MusicCoordinator"] as const;


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { member, loading: memberLoading } = useCurrentMember();

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Show restricted nav items (Settings, Audit Log) only once the role is
  // confirmed as non-restricted. While loading or on fetch failure, default to
  // hiding them — never flash privileged links to restricted users.
  const showAll = !memberLoading && member !== null && !RESTRICTED_ROLES.includes(member.app_role as typeof RESTRICTED_ROLES[number]);
  const filteredSidebar = showAll
    ? SIDEBAR_ITEMS
    : SIDEBAR_ITEMS.filter((item) => !RESTRICTED_NAV_HIDDEN.includes(item.href));

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

        <nav className="flex-1 p-2" data-testid="sidebar-nav">
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

        {/* Portal quick-links */}
        <div className="px-2 pb-2 border-b border-gray-200">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Portal
          </p>
          {[
            { href: "/portal/roster", label: "Roster", icon: "📋" },
            { href: "/portal/songs", label: "Song Library", icon: "🎵" },
          ].map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors mb-0.5"
            >
              <span>{icon}</span>
              {label}
              <span className="ml-auto text-gray-300 text-xs">↗</span>
            </a>
          ))}
        </div>

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
