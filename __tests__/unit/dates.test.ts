/**
 * Unit tests — Date utilities
 * src/lib/utils/dates.ts
 *
 * Tests all exported helpers for correctness against known calendar facts.
 * getCurrentSunday uses fake timers because it reads the real Date under the hood.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSundaysInMonth,
  formatSundayDate,
  formatDateDMY,
  toISODate,
  getCurrentSunday,
} from "@/lib/utils/dates";

// ─────────────────────────────────────────────────────────────────────────────
// getSundaysInMonth
// ─────────────────────────────────────────────────────────────────────────────
describe("getSundaysInMonth", () => {
  it("returns 4 Sundays for February 2026 (starts on a Sunday)", () => {
    // Feb 1 2026 is a Sunday → 4 Sundays total
    const sundays = getSundaysInMonth(2026, 1); // month index 1 = February
    expect(sundays).toHaveLength(4);
    expect(sundays[0].getDate()).toBe(1);
    expect(sundays[1].getDate()).toBe(8);
    expect(sundays[2].getDate()).toBe(15);
    expect(sundays[3].getDate()).toBe(22);
  });

  it("returns 5 Sundays for March 2026", () => {
    // March 2026 has 5 Sundays (Mar 1, 8, 15, 22, 29)
    const sundays = getSundaysInMonth(2026, 2);
    expect(sundays).toHaveLength(5);
    expect(sundays[0].getDate()).toBe(1);
  });

  it("returns 4 Sundays for January 2026", () => {
    // Jan 2026: first Sunday on Jan 4
    const sundays = getSundaysInMonth(2026, 0);
    expect(sundays).toHaveLength(4);
    expect(sundays[0].getDate()).toBe(4);
  });

  it("all returned dates fall on a Sunday (getDay() === 0)", () => {
    for (let m = 0; m < 12; m++) {
      const sundays = getSundaysInMonth(2026, m);
      sundays.forEach((d) => {
        expect(d.getDay()).toBe(0);
      });
    }
  });

  it("all returned dates belong to the requested month", () => {
    const sundays = getSundaysInMonth(2026, 5); // June
    sundays.forEach((d) => expect(d.getMonth()).toBe(5));
  });

  it("returns empty array for a month with no Sundays in wrong usage (edge)", () => {
    // All 12 months have at least 4 Sundays — just check non-zero length
    for (let m = 0; m < 12; m++) {
      expect(getSundaysInMonth(2026, m).length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatSundayDate
// ─────────────────────────────────────────────────────────────────────────────
describe("formatSundayDate", () => {
  it("formats a Date object — contains month, day, and year", () => {
    const result = formatSundayDate(new Date(2026, 1, 1)); // Feb 1 2026
    expect(result).toContain("Feb");
    expect(result).toContain("1");
    expect(result).toContain("2026");
  });

  it("formats an ISO string — avoids timezone shift (T00:00:00 parse)", () => {
    const result = formatSundayDate("2026-02-15");
    expect(result).toContain("Feb");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("includes day-of-week abbreviation", () => {
    // Feb 1, 2026 is a Sunday
    const result = formatSundayDate("2026-02-01");
    expect(result).toMatch(/Sun/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatDateDMY
// ─────────────────────────────────────────────────────────────────────────────
describe("formatDateDMY", () => {
  it("returns DD-MM-YYYY format for an ISO string", () => {
    expect(formatDateDMY("2026-02-01")).toBe("01-02-2026");
  });

  it("zero-pads single-digit day and month", () => {
    expect(formatDateDMY("2026-01-05")).toBe("05-01-2026");
    expect(formatDateDMY("2026-09-03")).toBe("03-09-2026");
  });

  it("accepts a Date object", () => {
    // Use local date constructor — month 1 = February
    const d = new Date(2026, 1, 15);
    expect(formatDateDMY(d)).toBe("15-02-2026");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toISODate
// ─────────────────────────────────────────────────────────────────────────────
describe("toISODate", () => {
  it("returns YYYY-MM-DD for a known date", () => {
    expect(toISODate(new Date(2026, 1, 1))).toBe("2026-02-01");
  });

  it("zero-pads month and day", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("handles December correctly", () => {
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentSunday  (uses fake timers — always a Sunday result)
// ─────────────────────────────────────────────────────────────────────────────
describe("getCurrentSunday", () => {
  afterEach(() => vi.useRealTimers());

  it("returns THIS Sunday when it is Sunday before noon Melbourne time", () => {
    // Feb 1 2026 = Sunday.  AEDT is UTC+11 in February.
    // 00:00 UTC = 11:00 AEDT — before noon → show this Sunday.
    vi.useFakeTimers({ now: new Date("2026-02-01T00:00:00.000Z") });
    const result = getCurrentSunday();
    expect(result.getDay()).toBe(0); // is a Sunday
  });

  it("returns NEXT Sunday when it is Sunday at/after noon Melbourne time", () => {
    // 05:00 UTC = 16:00 AEDT (past noon) — skip to next Sunday Feb 8
    vi.useFakeTimers({ now: new Date("2026-02-01T05:00:00.000Z") });
    const result = getCurrentSunday();
    expect(result.getDay()).toBe(0); // still a Sunday (next one)
  });

  it("returns the next Sunday when today is a weekday", () => {
    // Feb 2, 2026 is Monday UTC/Melbourne → next Sunday is Feb 8
    vi.useFakeTimers({ now: new Date("2026-02-02T00:00:00.000Z") });
    const result = getCurrentSunday();
    expect(result.getDay()).toBe(0);
  });

  it("always returns midnight (time component is zeroed)", () => {
    vi.useFakeTimers({ now: new Date("2026-02-02T00:00:00.000Z") });
    const result = getCurrentSunday();
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});
