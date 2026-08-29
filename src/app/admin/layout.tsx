"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MeResponse } from "@/lib/types/database";
import type { Resource } from "@/lib/permissions";

function useCurrentMember() {
  const [member, setMember] = useState<MeResponse | null>(null);
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

interface SidebarItem {
  href: string;
  label: string;
  icon: string;
  /** Feature flag key. If undefined, the item is always visible (not feature-gated). */
  feature?: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { href: "/admin/roster", label: "Roster Manager", icon: "📋", feature: "roster" },
  { href: "/admin/availability", label: "Availability", icon: "📅", feature: "availability" },
  { href: "/admin/setlist", label: "Setlist", icon: "🎶", feature: "setlist" },
  { href: "/admin/songs", label: "Song Manager", icon: "🎵", feature: "songs" },
  { href: "/admin/songs/health", label: "Song Health", icon: "💚", feature: "songs" },
  { href: "/admin/people", label: "People", icon: "👥" },
  { href: "/admin/recordings", label: "Recordings", icon: "🎙️" },
  { href: "/admin/handbook", label: "Team Handbook", icon: "📖", feature: "handbook" },
  { href: "/admin/help", label: "Help", icon: "❓" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/admin/audit", label: "Audit Log", icon: "🔍", feature: "audit_log" },
  { href: "/admin/about", label: "About", icon: "ℹ️" },
];

// Map sidebar hrefs to the permission resource required to view them.
// Pages not listed here are visible to all authenticated admin roles.
const NAV_PERMISSION_RESOURCE: Record<string, Resource> = {
  "/admin/settings": "settings",
  "/admin/audit": "audit",
};


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { member, loading: memberLoading } = useCurrentMember();
  const permissions = member?.permissions ?? null;

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Permission-based nav visibility. While loading or on fetch failure, default
  // to hiding restricted items — never flash privileged links.
  const isNavAllowed = (href: string): boolean => {
    const resource = NAV_PERMISSION_RESOURCE[href];
    if (!resource) return true; // no permission gate on this nav item
    if (memberLoading || !permissions) return false; // hide while unknown
    return permissions[resource]?.includes("view") ?? false;
  };

  // Feature flag filtering: if features[] is absent (single-tenant / not loaded),
  // default to showing all items. This preserves backward compatibility with tests
  // and single-tenant deployments.
  const enabledFeatures = member?.features ?? null;
  const isFeatureVisible = (feature?: string) => {
    if (!feature) return true;           // no feature key → always visible
    if (!enabledFeatures) return true;   // features not yet resolved → show all
    return enabledFeatures.includes(feature);
  };

  const filteredSidebar = SIDEBAR_ITEMS.filter((item) => {
    // 1. Feature-flag gate
    if (!isFeatureVisible(item.feature)) return false;
    // 2. Permission-based gate (e.g. Settings / Audit Log)
    if (!isNavAllowed(item.href)) return false;
    return true;
  });

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network failures — redirect regardless
    }
    router.replace("/admin/login");
    router.refresh();
  }

  // Display the tenant name from /api/me if available, otherwise fall back to
  // the static label (backward compat in single-tenant mode).
  const tenantName = member?.tenant_name ?? "Worship Ministry";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-900">{tenantName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Ministry Admin</p>
        </div>

        <nav className="p-2" data-testid="sidebar-nav">
          <p className="px-3 pt-1 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Admin
          </p>
          {filteredSidebar.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href + "/") && !item.href.endsWith("/"));
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

        {/* Musician View quick-links — below admin nav */}
        <div className="px-2 pt-2 pb-2 border-t border-gray-200">
          <p className="px-3 pt-1 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Musician View
          </p>
          {[
            { href: "/portal/roster", label: "Roster", icon: "📋" },
            { href: "/portal/songs", label: "Song Library", icon: "🎵" },
            { href: "/portal/recordings", label: "Recordings", icon: "🎙️" },
          ].map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors mb-0.5"
            >
              <span>{icon}</span>
              <span className="flex flex-col min-w-0">
                <span>{label}</span>
                <span className="text-[10px] font-normal text-gray-400 leading-tight">opens in new tab</span>
              </span>
              <span className="ml-auto text-gray-300 text-xs flex-shrink-0">↗</span>
            </a>
          ))}
        </div>
      </aside>

      {/* Right column: top header + main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header bar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-end px-6 shrink-0">
          {memberLoading ? (
            <span className="text-sm text-gray-400">—</span>
          ) : member ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">{member.name}</span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-50 text-yellow-700">{member.app_role}</span>
              <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer p-0">
                Sign out
              </button>
            </div>
          ) : (
            <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer p-0">
              Sign out
            </button>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
