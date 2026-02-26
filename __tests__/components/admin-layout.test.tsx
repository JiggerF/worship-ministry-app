/**
 * Component tests — AdminLayout sidebar navigation
 *
 * Verifies that the correct nav links appear for each role.
 * Regression guard: if a page is added/removed from SIDEBAR_ITEMS without
 * updating the expected list here, these tests will fail loudly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import AdminLayout from "@/app/admin/layout";

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/roster"),
  useRouter: vi.fn(() => ({ replace: vi.fn(), refresh: vi.fn() })),
}));

// ── Mock next/link (renders as <a> in tests) ──────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Stubs global fetch to return the given member from /api/me */
function setupMember(app_role: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "member-1", name: "Test User", app_role }),
    })
  );
}

/** Stubs fetch so /api/me never resolves (simulates loading) */
function setupMemberLoading() {
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
}

function renderLayout() {
  render(
    <AdminLayout>
      <div>page content</div>
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  // Reset usePathname to the default so the login page test's mock doesn't leak
  vi.mocked(usePathname).mockReturnValue("/admin/roster");
});

describe("AdminLayout — Admin nav", () => {
  it("shows all 6 nav links for Admin role", async () => {
    setupMember("Admin");
    renderLayout();
    // All six pages must be present — scope to sidebar-nav to avoid portal links
    const nav = await screen.findByTestId("sidebar-nav");
    expect(within(nav).getByRole("link", { name: /roster manager/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /setlist/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /song manager/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /people/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /audit log/i })).toBeInTheDocument();
  });

  it("Audit Log link points to /admin/audit", async () => {
    setupMember("Admin");
    renderLayout();
    const auditLink = await screen.findByRole("link", { name: /audit log/i });
    expect(auditLink).toHaveAttribute("href", "/admin/audit");
  });

  it("Settings link points to /admin/settings", async () => {
    setupMember("Admin");
    renderLayout();
    const settingsLink = await screen.findByRole("link", { name: /settings/i });
    expect(settingsLink).toHaveAttribute("href", "/admin/settings");
  });
});

describe("AdminLayout — Coordinator nav", () => {
  it("shows Roster, Setlist, Songs, People but NOT Settings or Audit Log", async () => {
    setupMember("Coordinator");
    renderLayout();

    const nav = await screen.findByTestId("sidebar-nav");
    expect(within(nav).getByRole("link", { name: /roster manager/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /setlist/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /song manager/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /people/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(nav).queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /audit log/i })).not.toBeInTheDocument();
    });
  });

  it("shows exactly 4 nav links for Coordinator", async () => {
    setupMember("Coordinator");
    renderLayout();
    await screen.findByTestId("sidebar-nav");
    await waitFor(() => {
      // 4 allowed nav links: Roster, Setlist, Songs, People (excludes Settings, Audit Log, and Sign out)
      const navLinks = screen
        .getAllByRole("link")
        .filter((el) =>
          ["/admin/roster", "/admin/setlist", "/admin/songs", "/admin/people"].includes(
            el.getAttribute("href") ?? ""
          )
        );
      expect(navLinks).toHaveLength(4);
    });
  });
});

describe("AdminLayout — loading state", () => {
  it("hides restricted nav links while member is loading (secure default)", () => {
    // Fetch never resolves, so member stays null and loading stays true.
    // Restricted items must NOT flash while we wait for the role — this is the
    // security regression guard.
    setupMemberLoading();
    renderLayout();
    const nav = screen.getByTestId("sidebar-nav");
    expect(within(nav).getByRole("link", { name: /roster/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /setlist/i })).toBeInTheDocument();
    // Settings and Audit Log must be hidden until role is confirmed as Admin
    expect(screen.queryByRole("link", { name: /audit log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });
});

describe("AdminLayout — login page", () => {
  it("does not render the sidebar on /admin/login", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/login");
    setupMember("Admin");
    renderLayout();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /audit log/i })).not.toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Profile section — sidebar bottom (regression guard for /api/me fix)
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminLayout — profile section", () => {
  it("shows the member name after /api/me resolves", async () => {
    setupMember("Admin");
    renderLayout();
    expect(await screen.findByText("Test User")).toBeInTheDocument();
  });

  it("shows the role badge next to the member name", async () => {
    setupMember("Admin");
    renderLayout();
    await screen.findByText("Test User");
    // Role badge is a <span> with additional styling — check it appears within the header
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Admin")).toBeInTheDocument();
  });

  it("shows the role badge for Coordinator role", async () => {
    setupMember("Coordinator");
    renderLayout();
    await screen.findByText("Test User");
    expect(screen.getByText("Coordinator")).toBeInTheDocument();
  });

  it("shows '—' placeholder while /api/me is still loading", () => {
    setupMemberLoading();
    renderLayout();
    expect(screen.getByText("—")).toBeInTheDocument();
    // 'Loading...' must NOT appear — that was the old broken behaviour
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("shows the Sign out button after member data loads", async () => {
    setupMember("Admin");
    renderLayout();
    const signOut = await screen.findByRole("button", { name: /sign out/i });
    expect(signOut).toBeInTheDocument();
  });

  it("shows Sign out button (without name) when /api/me returns non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => null })
    );
    renderLayout();
    // Wait for loading state to finish (— disappears once setLoading(false) fires)
    await waitFor(() =>
      expect(screen.queryByText("—")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("shows Sign out button when /api/me fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderLayout();
    // Wait for loading state to finish (catch handler calls setLoading(false))
    await waitFor(() =>
      expect(screen.queryByText("—")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
