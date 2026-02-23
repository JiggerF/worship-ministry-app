"use client";
// Explicit interface for mock auth client
interface MockAuthClient {
  session: () => { user?: { email?: string } };
}

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import type { Member } from "@/lib/types/database";

// ...existing code...

function useCurrentMember() {
  const [member, setMember] = useState<Member | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function fetchMember() {
      let user: { email?: string } | null = null;
      // Check for getUser (real supabase client)
      if (
        supabase.auth &&
        typeof (supabase.auth as { getUser?: () => Promise<{ data?: { user?: { email?: string } } }> }).getUser === "function"
      ) {
        const { data } = await (supabase.auth as { getUser: () => Promise<{ data?: { user?: { email?: string } } }> }).getUser();
        user = data?.user || null;
      } else if (
        supabase.auth &&
        typeof (supabase.auth as unknown as MockAuthClient).session === "function"
      ) {
        const session = (supabase.auth as unknown as MockAuthClient).session();
        user = session?.user || null;
      }
      if (!user || typeof user.email !== "string") {
        setMember(null);
        return;
      }
      // Fetch member info from DB by email
      let data: Member | null = null;
      let error: unknown = null;
      if (
        typeof (supabase as unknown as { from?: (table: string) => { select: (fields: string) => { eq: (field: string, value: string) => { single: () => Promise<{ data: Member | null; error: unknown }> } } } }).from === "function"
      ) {
        const result = await (supabase as unknown as { from: (table: string) => { select: (fields: string) => { eq: (field: string, value: string) => { single: () => Promise<{ data: Member | null; error: unknown }> } } } }).from("members")
          .select("id, name, app_role")
          .eq("email", user.email)
          .single();
        data = result.data;
        error = result.error;
      }
      if (!cancelled) {
        if (!error && data) setMember(data);
        else setMember(null);
      }
    }
    fetchMember();
    // Listen for auth state changes
    let unsubscribe: (() => void) | undefined;
    if (
      supabase.auth &&
      typeof (supabase.auth as { onAuthStateChange?: (cb: () => void) => { data?: { subscription?: { unsubscribe?: () => void } } } }).onAuthStateChange === "function"
    ) {
      const { data: listener } = (supabase.auth as { onAuthStateChange: (cb: () => void) => { data?: { subscription?: { unsubscribe?: () => void } } } }).onAuthStateChange(() => {
        fetchMember();
      });
      if (
        listener &&
        listener.subscription &&
        typeof listener.subscription.unsubscribe === "function"
      ) {
        unsubscribe = () => {
          if (listener.subscription && typeof listener.subscription.unsubscribe === "function") {
            listener.subscription.unsubscribe();
          }
        };
      }
    }
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  return member;
}

const SIDEBAR_ITEMS = [
  { href: "/admin/roster", label: "Roster", icon: "📋" },
  { href: "/admin/songs", label: "Songs", icon: "🎵" },
  { href: "/admin/people", label: "People", icon: "👥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const member = useCurrentMember();

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Hide Settings nav for Coordinator
  const filteredSidebar = member?.app_role === "Coordinator"
    ? SIDEBAR_ITEMS.filter((item) => item.href !== "/admin/settings")
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
              {member ? (
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
                <>
                  <p className="text-sm font-medium text-gray-900">Loading...</p>
                  <Link
                    href="/admin/login"
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Sign out
                  </Link>
                </>
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
