import type { MemberRole } from "@/lib/types/database";

export const ROLES: { value: MemberRole; label: string }[] = [
  { value: "worship_lead", label: "Worship Lead" },
  { value: "backup_vocals_1", label: "Backup Vocals 1" },
  { value: "backup_vocals_2", label: "Backup Vocals 2" },
  { value: "acoustic_guitar", label: "Acoustic Guitar" },
  { value: "electric_guitar", label: "Electric Guitar" },
  { value: "bass", label: "Bass" },
  { value: "keyboard", label: "Keys" },
  { value: "drums", label: "Drums" },
  { value: "percussion", label: "Percussion" },
  { value: "setup", label: "Setup" },
  { value: "sound", label: "Sound" },
] as const;

export const ROLE_LABEL_MAP: Record<MemberRole, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label])
) as Record<MemberRole, string>;

// Grid column order for admin roster table
export const ROSTER_COLUMN_ORDER: MemberRole[] = ROLES.map((r) => r.value);
