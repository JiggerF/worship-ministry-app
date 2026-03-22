/**
 * Component tests — AdminRecordingsPage
 *
 * REGRESSION GUARD: Verifies that the upload modal renders all required form
 * fields, that Admin/Coordinator see the upload button, and that
 * read-only roles (Musician, WorshipLeader) do not.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminRecordingsPage from "@/app/admin/recordings/page";

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

const COORDINATOR_MEMBER = { ...ADMIN_MEMBER, id: "coord-1", app_role: "Coordinator" };
const MUSICIAN_MEMBER = { ...ADMIN_MEMBER, id: "mus-1", app_role: "Musician" };

const MOCK_RECORDINGS = [
  {
    id: "rec-1",
    tenant_id: "tenant-1",
    title: "Sunday Morning Service - Live Mix",
    sunday_date: "2026-03-15",
    recording_type: "audio",
    drive_url: "https://drive.google.com/file/d/ABC123/view?usp=sharing",
    duration_seconds: 2722,
    uploaded_by: "admin-1",
    created_at: "2026-03-15T10:00:00Z",
    featured_members: [
      { id: "m1", name: "Tess Cruz" },
      { id: "m2", name: "Joseph Lee" },
    ],
  },
];

function makeFetch(meResponse: object, recordings: object[] = MOCK_RECORDINGS) {
  return vi.fn((url: string) => {
    if (url === "/api/me") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(meResponse) });
    }
    if (typeof url === "string" && url.startsWith("/api/recordings")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(recordings) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

afterEach(() => vi.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminRecordingsPage", () => {
  it("renders the recordings list for Admin", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminRecordingsPage />);
    expect(await screen.findByText("Sunday Morning Service - Live Mix")).toBeInTheDocument();
    expect(screen.getByText("45:22")).toBeInTheDocument();
    expect(screen.getByText("Tess")).toBeInTheDocument();
    expect(screen.getByText("Joseph")).toBeInTheDocument();
  });

  it("Admin sees + Upload Recording button", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminRecordingsPage />);
    expect(await screen.findByRole("button", { name: "+ Upload Recording" })).toBeInTheDocument();
  });

  it("Coordinator sees + Upload Recording button", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER));
    render(<AdminRecordingsPage />);
    expect(await screen.findByRole("button", { name: "+ Upload Recording" })).toBeInTheDocument();
  });

  it("Musician does NOT see + Upload Recording button", async () => {
    vi.stubGlobal("fetch", makeFetch(MUSICIAN_MEMBER));
    render(<AdminRecordingsPage />);
    // Wait for the list to render (proves fetch completed)
    await screen.findByText("Sunday Morning Service - Live Mix");
    expect(screen.queryByRole("button", { name: "+ Upload Recording" })).not.toBeInTheDocument();
  });

  it("opens upload modal with all required fields when button clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminRecordingsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Upload Recording" }));

    expect(screen.getByPlaceholderText("e.g. Sunday Morning Service - Live Mix")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://drive.google.com/file/d/…/view")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 45:22")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("Cancel closes the upload modal", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminRecordingsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Upload Recording" }));
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    });
  });

  it("Upload button is disabled when required fields are empty", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminRecordingsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Upload Recording" }));
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });

  it("shows empty state when no recordings", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, []));
    render(<AdminRecordingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no recordings yet/i)).toBeInTheDocument();
    });
  });
});
