import { useEffect, useState } from "react";
import type { Permissions } from "@/lib/permissions";

export function useCurrentMember() {
  const [member, setMember] = useState<{ app_role: string } | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setMember(data ?? null);
          setPermissions(data?.permissions ?? null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { member, permissions, loading };
}
