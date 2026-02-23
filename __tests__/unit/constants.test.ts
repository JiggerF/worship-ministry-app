/**
 * Unit tests — Application constants
 * src/lib/constants/roles.ts  &  src/lib/constants/categories.ts
 *
 * Verifies that every MemberRole/SongCategory value present in the type system
 * has a corresponding label/map entry — guards against silent gaps when new
 * values are added to the DB or type definitions.
 */
import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_LABEL_MAP,
  ROLE_SHORT_LABEL_MAP,
  ROSTER_COLUMN_ORDER,
} from "@/lib/constants/roles";
import {
  SONG_CATEGORIES,
  CATEGORY_LABEL_MAP,
} from "@/lib/constants/categories";
import type { MemberRole } from "@/lib/types/database";
import type { SongCategory } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// ROLES constant array
// ─────────────────────────────────────────────────────────────────────────────
describe("ROLES array", () => {
  const EXPECTED_ROLES: MemberRole[] = [
    "worship_lead",
    "backup_vocals_1",
    "backup_vocals_2",
    "acoustic_guitar",
    "electric_guitar",
    "bass",
    "keyboard",
    "drums",
    "percussion",
    "setup",
    "sound",
  ];

  it("contains all 11 expected role values", () => {
    const values = ROLES.map((r) => r.value);
    EXPECTED_ROLES.forEach((role) => {
      expect(values).toContain(role);
    });
  });

  it("has a non-empty label for every role", () => {
    ROLES.forEach(({ value, label }) => {
      expect(label, `Role '${value}' is missing a label`).toBeTruthy();
      expect(label.trim().length).toBeGreaterThan(0);
    });
  });

  it("has no duplicate role values", () => {
    const values = ROLES.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE_LABEL_MAP
// ─────────────────────────────────────────────────────────────────────────────
describe("ROLE_LABEL_MAP", () => {
  it("maps worship_lead to a human-readable label", () => {
    expect(ROLE_LABEL_MAP.worship_lead).toBeTruthy();
  });

  it("contains an entry for every role in ROLES", () => {
    ROLES.forEach(({ value }) => {
      expect(
        ROLE_LABEL_MAP[value],
        `ROLE_LABEL_MAP is missing entry for '${value}'`
      ).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE_SHORT_LABEL_MAP
// ─────────────────────────────────────────────────────────────────────────────
describe("ROLE_SHORT_LABEL_MAP", () => {
  it("has short labels for all roles (3-6 chars convention)", () => {
    const entries = Object.entries(ROLE_SHORT_LABEL_MAP);
    expect(entries.length).toBeGreaterThanOrEqual(11);
    entries.forEach(([role, short]) => {
      expect(short, `Short label missing for role '${role}'`).toBeTruthy();
    });
  });

  it("has known short labels for core roles", () => {
    expect(ROLE_SHORT_LABEL_MAP.worship_lead).toBe("WL");
    expect(ROLE_SHORT_LABEL_MAP.drums).toBe("DRM");
    expect(ROLE_SHORT_LABEL_MAP.keyboard).toBe("KEYS");
    expect(ROLE_SHORT_LABEL_MAP.bass).toBe("BASS");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER_COLUMN_ORDER
// ─────────────────────────────────────────────────────────────────────────────
describe("ROSTER_COLUMN_ORDER", () => {
  it("starts with worship_lead (always the first column)", () => {
    expect(ROSTER_COLUMN_ORDER[0]).toBe("worship_lead");
  });

  it("contains all 11 roles exactly once", () => {
    expect(ROSTER_COLUMN_ORDER).toHaveLength(11);
    expect(new Set(ROSTER_COLUMN_ORDER).size).toBe(11);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SONG_CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
describe("SONG_CATEGORIES array", () => {
  const EXPECTED_CATEGORIES: SongCategory[] = [
    "assurance_of_grace",
    "gospel_salvation",
    "call_to_worship",
    "praise_upbeat",
    "confession_repentance",
    "thanksgiving",
    "response_commitment",
    "communion",
    "adoration_worship",
  ];

  it("contains all 9 expected song categories", () => {
    const values = SONG_CATEGORIES.map((c) => c.value);
    EXPECTED_CATEGORIES.forEach((cat) => {
      expect(values).toContain(cat);
    });
  });

  it("has a non-empty label for every category", () => {
    SONG_CATEGORIES.forEach(({ value, label }) => {
      expect(label, `Category '${value}' is missing a label`).toBeTruthy();
      expect(label.trim().length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY_LABEL_MAP
// ─────────────────────────────────────────────────────────────────────────────
describe("CATEGORY_LABEL_MAP", () => {
  it("maps every SONG_CATEGORIES value to a label", () => {
    SONG_CATEGORIES.forEach(({ value }) => {
      expect(
        CATEGORY_LABEL_MAP[value],
        `CATEGORY_LABEL_MAP missing entry for '${value}'`
      ).toBeTruthy();
    });
  });

  it("has human-friendly labels for known categories", () => {
    expect(CATEGORY_LABEL_MAP.communion).toBe("Communion");
    expect(CATEGORY_LABEL_MAP.thanksgiving).toBe("Thanksgiving");
    expect(CATEGORY_LABEL_MAP.call_to_worship).toBe("Call to Worship");
  });
});
