/**
 * Intent tests — Songs page
 *
 * Describes WHAT users can accomplish on the Songs page based on their role.
 * Covers Add Song form access and role-gated action button visibility.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSongsPage from "@/app/admin/songs/page";
import {
  ADMIN_MEMBER,
  COORDINATOR_MEMBER,
  MUSIC_COORDINATOR_MEMBER,
  WORSHIP_LEADER_MEMBER,
  MOCK_SONGS,
  makeFetch,
} from "./helpers/createIntentSetup";

// Single-song list avoids multiple-element ambiguity in getByRole assertions
const ONE_SONG = [MOCK_SONGS[0]];

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Admin can manage songs
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Admin can manage songs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Admin: song list loads and displays existing songs", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, { "/api/songs": MOCK_SONGS }));
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");
  });

  it("Admin: can open Add Song form with required fields", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, { "/api/songs": ONE_SONG }));
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");
    await user.click(screen.getByRole("button", { name: "+ Add Song" }));

    expect(screen.getByPlaceholderText("Song title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Artist name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    // Submit button reads "Add Song" for a new song
    const submitBtn = screen.getByRole("button", { name: "Add Song" });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  it("Admin: clicking Cancel on Add Song closes the modal", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, { "/api/songs": ONE_SONG }));
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");
    await user.click(screen.getByRole("button", { name: "+ Add Song" }));
    expect(screen.getByPlaceholderText("Song title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Song title")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Role-based access on Songs page
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Role-based access on Songs page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("MusicCoordinator: sees Edit button but not Add Song or Delete", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(MUSIC_COORDINATOR_MEMBER, { "/api/songs": ONE_SONG })
    );
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add Song" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("WorshipLeader: sees Edit button but NOT Add Song or Delete", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(WORSHIP_LEADER_MEMBER, { "/api/songs": ONE_SONG })
    );
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");

    // WorshipLeader can edit songs (e.g. update chord URLs)
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Add Song" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("Coordinator: sees full song management controls", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(COORDINATOR_MEMBER, { "/api/songs": ONE_SONG })
    );
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");

    expect(screen.getByRole("button", { name: "+ Add Song" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("Any role: no action buttons shown while /api/me is loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/me") {
          return new Promise(() => {}); // never resolves
        }
        if (typeof url === "string" && url.startsWith("/api/songs")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(ONE_SONG),
          });
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      })
    );
    render(<AdminSongsPage />);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "+ Add Song" })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    });
  });
});
