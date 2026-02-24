/**
 * Component tests — SundayCard
 * src/components/sunday-card.tsx
 *
 * Verifies date formatting, role slot rendering, status badges,
 * empty-state display, the "THIS WEEK" highlight when isNext=true,
 * and the "Download All Chord Charts" PDF compilation feature.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SundayCard } from "@/components/sunday-card";
import type { SundayCardRoster } from "@/components/sunday-card";

// ─── jsPDF mock ──────────────────────────────────────────────────────────────
const mockSave = vi.fn();
const mockAddPage = vi.fn();
const mockText = vi.fn();
const mockSetFont = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();
const mockSplitTextToSize = vi.fn((text: string) => [text]);

vi.mock("jspdf", () => ({
  default: vi.fn(function (this: Record<string, unknown>) {
    this.save = mockSave;
    this.addPage = mockAddPage;
    this.text = mockText;
    this.setFont = mockSetFont;
    this.setFontSize = mockSetFontSize;
    this.setTextColor = mockSetTextColor;
    this.splitTextToSize = mockSplitTextToSize;
    this.internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
  }),
}));

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

// Roster with a song that has both a YouTube URL and a chord chart with file_url
const ROSTER_WITH_YOUTUBE: SundayCardRoster = {
  date: "2026-03-08",
  status: "DRAFT",
  assignments: [],
  setlist: [
    {
      id: "s2",
      position: 1,
      chosen_key: "G",
      song: {
        title: "Amazing Grace",
        artist: "Traditional",
        youtube_url: "https://www.youtube.com/watch?v=test123",
        scripture_anchor: "Ephesians 2:8",
        chord_charts: [
          { key: "G", file_url: "https://example.com/chart-g.pdf" },
          { key: "A", file_url: null },
        ],
      },
    },
  ],
  notes: null,
};

// Roster with 2 songs + notes — used for accordion + notes tests
const ROSTER_WITH_MULTI_SONG: SundayCardRoster = {
  date: "2026-03-08",
  status: "DRAFT",
  assignments: [],
  setlist: [
    {
      id: "s-a",
      position: 1,
      chosen_key: "G",
      song: {
        title: "Song Alpha",
        artist: "Artist One",
        chord_charts: [],
      },
    },
    {
      id: "s-b",
      position: 2,
      chosen_key: "D",
      song: {
        title: "Song Beta",
        artist: null,
        scripture_anchor: "John 3:16",
        chord_charts: [{ key: "D", file_url: "https://example.com/d.pdf" }],
      },
    },
  ],
  notes: "Remember to read the intro.",
};

// Roster with a DRAFT status but empty setlist (no songs)
const ROSTER_DRAFT_NO_SONGS: SundayCardRoster = {
  date: "2026-03-22",
  status: "DRAFT",
  assignments: [],
  setlist: [],
  notes: null,
};
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

  it("shows download button when setlist has songs", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    expect(screen.getByRole("button", { name: /download all chord charts/i })).toBeInTheDocument();
  });

  it("does NOT show download button when setlist is empty", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.queryByRole("button", { name: /download all chord charts/i })).not.toBeInTheDocument();
  });

  it("does NOT show download button on an EMPTY roster", () => {
    render(<SundayCard roster={EMPTY_ROSTER} isNext={false} />);
    expect(screen.queryByRole("button", { name: /download all chord charts/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Expanded row (collapsed → open)
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — expanded song row", () => {
  it("shows Watch on YouTube link when song has youtube_url and row is expanded", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);

    // Expand the row by clicking the song title button
    await user.click(screen.getByRole("button", { name: /Amazing Grace/i }));

    const ytLink = screen.getByRole("link", { name: /watch on youtube/i });
    expect(ytLink).toBeInTheDocument();
    expect(ytLink).toHaveAttribute("href", "https://www.youtube.com/watch?v=test123");
  });

  it("does NOT show Watch on YouTube link before the row is expanded", () => {
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    expect(screen.queryByRole("link", { name: /watch on youtube/i })).not.toBeInTheDocument();
  });

  it("shows 'Explore other Keys' button when charts have files", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);

    await user.click(screen.getByRole("button", { name: /Amazing Grace/i }));

    expect(screen.getByRole("button", { name: /Explore other Keys/i })).toBeInTheDocument();
  });

  it("shows 'No chord chart uploaded yet' when no charts have file_url", async () => {
    const user = userEvent.setup();
    // ROSTER_WITH_ASSIGNMENTS has chord_charts: [] (no files)
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);

    await user.click(screen.getByRole("button", { name: /How Great Thou Art/i }));

    expect(screen.getByText(/no chord chart uploaded yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Explore other Keys/i })).not.toBeInTheDocument();
  });

  it("collapses the row again when clicked a second time", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);

    const rowBtn = screen.getByRole("button", { name: /Amazing Grace/i });
    await user.click(rowBtn); // expand
    expect(screen.getByRole("link", { name: /watch on youtube/i })).toBeInTheDocument();

    await user.click(rowBtn); // collapse
    expect(screen.queryByRole("link", { name: /watch on youtube/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collapsed row — visible metadata (key pill, artist, title)
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — collapsed row metadata", () => {
  it("shows the chosen_key pill in the collapsed row", () => {
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    // "Key of G" badge should be visible without expanding
    expect(screen.getByText(/Key of G/i)).toBeInTheDocument();
  });

  it("shows the artist name in the collapsed row", () => {
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    expect(screen.getByText(/Traditional/i)).toBeInTheDocument();
  });

  it("does not show artist when song has no artist", () => {
    render(<SundayCard roster={ROSTER_WITH_MULTI_SONG} isNext={false} />);
    // Song Beta has artist: null — verify no second artist text shows
    // Song Alpha has "Artist One"
    expect(screen.getByText("Artist One")).toBeInTheDocument();
    expect(screen.queryByText(/Artist One.*Artist One/)).not.toBeInTheDocument();
  });

  it("song row button is clickable and marked aria-expanded=false initially", () => {
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    const btn = screen.getByRole("button", { name: /Amazing Grace/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("song row button is marked aria-expanded=true after click", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    const btn = screen.getByRole("button", { name: /Amazing Grace/i });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scripture shown in expanded row
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — scripture in expanded row", () => {
  it("shows scripture_anchor text when row is expanded", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /Amazing Grace/i }));
    expect(screen.getByText(/Ephesians 2:8/i)).toBeInTheDocument();
  });

  it("does NOT show scripture text before the row is expanded", () => {
    render(<SundayCard roster={ROSTER_WITH_YOUTUBE} isNext={false} />);
    expect(screen.queryByText(/Ephesians 2:8/i)).not.toBeInTheDocument();
  });

  it("shows scripture from second song when second row is expanded", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_MULTI_SONG} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /Song Beta/i }));
    expect(screen.getByText(/John 3:16/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Download button — visible text + regression
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — download button text", () => {
  it("shows visible text 'Download All Chord Charts [PDF]'", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    expect(screen.getByText("Download All Chord Charts [PDF]")).toBeInTheDocument();
  });

  it("download button has an accessible label", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    expect(
      screen.getByRole("button", { name: /download all chord charts/i })
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "No songs assigned yet" empty setlist state
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — setlist empty state", () => {
  it("shows 'No songs assigned yet' when setlist is empty but roster is not EMPTY status", () => {
    render(<SundayCard roster={ROSTER_DRAFT_NO_SONGS} isNext={false} />);
    expect(screen.getByText(/No songs assigned yet/i)).toBeInTheDocument();
  });

  it("does NOT show 'No songs assigned yet' when setlist has songs", () => {
    render(<SundayCard roster={ROSTER_WITH_ASSIGNMENTS} isNext={false} />);
    expect(screen.queryByText(/No songs assigned yet/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — notes", () => {
  it("renders notes text when present", () => {
    render(<SundayCard roster={ROSTER_WITH_MULTI_SONG} isNext={false} />);
    expect(screen.getByText("Remember to read the intro.")).toBeInTheDocument();
  });

  it("does NOT render notes when notes is null", () => {
    render(<SundayCard roster={BASE_ROSTER} isNext={false} />);
    expect(screen.queryByText(/intro/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accordion — only one row open at a time
// ─────────────────────────────────────────────────────────────────────────────
describe("SundayCard — accordion (one open at a time)", () => {
  it("opening a second row collapses the first", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_MULTI_SONG} isNext={false} />);

    const btnAlpha = screen.getByRole("button", { name: /Song Alpha/i });
    const btnBeta = screen.getByRole("button", { name: /Song Beta/i });

    // Expand first song
    await user.click(btnAlpha);
    expect(btnAlpha).toHaveAttribute("aria-expanded", "true");
    expect(btnBeta).toHaveAttribute("aria-expanded", "false");

    // Expand second song — first should collapse
    await user.click(btnBeta);
    expect(btnAlpha).toHaveAttribute("aria-expanded", "false");
    expect(btnBeta).toHaveAttribute("aria-expanded", "true");
  });

  it("expanding second song shows its scripture but not first song's content", async () => {
    const user = userEvent.setup();
    render(<SundayCard roster={ROSTER_WITH_MULTI_SONG} isNext={false} />);

    // Open Song Alpha first
    await user.click(screen.getByRole("button", { name: /Song Alpha/i }));
    // Now open Song Beta
    await user.click(screen.getByRole("button", { name: /Song Beta/i }));

    // Beta's scripture visible
    expect(screen.getByText(/John 3:16/i)).toBeInTheDocument();
    // Alpha had no scripture — no stale content
    expect(screen.queryByText(/Ephesians/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Download All Chord Charts — PDF compilation
// ─────────────────────────────────────────────────────────────────────────────

// Roster where ALL songs have downloadable chord charts
const ROSTER_ALL_DOWNLOADABLE: SundayCardRoster = {
  date: "2026-03-08",
  status: "LOCKED",
  assignments: [],
  setlist: [
    {
      id: "dl-1",
      position: 1,
      chosen_key: "G",
      song: {
        id: "song-1",
        title: "How Great Is Our God",
        artist: "Chris Tomlin",
        chord_charts: [
          { key: "G", file_url: "https://docs.google.com/document/d/abc123" },
          { key: "A", file_url: "https://docs.google.com/document/d/abc456" },
        ],
      },
    },
    {
      id: "dl-2",
      position: 2,
      chosen_key: "D",
      song: {
        id: "song-2",
        title: "Amazing Grace",
        artist: "Traditional",
        chord_charts: [
          { key: "C", file_url: "https://docs.google.com/document/d/def123" },
          { key: "D", file_url: "https://docs.google.com/document/d/def456" },
        ],
      },
    },
  ],
  notes: null,
};

// Roster where NO songs have downloadable charts (all file_url are null)
const ROSTER_NO_DOWNLOADABLE: SundayCardRoster = {
  date: "2026-03-08",
  status: "DRAFT",
  assignments: [],
  setlist: [
    {
      id: "nd-1",
      position: 1,
      song: {
        title: "Song Without Charts",
        chord_charts: [{ key: "C", file_url: null }],
      },
    },
  ],
  notes: null,
};

// Roster with a mix — one song has charts, one does not
const ROSTER_PARTIAL_DOWNLOADABLE: SundayCardRoster = {
  date: "2026-03-08",
  status: "DRAFT",
  assignments: [],
  setlist: [
    {
      id: "pd-1",
      position: 1,
      chosen_key: "E",
      song: {
        title: "Song With Chart",
        chord_charts: [
          { key: "E", file_url: "https://docs.google.com/document/d/eee111" },
        ],
      },
    },
    {
      id: "pd-2",
      position: 2,
      song: {
        title: "Song Without Chart",
        chord_charts: [],
      },
    },
  ],
  notes: null,
};

// Roster with chosen_key that doesn't match any chart key — should fall back
const ROSTER_KEY_FALLBACK: SundayCardRoster = {
  date: "2026-03-08",
  status: "DRAFT",
  assignments: [],
  setlist: [
    {
      id: "fb-1",
      position: 1,
      chosen_key: "Bb",
      song: {
        title: "Fallback Song",
        chord_charts: [
          { key: "G", file_url: "https://docs.google.com/document/d/fallback1" },
        ],
      },
    },
  ],
  notes: null,
};

/** Builds a fetch mock that returns chord sheet text for any /api/chord-sheet call */
function makeFetchMock(textByUrl?: Record<string, string>) {
  return vi.fn((url: string) => {
    if (typeof url === "string" && url.startsWith("/api/chord-sheet")) {
      const params = new URLSearchParams(url.split("?")[1]);
      const docUrl = params.get("url") ?? "";
      const text = textByUrl?.[docUrl] ?? "[Verse]\nG  C  D\nAmazing grace";
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ text }),
      });
    }
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });
  });
}

describe("SundayCard — Download All Chord Charts", () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockAddPage.mockClear();
    mockText.mockClear();
    mockSetFont.mockClear();
    mockSetFontSize.mockClear();
    mockSetTextColor.mockClear();
    mockSplitTextToSize.mockClear();
    mockSplitTextToSize.mockImplementation((text: string) => [text]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("download button is disabled when no songs have downloadable charts", () => {
    render(<SundayCard roster={ROSTER_NO_DOWNLOADABLE} isNext={false} />);
    const btn = screen.getByRole("button", { name: /download all chord charts/i });
    expect(btn).toBeDisabled();
  });

  it("download button is enabled when at least one song has a downloadable chart", () => {
    render(<SundayCard roster={ROSTER_ALL_DOWNLOADABLE} isNext={false} />);
    const btn = screen.getByRole("button", { name: /download all chord charts/i });
    expect(btn).not.toBeDisabled();
  });

  it("download button is enabled with partial downloadable songs", () => {
    render(<SundayCard roster={ROSTER_PARTIAL_DOWNLOADABLE} isNext={false} />);
    const btn = screen.getByRole("button", { name: /download all chord charts/i });
    expect(btn).not.toBeDisabled();
  });

  it("clicking download fetches chord sheets and generates a PDF", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SundayCard roster={ROSTER_ALL_DOWNLOADABLE} isNext={false} />);
    const btn = screen.getByRole("button", { name: /download all chord charts/i });

    await user.click(btn);

    // Wait for the PDF to be saved
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    // Should have fetched chord sheets for both songs
    const chordSheetCalls = fetchMock.mock.calls.filter(
      (call: string[]) => typeof call[0] === "string" && call[0].startsWith("/api/chord-sheet")
    );
    expect(chordSheetCalls).toHaveLength(2);

    // PDF filename should include the date
    expect(mockSave).toHaveBeenCalledWith("Chord-Charts-08-Mar-2026.pdf");
  });

  it("fetches the chart matching chosen_key when available", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SundayCard roster={ROSTER_ALL_DOWNLOADABLE} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /download all chord charts/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    // Song 1 chosen_key=G → should fetch the G chart URL
    const calls = fetchMock.mock.calls.map((c: string[]) => c[0]) as string[];
    expect(calls.some((url: string) => url.includes(encodeURIComponent("https://docs.google.com/document/d/abc123")))).toBe(true);
    // Song 2 chosen_key=D → should fetch the D chart URL
    expect(calls.some((url: string) => url.includes(encodeURIComponent("https://docs.google.com/document/d/def456")))).toBe(true);
  });

  it("falls back to first chart with file_url when chosen_key has no matching chart", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SundayCard roster={ROSTER_KEY_FALLBACK} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /download all chord charts/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // chosen_key=Bb but only G chart exists → should fetch the G chart
    const calls = fetchMock.mock.calls.map((c: string[]) => c[0]) as string[];
    expect(calls.some((url: string) => url.includes(encodeURIComponent("https://docs.google.com/document/d/fallback1")))).toBe(true);
  });

  it("only fetches charts for songs that have downloadable files (skips empty)", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<SundayCard roster={ROSTER_PARTIAL_DOWNLOADABLE} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /download all chord charts/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    // Only 1 song has a chart — should only fetch once
    const chordSheetCalls = fetchMock.mock.calls.filter(
      (call: string[]) => typeof call[0] === "string" && call[0].startsWith("/api/chord-sheet")
    );
    expect(chordSheetCalls).toHaveLength(1);
  });

  it("adds a new page for each song in the compiled PDF", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchMock());

    render(<SundayCard roster={ROSTER_ALL_DOWNLOADABLE} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /download all chord charts/i }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    // 2 songs → addPage called once (first song uses initial page)
    expect(mockAddPage).toHaveBeenCalled();
  });

  it("shows loading state while generating PDF", async () => {
    const user = userEvent.setup();
    // Use a delayed fetch to observe loading state
    vi.stubGlobal("fetch", vi.fn(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ text: "G C D\nTest lyric" }),
        }), 100)
      )
    ));

    render(<SundayCard roster={ROSTER_ALL_DOWNLOADABLE} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /download all chord charts/i }));

    // Should show loading text
    expect(screen.getByText("Generating PDF…")).toBeInTheDocument();

    // Wait for completion
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    // Should revert to normal text
    expect(screen.getByText("Download All Chord Charts [PDF]")).toBeInTheDocument();
  });

  it("does not generate PDF when fetch returns errors for all songs", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ error: "Doc not found" }),
      })
    ));

    render(<SundayCard roster={ROSTER_ALL_DOWNLOADABLE} isNext={false} />);
    await user.click(screen.getByRole("button", { name: /download all chord charts/i }));

    // Wait for fetch to complete
    await waitFor(() => {
      expect(screen.getByText("Download All Chord Charts [PDF]")).toBeInTheDocument();
    });

    // PDF save should NOT have been called
    expect(mockSave).not.toHaveBeenCalled();
  });
});
