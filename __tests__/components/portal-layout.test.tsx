/**
 * Component tests — PortalLayout
 *
 * Regression guard for the tenant_name dynamic fetch introduced in this session.
 * The layout fetches /api/me on mount and renders the tenant_name returned.
 * If the fetch fails or returns no tenant_name, it falls back to "Worship Team".
 *
 * Key behaviours under test:
 *   1. Shows fallback "Worship Team" while fetch is pending
 *   2. Shows tenant_name from /api/me when the response includes it
 *   3. Falls back to "Worship Team" when /api/me returns a non-ok response
 *   4. Falls back to "Worship Team" when /api/me throws a network error
 *   5. Falls back to "Worship Team" when /api/me returns ok but no tenant_name field
 *   6. Renders the Musicians Portal subheading
 *   7. Renders Roster and Song Library nav tabs
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PortalLayout from "@/app/portal/layout";

// ── Mock next/navigation ───────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/portal/roster"),
}));

// ── Mock next/link ────────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function renderLayout() {
  return render(
    <PortalLayout>
      <div>portal content</div>
    </PortalLayout>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// tenant_name display
// ─────────────────────────────────────────────────────────────────────────────

describe("PortalLayout — tenant name display", () => {
  it("shows 'Worship Team' fallback before /api/me resolves", () => {
    // fetch never resolves — simulates pending state
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderLayout();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Worship Team");
  });

  it("shows tenant_name from /api/me when fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "member-1",
          name: "Julius",
          app_role: "Admin",
          tenant_name: "Julius Church Music Ministry",
        }),
      })
    );
    renderLayout();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Julius Church Music Ministry"
      )
    );
  });

  it("keeps 'Worship Team' fallback when /api/me returns non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => null })
    );
    renderLayout();
    // After the fetch settles the heading should still be the fallback
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Worship Team")
    );
  });

  it("keeps 'Worship Team' fallback when /api/me throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderLayout();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Worship Team")
    );
  });

  it("keeps 'Worship Team' fallback when /api/me returns ok but no tenant_name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "member-1",
          name: "Julius",
          app_role: "Admin",
          // tenant_name is intentionally absent (e.g. single-tenant mode)
        }),
      })
    );
    renderLayout();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Worship Team")
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Static structure
// ─────────────────────────────────────────────────────────────────────────────

describe("PortalLayout — static structure", () => {
  it("renders the 'Musicians Portal' subheading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderLayout();
    expect(screen.getByText("Musicians Portal")).toBeInTheDocument();
  });

  it("renders the Roster nav tab", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderLayout();
    expect(screen.getByRole("link", { name: /roster/i })).toBeInTheDocument();
  });

  it("renders the Song Library nav tab", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderLayout();
    expect(screen.getByRole("link", { name: /song library/i })).toBeInTheDocument();
  });

  it("renders children inside the main content area", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderLayout();
    expect(screen.getByText("portal content")).toBeInTheDocument();
  });
});
