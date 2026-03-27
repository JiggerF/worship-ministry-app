/**
 * Intent tests — Roster page
 *
 * Focuses on top-level journeys: page renders without crashing, month
 * navigation is present, and edit controls appear or are hidden based on role.
 *
 * The roster page is complex (it fetches /api/roster, /api/members,
 * /api/availability/periods, and uses useRouter). All of those are mocked here.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminRosterPage from "@/app/admin/roster/page";
import {
  ADMIN_MEMBER,
  COORDINATOR_MEMBER,
  MUSICIAN_MEMBER,
  makeFetch,
} from "./helpers/createIntentSetup";

// next/navigation must be mocked for any component using useRouter
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

// Shared roster API stub — empty assignments and no notes
const EMPTY_ROSTER = { assignments: [], notes: "" };

function makeRosterFetch(meResponse: object) {
  return makeFetch(meResponse, {
    "/api/roster": EMPTY_ROSTER,
    "/api/members": [],
    "/api/availability/periods": [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Roster page loads and is accessible
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Roster page loads and is accessible", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Admin: roster page renders without crashing and shows month navigation", async () => {
    vi.stubGlobal("fetch", makeRosterFetch(ADMIN_MEMBER));
    render(<AdminRosterPage />);

    // Month navigation buttons have aria-labels set in the source
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Previous month" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next month" })
      ).toBeInTheDocument();
    });
  });

  it("Coordinator: roster page renders and edit controls are visible", async () => {
    vi.stubGlobal("fetch", makeRosterFetch(COORDINATOR_MEMBER));
    render(<AdminRosterPage />);

    // Coordinator has canEditRoster = true, so Save Draft button should appear
    // once the roster has loaded (loading = false)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save Draft" })
      ).toBeInTheDocument();
    });
  });

  it("Musician: roster page renders but shows no edit controls", async () => {
    vi.stubGlobal("fetch", makeRosterFetch(MUSICIAN_MEMBER));
    render(<AdminRosterPage />);

    // Wait for page to settle (month nav always renders)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Previous month" })
      ).toBeInTheDocument();
    });

    // Musician cannot edit — Save Draft must not be present
    expect(
      screen.queryByRole("button", { name: "Save Draft" })
    ).not.toBeInTheDocument();
  });
});
