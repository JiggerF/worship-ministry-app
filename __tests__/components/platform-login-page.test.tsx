/**
 * Component tests — PlatformLoginPage
 *
 * Regression guard for the session-preservation fix:
 * When /api/platform/me returns 403 (valid Supabase user, not a platform admin),
 * the page must NOT call /api/auth/logout. Destroying the session would lock
 * a church admin out of /admin/* routes.
 *
 * Key behaviours under test:
 *   1. Renders email + password fields and submit button
 *   2. Shows error when /api/auth/login fails
 *   3. Shows "not a platform admin" error when /api/platform/me returns 403
 *   4. CRITICAL: Does NOT call /api/auth/logout after a failed platform admin check
 *   5. Submit button is re-enabled after a failed check
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlatformLoginPage from "@/app/platform/login/page";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFetch(handlers: Record<string, { ok: boolean; body?: object }>) {
  return vi.fn().mockImplementation((url: string) => {
    const entry = handlers[url] ?? { ok: false, body: { error: "unexpected url" } };
    return Promise.resolve({
      ok: entry.ok,
      json: async () => entry.body ?? {},
    });
  });
}

/** Fill in the platform login form. Password input has no placeholder/label association — query by type. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  email: string,
  password: string
) {
  await user.type(screen.getByPlaceholderText("admin@worshipapp.com"), email);
  const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
  await user.type(passwordInput, password);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

describe("PlatformLoginPage — rendering", () => {
  it("renders email field, password field, and sign-in button", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<PlatformLoginPage />);
    expect(screen.getByPlaceholderText("admin@worshipapp.com")).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth login failure
// ─────────────────────────────────────────────────────────────────────────────

describe("PlatformLoginPage — login failure", () => {
  it("shows error message when /api/auth/login returns 401", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      makeFetch({
        "/api/auth/login": { ok: false, body: { error: "Invalid login credentials" } },
      })
    );

    const { container } = render(<PlatformLoginPage />);
    await fillForm(user, container, "test@test.com", "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Platform admin check failure — session must NOT be destroyed
// ─────────────────────────────────────────────────────────────────────────────

describe("PlatformLoginPage — platform admin check failure", () => {
  it("shows 'no platform admin access' error when /api/platform/me returns 403", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      makeFetch({
        "/api/auth/login": { ok: true, body: {} },
        "/api/platform/me": { ok: false, body: { error: "Forbidden" } },
      })
    );

    const { container } = render(<PlatformLoginPage />);
    await fillForm(user, container, "churchadmin@wcc.org", "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/you do not have platform admin access/i)).toBeInTheDocument()
    );
  });

  it("CRITICAL: does NOT call /api/auth/logout after a failed platform admin check", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetch({
      "/api/auth/login": { ok: true, body: {} },
      "/api/platform/me": { ok: false, body: { error: "Forbidden" } },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<PlatformLoginPage />);
    await fillForm(user, container, "churchadmin@wcc.org", "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/you do not have platform admin access/i)).toBeInTheDocument()
    );

    // Verify logout was never called — re-introducing this call would lock a
    // church admin out of /admin/* by destroying their active Supabase session.
    const logoutCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/auth/logout"
    );
    expect(logoutCalls).toHaveLength(0);
  });

  it("re-enables the submit button after a failed platform admin check", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      makeFetch({
        "/api/auth/login": { ok: true, body: {} },
        "/api/platform/me": { ok: false, body: { error: "Forbidden" } },
      })
    );

    const { container } = render(<PlatformLoginPage />);
    await fillForm(user, container, "churchadmin@wcc.org", "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/you do not have platform admin access/i)).toBeInTheDocument()
    );

    expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
  });
});
