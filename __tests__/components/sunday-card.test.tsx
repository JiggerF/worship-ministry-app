/**
 * Component tests — SundayCard
 * src/components/sunday-card.tsx
 *
 * Verifies date formatting, role slot rendering, status badges,
 * empty-state display, and the "THIS WEEK" highlight when isNext=true.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SundayCard } from "@/components/sunday-card";
import type { SundayCardRoster } from "@/components/sunday-card";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const BASE_ROSTER: SundayCardRoster = {
  date: "2026-03-01", // Sunday
  status: "DRAFT",
  assignments: [],
  setlist: [],
  notes: null,
};

const ROSTER_WITH_ASSIGNMENTS: SundayCardRoster = {
  date: "2026-03-08",
  status: "LOCKED",
  assignments: [
    {
      id: "a1",
      role: "worship_lead",
      member: { id: "m1", name: "Jane Smith" },
    },
    {
      id: "a2",
      role: "drums",
      member: { id: "m2", name: "Bob Jones" },
    },
  ],
  setlist: [
    {
      id: "s1",
      position: 1,
      song: { title: "How Great Thou Art", chord_charts: [] },
    },
  ],
  notes: null,
};

const EMPTY_ROSTER: SundayCardRoster = {
  date: "2026-03-15",
  status: "EMPTY",
  assignments: [],
  setlist: [],
  notes: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — date display", () => {
  it("renders day name (Sunday for 2026-03-01)", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.getByText(/Sunday/i)).toBeInTheDocument();
  });

  it("renders day and month in short format (01 Mar 2026)", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.getByText(/01 Mar 2026/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isNext badge
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — isNext highlight", () => {
  it("shows 'THIS WEEK' badge when isNext=true", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={true} />);
    expect(screen.getByText("THIS WEEK")).toBeInTheDocument();
  });

  it("does NOT show 'THIS WEEK' badge when isNext=false", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.queryByText("THIS WEEK")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status badges
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — status badges", () => {
  it("shows 'FINAL' badge for LOCKED status", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    expect(screen.getByText("FINAL")).toBeInTheDocument();
  });

  it("shows 'DRAFT' badge for DRAFT status", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("does NOT show status badge when status is EMPTY", () => {
    render(<SundayCard roster={EMPTY_ROSTER} isNext={false} />);
    expect(screen.queryByText("FINAL")).not.toBeInTheDocument();
    expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — roster assignments", () => {
  it("renders assigned member names", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows 'No assignments yet' text when assignments array is empty", () => {
    // BASE_ROSTER has assignments=[] and status=DRAFT (not EMPTY)
    // so isEmpty=false → team section renders but shows 'No assignments yet'
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.getByText("No assignments yet")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — empty state", () => {
  it("renders 'Roster not yet assigned' when status is EMPTY with no assignments", () => {
    render(<SundayCard roster={EMPTY_ROSTER} isNext={false} />);
    expect(
      screen.getByText("Roster not yet assigned")
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Setlist
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — setlist", () => {
  it("renders song titles in the setlist (prefixed with position number)", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    // Song title is rendered as "1. How Great Thou Art"
    expect(screen.getByText(/How Great Thou Art/)).toBeInTheDocument();
  });
});
