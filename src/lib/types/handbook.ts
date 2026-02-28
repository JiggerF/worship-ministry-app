export type ChangeType = "minor" | "major";

export interface HandbookDocument {
  id: string;
  slug: string;
  title: string;
  content: string;
  major_version: number;
  minor_version: number;
  is_current: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  change_type: ChangeType;
  what_changed: string[];
  why_changed: string;
}

/** Lightweight metadata — no content. Used for the sidebar list. */
export interface HandbookMeta {
  id: string;
  slug: string;
  title: string;
  major_version: number;
  minor_version: number;
  created_by_name: string | null;
  created_at: string;
}

/** Body sent by the client on POST /api/handbook/[slug] */
export interface SaveHandbookPayload {
  content: string;
  change_type: ChangeType;
  what_changed: string[];
  why_changed: string;
}

/** Computed display string, e.g. "v1.2" */
export function versionLabel(doc: Pick<HandbookDocument | HandbookMeta, "major_version" | "minor_version">): string {
  return `v${doc.major_version}.${doc.minor_version}`;
}

/** The ordered sidebar sections for the Team Handbook */
export const HANDBOOK_SECTIONS = [
  {
    label: "Vision & Values",
    slug: "vision-values",
    group: null,
  },
  {
    label: "Roles & Responsibilities",
    slug: null, // group heading — not clickable
    group: "roles",
    children: [
      { label: "Worship Lead", slug: "roles-worship-lead" },
      { label: "Worship Coordinator", slug: "roles-worship-coordinator" },
      { label: "Music Coordinator", slug: "roles-music-coordinator" },
    ],
  },
  {
    label: "Weekly Rhythm",
    slug: "weekly-rhythm",
    group: null,
  },
  {
    label: "Decision Rights & Escalation",
    slug: "decision-rights",
    group: null,
  },
] as const;

export const DEFAULT_SLUG = "vision-values";
