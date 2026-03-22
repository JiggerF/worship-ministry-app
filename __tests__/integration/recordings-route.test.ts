// @vitest-environment node
/**
 * Integration tests — GET /api/recordings & POST /api/recordings
 *                     DELETE /api/recordings/[id]
 *
 * Tests role-based auth, tenant scoping, body validation, and DB error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock getActorFromRequest ──
const mockGetActor = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: "admin-1",
    name: "Admin User",
    role: "Admin",
    tenantId: "00000000-0000-0000-0000-000000000001",
  })
);
vi.mock("@/lib/server/get-actor", () => ({
  getActorFromRequest: mockGetActor,
}));

// ── Mock DB helpers ──
const mockGetRecordings = vi.hoisted(() => vi.fn());
const mockCreateRecording = vi.hoisted(() => vi.fn());
const mockDeleteRecording = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/recordings", () => ({
  getRecordings: mockGetRecordings,
  createRecording: mockCreateRecording,
  deleteRecording: mockDeleteRecording,
  driveEmbedUrl: vi.fn((u: string) => u),
  driveDownloadUrl: vi.fn((u: string) => u),
  formatDuration: vi.fn(() => null),
}));

import { GET, POST } from "@/app/api/recordings/route";
import { DELETE } from "@/app/api/recordings/[id]/route";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_RECORDING = {
  id: "rec-1",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  title: "Sunday Morning Service",
  sunday_date: "2026-03-15",
  recording_type: "audio",
  drive_url: "https://drive.google.com/file/d/ABC/view",
  duration_seconds: 2722,
  uploaded_by: "admin-1",
  created_at: "2026-03-15T10:00:00Z",
  featured_members: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActor.mockResolvedValue({
    id: "admin-1",
    name: "Admin User",
    role: "Admin",
    tenantId: "00000000-0000-0000-0000-000000000001",
  });
  mockGetRecordings.mockResolvedValue([MOCK_RECORDING]);
  mockCreateRecording.mockResolvedValue(MOCK_RECORDING);
  mockDeleteRecording.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/recordings
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/recordings", () => {
  it("returns recordings array", async () => {
    const req = makeNextRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].id).toBe("rec-1");
  });

  it("returns 500 when getRecordings throws", async () => {
    mockGetRecordings.mockRejectedValue(new Error("DB failure"));
    const req = makeNextRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/DB failure/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/recordings
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/recordings", () => {
  it("creates a recording and returns 201 for Admin", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: {
        title: "Sunday Morning Service",
        sunday_date: "2026-03-15",
        recording_type: "audio",
        drive_url: "https://drive.google.com/file/d/ABC/view",
        duration: "45:22",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.recording.id).toBe("rec-1");
    expect(mockCreateRecording).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      expect.objectContaining({
        title: "Sunday Morning Service",
        duration_seconds: 2722, // 45*60 + 22
      })
    );
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue({ id: "m1", name: "Musician", role: "Musician", tenantId: "t1" });
    const req = makeNextRequest({
      method: "POST",
      body: { title: "X", sunday_date: "2026-03-15", drive_url: "https://drive.google.com/file/d/X/view" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when actor is null (unauthenticated)", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "POST", body: {} });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makeNextRequest({ method: "POST", body: { title: "No Date No URL" } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("parses duration correctly when not provided", async () => {
    const req = makeNextRequest({
      method: "POST",
      body: {
        title: "No Duration",
        sunday_date: "2026-03-15",
        drive_url: "https://drive.google.com/file/d/X/view",
      },
    });
    await POST(req);
    expect(mockCreateRecording).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ duration_seconds: null })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/recordings/[id]
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/recordings/[id]", () => {
  it("deletes a recording and returns success for Admin", async () => {
    const req = makeNextRequest({ method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDeleteRecording).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      "rec-1"
    );
  });

  it("returns 403 for Musician role", async () => {
    mockGetActor.mockResolvedValue({ id: "m1", name: "Musician", role: "Musician", tenantId: "t1" });
    const req = makeNextRequest({ method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    mockGetActor.mockResolvedValue(null);
    const req = makeNextRequest({ method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 500 when deleteRecording throws", async () => {
    mockDeleteRecording.mockRejectedValue(new Error("delete failed"));
    const req = makeNextRequest({ method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(500);
  });
});
