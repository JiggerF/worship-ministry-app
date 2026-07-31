/**
 * Component tests — AdminLoginForm (dynamic tenant label feature)
 *
 * Verifies that:
 * 1. The orgName prop is rendered in the h1.
 * 2. A specific tenant name renders correctly.
 * 3. The fallback "Worship Ministry" renders when no tenant name is supplied.
 * 4. Form fields (email, password, submit) are all present — regression guard.
 * 5. Form submit calls fetch with the correct URL (with and without ?org= param).
 * 6. Error state is shown when login fails.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminLoginForm } from "@/app/admin/login/LoginForm";

// ── Mock next/navigation ──────────────────────────────────────────────────────
const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockGet = vi.fn().mockReturnValue(null); // no ?org= by default

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace, refresh: mockRefresh })),
  useSearchParams: vi.fn(() => ({ get: mockGet })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFetchOk() {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
}

function makeFetchFail(errorMsg = "Invalid credentials") {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: errorMsg }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  // Reset the org param mock to null between tests
  mockGet.mockReturnValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// h1 / orgName rendering
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminLoginForm — orgName prop rendering", () => {
  it("renders the orgName prop in the h1", () => {
    render(<AdminLoginForm orgName="Worship Ministry" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Worship Ministry");
  });

  it("renders a specific tenant name in the h1", () => {
    render(<AdminLoginForm orgName="Julius Church Music Ministry" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Julius Church Music Ministry"
    );
  });

  it("renders the WCC church name when passed as prop", () => {
    render(<AdminLoginForm orgName="WCC Worship Ministry" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("WCC Worship Ministry");
  });

  it("renders the fallback 'Worship Ministry' string correctly", () => {
    // Simulates what AdminLoginPage passes when x-tenant-name header is absent
    render(<AdminLoginForm orgName="Worship Ministry" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Worship Ministry");
    expect(h1.textContent).toBe("Worship Ministry");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Form field presence — regression guard
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminLoginForm — form fields regression guard", () => {
  it("renders email input", () => {
    render(<AdminLoginForm orgName="Worship Ministry" />);
    expect(screen.getByPlaceholderText("admin@wcc.org")).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<AdminLoginForm orgName="Worship Ministry" />);
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
  });

  it("renders the Sign In submit button", () => {
    render(<AdminLoginForm orgName="Worship Ministry" />);
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("submit button is enabled when form is idle", () => {
    render(<AdminLoginForm orgName="Worship Ministry" />);
    expect(screen.getByRole("button", { name: "Sign In" })).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Form submission — regression tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminLoginForm — form submission", () => {
  it("calls /api/auth/login (no ?org=) when no org search param is present", async () => {
    const user = userEvent.setup();
    mockGet.mockReturnValue(null); // no ?org= param
    vi.stubGlobal("fetch", makeFetchOk());

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "admin@wcc.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("calls /api/auth/login?org=<slug> when ?org= param is present", async () => {
    const user = userEvent.setup();
    mockGet.mockReturnValue("julius-church-music-ministry");
    vi.stubGlobal("fetch", makeFetchOk());

    render(<AdminLoginForm orgName="Julius Church Music Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "julius@church.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const [calledUrl] = (vi.mocked(global.fetch).mock.calls[0] as [string, ...unknown[]]);
      expect(calledUrl).toContain("/api/auth/login?org=");
      expect(calledUrl).toContain("julius-church-music-ministry");
    });
  });

  it("redirects to /admin/roster on successful login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchOk());

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "admin@wcc.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "pass");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/roster");
    });
  });

  it("shows error message when login fails (non-ok response)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchFail("Invalid email or password"));

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "bad@wcc.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("shows generic error when server returns no error message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "x@x.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Sign in failed. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows network error message when fetch throws", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "x@x.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(
        screen.getByText("Network error. Please check your connection and try again.")
      ).toBeInTheDocument();
    });
  });

  it("disables the button while submitting", async () => {
    const user = userEvent.setup();
    // Fetch never resolves — keeps the button in the loading state
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "a@b.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "pass");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    // Button should now be disabled and show "Signing in..."
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });
  });

  // Gap: the success test only asserted router.replace(). The component calls both
  // router.replace() AND router.refresh() so that Next.js SSR re-evaluates the
  // auth session on the next page load. If refresh() were silently removed the
  // redirect would still pass but stale middleware/SSR state would persist.
  it("calls router.refresh() after a successful login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchOk());

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "admin@wcc.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "pass");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  // Gap: the `if (loading) return;` guard in handleSubmit was untested. Without
  // this guard a slow network + impatient user could fire duplicate POST requests,
  // creating duplicate audit log events or triggering a second session cookie
  // write mid-flight.
  it("does not fire a second fetch when the button is clicked while already submitting", async () => {
    const user = userEvent.setup();
    // First call never resolves — simulates an in-flight request
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "a@b.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "pass");

    // First click — starts the in-flight request
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    // Wait until the button is in loading state before clicking again
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled()
    );

    // Second click on the disabled button — the guard should prevent a second fetch
    await user.click(screen.getByRole("button", { name: /signing in/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Gap: `setError(null)` at the top of handleSubmit was untested. If that line
  // were accidentally removed, a stale error banner from a previous failed attempt
  // would remain visible during and after a successful retry — misleading the user
  // into thinking the second attempt also failed.
  it("clears a previous error message when the user retries", async () => {
    const user = userEvent.setup();

    // First attempt fails
    vi.stubGlobal("fetch", makeFetchFail("Invalid email or password"));

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "bad@wcc.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });

    // Second attempt succeeds — error should disappear
    vi.stubGlobal("fetch", makeFetchOk());
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
    });
  });

  // Gap: existing submission tests only verified the request URL. The API route
  // reads email and password from the JSON body to authenticate against Supabase.
  // A regression that inadvertently omits or misspells those keys would produce a
  // silent authentication failure that URL-only assertions would never catch.
  it("sends the typed email and password in the POST request body", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchOk();
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLoginForm orgName="Worship Ministry" />);

    await user.type(screen.getByPlaceholderText("admin@wcc.org"), "leader@wcc.org");
    await user.type(screen.getByPlaceholderText("Enter password"), "s3cret!");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { email: string; password: string };
      expect(body.email).toBe("leader@wcc.org");
      expect(body.password).toBe("s3cret!");
    });
  });
});
