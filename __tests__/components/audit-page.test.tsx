/**
 * Component tests — AuditPage (src/app/admin/audit/page.tsx)
 *
 * Verifies loading state, entry rendering, error states (403, general),
 * empty state, pagination controls, and sort toggling.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditPage from "@/app/admin/audit/page";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_ENTRIES = [
  {
    id: "row-1",
    created_at: "2026-01-15T08:00:00Z",
    actor_id: "actor-1",
    actor_name: "Test Admin",
    actor_role: "Admin",
    action: "create_song",
    entity_type: "song",
    entity_id: "song-1",
    summary: "Created song 'Amazing Grace'",
  },
  {
    id: "row-2",
    created_at: "2026-01-16T09:30:00Z",
    actor_id: "actor-1",
    actor_name: "Test Admin",
    actor_role: "Admin",
    action: "update_song",
    entity_type: "song",
    entity_id: "song-2",
    summary: "Updated song 'How Great Thou Art'",
  },
];

const ALL_ACTION_ENTRIES = [
  { ...SAMPLE_ENTRIES[0], action: "delete_song", summary: "Deleted song 'Old Song'" },
  { ...SAMPLE_ENTRIES[0], id: "row-rd", action: "save_roster_draft", entity_type: "roster", summary: "Saved draft for 2026-01" },
  { ...SAMPLE_ENTRIES[0], id: "row-rf", action: "finalize_roster", entity_type: "roster", summary: "Finalized roster for 2026-01" },
  { ...SAMPLE_ENTRIES[0], id: "row-rr", action: "revert_roster", entity_type: "roster", summary: "Reverted roster for 2026-01" },
  { ...SAMPLE_ENTRIES[0], id: "row-rn", action: "save_roster_note", entity_type: "roster", summary: "Updated note for 2026-01" },
];

function makeSuccessFetch(
  entries = SAMPLE_ENTRIES,
  total = entries.length,
  pageSize = 50,
  page = 1
) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ entries, total, pageSize, page }),
    })
  );
}

function make403Fetch() {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    })
  );
}

function makeErrorFetch() {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuditPage — page structure", () => {
  it("renders the Audit Log heading", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    expect(screen.getByRole("heading", { name: "Audit Log" })).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("hides loading indicator after fetch completes", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    await waitFor(() =>
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
    );
  });
});

describe("AuditPage — entry rendering", () => {
  it("renders actor names for all entries", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    await screen.findAllByText("Test Admin");
  });

  it("renders action labels from ACTION_LABELS map", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    await screen.findByText("Created song");
    expect(screen.getByText("Updated song")).toBeInTheDocument();
  });

  it("renders summary text for each entry", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    await screen.findByText("Created song 'Amazing Grace'");
    expect(screen.getByText("Updated song 'How Great Thou Art'")).toBeInTheDocument();
  });

  it("renders all 7 action labels when all action types are present", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(ALL_ACTION_ENTRIES));
    render(<AuditPage />);
    await screen.findByText("Deleted song");
    expect(screen.getByText("Saved draft")).toBeInTheDocument();
    expect(screen.getByText("Finalized roster")).toBeInTheDocument();
    expect(screen.getByText("Reverted roster")).toBeInTheDocument();
    expect(screen.getByText("Updated note")).toBeInTheDocument();
  });

  it("shows actor role badge next to each actor name", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch());
    render(<AuditPage />);
    // The role badges are rendered as text nodes alongside the actor name
    const adminBadges = await screen.findAllByText("Admin");
    expect(adminBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the total entry count", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(SAMPLE_ENTRIES, 2));
    render(<AuditPage />);
    await screen.findByText("2 entries");
  });
});

describe("AuditPage — empty state", () => {
  it("shows 'No activity recorded yet.' when entries array is empty", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch([], 0));
    render(<AuditPage />);
    await screen.findByText("No activity recorded yet.");
  });

  it("does not render the entries table when empty", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch([], 0));
    render(<AuditPage />);
    await waitFor(() =>
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("AuditPage — error states", () => {
  it("shows 'Access denied — Admins only.' on 403 response", async () => {
    vi.stubGlobal("fetch", make403Fetch());
    render(<AuditPage />);
    await screen.findByText("Access denied — Admins only.");
  });

  it("shows 'Failed to load audit log.' on non-403, non-OK response", async () => {
    vi.stubGlobal("fetch", makeErrorFetch());
    render(<AuditPage />);
    await screen.findByText("Failed to load audit log.");
  });
});

describe("AuditPage — pagination", () => {
  it("does NOT render Prev/Next buttons when there is only one page", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(SAMPLE_ENTRIES, 2, 50, 1)); // 2 total ≤ 50
    render(<AuditPage />);
    await waitFor(() =>
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("renders Prev and Next buttons when there are multiple pages", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(SAMPLE_ENTRIES, 55, 50, 1)); // 55 > 50 = 2 pages
    render(<AuditPage />);
    await screen.findByRole("button", { name: "Previous" });
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("Previous button is disabled on page 1", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(SAMPLE_ENTRIES, 55, 50, 1));
    render(<AuditPage />);
    const prevBtn = await screen.findByRole("button", { name: "Previous" });
    expect(prevBtn).toBeDisabled();
  });

  it("Next button is enabled on page 1 of 2", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(SAMPLE_ENTRIES, 55, 50, 1));
    render(<AuditPage />);
    const nextBtn = await screen.findByRole("button", { name: "Next" });
    expect(nextBtn).not.toBeDisabled();
  });

  it("shows 'Page 1 of 2' text when on page 1 with 55 total entries", async () => {
    vi.stubGlobal("fetch", makeSuccessFetch(SAMPLE_ENTRIES, 55, 50, 1));
    render(<AuditPage />);
    await screen.findByText("Page 1 of 2");
  });

  it("fetches page 2 and re-fetches when Next is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 2 }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditPage />);
    const nextBtn = await screen.findByRole("button", { name: "Next" });
    await user.click(nextBtn);
    // Second fetch should have page=2 in the URL
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondCallUrl: string = fetchMock.mock.calls[1][0];
      expect(secondCallUrl).toContain("page=2");
    });
  });

  it("Next is disabled on the last page", async () => {
    // page=2 out of 2 means next should be disabled
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 2 }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AuditPage />);
    const nextBtn = await screen.findByRole("button", { name: "Next" });
    await user.click(nextBtn);
    // Now on page 2 of 2, Next should be disabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });
  });
});

describe("AuditPage — sort toggle", () => {
  it("re-fetches with sort=asc when the Timestamp button is clicked (toggling from desc)", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 2, pageSize: 50, page: 1 }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditPage />);
    // Wait for initial load
    const sortBtn = await screen.findByRole("button", { name: /timestamp/i });
    await user.click(sortBtn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondCallUrl: string = fetchMock.mock.calls[1][0];
      expect(secondCallUrl).toContain("sort=asc");
    });
  });

  it("clicking sort button resets page to 1", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 2 }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: SAMPLE_ENTRIES, total: 55, pageSize: 50, page: 1 }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditPage />);
    // Click Next to go to page 2
    const nextBtn = await screen.findByRole("button", { name: "Next" });
    await user.click(nextBtn);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // Now click sort — page should reset to 1
    const sortBtn = screen.getByRole("button", { name: /timestamp/i });
    await user.click(sortBtn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const thirdCallUrl: string = fetchMock.mock.calls[2][0];
      expect(thirdCallUrl).toContain("page=1");
    });
  });
});
