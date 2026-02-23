/**
 * Component tests — StatusBadge variants
 * src/components/status-badge.tsx
 *
 * Tests both RosterBadge and SongStatusBadge for correct label rendering,
 * CSS class application, and edge-case rendering (null/empty status).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RosterBadge, SongStatusBadge } from "@/components/status-badge";

// ─────────────────────────────────────────────────────────────────────────────
// RosterBadge
// ─────────────────────────────────────────────────────────────────────────────
describe("RosterBadge", () => {
  it("renders 'FINAL' label for LOCKED status", () => {
    render(<RosterBadge status="LOCKED" />);
    expect(screen.getByText("FINAL")).toBeInTheDocument();
  });

  it("applies green background class for LOCKED status", () => {
    render(<RosterBadge status="LOCKED" />);
    expect(screen.getByText("FINAL").className).toContain("bg-green-600");
  });

  it("renders 'DRAFT' label for DRAFT status", () => {
    render(<RosterBadge status="DRAFT" />);
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("applies amber background class for DRAFT status", () => {
    render(<RosterBadge status="DRAFT" />);
    expect(screen.getByText("DRAFT").className).toContain("bg-amber-500");
  });

  it("renders '> NEXT' label for 'next' status", () => {
    render(<RosterBadge status="next" />);
    expect(screen.getByText("> NEXT")).toBeInTheDocument();
  });

  it("renders nothing (null) for 'empty' status", () => {
    const { container } = render(<RosterBadge status="empty" />);
    // Component returns null — container is an empty div
    expect(container.firstChild).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SongStatusBadge
// ─────────────────────────────────────────────────────────────────────────────
describe("SongStatusBadge", () => {
  it("renders 'Published' for 'published' status", () => {
    render(<SongStatusBadge status="published" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("applies green background class for 'published'", () => {
    render(<SongStatusBadge status="published" />);
    expect(screen.getByText("Published").className).toContain("bg-green-600");
  });

  it("renders 'New Song – Learning' for 'learning' status", () => {
    render(<SongStatusBadge status="learning" />);
    expect(screen.getByText("New Song – Learning")).toBeInTheDocument();
  });

  it("applies orange background class for 'learning'", () => {
    render(<SongStatusBadge status="learning" />);
    expect(screen.getByText("New Song – Learning").className).toContain(
      "bg-orange-500"
    );
  });

  it("renders 'In Review' for 'internal_approved' status", () => {
    render(<SongStatusBadge status="internal_approved" />);
    expect(screen.getByText("In Review")).toBeInTheDocument();
  });

  it("applies blue background class for 'internal_approved'", () => {
    render(<SongStatusBadge status="internal_approved" />);
    expect(screen.getByText("In Review").className).toContain("bg-blue-200");
  });
});
