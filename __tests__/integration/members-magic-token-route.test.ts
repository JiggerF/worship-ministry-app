/**
 * Integration tests for POST /api/members/[id]/magic-token
 *
 * Route calls generateMagicToken with the member id found in the route params.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── hoisted mock refs ──────────────────────────────────────────────────────
const { mockGenerateMagicToken } = vi.hoisted(() => ({
  mockGenerateMagicToken: vi.fn(),
}));

vi.mock("@/lib/db/members", () => ({
  generateMagicToken: mockGenerateMagicToken,
}));

const { POST } = await import("@/app/api/members/[id]/magic-token/route");

// ── helpers ────────────────────────────────────────────────────────────────
function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateMagicToken.mockResolvedValue("abc123token");
});

// ── tests ──────────────────────────────────────────────────────────────────
describe("POST /api/members/[id]/magic-token", () => {
  it("returns 200 with the generated token", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/members/m1/magic-token",
    });

    const res = await POST(req, makeContext("m1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ token: "abc123token" });
    expect(mockGenerateMagicToken).toHaveBeenCalledWith("m1");
  });

  it("calls generateMagicToken with the correct id", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/members/uuid-999/magic-token",
    });

    await POST(req, makeContext("uuid-999"));

    expect(mockGenerateMagicToken).toHaveBeenCalledTimes(1);
    expect(mockGenerateMagicToken).toHaveBeenCalledWith("uuid-999");
  });
});
