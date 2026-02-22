// ─────────────────────────────────────────────────────────────────────────────
// Chord transposition utilities (no external dependencies)
// Handles: simple chords, slash chords, sus, minor, major variants
// Example inputs from real chord sheets: B, F#, G#m, Bsus4, B/D#, D#m, etc.
// ─────────────────────────────────────────────────────────────────────────────

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_SCALE  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

// Keys where flat notation is conventional
const FLAT_KEY_SET = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']);

// Display keys shown in the key selector (mixed sharp/flat by convention)
export const ALL_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map enharmonic equivalents so DB keys always match a selector option
const TO_SELECTOR_KEY: Record<string, string> = {
  'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb',
};
export function normalizeKey(key: string): string {
  return TO_SELECTOR_KEY[key] ?? key;
}

function noteIndex(note: string): number {
  const si = (SHARP_SCALE as readonly string[]).indexOf(note);
  return si !== -1 ? si : (FLAT_SCALE as readonly string[]).indexOf(note);
}

function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const idx = noteIndex(note);
  if (idx === -1) return note;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return (useFlats ? FLAT_SCALE : SHARP_SCALE)[newIdx];
}

// Matches a full chord token: root + optional quality + optional bass note
// Supported: C, C#, Dm, Am7, Dm7, G7, F#m, Bsus4, B/D#, G#m, Cmaj7, aug, dim, add9, etc.
// FIX: m[0-9]+ must come before m(?!aj) — otherwise regex engine matches lone 'm'
// in Am7 via m(?!aj) and leaves the digit unmatched, failing the full token.
const CHORD_RE = /^([A-G][#b]?)(m[0-9]+|m(?!aj)|M|maj[0-9]*|min[0-9]*|sus[0-9]*|aug|dim|add[0-9]*|[0-9]+)?(\/([A-G][#b]?))?$/;

// Tokens that can appear on a chord line but aren't chords (bar/rhythm markers)
const MARKER_RE = /^[|/()\[\]]+$|^\/{1,3}$/;

export function isChordToken(token: string): boolean {
  return CHORD_RE.test(token);
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Section headers like [Intro], [Verse] [2x] are never chord lines
  if (/^\[/.test(trimmed)) return false;

  // Strip parenthetical annotations, e.g. "(straight to Open the Eyes of my Heart)"
  // These are performance notes, not chords — ignore them for detection purposes.
  const stripped = trimmed.replace(/\([^)]*\)/g, '').trim();
  if (!stripped) return false;

  const tokens = stripped.split(/\s+/).filter(Boolean);
  let hasChord = false;
  for (const token of tokens) {
    if (MARKER_RE.test(token)) continue; // skip bar/rhythm markers
    if (!isChordToken(token)) return false;
    hasChord = true;
  }
  return hasChord;
}

function transposeChord(chord: string, semitones: number, useFlats: boolean): string {
  const m = chord.match(CHORD_RE);
  if (!m) return chord;
  const [, root, quality = '', , bass] = m;
  const newRoot = transposeNote(root, semitones, useFlats);
  const newBass = bass ? '/' + transposeNote(bass, semitones, useFlats) : '';
  return newRoot + quality + newBass;
}

// Transpose all chord tokens in a chord line, preserving whitespace exactly
export function transposeLine(line: string, semitones: number, useFlats: boolean): string {
  if (semitones === 0) return line;
  return line.replace(/\S+/g, (token) => {
    if (MARKER_RE.test(token)) return token;
    if (isChordToken(token)) return transposeChord(token, semitones, useFlats);
    return token;
  });
}

export function semitonesBetween(fromKey: string, toKey: string): number {
  const from = noteIndex(fromKey);
  const to   = noteIndex(toKey);
  if (from === -1 || to === -1) return 0;
  return ((to - from) + 12) % 12;
}

export function prefersFlats(key: string): boolean {
  return FLAT_KEY_SET.has(key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chord sheet parser — splits raw text into typed lines for rendering
// ─────────────────────────────────────────────────────────────────────────────

export type LineType = 'empty' | 'section' | 'chord' | 'lyric';

export interface ParsedLine {
  type: LineType;
  raw: string;
  display: string; // transposed (chord) or original (lyric/section)
}

export function parseChordSheet(
  text: string,
  semitones: number,
  toKey: string,
): ParsedLine[] {
  const useFlats = prefersFlats(toKey);
  return text.split('\n').map((raw): ParsedLine => {
    const trimmed = raw.trim();
    if (!trimmed) return { type: 'empty', raw, display: '' };

    if (/^\[/.test(trimmed)) {
      return { type: 'section', raw, display: raw };
    }

    if (isChordLine(raw)) {
      return {
        type: 'chord',
        raw,
        display: transposeLine(raw, semitones, useFlats),
      };
    }

    return { type: 'lyric', raw, display: raw };
  });
}
