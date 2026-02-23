/**
 * Unit tests — Chord transposition utilities
 * src/lib/utils/transpose.ts
 *
 * Covers: isChordToken, isChordLine, semitonesBetween, transposeLine,
 *         normalizeKey, prefersFlats, parseChordSheet, ALL_KEYS
 */
import { describe, it, expect } from "vitest";
import {
  isChordToken,
  isChordLine,
  transposeLine,
  semitonesBetween,
  prefersFlats,
  normalizeKey,
  parseChordSheet,
  ALL_KEYS,
} from "@/lib/utils/transpose";

// ─────────────────────────────────────────────────────────────────────────────
// isChordToken
// ─────────────────────────────────────────────────────────────────────────────
describe("isChordToken", () => {
  it.each([
    "C", "G", "D", "A", "E", "B", "F",
    "Am", "Dm", "Em",
    "F#", "C#", "G#m", "D#m",
    "Bb", "Eb",
    "Bsus4", "Asus2", "Esus",
    "B/D#", "G/B", "C/E",
    "Cmaj7", "Gmaj7", "Fmaj7",
    "Am7", "Dm7", "Em7",
    "G7", "D7", "A7",
    "Caug", "Cdim",
  ])("recognises valid chord token: %s", (chord) => {
    expect(isChordToken(chord)).toBe(true);
  });

  it.each([
    "hello",
    "words",
    "the",
    "Amazing",
    "123",
    "||",
    "//",
    "",
  ])("rejects non-chord token: %s", (token) => {
    expect(isChordToken(token)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isChordLine
// ─────────────────────────────────────────────────────────────────────────────
describe("isChordLine", () => {
  it.each([
    "G C Am F",
    "B F# G#m E",
    "Bsus4 B/D# E",
    "D A Bm G",
    "| C G | Am F |",
  ])("returns true for a chord line: '%s'", (line) => {
    expect(isChordLine(line)).toBe(true);
  });

  it.each([
    "Amazing grace how sweet the sound",
    "That saved a wretch like me",
    "1. First verse",
  ])("returns false for a lyric line: '%s'", (line) => {
    expect(isChordLine(line)).toBe(false);
  });

  it("returns false for empty or whitespace-only string", () => {
    expect(isChordLine("")).toBe(false);
    expect(isChordLine("   ")).toBe(false);
  });

  it.each(["[Verse]", "[Chorus]", "[Bridge]", "[Intro]", "[Outro]"])(
    "returns false for section header: '%s'",
    (header) => {
      expect(isChordLine(header)).toBe(false);
    }
  );

  it("ignores parenthetical performance annotations when detecting chord lines", () => {
    // Real-world chord line with a bracketed note
    expect(isChordLine("G C (straight to next verse) Am")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// semitonesBetween
// ─────────────────────────────────────────────────────────────────────────────
describe("semitonesBetween", () => {
  it("returns 0 for the same key", () => {
    expect(semitonesBetween("C", "C")).toBe(0);
    expect(semitonesBetween("G", "G")).toBe(0);
    expect(semitonesBetween("Bb", "Bb")).toBe(0);
  });

  it("returns 7 for C → G", () => {
    expect(semitonesBetween("C", "G")).toBe(7);
  });

  it("returns 2 for C → D", () => {
    expect(semitonesBetween("C", "D")).toBe(2);
  });

  it("returns 5 for C → F", () => {
    expect(semitonesBetween("C", "F")).toBe(5);
  });

  it("wraps around correctly: C → B = 11", () => {
    expect(semitonesBetween("C", "B")).toBe(11);
  });

  it("handles enharmonic equivalents via flat scale: C → Eb = 3", () => {
    expect(semitonesBetween("C", "Eb")).toBe(3);
  });

  it("returns 0 for unknown keys (graceful fallback)", () => {
    expect(semitonesBetween("X", "Y")).toBe(0);
    expect(semitonesBetween("C", "H")).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// transposeLine
// ─────────────────────────────────────────────────────────────────────────────
describe("transposeLine", () => {
  it("returns the original line unchanged for 0 semitones", () => {
    expect(transposeLine("C G Am F", 0, false)).toBe("C G Am F");
    expect(transposeLine("B F# G#m E", 0, false)).toBe("B F# G#m E");
  });

  it("transposes C G Am F up 7 semitones → G D Em C", () => {
    expect(transposeLine("C G Am F", 7, false)).toBe("G D Em C");
  });

  it("transposes C G Am F up 2 semitones → D A Bm G", () => {
    expect(transposeLine("C G Am F", 2, false)).toBe("D A Bm G");
  });

  it("transposes a slash chord: B/D# up 2 semitones → C#/F", () => {
    expect(transposeLine("B/D#", 2, false)).toBe("C#/F");
  });

  it("uses flat notation when useFlats=true", () => {
    // C + 6 semitones = F# (sharp) or Gb (flat)
    expect(transposeLine("C", 6, false)).toBe("F#");
    expect(transposeLine("C", 6, true)).toBe("Gb");
  });

  it("preserves bar/rhythm markers ( | ) untouched", () => {
    expect(transposeLine("| C G |", 7, false)).toBe("| G D |");
  });

  it("transposes with minor quality preserved: Am → Em (+7)", () => {
    const result = transposeLine("Am", 7, false);
    expect(result).toBe("Em");
  });

  it("transposes sus chord quality preserved: Asus2 → Esus2 (+7)", () => {
    const result = transposeLine("Asus2", 7, false);
    expect(result).toBe("Esus2");
  });

  it("transposes maj7 quality preserved: Cmaj7 → Gmaj7 (+7)", () => {
    const result = transposeLine("Cmaj7", 7, false);
    expect(result).toBe("Gmaj7");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeKey
// ─────────────────────────────────────────────────────────────────────────────
describe("normalizeKey", () => {
  it.each([
    ["D#", "Eb"],
    ["G#", "Ab"],
    ["A#", "Bb"],
  ])("maps enharmonic '%s' → '%s'", (input, expected) => {
    expect(normalizeKey(input)).toBe(expected);
  });

  it.each(["C", "G", "D", "A", "E", "B", "F", "F#", "Eb", "Bb", "Ab"])(
    "leaves canonical key '%s' unchanged",
    (key) => {
      expect(normalizeKey(key)).toBe(key);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// prefersFlats
// ─────────────────────────────────────────────────────────────────────────────
describe("prefersFlats", () => {
  it.each(["F", "Bb", "Eb", "Ab", "Db", "Gb"])(
    "returns true for flat key: %s",
    (key) => {
      expect(prefersFlats(key)).toBe(true);
    }
  );

  it.each(["C", "G", "D", "A", "E", "B", "F#", "C#"])(
    "returns false for sharp/natural key: %s",
    (key) => {
      expect(prefersFlats(key)).toBe(false);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// parseChordSheet
// ─────────────────────────────────────────────────────────────────────────────
describe("parseChordSheet", () => {
  it("classifies empty lines as type 'empty'", () => {
    const result = parseChordSheet("\n\n", 0, "C");
    expect(result.every((l) => l.type === "empty")).toBe(true);
  });

  it("classifies section headers as type 'section'", () => {
    const result = parseChordSheet("[Verse]\n[Chorus]", 0, "C");
    expect(result[0].type).toBe("section");
    expect(result[1].type).toBe("section");
  });

  it("classifies chord lines as type 'chord'", () => {
    const result = parseChordSheet("C G Am F", 0, "C");
    expect(result[0].type).toBe("chord");
  });

  it("classifies lyric lines as type 'lyric'", () => {
    const result = parseChordSheet("Amazing grace how sweet the sound", 0, "C");
    expect(result[0].type).toBe("lyric");
  });

  it("applies transposition to chord lines (+2 semitones)", () => {
    const result = parseChordSheet("C G Am F", 2, "D");
    expect(result[0].display).toBe("D A Bm G");
  });

  it("does NOT apply transposition to lyric lines", () => {
    const result = parseChordSheet("Amazing grace", 7, "G");
    expect(result[0].display).toBe("Amazing grace");
  });

  it("does NOT transpose section headers", () => {
    const result = parseChordSheet("[Verse 1]", 7, "G");
    expect(result[0].display).toBe("[Verse 1]");
  });

  it("handles a realistic mixed chord sheet", () => {
    const sheet = `[Verse]\nC G Am F\nAmazing grace\n\n[Chorus]\nG D Em C`;
    const result = parseChordSheet(sheet, 0, "C");
    expect(result[0].type).toBe("section");
    expect(result[1].type).toBe("chord");
    expect(result[2].type).toBe("lyric");
    expect(result[3].type).toBe("empty");
    expect(result[4].type).toBe("section");
    expect(result[5].type).toBe("chord");
  });

  it("preserves raw text on each line", () => {
    const sheet = "C G Am F";
    const result = parseChordSheet(sheet, 7, "G");
    expect(result[0].raw).toBe("C G Am F");
  });

  it("uses flat notation for flat target keys", () => {
    // C + 6 semitones under key of Gb (prefers flats)
    const result = parseChordSheet("C", 6, "Gb");
    expect(result[0].display).toBe("Gb");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ALL_KEYS
// ─────────────────────────────────────────────────────────────────────────────
describe("ALL_KEYS", () => {
  it("contains exactly 12 entries", () => {
    expect(ALL_KEYS).toHaveLength(12);
  });

  it.each(["C", "G", "D", "A", "E", "B", "F", "F#", "Bb", "Eb", "Ab", "C#"])(
    "includes key: %s",
    (key) => {
      expect(ALL_KEYS).toContain(key);
    }
  );

  it("contains no duplicate keys", () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });
});
