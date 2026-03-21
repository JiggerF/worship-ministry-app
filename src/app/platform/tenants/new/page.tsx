"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewTenantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive slug from name (lowercase, hyphens, strip specials)
  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === autoSlug(name)) {
      setSlug(autoSlug(value));
    }
  }

  function autoSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          admin_email: adminEmail.trim(),
          admin_name: adminName.trim(),
        }),
      });

      let json: { error?: string; org_id?: string } | null = null;
      try { json = await res.json(); } catch { /* ignore */ }

      if (!res.ok) {
        setError(json?.error ?? "Failed to create tenant");
        return;
      }

      router.replace(`/platform/tenants/${json?.org_id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/platform/tenants" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Tenants
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Tenant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Provisions a new church organization. The admin will receive a Supabase Auth invite email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Church Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="Grace Community Church"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              required
              pattern="[a-z0-9-]+"
              placeholder="grace-community"
              className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Used as the subdomain: <span className="font-mono">{slug || "slug"}.worshipapp.com</span>
          </p>
        </div>

        <hr className="border-gray-100" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Admin Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            required
            placeholder="John Smith"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Admin Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            placeholder="admin@gracechurch.org"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            An invite email will be sent to this address after provisioning.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Provisioning…" : "Provision Tenant"}
          </button>
          <Link
            href="/platform/tenants"
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
