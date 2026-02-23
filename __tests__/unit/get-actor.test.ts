// @vitest-environment node
/**
 * Unit tests — getActorFromRequest
 * src/lib/server/get-actor.ts
 *
 * Verifies actor extraction from the sb-access-token JWT cookie, including
 * all null-return edge cases and the success path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "../integration/_helpers";

// ── Build mock via vi.hoisted so references are valid inside vi.mock factory ──
const { mockQuery, mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "eq", "single"] as const;
  methods.forEach((m) => {
    query[m] = vi.fn().mockReturnValue(query);
  });
  query.then = vi.fn();
  const from = vi.fn().mockReturnValue(query);
  const client = { from };
  return { mockQuery: query, mockFrom: from, mockClient: client };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

import { getActorFromRequest } from "@/lib/server/get-actor";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeJwt(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `fakeheader.${encoded}.fakesig`;
}

function setDbResult(data: unknown, error: unknown = null) {
  (mockQuery.then as (resolve: (v: unknown) => unknown) => unknown) = vi.fn(
    (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve)
  );
}

const VALID_MEMBER = {
  id: "member-uuid-123",
  name: "Test Admin",
  app_role: "Admin",
};

beforeEach(() => {
  vi.clearAllMocks();
  const methods = ["select", "eq", "single"] as const;
  methods.forEach((m) => {
    (mockQuery[m] as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockReturnValue(mockQuery);
  });
  mockFrom.mockReturnValue(mockQuery);
  setDbResult(VALID_MEMBER);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("getActorFromRequest — null paths", () => {
  it("returns null when no sb-access-token cookie is present", async () => {
    const req = makeNextRequest({ method: "GET" });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when token has fewer than 3 parts", async () => {
    const req = makeNextRequest({
      cookies: { "sb-access-token": "not.avalidjwt" },
    });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when token has more than 3 parts", async () => {
    const req = makeNextRequest({
      cookies: { "sb-access-token": "a.b.c.d" },
    });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when payload has no email field", async () => {
    const jwt = makeJwt({ sub: "user-uuid", iat: 1234567890 }); // no email
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when DB returns no data (member not found)", async () => {
    setDbResult(null);
    const jwt = makeJwt({ email: "unknown@wcc.org" });
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when DB query throws an exception", async () => {
    (mockQuery.then as ReturnType<typeof vi.fn>) = vi.fn(
      (resolve: unknown, reject?: (e: unknown) => void) =>
        Promise.reject(new Error("connection refused")).then(
          resolve as never,
          reject
        )
    );
    const jwt = makeJwt({ email: "admin@wcc.org" });
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when the base64 payload is not valid JSON", async () => {
    const badBase64 = Buffer.from("not-json{{{{").toString("base64");
    const jwt = `fakeheader.${badBase64}.fakesig`;
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    const result = await getActorFromRequest(req);
    expect(result).toBeNull();
  });
});

describe("getActorFromRequest — success path", () => {
  it("returns an AuditActor with id, name and role on success", async () => {
    const jwt = makeJwt({ email: "admin@wcc.org" });
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    const result = await getActorFromRequest(req);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(VALID_MEMBER.id);
    expect(result?.name).toBe(VALID_MEMBER.name);
    expect(result?.role).toBe(VALID_MEMBER.app_role);
  });

  it("queries the members table by the decoded email", async () => {
    const email = "worship@wcc.org";
    const jwt = makeJwt({ email });
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    await getActorFromRequest(req);
    expect(mockFrom).toHaveBeenCalledWith("members");
    expect(mockQuery.select).toHaveBeenCalledWith("id, name, app_role");
    expect(mockQuery.eq).toHaveBeenCalledWith("email", email);
  });

  it("maps app_role column to the role field correctly", async () => {
    setDbResult({ id: "coord-id", name: "Coord User", app_role: "Coordinator" });
    const jwt = makeJwt({ email: "coord@wcc.org" });
    const req = makeNextRequest({
      cookies: { "sb-access-token": jwt },
    });
    const result = await getActorFromRequest(req);
    expect(result?.role).toBe("Coordinator");
  });
});
