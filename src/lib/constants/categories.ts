import type { SongCategory } from "@/lib/types/database";

export const SONG_CATEGORIES: { value: SongCategory; label: string }[] = [
  { value: "assurance_of_grace", label: "Assurance of Grace" },
  { value: "gospel_salvation", label: "Gospel / Salvation" },
  { value: "call_to_worship", label: "Call to Worship" },
  { value: "praise_upbeat", label: "Praise (Upbeat)" },
  { value: "confession_repentance", label: "Confession / Repentance" },
  { value: "thanksgiving", label: "Thanksgiving" },
  { value: "response_commitment", label: "Response / Commitment" },
  { value: "communion", label: "Communion" },
  { value: "adoration_worship", label: "Adoration / Worship" },
];

export const CATEGORY_LABEL_MAP: Record<SongCategory, string> =
  Object.fromEntries(
    SONG_CATEGORIES.map((c) => [c.value, c.label])
  ) as Record<SongCategory, string>;
