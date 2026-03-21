// @vitest-environment node
/**
 * Unit tests — isFeatureEnabled & getEnabledFeatures
 * src/lib/server/feature-flags.ts
 *
 * Covers flag resolution order:
 *   1. Explicit organization_features override (enabled or disabled)
 *   2. Fallback to feature_flags.default_enabled
 *   3. Fail-closed on unknown flag key
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────
const { mockFrom, mockClient } = vi.hoisted(() => {
  const query: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "maybeSingle"] as const;
  methods.forEach((m) => {
    query[m] = vi.fn().mockReturnValue(query);
  });
  // Default: resolves with no data
  (query as Record<string, unknown>).then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );

  const mockFrom = vi.fn().mockReturnValue(query);
  const mockClient = { from: mockFrom };
  return { mockFrom, mockClient };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue(mockClient),
}));

vi.mock("server-only", () => ({}));

// Set required env vars before importing the module
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

const { isFeatureEnabled, getEnabledFeatures } = await import(
  "@/lib/server/feature-flags"
);

// Helper: make the Supabase query chain resolve with a specific value
function mockQueryResult(data: unknown, error: unknown = null) {
  const chain = mockFrom.mock.results[mockFrom.mock.results.length - 1]?.value as
    | Record<string, ReturnType<typeof vi.fn>>
    | undefined;
  if (!chain) return;
  // Attach a custom `.then` on the chain so `await supabase.from(...).select(...).xxx` resolves
  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset chain: each method returns the chain itself
  const query: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "maybeSingle"] as const;
  methods.forEach((m) => {
    (query as Record<string, ReturnType<typeof vi.fn>>)[m] = vi.fn().mockReturnValue(query);
  });
  query.then = vi.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
  mockFrom.mockReturnValue(query);
});

// ─────────────────────────────────────────────────────────────────────────────

describe("isFeatureEnabled", () => {
  it("returns true when organization_features override is enabled=true", async () => {
    // Simulate the joined query returning a flag row with an override
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({
          data: {
            flag_key: "roster",
            default_enabled: false,
            organization_features: [{ organization_id: TENANT_A, enabled: true }],
          },
          error: null,
        }).then(resolve)
      ),
    });

    const result = await isFeatureEnabled(TENANT_A, "roster");
    expect(result).toBe(true);
  });

  it("returns false when organization_features override is enabled=false", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({
          data: {
            flag_key: "handbook",
            default_enabled: true, // default is true
            organization_features: [{ organization_id: TENANT_A, enabled: false }], // override disabled
          },
          error: null,
        }).then(resolve)
      ),
    });

    const result = await isFeatureEnabled(TENANT_A, "handbook");
    expect(result).toBe(false);
  });

  it("falls back to default_enabled=true when no override exists", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({
          data: {
            flag_key: "songs",
            default_enabled: true,
            organization_features: [], // no override
          },
          error: null,
        }).then(resolve)
      ),
    });

    const result = await isFeatureEnabled(TENANT_A, "songs");
    expect(result).toBe(true);
  });

  it("falls back to default_enabled=false when no override exists", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({
          data: {
            flag_key: "ai_roster",
            default_enabled: false,
            organization_features: [],
          },
          error: null,
        }).then(resolve)
      ),
    });

    const result = await isFeatureEnabled(TENANT_A, "ai_roster");
    expect(result).toBe(false);
  });

  it("returns false for an unknown flag key (fail-closed)", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      ),
    });

    const result = await isFeatureEnabled(TENANT_A, "nonexistent_flag");
    expect(result).toBe(false);
  });

  it("returns false when missing env vars (fail-closed)", async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    // Re-import to pick up the changed env (module is cached, but the check is inline)
    // We test via the already-imported function — it reads env at call time
    const result = await isFeatureEnabled(TENANT_A, "roster");
    expect(result).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getEnabledFeatures", () => {
  it("returns enabled flag_keys for the tenant", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => unknown) =>
        Promise.resolve({
          data: [
            {
              flag_key: "roster",
              default_enabled: true,
              organization_features: [{ organization_id: TENANT_A, enabled: true }],
            },
            {
              flag_key: "handbook",
              default_enabled: false,
              organization_features: [{ organization_id: TENANT_A, enabled: false }],
            },
            {
              flag_key: "songs",
              default_enabled: true,
              organization_features: [],
            },
          ],
          error: null,
        }).then(resolve)
      ),
    });

    const result = await getEnabledFeatures(TENANT_A);
    expect(result).toEqual(expect.arrayContaining(["roster", "songs"]));
    expect(result).not.toContain("handbook");
  });

  it("returns empty array on error (fail-closed)", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((_resolve: unknown, reject: (v: unknown) => unknown) =>
        Promise.reject(new Error("DB down")).catch(reject)
      ),
    });

    const result = await getEnabledFeatures(TENANT_A);
    expect(result).toEqual([]);
  });
});
