/**
 * Component tests — AdminPeoplePage (Add Member / Edit Member modal)
 *
 * REGRESSION GUARD: The modal form body was replaced with a placeholder comment
 * ({/* ...existing code... *\/}) twice, causing a blank "Add Member" dialog.
 * These tests assert that every expected form field is actually rendered when
 * the modal opens, so that placeholder regressions fail loudly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPeoplePage from "@/app/admin/people/page";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_MEMBER = {
  id: "admin-1",
  name: "Test Admin",
  email: "admin@wcc.org",
  phone: null,
  app_role: "Admin",
  magic_token: "token-abc",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  roles: [],
};

const COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "coord-1",
  name: "Test Coordinator",
  email: "coord@wcc.org",
  app_role: "Coordinator",
  magic_token: "token-xyz",
};

const EXISTING_MEMBER = {
  ...ADMIN_MEMBER,
  id: "musician-1",
  name: "John Doe",
  email: "john@test.com",
  app_role: "Musician",
  magic_token: "token-musician",
  roles: ["worship_lead", "acoustic_guitar"],
};

function makeFetch(meResponse: object, members: object[] = []) {
  return vi.fn((url: string) => {
    if (url === "/api/me") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(meResponse) });
    }
    if (url === "/api/members") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(members) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminPeoplePage — Add Member modal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all required form fields when Add Member is clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminPeoplePage />);

    // Button only appears after /api/me resolves with a non-Coordinator role
    const addButton = await screen.findByRole("button", { name: "+ Add Member" });
    await user.click(addButton);

    // Modal heading
    expect(screen.getByRole("heading", { name: "Add Member" })).toBeInTheDocument();

    // All text inputs present
    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("email@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+63 9XX XXX XXXX")).toBeInTheDocument();

    // App role select with all three options
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Musician" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Coordinator" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Admin" })).toBeInTheDocument();

    // Worship role pills — spot-check first, last, and middle
    expect(screen.getByRole("button", { name: "Worship Lead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vocals 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keys" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sound" })).toBeInTheDocument();

    // Footer buttons
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: "Add Member" });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  it("cancel button closes the modal", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminPeoplePage />);

    await user.click(await screen.findByRole("button", { name: "+ Add Member" }));
    expect(screen.getByRole("heading", { name: "Add Member" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Add Member" })).not.toBeInTheDocument();
  });

  it("worship role pills toggle selection", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminPeoplePage />);

    await user.click(await screen.findByRole("button", { name: "+ Add Member" }));
    const pill = screen.getByRole("button", { name: "Worship Lead" });

    // Initially deselected
    expect(pill).not.toHaveClass("bg-gray-900");

    await user.click(pill);
    expect(pill).toHaveClass("bg-gray-900");

    // Toggle off
    await user.click(pill);
    expect(pill).not.toHaveClass("bg-gray-900");
  });

  it("Edit Member modal pre-populates fields from the selected member", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [EXISTING_MEMBER]));
    render(<AdminPeoplePage />);

    // Wait for members to load and Edit button to appear
    const editBtn = await screen.findByRole("button", { name: "Edit" });
    await user.click(editBtn);

    expect(screen.getByRole("heading", { name: "Edit Member" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("John Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("john@test.com")).toBeInTheDocument();
    // Pre-selected worship roles are highlighted
    expect(screen.getByRole("button", { name: "Worship Lead" })).toHaveClass("bg-gray-900");
    // Submit button says "Save Changes" when editing
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});

describe("AdminPeoplePage — Coordinator read-only", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides Add Member button for Coordinator", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER));
    render(<AdminPeoplePage />);

    // Wait for the page to settle — "People" heading is always rendered
    await screen.findByRole("heading", { name: "People" });

    expect(screen.queryByRole("button", { name: "+ Add Member" })).not.toBeInTheDocument();
  });

  it("never renders the modal for Coordinator even if somehow triggered", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER));
    render(<AdminPeoplePage />);

    // Wait for the page to settle
    await screen.findByRole("heading", { name: "People" });

    // Modal and its form fields must never appear
    expect(screen.queryByRole("heading", { name: "Add Member" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Full name")).not.toBeInTheDocument();
  });
});
