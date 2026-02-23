// @vitest-environment node
/**
 * Integration tests — GET /api/chord-sheet
 * src/app/api/chord-sheet/route.ts
 *
 * Tests URL validation (Google Docs only), document-ID extraction,
 * and upstream error propagation — no real HTTP calls (fetch is mocked).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// Mock global fetch before importing the route
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "@/app/api/chord-sheet/route";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Parameter validation
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/chord-sheet — validation", () => {
  it("returns 400 when 'url' query param is missing", async () => {
    const req = makeNextRequest({ url: "http://localhost/api/chord-sheet" });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it("returns 400 for a non-Google-Docs URL", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/chord-sheet?url=https://example.com/doc",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/google docs/i);
  });

  it("returns 400 when the URL is completely invalid", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/chord-sheet?url=not-a-url",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when Google Docs URL has no document ID", async () => {
    const req = makeNextRequest({
      url: "http://localhost/api/chord-sheet?url=https://docs.google.com/",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/document id/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Upstream Google Docs proxy
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/chord-sheet — Google Docs proxy", () => {
  const VALID_URL =
    "https://docs.google.com/document/d/1abc123XYZ/edit?usp=sharing";

  it("returns chord sheet text on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue("[Verse]\nC G Am F\nAmazing grace"),
    });

    const req = makeNextRequest({
      url: `http://localhost/api/chord-sheet?url=${encodeURIComponent(VALID_URL)}`,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain("[Verse]");
  });

  it("returns 502 when Google Docs returns non-OK status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const req = makeNextRequest({
      url: `http://localhost/api/chord-sheet?url=${encodeURIComponent(VALID_URL)}`,
    });
    const res = await GET(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/403/);
  });

  it("returns 502 when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const req = makeNextRequest({
      url: `http://localhost/api/chord-sheet?url=${encodeURIComponent(VALID_URL)}`,
    });
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("calls the correct export URL (txt format)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });

    const req = makeNextRequest({
      url: `http://localhost/api/chord-sheet?url=${encodeURIComponent(VALID_URL)}`,
    });
    await GET(req);

    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("export?format=txt");
    expect(calledUrl).toContain("1abc123XYZ");
  });
});
