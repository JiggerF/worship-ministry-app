// @vitest-environment node
/**
 * Integration tests — POST /api/auth/login and POST /api/auth/logout
 *
 * Verifies:
 *   login:
 *     - 400 on missing/invalid body
 *     - 401 when Supabase returns an auth error
 *     - 200 + cookies set on success
 *     - createAuditLogEntry called with action:"login" for ALL app_roles
 *     - audit failure never blocks login response
 *
 *   logout:
 *     - 200 always (even when actor is null / unauthenticated)
 *     - cookies cleared on response
 *     - createAuditLogEntry called with action:"logout" when actor is resolved
 *     - audit failure never blocks logout response
 *     - audit NOT called when actor cannot be resolved (no cookie)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── All mocks in one vi.hoisted block ─────────────────────────────────────
const {
  mockGetActor,
  mockCreateAuditLogEntry,
  mockSignInWithPassword,
  mockQuery,
  mockFrom,
  mockClient,
} = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "eq", "single"] as const;
  methods.forEach((m) => {
    query[m] = vi.fn().mockReturnValue(query);
  });
  query.then = vi.fn();
  const from = vi.fn().mockReturnValue(query);

  const mockSignIn = vi.fn();
  const mockAuth = { signInWithPassword: mockSignIn };

  return {
    mockGetActor: vi.fn(),
    mockCreateAuditLogEntry: vi.fn(),
    mockSignInWithPassword: mockSignIn,
    mockQuery: query,
    mockFrom: from,
    mockClient: { from, auth: mockAuth },
  };
});

vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

vi.mock("@/lib/db/audit-log", () => ({
  createAuditLogEntry: mockCreateAuditLogEntry,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ACTOR = { id: "member-uuid-1", name: "Test Admin", role: "Admin" };
const COORD_ACTOR = { id: "member-uuid-2", name: "Test Coord", role: "Coordinator" };
const MUSICIAN_ACTOR = { id: "member-uuid-3", name: "Test Musician", role: "Musician" };

const MOCK_SESSION = {
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHdlY2Mub3JnIn0.sig",
  refresh_token: "refresh-token-xyz",
};

/** Resolves the supabase query chain (member lookup) with given data/error */
function resolveWith(data: unknown, error: unknown = null) {
  (mockQuery.then as ReturnType<typeof vi.fn>).mockImplementation(
    (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve)
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  // Reset query chain
  const methods = ["select", "eq", "single"] as const;
  methods.forEach((m) => {
    (mockQuery[m] as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);

  // Default: successful Supabase sign-in
  mockSignInWithPassword.mockResolvedValue({
    data: { session: MOCK_SESSION, user: { email: "admin@wcc.org" } },
    error: null,
  });

  // Default: member lookup returns Admin
  resolveWith({ id: ADMIN_ACTOR.id, name: ADMIN_ACTOR.name, app_role: "Admin" });

  // Default: getActorFromRequest returns Admin
  mockGetActor.mockResolvedValue(ADMIN_ACTOR);

  // Default: audit entry succeeds
  mockCreateAuditLogEntry.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login — validation", () => {
  it("returns 400 when body is not valid JSON", async () => {
    // Build a request with an unparseable body
    const badReq = new (await import("next/server")).NextRequest(
      "http://localhost/api/auth/login",
      { method: "POST", body: "not-json", headers: { "content-type": "application/json" } }
    );
    const res = await loginHandler(badReq);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when email is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { password: "secret" },
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 when password is missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org" },
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });
});

describe("POST /api/auth/login — authentication failure", () => {
  it("returns 401 when Supabase returns an auth error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "wrongpass" },
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid login credentials");
  });

  it("returns 401 when Supabase returns no session", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: { email: "admin@wcc.org" } },
      error: null,
    });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "badpass" },
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(401);
  });

  it("does NOT call createAuditLogEntry on auth failure", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "wrongpass" },
    });
    await loginHandler(req);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login — success", () => {
  it("returns 200 with { success: true } on valid credentials", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("sets sb-access-token cookie on success", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    const res = await loginHandler(req);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-access-token");
  });

  it("sets sb-refresh-token cookie on success", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    const res = await loginHandler(req);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-refresh-token");
  });

  it("calls createAuditLogEntry with action:login for Admin role", async () => {
    resolveWith({ id: "member-uuid-1", name: "Test Admin", app_role: "Admin" });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    await loginHandler(req);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login",
        entity_type: "auth",
        actor_role: "Admin",
      })
    );
  });

  it("calls createAuditLogEntry with action:login for Coordinator role", async () => {
    resolveWith({ id: COORD_ACTOR.id, name: COORD_ACTOR.name, app_role: "Coordinator" });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "coordinator@wcc.org", password: "correct" },
    });
    await loginHandler(req);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login",
        entity_type: "auth",
        actor_role: "Coordinator",
        actor_name: COORD_ACTOR.name,
      })
    );
  });

  it("calls createAuditLogEntry with action:login for Musician role", async () => {
    resolveWith({ id: MUSICIAN_ACTOR.id, name: MUSICIAN_ACTOR.name, app_role: "Musician" });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "musician@wcc.org", password: "correct" },
    });
    await loginHandler(req);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login",
        actor_role: "Musician",
      })
    );
  });

  it("audit summary includes actor name and role", async () => {
    resolveWith({ id: ADMIN_ACTOR.id, name: "Test Admin", app_role: "Admin" });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    await loginHandler(req);
    const call = mockCreateAuditLogEntry.mock.calls[0][0];
    expect(call.summary).toContain("Test Admin");
    expect(call.summary).toContain("Admin");
  });

  it("still returns 200 even when member lookup fails (no audit written)", async () => {
    resolveWith(null, { message: "no rows" });
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    const res = await loginHandler(req);
    // Login itself succeeds — audit failure must not block auth
    expect(res.status).toBe(200);
  });

  it("still returns 200 even when createAuditLogEntry throws", async () => {
    mockCreateAuditLogEntry.mockRejectedValue(new Error("DB down"));
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      body: { email: "admin@wcc.org", password: "correct" },
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/logout — success", () => {
  it("always returns 200", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 200 even when actor is null (unauthenticated)", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
  });

  it("clears sb-access-token cookie", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    const res = await logoutHandler(req);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-access-token");
    // maxAge=0 means cleared
    expect(setCookie).toContain("Max-Age=0");
  });

  it("clears sb-refresh-token cookie", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    const res = await logoutHandler(req);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-refresh-token");
  });
});

describe("POST /api/auth/logout — audit", () => {
  it("calls createAuditLogEntry with action:logout when actor is resolved", async () => {
    mockGetActor.mockResolvedValue(ADMIN_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    await logoutHandler(req);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledOnce();
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "logout",
        entity_type: "auth",
        actor_id: ADMIN_ACTOR.id,
        actor_name: ADMIN_ACTOR.name,
        actor_role: ADMIN_ACTOR.role,
      })
    );
  });

  it("calls createAuditLogEntry with action:logout for Coordinator", async () => {
    mockGetActor.mockResolvedValue(COORD_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    await logoutHandler(req);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "logout",
        actor_role: "Coordinator",
        actor_name: COORD_ACTOR.name,
      })
    );
  });

  it("calls createAuditLogEntry with action:logout for Musician", async () => {
    mockGetActor.mockResolvedValue(MUSICIAN_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    await logoutHandler(req);
    expect(mockCreateAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "logout",
        actor_role: "Musician",
      })
    );
  });

  it("audit summary includes actor name and role", async () => {
    mockGetActor.mockResolvedValue(ADMIN_ACTOR);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    await logoutHandler(req);
    const call = mockCreateAuditLogEntry.mock.calls[0][0];
    expect(call.summary).toContain(ADMIN_ACTOR.name);
    expect(call.summary).toContain(ADMIN_ACTOR.role);
  });

  it("does NOT call createAuditLogEntry when actor is null", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    await logoutHandler(req);
    expect(mockCreateAuditLogEntry).not.toHaveBeenCalled();
  });

  it("still returns 200 even when createAuditLogEntry throws", async () => {
    mockGetActor.mockResolvedValue(ADMIN_ACTOR);
    mockCreateAuditLogEntry.mockRejectedValue(new Error("DB down"));
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
  });

  it("still returns 200 even when getActorFromRequest throws", async () => {
    mockGetActor.mockRejectedValue(new Error("cookie parse error"));
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/auth/logout",
    });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
  });
});
