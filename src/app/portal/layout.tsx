"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_TABS = [
  { href: "/portal/roster", label: "Roster" },
  { href: "/portal/songs", label: "Song Library" },
  { href: "#", label: "Calendar", comingSoon: true },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">WORDCC Worship Team</h1>
        <p className="text-sm text-gray-500 mt-1">Musicians Portal</p>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4">
        <div className="max-w-3xl mx-auto flex gap-1 overflow-x-auto">
          {NAV_TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.label}
                href={tab.comingSoon ? "#" : tab.href}
                className={`
                  px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${
                    isActive
                      ? "border-gray-900 text-gray-900"
                      : tab.comingSoon
                        ? "border-transparent text-gray-300 cursor-not-allowed"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                onClick={tab.comingSoon ? (e) => e.preventDefault() : undefined}
              >
                {tab.label}
                {tab.comingSoon && (
                  <span className="ml-1 text-xs text-gray-300">(soon)</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
