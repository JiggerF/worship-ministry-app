/**
 * Intent tests — Coordinator access restrictions
 *
 * Verifies that role restrictions are enforced at the UI layer across multiple
 * pages when the current user is a Coordinator.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminPeoplePage from "@/app/admin/people/page";
import AdminSongsPage from "@/app/admin/songs/page";
import AdminRosterPage from "@/app/admin/roster/page";
import {
  COORDINATOR_MEMBER,
  MOCK_SONGS,
  makeFetch,
} from "./helpers/createIntentSetup";

// Roster page uses useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin/roster",
  useSearchParams: () => new URLSearchParams(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Coordinator access restrictions
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Coordinator access restrictions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Coordinator: People page — zero mutation affordances visible", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(COORDINATOR_MEMBER, { "/api/members": [] })
    );
    render(<AdminPeoplePage />);

    await screen.findByRole("heading", { name: "People" });

    expect(
      screen.queryByRole("button", { name: "+ Add Member" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deactivate" })
    ).not.toBeInTheDocument();
  });

  it("Coordinator: Songs page — full song management controls visible", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(COORDINATOR_MEMBER, { "/api/songs": MOCK_SONGS })
    );
    render(<AdminSongsPage />);

    await screen.findByText("Amazing Grace");

    // Coordinator has full songs access (canAddDeleteSong is true for Coordinator)
    expect(screen.getByRole("button", { name: "+ Add Song" })).toBeInTheDocument();
    // Multiple songs means multiple Edit buttons — use getAllByRole
    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Delete" }).length).toBeGreaterThan(0);
  });

  it("Coordinator: Roster page — edit controls are visible", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(COORDINATOR_MEMBER, {
        "/api/roster": { assignments: [], notes: "" },
        "/api/members": [],
        "/api/availability/periods": [],
      })
    );
    render(<AdminRosterPage />);

    // Coordinator has canEditRoster = true, Save Draft button should appear after load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save Draft" })
      ).toBeInTheDocument();
    });
  });
});
