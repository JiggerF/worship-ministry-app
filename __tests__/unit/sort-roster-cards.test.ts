/**
 * Unit tests — sortRosterCards
 * src/app/portal/roster/page.tsx
 *
 * Covers:
 * - Upcoming Sunday is always pinned at index 0
 * - Remaining Sundays sorted ascending (oldest → newest)
 * - Upcoming Sunday in the middle of the month
 * - Upcoming Sunday is the last Sunday of the month
 * - Upcoming Sunday is the first Sunday of the month
 * - Single-item list
 * - All Sundays in one month in randomised input order
 * - upcomingISO not present in the list (fallback to ascending order)
 */
import { describe, it, expect } from "vitest";
import { sortRosterCards } from "@/app/portal/roster/page";

// Helper: build a minimal roster-like object array from ISO date strings
function makeDates(isos: string[]): { date: string }[] {
  return isos.map((d) => ({ date: d }));
}

function dates(results: { date: string }[]): string[] {
  return results.map((r) => r.date);
}

describe("sortRosterCards — upcoming Sunday pinned first", () => {
  it("places the upcoming Sunday at index 0 when it is the second date", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result[0]).toBe("2026-03-08");
  });

  it("places the upcoming Sunday at index 0 when it is the last date", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-15"));
    expect(result[0]).toBe("2026-03-15");
  });

  it("places the upcoming Sunday at index 0 when it is the first date (no change needed)", () => {
    const input = makeDates(["2026-03-01", "2026-03-08", "2026-03-15"]);
    const result = dates(sortRosterCards(input, "2026-03-01"));
    expect(result[0]).toBe("2026-03-01");
  });

  it("returns only the upcoming Sunday at index 0 with a single-item list", () => {
    const input = makeDates(["2026-03-08"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result).toEqual(["2026-03-08"]);
  });
});

describe("sortRosterCards — remaining Sundays ascending order", () => {
  it("sorts remaining dates oldest → newest after the pinned item", () => {
    // Input deliberately randomised
    const input = makeDates(["2026-03-29", "2026-03-08", "2026-03-01", "2026-03-15", "2026-03-22"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result).toEqual([
      "2026-03-08", // upcoming pinned first
      "2026-03-01", // then ascending
      "2026-03-15",
      "2026-03-22",
      "2026-03-29",
    ]);
  });

  it("all dates in reverse order → output is still ascending after the pin", () => {
    const input = makeDates(["2026-04-26", "2026-04-19", "2026-04-12", "2026-04-05"]);
    const result = dates(sortRosterCards(input, "2026-04-12"));
    expect(result).toEqual([
      "2026-04-12", // upcoming
      "2026-04-05", // oldest remaining
      "2026-04-19",
      "2026-04-26",
    ]);
  });

  it("all five Sundays in a month: upcoming is third, rest ascending", () => {
    const sundays = ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29"];
    // Input shuffled
    const shuffled = ["2026-03-29", "2026-03-01", "2026-03-22", "2026-03-08", "2026-03-15"];
    const result = dates(sortRosterCards(makeDates(shuffled), "2026-03-15"));
    expect(result[0]).toBe("2026-03-15");
    // Remaining Sundays in ascending order
    const rest = result.slice(1);
    const expected = sundays.filter((d) => d !== "2026-03-15");
    expect(rest).toEqual(expected);
  });

  it("two dates: upcoming is the later one, earlier comes second", () => {
    const input = makeDates(["2026-03-01", "2026-03-08"]);
    const result = dates(sortRosterCards(input, "2026-03-08"));
    expect(result).toEqual(["2026-03-08", "2026-03-01"]);
  });

  it("two dates: upcoming is the earlier one, later comes second", () => {
    const input = makeDates(["2026-03-01", "2026-03-08"]);
    const result = dates(sortRosterCards(input, "2026-03-01"));
    expect(result).toEqual(["2026-03-01", "2026-03-08"]);
  });
});

describe("sortRosterCards — upcoming not in list (edge case)", () => {
  it("returns all dates in ascending order when upcomingISO is not present", () => {
    const input = makeDates(["2026-03-15", "2026-03-01", "2026-03-08"]);
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
