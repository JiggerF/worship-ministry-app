"use client";

import { useEffect, useState } from "react";
import type { MeResponse } from "@/lib/types/database";
import { APP_INFO, MODULES } from "@/lib/constants/app-info";

function StatusDot({ status }: { status: "on" | "off" | "coming-soon" }) {
  if (status === "on")
    return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />;
  if (status === "coming-soon")
    return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />;
}

function StatusBadge({ status }: { status: "on" | "off" | "coming-soon" }) {
  if (status === "on")
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
        Active
      </span>
    );
  if (status === "coming-soon")
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
        Coming Soon
      </span>
    );
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
      Inactive
    </span>
  );
}

export default function AboutPage() {
  const [member, setMember] = useState<MeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setMember(data ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const enabledFeatures: string[] = member?.features ?? [];

  const resolveStatus = (key: string, moduleStatus: string): "on" | "off" | "coming-soon" => {
    if (moduleStatus === "coming-soon") return "coming-soon";
    if (enabledFeatures.length === 0) return "on"; // single-tenant: show all as active
    return enabledFeatures.includes(key) ? "on" : "off";
  };

  const buildYear = new Date().getFullYear();

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">About</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-gray-900 text-white text-xs font-semibold tracking-wide">
            v{APP_INFO.version}
          </span>
        </div>
        <p className="text-sm text-gray-500">{APP_INFO.name} · {APP_INFO.releaseDate}</p>
      </div>

      {/* ── Author card ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Created by
            </p>
            <h2 className="text-lg font-bold text-gray-900">{APP_INFO.author.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{APP_INFO.author.role}</p>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed max-w-lg">
              {APP_INFO.author.note}
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white text-lg font-bold select-none">
              JF
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          <a
            href={`mailto:${APP_INFO.author.email}?subject=Worship Ministry App — Feedback`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Feedback
          </a>
          <a
            href={`mailto:${APP_INFO.author.email}?subject=Worship Ministry App — Bug Report`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Report a Bug
          </a>
        </div>
      </div>

      {/* ── Module status ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Platform Modules</h2>
          <p className="text-xs text-gray-500 mt-0.5">Features available on your plan</p>
        </div>
        <div className="divide-y divide-gray-50">
          {MODULES.map((mod) => {
            const status = resolveStatus(mod.key, mod.status);
            return (
              <div key={mod.key} className="px-6 py-3.5 flex items-start gap-3">
                <StatusDot status={status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${status === "off" ? "text-gray-400" : "text-gray-900"}`}>
                      {mod.label}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{mod.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Build information ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Build Information</h2>
        </div>
        <dl className="divide-y divide-gray-50">
          {[
            { label: "App Version", value: `v${APP_INFO.version}` },
            { label: "Release", value: APP_INFO.releaseDate },
            { label: "License", value: APP_INFO.license },
            { label: "Multi-Tenancy", value: "Enabled — tenant-isolated per subdomain" },
          ].map(({ label, value }) => (
            <div key={label} className="px-6 py-3 flex items-center justify-between gap-4">
              <dt className="text-xs font-medium text-gray-500 w-36 flex-shrink-0">{label}</dt>
              <dd className="text-sm text-gray-900 text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-gray-400">
        © {buildYear} {APP_INFO.author.name} · {APP_INFO.license}
      </p>
    </div>
  );
}
