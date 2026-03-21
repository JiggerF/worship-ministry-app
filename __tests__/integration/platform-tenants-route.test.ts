// @vitest-environment node
/**
 * Integration tests — Platform API routes
 *
 * GET /api/platform/tenants    — list tenants
 * POST /api/platform/tenants   — provision new tenant
 * GET /api/platform/tenants/[id]/features — list feature flags
 * PUT /api/platform/tenants/[id]/features — toggle feature flag
 *
 * getPlatformAdmin and Supabase are mocked throughout.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeNextRequest } from "./_helpers";

// ── Mock requirePlatformAdmin ─────────────────────────────────────────────────
// Routes import requirePlatformAdmin (returns NextResponse | null).
// null  → caller is authorized (proceed)
// NextResponse → deny (return immediately)
const { mockRequirePlatformAdmin } = vi.hoisted(() => ({
  mockRequirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/server/platform-auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

// ── Mock Supabase service client ──────────────────────────────────────────────
const { mockSupabase } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "order", "maybeSingle", "upsert", "insert", "update"] as const;
  chainMethods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );

  const mockRpc = vi.fn();
  const mockFrom = vi.fn().mockReturnValue(chain);

  const supabase = {
    from: mockFrom,
    rpc: mockRpc,
    auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({}) } },
  };

  return { mockSupabase: supabase };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

vi.mock("server-only", () => ({}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

// Import AFTER mocks
const { GET: getTenantsRoute, POST: postTenantsRoute } = await import(
  "@/app/api/platform/tenants/route"
);
const { GET: getFeaturesRoute, PUT: putFeaturesRoute } = await import(
  "@/app/api/platform/tenants/[id]/features/route"
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLATFORM_ADMIN = {
  id: "pa-001",
  email: "admin@platform.com",
  name: "Platform Admin",
  created_at: "2026-01-01T00:00:00Z",
};

const ORG = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "WCC Worship Ministry",
  slug: "wcc",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

/** Helper: resolve the last Supabase chain with given data */
function resolveChain(data: unknown, error: unknown = null) {
  const lastChain = mockSupabase.from.mock.results[
    mockSupabase.from.mock.results.length - 1
  ]?.value as Record<string, ReturnType<typeof vi.fn>>;
  if (!lastChain) return;
  (lastChain as Record<string, unknown>).then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve)
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: authorized — requirePlatformAdmin returns null (no denial)
  mockRequirePlatformAdmin.mockResolvedValue(null);

  // Reset chain
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "maybeSingle", "upsert", "insert", "update"] as const;
  methods.forEach((m) => {
    (chain as Record<string, ReturnType<typeof vi.fn>>)[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve)
  );
  mockSupabase.from.mockReturnValue(chain);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/platform/tenants
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/platform/tenants", () => {
  it("returns 403 when caller is not a platform admin", async () => {
    mockRequirePlatformAdmin.mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const req = makeNextRequest({ url: "http://localhost/api/platform/tenants" });
    const res = await getTenantsRoute(req);
    expect(res.status).toBe(403);
  });

  it("returns tenant list for an authenticated platform admin", async () => {
    // First .from() call returns org list; subsequent count calls return 0
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Main org list query
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [ORG], error: null }).then(resolve)
          ),
        };
      }
      // Count queries for member_count and song_count
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (v: unknown) => unknown) =>
          Promise.resolve({ count: 5, error: null }).then(resolve)
        ),
      };
    });

    const req = makeNextRequest({ url: "http://localhost/api/platform/tenants" });
    const res = await getTenantsRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect((body[0] as Record<string, unknown>).slug).toBe("wcc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/platform/tenants (provision)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/platform/tenants", () => {
  it("returns 403 for non-platform admin", async () => {
    mockRequirePlatformAdmin.mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/platform/tenants",
      body: { name: "Grace Church", slug: "grace", admin_email: "a@b.com", admin_name: "Alice" },
    });
    const res = await postTenantsRoute(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/platform/tenants",
      body: { name: "Grace Church" }, // missing slug, admin_email, admin_name
    });
    const res = await postTenantsRoute(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug contains invalid characters", async () => {
    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/platform/tenants",
      body: { name: "Grace Church", slug: "Grace Church!", admin_email: "a@b.com", admin_name: "Alice" },
    });
    const res = await postTenantsRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/slug/i);
  });

  it("returns 201 with org_id on successful provisioning", async () => {
    const newOrgId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    mockSupabase.rpc.mockResolvedValue({ data: newOrgId, error: null });

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/platform/tenants",
      body: { name: "Grace Church", slug: "grace", admin_email: "a@grace.org", admin_name: "Alice" },
    });
    const res = await postTenantsRoute(req);
    expect(res.status).toBe(201);
    const body = await res.json() as { org_id: string };
    expect(body.org_id).toBe(newOrgId);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("provision_tenant", {
      p_name: "Grace Church",
      p_slug: "grace",
      p_admin_email: "a@grace.org",
      p_admin_name: "Alice",
    });
  });

  it("returns 409 on duplicate slug (Postgres unique violation)", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    const req = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/platform/tenants",
      body: { name: "WCC Copy", slug: "wcc", admin_email: "x@wcc.org", admin_name: "Bob" },
    });
    const res = await postTenantsRoute(req);
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/wcc/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/platform/tenants/[id]/features
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/platform/tenants/[id]/features", () => {
  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  it("returns 403 for non-platform admin", async () => {
    mockRequirePlatformAdmin.mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const req = makeNextRequest({
      url: `http://localhost/api/platform/tenants/${ORG_ID}/features`,
    });
    const res = await getFeaturesRoute(req, { params: Promise.resolve({ id: ORG_ID }) });
    expect(res.status).toBe(403);
  });

  it("returns merged flags (override takes precedence)", async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // feature_flags query
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve({
              data: [
                { id: "f1", flag_key: "roster", label: "Roster Manager", description: null, default_enabled: true },
                { id: "f2", flag_key: "handbook", label: "Team Handbook", description: null, default_enabled: false },
              ],
              error: null,
            }).then(resolve)
          ),
        };
      }
      // organization_features query
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data: [{ flag_id: "f2", enabled: true }], // override handbook to enabled
            error: null,
          }).then(resolve)
        ),
      };
    });

    const req = makeNextRequest({
      url: `http://localhost/api/platform/tenants/${ORG_ID}/features`,
    });
    const res = await getFeaturesRoute(req, { params: Promise.resolve({ id: ORG_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ flag_key: string; enabled: boolean }>;
    const roster = body.find((f) => f.flag_key === "roster");
    const handbook = body.find((f) => f.flag_key === "handbook");
    expect(roster?.enabled).toBe(true);   // default = true
    expect(handbook?.enabled).toBe(true); // override from false → true
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/platform/tenants/[id]/features
// ─────────────────────────────────────────────────────────────────────────────

describe("PUT /api/platform/tenants/[id]/features", () => {
  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  it("returns 403 for non-platform admin", async () => {
    mockRequirePlatformAdmin.mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const req = makeNextRequest({
      method: "PUT",
      url: `http://localhost/api/platform/tenants/${ORG_ID}/features`,
      body: { flag_key: "handbook", enabled: true },
    });
    const res = await putFeaturesRoute(req, { params: Promise.resolve({ id: ORG_ID }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when flag_key or enabled is missing", async () => {
    const req = makeNextRequest({
      method: "PUT",
      url: `http://localhost/api/platform/tenants/${ORG_ID}/features`,
      body: { flag_key: "handbook" }, // missing enabled
    });
    const res = await putFeaturesRoute(req, { params: Promise.resolve({ id: ORG_ID }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown flag_key", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      ),
    });

    const req = makeNextRequest({
      method: "PUT",
      url: `http://localhost/api/platform/tenants/${ORG_ID}/features`,
      body: { flag_key: "nonexistent", enabled: true },
    });
    const res = await putFeaturesRoute(req, { params: Promise.resolve({ id: ORG_ID }) });
    expect(res.status).toBe(404);
  });

  it("upserts the feature flag override and returns ok", async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // flag lookup by flag_key
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: { id: "f2" }, error: null }).then(resolve)
          ),
        };
      }
      // upsert call
      return {
        upsert: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve)
        ),
      };
    });

    const req = makeNextRequest({
      method: "PUT",
      url: `http://localhost/api/platform/tenants/${ORG_ID}/features`,
      body: { flag_key: "handbook", enabled: true },
    });
    const res = await putFeaturesRoute(req, { params: Promise.resolve({ id: ORG_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
