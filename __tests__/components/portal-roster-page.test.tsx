/**
 * Component tests — PortalRosterPage
 *
 * REGRESSION GUARD: Verifies that when `?org=` is present in the URL,
 * the roster fetch and setlist fetches forward `&org=` to the API.
 * Without this fix, multi-tenant portal pages returned "Organization not found".
 *
 * The page reads `window.location.search` in a `useState` initializer (runs once
 * at mount). Tests must set `window.location.search` BEFORE calling `render()`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PortalRosterPage from "@/app/portal/roster/page";

// ─── Mock jsPDF (imported transitively via SundayCard) ───────────────────────
vi.mock("jspdf", () => ({
  default: vi.fn(function (this: Record<string, unknown>) {
    this.save = vi.fn();
    this.addPage = vi.fn();
    this.text = vi.fn();
    this.setFont = vi.fn();
    this.setFontSize = vi.fn();
    this.setTextColor = vi.fn();
    this.splitTextToSize = vi.fn((text: string) => [text]);
    this.internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a fetch mock that responds with empty assignments for /api/roster
 *  and empty arrays for /api/setlist, so the component renders to completion. */
function makeRosterFetch() {
  return vi.fn((url: string) => {
    const strUrl = typeof url === "string" ? url : String(url);
    if (strUrl.startsWith("/api/roster")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ assignments: [] }),
      });
    }
    if (strUrl.startsWith("/api/setlist")) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    }
    return Promise.resolve({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });
  });
}

/** Set window.location.search before a test and restore afterwards. */
function setWindowSearch(search: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("PortalRosterPage — ?org= forwarding to /api/roster", () => {
  beforeEach(() => {
    // Start with an empty search string before each test
    setWindowSearch("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setWindowSearch("");
  });

  it("includes &org=wcc in the roster fetch URL when ?org=wcc is in the browser URL", async () => {
    setWindowSearch("?org=wcc");
    const fetchMock = makeRosterFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PortalRosterPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText("Loading roster...")).not.toBeInTheDocument();
    });

    // Inspect every /api/roster call
    const rosterCalls = (fetchMock.mock.calls as [string][])
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/roster"));

    expect(rosterCalls.length).toBeGreaterThan(0);
    expect(rosterCalls[0]).toContain("&org=wcc");
  });

  it("does NOT include &org= in the roster fetch URL when ?org= is absent from the browser URL", async () => {
    setWindowSearch("");
    const fetchMock = makeRosterFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PortalRosterPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading roster...")).not.toBeInTheDocument();
    });

    const rosterCalls = (fetchMock.mock.calls as [string][])
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/roster"));

    expect(rosterCalls.length).toBeGreaterThan(0);
    expect(rosterCalls[0]).not.toContain("&org=");
  });

  it("URL-encodes the org slug when it contains special characters", async () => {
    setWindowSearch("?org=julius-church-music-ministry");
    const fetchMock = makeRosterFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PortalRosterPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading roster...")).not.toBeInTheDocument();
    });

    const rosterCalls = (fetchMock.mock.calls as [string][])
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/roster"));

    expect(rosterCalls.length).toBeGreaterThan(0);
    // encodeURIComponent("julius-church-music-ministry") === "julius-church-music-ministry"
    // (hyphens are not encoded), so check for the raw slug
    expect(rosterCalls[0]).toContain("org=julius-church-music-ministry");
  });
});

describe("PortalRosterPage — ?org= forwarding to /api/setlist", () => {
  beforeEach(() => {
    setWindowSearch("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setWindowSearch("");
  });

  it("includes &org=wcc in the setlist fetch URLs when ?org=wcc is in the browser URL", async () => {
    setWindowSearch("?org=wcc");
    const fetchMock = makeRosterFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PortalRosterPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading roster...")).not.toBeInTheDocument();
    });

    const setlistCalls = (fetchMock.mock.calls as [string][])
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/setlist"));

    // Setlists are fetched in parallel for each Sunday in the month
    expect(setlistCalls.length).toBeGreaterThan(0);
    // Every setlist call should carry the org slug
    for (const url of setlistCalls) {
      expect(url).toContain("&org=wcc");
    }
  });

  it("does NOT include &org= in setlist fetch URLs when ?org= is absent", async () => {
    setWindowSearch("");
    const fetchMock = makeRosterFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PortalRosterPage />);

    await waitFor(() => {
      expect(screen.queryByText("Loading roster...")).not.toBeInTheDocument();
    });

    const setlistCalls = (fetchMock.mock.calls as [string][])
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/setlist"));

    expect(setlistCalls.length).toBeGreaterThan(0);
    for (const url of setlistCalls) {
      expect(url).not.toContain("&org=");
    }
  });
});
