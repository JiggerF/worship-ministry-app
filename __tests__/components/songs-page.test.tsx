/**
 * Component tests — AdminSongsPage
 *
 * REGRESSION GUARD: Verifies that the MusicCoordinator role-split
 * (canEditSong vs canAddDeleteSong) renders the correct buttons per role.
 *
 * - Admin: sees + Add Song, Edit, Delete
 * - Coordinator: sees + Add Song, Edit, Delete (full songs access)
 * - MusicCoordinator: sees Edit only (no Add, no Delete)
 * - WorshipLeader: sees no action buttons (fully read-only)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminSongsPage from "@/app/admin/songs/page";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_MEMBER = {
  id: "admin-1",
  name: "Test Admin",
  email: "admin@wcc.org",
  app_role: "Admin",
  is_active: true,
};

const MUSIC_COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "mc-1",
  name: "Music Coordinator",
  email: "mc@wcc.org",
  app_role: "MusicCoordinator",
};

const WORSHIP_LEADER_MEMBER = {
  ...ADMIN_MEMBER,
  id: "wl-1",
  name: "Worship Leader",
  email: "wl@wcc.org",
  app_role: "WorshipLeader",
};

const COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "coord-1",
  name: "Coordinator",
  email: "coord@wcc.org",
  app_role: "Coordinator",
};

const MOCK_SONGS = [
  {
    id: "s1",
    title: "Amazing Grace",
    artist: "John Newton",
    status: "published",
    categories: ["adoration_worship"],
    youtube_url: null,
    scripture_anchor: null,
    created_at: "2026-01-01T00:00:00Z",
    chord_charts: [{ id: "cc1", song_id: "s1", key: "G", file_url: null, storage_path: null, created_at: "2026-01-01T00:00:00Z" }],
  },
];

function makeFetch(meResponse: object, songs: object[] = MOCK_SONGS) {
  return vi.fn((url: string) => {
    if (url === "/api/me") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(meResponse) });
    }
    if (url === "/api/songs" || (typeof url === "string" && url.startsWith("/api/songs"))) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(songs) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSongsPage — role-based button visibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Admin sees Add Song, Edit, and Delete buttons", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminSongsPage />);

    // Wait for songs to load
    await screen.findByText("Amazing Grace");

    // Add Song button
    expect(screen.getByRole("button", { name: "+ Add Song" })).toBeInTheDocument();
    // Edit button per row
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    // Delete button per row
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("MusicCoordinator sees Edit button but NOT Add Song or Delete", async () => {
    vi.stubGlobal("fetch", makeFetch(MUSIC_COORDINATOR_MEMBER));
    render(<AdminSongsPage />);

    // Wait for songs to load
    await screen.findByText("Amazing Grace");

    // Edit button should be visible
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    // Add Song button should NOT exist
    expect(screen.queryByRole("button", { name: "+ Add Song" })).not.toBeInTheDocument();
    // Delete button should NOT exist
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("WorshipLeader sees no action buttons (fully read-only)", async () => {
    vi.stubGlobal("fetch", makeFetch(WORSHIP_LEADER_MEMBER));
    render(<AdminSongsPage />);

    // Wait for songs to load
    await screen.findByText("Amazing Grace");

    // None of the action buttons should be visible
    expect(screen.queryByRole("button", { name: "+ Add Song" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("Coordinator sees Add Song, Edit, and Delete buttons (full songs access)", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER));
    render(<AdminSongsPage />);

    // Wait for songs to load
    await screen.findByText("Amazing Grace");

    // Coordinator has full songs access
    expect(screen.getByRole("button", { name: "+ Add Song" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows no action buttons while loading (restrictive default)", async () => {
    // Simulate a slow /api/me response
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/me") {
        return new Promise(() => {}); // Never resolves
      }
      if (typeof url === "string" && url.startsWith("/api/songs")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_SONGS) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }));
    render(<AdminSongsPage />);

    // Give render a tick
    await waitFor(() => {
      // The page should not show any action buttons while /api/me is pending
      expect(screen.queryByRole("button", { name: "+ Add Song" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });
  });
});
