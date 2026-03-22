/**
 * Static application metadata — displayed on the About page.
 * version is sourced from package.json — run `npm version patch/minor/major` to increment it.
 */

import { version } from "../../../package.json";

export const APP_INFO = {
  name: "Worship Ministry App",
  version,
  releaseDate: "2026",
  author: {
    name: "Jigger Fantonial",
    email: "",
    role: "Creator & Developer",
    note: "Built as a free tool for churches. Feedback and bug reports are always welcome.",
  },
  license: "Free for churches — no cost, no restrictions.",
  repoUrl: null, // set to a GitHub URL if ever open-sourced
} as const;

export const TECH_STACK = [
  { name: "Next.js", version: "16", category: "Framework", url: "https://nextjs.org" },
  { name: "React", version: "18", category: "UI Library", url: "https://react.dev" },
  { name: "TypeScript", version: "5", category: "Language", url: "https://typescriptlang.org" },
  { name: "Tailwind CSS", version: "4", category: "Styling", url: "https://tailwindcss.com" },
  { name: "Supabase", version: "2", category: "Database & Auth", url: "https://supabase.com" },
  { name: "Vercel", version: null, category: "Hosting", url: "https://vercel.com" },
  { name: "Vitest", version: "4", category: "Testing", url: "https://vitest.dev" },
] as const;

export interface ModuleInfo {
  key: string;
  label: string;
  description: string;
  status: "stable" | "beta" | "coming-soon";
}

/**
 * All known platform modules. The `key` maps 1:1 to feature flag keys in the DB.
 * Modules with status "coming-soon" are always shown as inactive regardless of flags.
 */
export const MODULES: ModuleInfo[] = [
  {
    key: "roster",
    label: "Roster Manager",
    description: "Monthly scheduling grid with Draft → Publish workflow.",
    status: "stable",
  },
  {
    key: "availability",
    label: "Availability Tracking",
    description: "Magic-link forms so musicians can submit availability monthly.",
    status: "stable",
  },
  {
    key: "songs",
    label: "Song Library",
    description: "Centralised song database with categories, keys, and scripture anchors.",
    status: "stable",
  },
  {
    key: "setlist",
    label: "Setlist Manager",
    description: "Curate Sunday setlists and download transposed chord chart bundles.",
    status: "stable",
  },
  {
    key: "chord_sheets",
    label: "Chord Sheet PDFs",
    description: "In-browser PDF generation with real-time key transposition.",
    status: "stable",
  },
  {
    key: "handbook",
    label: "Team Handbook",
    description: "Per-tenant editable documentation for your team.",
    status: "stable",
  },
  {
    key: "audit_log",
    label: "Audit Log",
    description: "Full change history across all admin actions.",
    status: "stable",
  },
  {
    key: "equipment",
    label: "Equipment Tracking",
    description: "Per-tenant inventory management for worship gear.",
    status: "coming-soon",
  },
  {
    key: "ai_roster",
    label: "AI Roster Agent",
    description: "AI-assisted scheduling suggestions based on availability and fairness.",
    status: "coming-soon",
  },
];
