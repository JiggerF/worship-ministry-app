/**
 * Component tests — SongCard
 * src/components/song-card.tsx
 *
 * ChordSheetModal is mocked (it requires fetch + Radix Dialog) so we focus on
 * the card's own rendering: title, status badge, artist, categories,
 * chord chart key pills, scripture anchor, and empty states.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SongCard } from "@/components/song-card";
import type { SongWithCharts } from "@/lib/types/database";

// Mock ChordSheetModal — avoids jsPDF, fetch, and Radix Dialog setup in unit tests
vi.mock("@/components/chord-sheet-modal", () => ({
  ChordSheetModal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chord-sheet-modal-trigger">{children}</div>
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SONG: SongWithCharts = {
  id: "song-1",
  title: "Amazing Grace",
  artist: "John Newton",
  status: "published",
  categories: ["adoration_worship"],
  youtube_url: null,
  scripture_anchor: "Ephesians 2:8",
  created_at: "2026-01-01T00:00:00Z",
  chord_charts: [
    {
      id: "cc-1",
      song_id: "song-1",
      key: "G",
      file_url: "https://docs.google.com/document/d/abc/edit",
      storage_path: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
};

const MULTI_CHART_SONG: SongWithCharts = {
  ...BASE_SONG,
  id: "song-2",
  title: "How Great Thou Art",
  chord_charts: [
    {
      id: "cc-2",
      song_id: "song-2",
      key: "Bb",
      file_url: "https://docs.google.com/document/d/xyz/edit",
      storage_path: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cc-3",
      song_id: "song-2",
      key: "G",
      file_url: "https://docs.google.com/document/d/pqr/edit",
      storage_path: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
};

const NO_CHART_SONG: SongWithCharts = {
  ...BASE_SONG,
  id: "song-3",
  title: "No Charts Song",
  chord_charts: [],
};

const LEARNING_SONG: SongWithCharts = {
  ...BASE_SONG,
  id: "song-4",
  title: "New Song Learning",
  status: "learning",
};

// ─────────────────────────────────────────────────────────────────────────────
// Song title & heading
// ─────────────────────────────────────────────────────────────────────────────
describe("SongCard — title", () => {
  it("renders the song title prominently", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
describe("SongCard — status badge", () => {
  it("shows 'Published' badge for published song", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows 'New Song – Learning' badge for learning song", () => {
    render(<SongCard song={LEARNING_SONG} />);
    expect(screen.getByText("New Song – Learning")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Artist
// ─────────────────────────────────────────────────────────────────────────────
describe("SongCard — artist", () => {
  it("renders the artist name", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("John Newton")).toBeInTheDocument();
  });

  it("does not crash when artist is null", () => {
    const noArtist = { ...BASE_SONG, artist: null };
    expect(() => render(<SongCard song={noArtist} />)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────
describe("SongCard — categories", () => {
  it("renders category label for adoration_worship", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("Adoration / Worship")).toBeInTheDocument();
  });

  it("renders multiple category labels", () => {
    const multiCat: SongWithCharts = {
      ...BASE_SONG,
      categories: ["call_to_worship", "thanksgiving"],
    };
    render(<SongCard song={multiCat} />);
    expect(screen.getByText("Call to Worship")).toBeInTheDocument();
    expect(screen.getByText("Thanksgiving")).toBeInTheDocument();
  });

  it("does not crash when categories is null", () => {
    const noCats = { ...BASE_SONG, categories: null };
    expect(() => render(<SongCard song={noCats} />)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scripture anchor
// ─────────────────────────────────────────────────────────────────────────────
describe("SongCard — scripture anchor", () => {
  it("renders scripture anchor text", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("Ephesians 2:8")).toBeInTheDocument();
  });

  it("does not render scripture section when anchor is null", () => {
    const noScripture = { ...BASE_SONG, scripture_anchor: null };
    render(<SongCard song={noScripture} />);
    expect(screen.queryByText("Ephesians 2:8")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chord chart key pills
// ─────────────────────────────────────────────────────────────────────────────
describe("SongCard — chord chart key pills", () => {
  it("renders a key pill for a single chart", () => {
    render(<SongCard song={BASE_SONG} />);
    // The key "G" should appear as a link/pill
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("renders key pills for multiple charts", () => {
    render(<SongCard song={MULTI_CHART_SONG} />);
    expect(screen.getByText("Bb")).toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("renders 'Change Key' button when at least one chart has a file_url", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("Change Key")).toBeInTheDocument();
  });

  it("does not render 'Change Key' button when no charts have a file_url", () => {
    render(<SongCard song={NO_CHART_SONG} />);
    expect(screen.queryByText("Change Key")).not.toBeInTheDocument();
  });

  it("shows 'Key:' label when song has exactly one chart", () => {
    render(<SongCard song={BASE_SONG} />);
    expect(screen.getByText("Key:")).toBeInTheDocument();
  });

  it("shows 'Available keys:' label when song has multiple charts", () => {
    render(<SongCard song={MULTI_CHART_SONG} />);
    expect(screen.getByText("Available keys:")).toBeInTheDocument();
  });
});
