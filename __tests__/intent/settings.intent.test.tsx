/**
 * Intent tests — Settings page
 *
 * Describes the top-level journeys an Admin can accomplish on the Settings page.
 * Does not re-test individual field interactions — those are covered by
 * component-level tests if they exist.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminSettingsPage from "@/app/admin/settings/page";
import { ADMIN_MEMBER, makeFetch } from "./helpers/createIntentSetup";

// Settings page fetches three endpoints on mount
const SETTINGS_OVERRIDES = {
  "/api/settings/handbook-permissions": {
    editor_roles: ["Admin", "Coordinator"],
    editor_member_ids: [],
  },
  "/api/settings": {
    future_months: 2,
    history_months: 6,
    max_songs_per_setlist: 10,
  },
  "/api/members": [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Settings page loads
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Settings page loads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Admin: settings page loads and shows configuration fields", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, SETTINGS_OVERRIDES));
    render(<AdminSettingsPage />);

    // The settings page renders a top-level "Settings" heading
    await screen.findByRole("heading", { name: "Settings" });

    // Section labels that are always rendered (from the source labels)
    expect(screen.getByText(/Future months/i)).toBeInTheDocument();
    expect(screen.getByText(/Historical months/i)).toBeInTheDocument();
  });

  it("Admin: settings page shows save button", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, SETTINGS_OVERRIDES));
    render(<AdminSettingsPage />);

    await screen.findByRole("heading", { name: "Settings" });

    // The page renders a "Save Settings" button in the footer of the Roster Pagination card
    expect(
      screen.getByRole("button", { name: "Save Settings" })
    ).toBeInTheDocument();
  });
});
