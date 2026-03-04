/**
 * Unit tests — sortRosterCards
 * src/app/portal/roster/page.tsx
 *
 * Sort contract (updated to future-first):
 *  1. Upcoming Sunday always pinned at index 0.
 *  2. Future Sundays (date > upcomingISO) sorted ascending after the pin.
 *  3. Past Sundays (date < upcomingISO) sorted ascending at the bottom.
 *  4. When upcomingISO is not in the list, all dates sort ascending.
 *  5. Input array is never mutated.
 *
 * Why future-first?
 *  The old sort placed past dates before future dates (ascending across the
 *  whole non-pinned set), which caused March 1 to appear above March 15
 *  when the upcoming Sunday was March 8 — confusing for musicians who only
 *  care about what's coming up next.
 */
import { describe, it, expect } from "vitest";
import { sortRosterCards } from "@/app/portal/roster/page";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDates(isos: string[]): { date: string }[] {
  return isos.map((d) => ({ date: d }));
}

function dates(results: { date: string }[]): string[] {
  return results.map((r) => r.date);
}

// ─── Pinning ───────────────────────────────────────────────────────────────────

describe("sortRosterCards — upcoming Sunday always pinned first", () => {
  it("pins the upcoming Sunday when it is the second date in the list", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result[0]).toBe("2026-03-08");
  });

  it("pins the upcoming Sunday when it is the last date in the list", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-15"));
    expect(result[0]).toBe("2026-03-15");
  });

  it("pins the upcoming Sunday when it is already the first date (no-op)", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-01"));
    expect(result[0]).toBe("2026-03-01");
  });

  it("handles a single-item list", () => {
    const input = makeDates(["2026-03-08"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result).toEqual(["2026-03-08"]);
  });
});

// ─── Future-first sort ────────────────────────────────────────────────────────

describe("sortRosterCards — future Sundays before past Sundays", () => {
  it("places future dates before past dates after the pinned upcoming", () => {
    // upcoming = Mar 8 → Mar 1 is past, Mar 15/22/29 are future
    const shuffled = makeDates(["2026-03-29", "2026-03-08", "2026-03-01", "2026-03-15", "2026-03-22"]);
    const result = dates(sortRosterCards(shuffled, "2026-03-08"));
    expect(result).toEqual([
      "2026-03-08", // upcoming — pinned
      "2026-03-15", // future — ascending
      "2026-03-22",
      "2026-03-29",
      "2026-03-01", // past — at the bottom
    ]);
  });

  it("upcoming is the last Sunday: all others are past, sorted ascending at bottom", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29"]);
    const result = dates(sortRosterCards(input, "2026-03-29"));
    expect(result).toEqual([
      "2026-03-29", // upcoming
      "2026-03-01", // all past, ascending
      "2026-03-08",
      "2026-03-15",
      "2026-03-22",
    ]);
  });

  it("upcoming is the first Sunday: all others are future, sorted ascending", () => {
    const input = makeDates(["2026-03-29", "2026-03-01", "2026-03-22", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-01"));
    expect(result).toEqual([
      "2026-03-01", // upcoming
      "2026-03-08", // all future, ascending
      "2026-03-15",
      "2026-03-22",
      "2026-03-29",
    ]);
  });

  it("upcoming is in the middle: future dates ascend above, past dates ascend below", () => {
    // All 5 Sundays in March 2026; upcoming = March 15
    const shuffled = makeDates(["2026-03-29", "2026-03-01", "2026-03-22", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(shuffled, "2026-03-15"));
    expect(result).toEqual([
      "2026-03-15", // upcoming — pinned
      "2026-03-22", // future — ascending
      "2026-03-29",
      "2026-03-01", // past — ascending at bottom
      "2026-03-08",
    ]);
  });

  it("two dates: upcoming is the later one → earlier date is past, goes to bottom", () => {
    const input = makeDates(["2026-03-01", "2026-03-08"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result).toEqual(["2026-03-08", "2026-03-01"]);
  });

  it("two dates: upcoming is the earlier one → later date is future, goes second", () => {
    const input = makeDates(["2026-03-01", "2026-03-08"]);
    const result = dates(sortRosterCards(input, "2026-03-01"));
    expect(result).toEqual(["2026-03-01", "2026-03-08"]);
  });

  it("input in reverse order still produces the correct future-first output", () => {
    const input = makeDates(["2026-04-26", "2026-04-19", "2026-04-12", "2026-04-05"]);
    // upcoming = Apr 12 → Apr 5 is past; Apr 19, Apr 26 are future
    const result = dates(sortRosterCards(input, "2026-04-12"));
    expect(result).toEqual([
      "2026-04-12", // upcoming
      "2026-04-19", // future — ascending
      "2026-04-26",
      "2026-04-05", // past — at bottom
    ]);
  });
});

// ─── Past divider boundary ────────────────────────────────────────────────────

describe("sortRosterCards — past / future boundary (for divider placement)", () => {
  it("first past card always appears immediately after the last future card", () => {
    const input = makeDates([
      "2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29",
    ]);
    const result = dates(sortRosterCards(input, "2026-03-15"));
    // [Mar15, Mar22, Mar29, Mar1, Mar8]
    // Last future: Mar29 (index 2), First past: Mar1 (index 3)
    const firstPastIndex = result.findIndex((d) => d < "2026-03-15");
    const lastFutureIndex = firstPastIndex - 1;
    // Everything before firstPastIndex must be >= upcoming
    expect(result.slice(0, firstPastIndex).every((d) => d >= "2026-03-15")).toBe(true);
    // Everything from firstPastIndex onward must be < upcoming
    expect(result.slice(firstPastIndex).every((d) => d < "2026-03-15")).toBe(true);
    // Boundary is contiguous (no future cards after past cards)
    expect(lastFutureIndex).toBe(firstPastIndex - 1);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("sortRosterCards — upcoming not in list (edge case)", () => {
  it("returns all dates in ascending order when upcomingISO is not present", () => {
    const input = makeDates(["2026-03-15", "2026-03-01", "2026-03-08"]);
    // upcoming = Mar 22 (not in list) → all are "past" relative to Mar 22, sort ascending
    const result = dates(sortRosterCards(input, "2026-03-22"));
    expect(result).toEqual(["2026-03-01", "2026-03-08", "2026-03-15"]);
  });
});

describe("sortRosterCards — does not mutate the original array", () => {
  it("returns a new array and leaves input order unchanged", () => {
    const input = makeDates(["2026-03-29", "2026-03-01", "2026-03-08"]);
    const originalOrder = input.map((x) => x.date);
    sortRosterCards(input, "2026-03-08");
    expect(input.map((x) => x.date)).toEqual(originalOrder);
  });
});
