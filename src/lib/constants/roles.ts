import type { MemberRole } from "@/lib/types/database";

/**
 * These MUST match roles.name in the database exactly.
 * Database is the source of truth.
 */
export const ROLES: { value: MemberRole; label: string }[] = [
  { value: "worship_lead", label: "Worship Lead" },
  { value: "backup_vocals_1", label: "Backup Vocals 1" },
  { value: "backup_vocals_2", label: "Backup Vocals 2" },
  { value: "acoustic_guitar", label: "Acoustic Guitar" },
  { value: "electric_guitar", label: "Electric Guitar" },
  { value: "bass", label: "Bass" },
  { value: "keyboard", label: "Keys" },
  { value: "drums", label: "Drums" },
  { value: "percussion", label: "Perc" },
  { value: "setup", label: "Setup" },
  { value: "sound", label: "Sound" },
] as const;

export const ROLE_LABEL_MAP: Record<MemberRole, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label])
) as Record<MemberRole, string>;

export const ROLE_SHORT_LABEL_MAP: Record<MemberRole, string> = {
  worship_lead:    "WL",
  backup_vocals_1: "VOC 1",
  backup_vocals_2: "VOC 2",
  acoustic_guitar: "AG",
  electric_guitar: "EG",
  bass:            "BASS",
  keyboard:        "KEYS",
  drums:           "DRM",
  percussion:      "PERC",
  setup:           "SETUP",
  sound:           "SND",
};

/**
 * Grid column order for admin roster table
 * Explicit to avoid accidental reorder bugs.
 */
export const ROSTER_COLUMN_ORDER: MemberRole[] = [
  "worship_lead",
  "backup_vocals_1",
  "backup_vocals_2",
  "acoustic_guitar",
  "electric_guitar",
  "bass",
  "keyboard",
  "drums",
  "sound",
  "setup",
  "percussion",
];