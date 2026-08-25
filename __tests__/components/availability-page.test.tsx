/**
 * Component tests — AdminAvailabilityPage (period list + new period modal)
 *
 * REGRESSION GUARD: Asserts the "+ New Period" modal form renders all expected
 * fields, so placeholder regressions fail immediately.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminAvailabilityPage from "@/app/admin/availability/page";

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => "/admin/availability"),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_MEMBER = {
  id: "admin-1",
  name: "Test Admin",
  email: "admin@wcc.org",
  app_role: "Admin",
};

const COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "coord-1",
  name: "Test Coordinator",
  app_role: "Coordinator",
};

const WORSHIP_LEADER_MEMBER = {
  ...ADMIN_MEMBER,
  id: "wl-1",
  name: "Test Worship Leader",
  app_role: "WorshipLeader",
};

const MUSIC_COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "mc-1",
  name: "Test Music Coordinator",
  app_role: "MusicCoordinator",
};

const PERIOD_OPEN = {
  id: "p-001",
  created_at: "2026-02-27T00:00:00Z",
  created_by: "admin-1",
  label: "April–May 2026",
  starts_on: "2026-04-05",
  ends_on: "2026-05-31",
  deadline: "2026-03-20",
  closed_at: null,
  response_count: 3,
  total_musicians: 8,
};

const PERIOD_CLOSED = {
  ...PERIOD_OPEN,
  id: "p-002",
  label: "Feb–Mar 2026",
  closed_at: "2026-02-01T00:00:00Z",
  response_count: 8,
};

function makeFetch(
  meResponse: object,
  periods: object[] = [],
  patchHandler?: (url: string) => object
) {
  return vi.fn((url: string, opts?: RequestInit) => {
    if (url === "/api/me") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(meResponse) });
    }
    if (url === "/api/availability/periods") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(periods) });
    }
    if (opts?.method === "PATCH" && patchHandler) {
      const result = patchHandler(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(result) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminAvailabilityPage — page structure", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the Availability heading", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Availability" })).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows empty state when no periods exist", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, []));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByText("No availability periods yet")).toBeInTheDocument();
  });

  it("renders period cards when periods exist", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [PERIOD_OPEN, PERIOD_CLOSED]));
    render(<AdminAvailabilityPage />);
    // Label appears in both the status card and the period row — use findAllByText
    expect(await screen.findAllByText("April\u2013May 2026")).not.toHaveLength(0);
    expect(screen.getAllByText("Feb\u2013Mar 2026")).not.toHaveLength(0);
  });

  it("shows Open badge for open period and Closed badge for closed period", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [PERIOD_OPEN, PERIOD_CLOSED]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("April\u2013May 2026");
    expect(screen.getAllByText("Open")).not.toHaveLength(0);
    expect(screen.getAllByText("Closed")).not.toHaveLength(0);
  });

  it("shows response counts for each period", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [PERIOD_OPEN]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("April\u2013May 2026");
    expect(screen.getByText("3 / 8")).toBeInTheDocument();
  });
});

describe("AdminAvailabilityPage — role-based access", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows access-restricted screen for WorshipLeader", async () => {
    vi.stubGlobal("fetch", makeFetch(WORSHIP_LEADER_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    expect(screen.getByText("Availability management is handled by your Coordinator.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Availability" })).not.toBeInTheDocument();
  });

  it("shows access-restricted screen for MusicCoordinator", async () => {
    vi.stubGlobal("fetch", makeFetch(MUSIC_COORDINATOR_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    expect(screen.getByText("Availability management is handled by your Coordinator.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Availability" })).not.toBeInTheDocument();
  });

  it("Coordinator sees the full page (not blocked)", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Availability" })).toBeInTheDocument();
    expect(screen.queryByText("Access restricted")).not.toBeInTheDocument();
  });

  it("Admin sees the full page (not blocked)", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Availability" })).toBeInTheDocument();
    expect(screen.queryByText("Access restricted")).not.toBeInTheDocument();
  });
});

describe("AdminAvailabilityPage — + New Period button", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows + New Period button for Admin", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByRole("button", { name: "+ New Period" })).toBeInTheDocument();
  });

  it("shows + New Period button for Coordinator", async () => {
    vi.stubGlobal("fetch", makeFetch(COORDINATOR_MEMBER));
    render(<AdminAvailabilityPage />);
    expect(await screen.findByRole("button", { name: "+ New Period" })).toBeInTheDocument();
  });

  it("does not show + New Period button while loading (null role)", () => {
    // Fetch never resolves — simulates loading state
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<AdminAvailabilityPage />);
    expect(screen.queryByRole("button", { name: "+ New Period" })).not.toBeInTheDocument();
  });
});

describe("AdminAvailabilityPage — New Period modal form", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens modal when + New Period is clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    await user.click(await screen.findByRole("button", { name: "+ New Period" }));
    expect(screen.getByRole("heading", { name: "New Availability Period" })).toBeInTheDocument();
  });

  it("renders all required form fields", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    await user.click(await screen.findByRole("button", { name: "+ New Period" }));

    expect(screen.getByPlaceholderText("e.g. April–May 2026")).toBeInTheDocument();
    // Date inputs (First Sunday, Last Sunday, Deadline)
    const dateInputs = screen.getAllByDisplayValue("");
    expect(dateInputs.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("button", { name: "Create Period" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("closes modal when Cancel is clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER));
    render(<AdminAvailabilityPage />);
    await user.click(await screen.findByRole("button", { name: "+ New Period" }));
    expect(screen.getByRole("heading", { name: "New Availability Period" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "New Availability Period" })).not.toBeInTheDocument();
    });
  });

  it("submits and closes modal on success", async () => {
    const user = userEvent.setup();
    const newPeriod = { ...PERIOD_OPEN, id: "p-new" };
    // GET returns [] so client-side overlap check passes; POST returns the new period
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === "/api/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ADMIN_MEMBER) });
      }
      if (url === "/api/availability/periods") {
        if (opts?.method === "POST") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(newPeriod) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAvailabilityPage />);

    await user.click(await screen.findByRole("button", { name: "+ New Period" }));
    await user.type(screen.getByPlaceholderText("e.g. April–May 2026"), "April–May 2026");

    // Fill date fields
    const dateInputs = screen.getAllByDisplayValue("");
    await user.type(dateInputs[0], "2026-04-05");
    await user.type(dateInputs[1], "2026-05-31");

    await user.click(screen.getByRole("button", { name: "Create Period" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "New Availability Period" })).not.toBeInTheDocument();
    });
  });

  it("shows error message when POST fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === "/api/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ADMIN_MEMBER) });
      }
      if (url === "/api/availability/periods") {
        if (opts?.method === "POST") {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "starts_on must be before ends_on" }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAvailabilityPage />);

    await user.click(await screen.findByRole("button", { name: "+ New Period" }));
    await user.type(screen.getByPlaceholderText("e.g. April–May 2026"), "Test");

    const dateInputs = screen.getAllByDisplayValue("");
    await user.type(dateInputs[0], "2026-06-01");
    await user.type(dateInputs[1], "2026-04-01");

    await user.click(screen.getByRole("button", { name: "Create Period" }));

    await waitFor(() => {
      expect(screen.getByText("starts_on must be before ends_on")).toBeInTheDocument();
    });
  });
});

describe("AdminAvailabilityPage — Reopen button", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows Reopen button for Admin on a closed period", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [PERIOD_CLOSED]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("Feb–Mar 2026");
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("does NOT show Reopen button on an open period", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [PERIOD_OPEN]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("April–May 2026");
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
  });

  it("shows both Reopen and Edit buttons for a closed period when Admin", async () => {
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [PERIOD_CLOSED]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("Feb–Mar 2026");
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
  });

  it("calls PATCH with action: reopen and refreshes list on success", async () => {
    const reopenedPeriod = { ...PERIOD_CLOSED, closed_at: null };
    let patchDone = false;
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === "/api/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ADMIN_MEMBER) });
      }
      if (url === "/api/availability/periods") {
        // Return closed period initially; after PATCH return reopened period
        const period = patchDone ? reopenedPeriod : PERIOD_CLOSED;
        return Promise.resolve({ ok: true, json: () => Promise.resolve([period]) });
      }
      if (opts?.method === "PATCH") {
        patchDone = true;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ reopened: true }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(<AdminAvailabilityPage />);
    await screen.findAllByText("Feb–Mar 2026");

    const reopenBtn = screen.getByRole("button", { name: "Reopen" });
    await userEvent.setup().click(reopenBtn);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, o]) => (o as RequestInit)?.method === "PATCH"
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.action).toBe("reopen");
    });
  });

  it("shows error toast when PATCH reopen fails", async () => {
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === "/api/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(ADMIN_MEMBER) });
      }
      if (url === "/api/availability/periods") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([PERIOD_CLOSED]) });
      }
      if (opts?.method === "PATCH") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Failed to reopen" }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(<AdminAvailabilityPage />);
    await screen.findAllByText("Feb–Mar 2026");

    await userEvent.setup().click(screen.getByRole("button", { name: "Reopen" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to reopen")).toBeInTheDocument();
    });
  });

  it("hides overdue label when all members have responded", async () => {
    const allRespondedPeriod = {
      ...PERIOD_OPEN,
      deadline: "2020-01-01", // well in the past — would normally show overdue
      response_count: 8,
      total_musicians: 8,
    };
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [allRespondedPeriod]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("April–May 2026");
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it("shows overdue label when deadline is past and responses are still pending", async () => {
    const pendingPeriod = {
      ...PERIOD_OPEN,
      deadline: "2020-01-01", // well in the past
      response_count: 3,
      total_musicians: 8,
    };
    vi.stubGlobal("fetch", makeFetch(ADMIN_MEMBER, [pendingPeriod]));
    render(<AdminAvailabilityPage />);
    await screen.findAllByText("April–May 2026");
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it("does not call PATCH when user cancels the confirm dialog", async () => {
    const fetchMock = makeFetch(ADMIN_MEMBER, [PERIOD_CLOSED]);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(<AdminAvailabilityPage />);
    await screen.findAllByText("Feb–Mar 2026");

    await userEvent.setup().click(screen.getByRole("button", { name: "Reopen" }));

    const patchCall = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, o]) => (o as RequestInit | undefined)?.method === "PATCH"
    );
    expect(patchCall).toBeUndefined();
  });
});
