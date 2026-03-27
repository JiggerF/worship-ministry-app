/**
 * Intent tests — People page
 *
 * Describes WHAT a user can accomplish on the People page, not HOW the DOM
 * is structured. Each test corresponds to a real user journey.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPeoplePage from "@/app/admin/people/page";
import {
  ADMIN_MEMBER,
  COORDINATOR_MEMBER,
  makeFetch,
} from "./helpers/createIntentSetup";

// Existing member used for Edit and list tests — Musician role so it is visible
// to both Admin and Coordinator (Coordinator filters out Admin-role members)
const EXISTING_MEMBER = {
  id: "musician-1",
  name: "John Doe",
  email: "john@test.com",
  phone: null,
  app_role: "Musician",
  magic_token: "token-musician",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  roles: ["worship_lead", "acoustic_guitar"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Admin can manage members
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Admin can manage members", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Admin: member list loads and displays existing members", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(ADMIN_MEMBER, { "/api/members": [EXISTING_MEMBER] })
    );
    render(<AdminPeoplePage />);

    await screen.findByText("John Doe");
  });

  it("Admin: can open the Add Member form and see all required fields", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, { "/api/members": [] }));
    render(<AdminPeoplePage />);

    const addButton = await screen.findByRole("button", { name: "+ Add Member" });
    await user.click(addButton);

    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("email@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+61 4XX XXX XXX")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Worship Lead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: "Add Member" });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  it("Admin: clicking Cancel closes the Add Member modal without saving", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, { "/api/members": [] }));
    render(<AdminPeoplePage />);

    await user.click(await screen.findByRole("button", { name: "+ Add Member" }));
    expect(screen.getByRole("heading", { name: "Add Member" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Add Member" })).not.toBeInTheDocument();
  });

  it("Admin: Edit Member modal pre-populates fields from selected member", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      makeFetch(ADMIN_MEMBER, { "/api/members": [EXISTING_MEMBER] })
    );
    render(<AdminPeoplePage />);

    const editBtn = await screen.findByRole("button", { name: "Edit" });
    await user.click(editBtn);

    expect(screen.getByRole("heading", { name: "Edit Member" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("John Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Journey: Coordinator sees read-only People page
// ─────────────────────────────────────────────────────────────────────────────

describe("Journey: Coordinator sees read-only People page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Coordinator: member list loads and displays existing members", async () => {
    // Coordinators see all members except Admin-role ones.
    // EXISTING_MEMBER has app_role "Musician" so it will be visible.
    vi.stubGlobal(
      "fetch",
      makeFetch(COORDINATOR_MEMBER, { "/api/members": [EXISTING_MEMBER] })
    );
    render(<AdminPeoplePage />);

    await screen.findByText("John Doe");
  });

  it("Coordinator: does not see Add Member button", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER, { "/api/members": [] }));
    render(<AdminPeoplePage />);

    await screen.findByRole("heading", { name: "People" });

    expect(
      screen.queryByRole("button", { name: "+ Add Member" })
    ).not.toBeInTheDocument();
  });

  it("Coordinator: does not see Edit or Deactivate buttons on member rows", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch(COORDINATOR_MEMBER, { "/api/members": [EXISTING_MEMBER] })
    );
    render(<AdminPeoplePage />);

    // Wait for the member list to render
    await screen.findByText("John Doe");

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });
});
