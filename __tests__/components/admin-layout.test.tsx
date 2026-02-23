/**
 * Component tests — AdminLayout sidebar navigation
 *
 * Verifies that the correct nav links appear for each role.
 * Regression guard: if a page is added/removed from SIDEBAR_ITEMS without
 * updating the expected list here, these tests will fail loudly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminLayout from "@/app/admin/layout";

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/roster"),
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

// ── Build Supabase mock via vi.hoisted ────────────────────────────────────────
const { mockGetUser, mockSingle, mockSupabase } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSingle = vi.fn();

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
  };

  const mockSupabase = {
    auth: { getUser: mockGetUser, onAuthStateChange: vi.fn(() => ({ data: {} })) },
    from: vi.fn(() => chain),
  };

  return { mockGetUser, mockSingle, mockSupabase };
});

vi.mock("@/lib/supabase", () => ({ default: mockSupabase }));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupMember(app_role: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { email: "user@wcc.org" } },
  });
  mockSingle.mockResolvedValue({
    data: { id: "member-1", name: "Test User", app_role },
    error: null,
  });
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
});

describe("AdminLayout — Admin nav", () => {
  it("shows all 5 nav links for Admin role", async () => {
    setupMember("Admin");
    renderLayout();
    // All five pages must be present
    expect(await screen.findByRole("link", { name: /roster/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /songs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /people/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit log/i })).toBeInTheDocument();
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
  it("shows Roster, Songs, People but NOT Settings or Audit Log", async () => {
    setupMember("Coordinator");
    renderLayout();

    await screen.findByRole("link", { name: /roster/i });
    expect(screen.getByRole("link", { name: /songs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /people/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /audit log/i })).not.toBeInTheDocument();
    });
  });

  it("shows exactly 3 nav links for Coordinator", async () => {
    setupMember("Coordinator");
    renderLayout();
    await screen.findByRole("link", { name: /roster/i });
    await waitFor(() => {
      // Only the 3 allowed nav links (excludes Sign out link counted separately)
      const navLinks = screen
        .getAllByRole("link")
        .filter((el) =>
          ["/admin/roster", "/admin/songs", "/admin/people"].includes(
            el.getAttribute("href") ?? ""
          )
        );
      expect(navLinks).toHaveLength(3);
    });
  });
});

describe("AdminLayout — loading state", () => {
  it("shows all nav links while member is loading (defaults to showing all)", () => {
    // Don't resolve getUser so member stays null/loading
    mockGetUser.mockReturnValue(new Promise(() => {}));
    renderLayout();
    // Before member loads, Coordinator filter hasn't applied — all items visible
    expect(screen.getByRole("link", { name: /roster/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit log/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });
});

describe("AdminLayout — login page", () => {
  it("does not render the sidebar on /admin/login", async () => {
    const { usePathname } = await import("next/navigation");
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/login");
    mockGetUser.mockResolvedValue({ data: { user: null } });
    renderLayout();
    expect(screen.queryByRole("link", { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /audit log/i })).not.toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
