/**
 * Shared fixtures and fetch factory for intent tests.
 *
 * Pattern mirrors __tests__/components/people-page.test.tsx exactly —
 * do not invent new patterns here.
 */
import { vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Member fixtures — one per AppRole
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_MEMBER = {
  id: "admin-1",
  name: "Test Admin",
  email: "admin@wcc.org",
  phone: null,
  app_role: "Admin",
  magic_token: "token-admin",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  roles: [],
};

export const COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "coord-1",
  name: "Test Coordinator",
  email: "coord@wcc.org",
  app_role: "Coordinator",
  magic_token: "token-coord",
};

export const MUSIC_COORDINATOR_MEMBER = {
  ...ADMIN_MEMBER,
  id: "mc-1",
  name: "Music Coordinator",
  email: "mc@wcc.org",
  app_role: "MusicCoordinator",
  magic_token: "token-mc",
};

export const WORSHIP_LEADER_MEMBER = {
  ...ADMIN_MEMBER,
  id: "wl-1",
  name: "Worship Leader",
  email: "wl@wcc.org",
  app_role: "WorshipLeader",
  magic_token: "token-wl",
};

export const MUSICIAN_MEMBER = {
  ...ADMIN_MEMBER,
  id: "musician-1",
  name: "Test Musician",
  email: "musician@wcc.org",
  app_role: "Musician",
  magic_token: "token-musician",
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic mock data
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SONGS = [
  {
    id: "s1",
    title: "Amazing Grace",
    artist: "John Newton",
    status: "published",
    tenant_id: "",
    categories: ["adoration_worship"],
    youtube_url: null,
    scripture_anchor: null,
    created_at: "2026-01-01T00:00:00Z",
    chord_charts: [
      {
        id: "cc1",
        song_id: "s1",
        key: "G",
        file_url: null,
        storage_path: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  },
  {
    id: "s2",
    title: "How Great Is Our God",
    artist: "Chris Tomlin",
    status: "learning",
    tenant_id: "",
    categories: ["praise_upbeat"],
    youtube_url: null,
    scripture_anchor: null,
    created_at: "2026-01-02T00:00:00Z",
    chord_charts: [],
  },
];

export const MOCK_MEMBERS = [
  ADMIN_MEMBER,
  {
    ...MUSICIAN_MEMBER,
    roles: ["acoustic_guitar"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// makeFetch factory
//
// Matches the signature from people-page.test.tsx but with a flexible overrides
// map so intent tests can mock any additional endpoints they need.
//
// overrides: Record<string, object | object[]>
//   key   = URL prefix to match (e.g. "/api/members", "/api/songs")
//   value = the response body that will be returned as JSON
//
// Fallback for unmatched URLs: { ok: false, json: () => Promise.resolve({}) }
// ─────────────────────────────────────────────────────────────────────────────

export function makeFetch(
  meResponse: object,
  overrides: Record<string, object | object[]> = {}
): ReturnType<typeof vi.fn> {
  return vi.fn((url: string) => {
    if (url === "/api/me") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(meResponse),
      });
    }

    // Check overrides by prefix match (longest first for specificity)
    const sortedKeys = Object.keys(overrides).sort((a, b) => b.length - a.length);
    for (const prefix of sortedKeys) {
      if (url === prefix || url.startsWith(prefix)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(overrides[prefix]),
        });
      }
    }

    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}
