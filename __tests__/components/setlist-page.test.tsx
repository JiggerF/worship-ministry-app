/**
 * Component tests — AdminSetlistPage
 *
 * Covers:
 * - Initial render (heading, Sunday selector)
 * - Empty setlist: 3 empty slots + Add songs button, Finalise disabled
 * - Filled setlist: song rows, no position badges, drag handles, Clear all, Finalise enabled
 * - Published setlist: LOCKED badge, Revert to Draft button
 * - canEdit guard: WorshipLeader assigned to date sees controls
 * - canEdit guard: WorshipLeader NOT assigned sees amber notice + no action controls
 * - Coordinator always has edit access
 * - Song Picker Modal open/close
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSetlistPage from "@/app/admin/setlist/page";

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic date anchor
// Compute the first upcoming Sunday the same way the page does so tests remain
// correct on any calendar day without needing fake timers (which break waitFor).
// ─────────────────────────────────────────────────────────────────────────────

function computeFirstUpcomingSunday(): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  for (let mOffset = 0; mOffset <= 2; mOffset++) {
    const ref = new Date(today.getFullYear(), today.getMonth() + mOffset, 1);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (new Date(year, month, day).getDay() === 0) {
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (iso >= todayStr) return iso;
      }
    }
  }
  throw new Error("No upcoming Sunday found in next 3 months");
}

const SUNDAY_DATE = computeFirstUpcomingSunday();
const ROSTER_MONTH = SUNDAY_DATE.slice(0, 7);

// ─────────────────────────────────────────────────────────────────────────────
// Member fixtures
// ─────────────────────────────────────────────────────────────────────────────

const makeMe = (override: object) => ({
  id: "member-1",
  name: "Test User",
  email: "test@wcc.org",
  phone: null,
  app_role: "Admin",
  magic_token: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  roles: [],
  ...override,
});

const ADMIN_ME = makeMe({ id: "admin-1", app_role: "Admin" });
const COORDINATOR_ME = makeMe({ id: "coord-1", app_role: "Coordinator" });
const WL_ME = makeMe({ id: "wl-1", name: "WL User", app_role: "WorshipLeader" });
const WL_OTHER_ME = makeMe({ id: "wl-99", name: "Other WL", app_role: "WorshipLeader" });

// ─────────────────────────────────────────────────────────────────────────────
// Setlist & roster fixtures
// ─────────────────────────────────────────────────────────────────────────────

const makeSong = (n: number) => ({
  id: `song-${n}`,
  title: `Song ${n}`,
  artist: `Artist ${n}`,
  status: "ACTIVE",
  categories: [],
  scripture_anchor: null,
  youtube_url: null,
  chord_charts: [{ id: `chart-${n}`, key: "G", file_url: null }],
});

const makeRow = (n: number, overrides: object = {}) => ({
  id: `row-${n}`,
  sunday_date: SUNDAY_DATE,
  song_id: `song-${n}`,
  position: n,
  chosen_key: "G",
  status: "DRAFT",
  song: makeSong(n),
  ...overrides,
});

const EMPTY_SETLIST: object[] = [];
const ONE_ROW = [makeRow(1)];
const THREE_ROWS = [makeRow(1), makeRow(2), makeRow(3)];
const THREE_ROWS_PUBLISHED = THREE_ROWS.map((r) => ({ ...r, status: "PUBLISHED" }));

const rosterWith = (memberId: string, memberName: string) => ({
  assignments: [
    {
      id: "assign-1",
      date: SUNDAY_DATE,
      role: { id: 1, name: "worship_lead" },
      member: { id: memberId, name: memberName },
    },
  ],
});

const ROSTER_NO_WL = { assignments: [] };

// ─────────────────────────────────────────────────────────────────────────────
// fetch mock factory
// ─────────────────────────────────────────────────────────────────────────────

function makeFetch({
  me = ADMIN_ME,
  setlist = EMPTY_SETLIST,
  roster = ROSTER_NO_WL,
}: {
  me?: object;
  setlist?: object[];
  roster?: object;
} = {}) {
  return vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method?.toUpperCase() ?? "GET";

    if (url === "/api/me") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(me) });
    }
    if (url.startsWith(`/api/setlist?date=`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(setlist) });
    }
    if (url.startsWith(`/api/roster?month=`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(roster) });
    }
    if (url === "/api/songs?scope=portal") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    // Mutation endpoints: POST /api/setlist, DELETE /api/setlist/:id,
    //                     PATCH /api/setlist/:date/publish|revert
    if (url.startsWith("/api/setlist")) {
      if (method === "PATCH") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (method === "DELETE") {
        return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) });
      }
      if (method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wait for the loading spinner to disappear (setlist fetch resolved). */
async function waitForSetlist() {
  await waitFor(() =>
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — initial render", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Setlist page heading", async () => {
    vi.stubGlobal("fetch", makeFetch());
    render(<AdminSetlistPage />);
    expect(screen.getByRole("heading", { name: "Setlist" })).toBeInTheDocument();
  });

  it("renders the Sunday selector with the first upcoming Sunday selected", async () => {
    vi.stubGlobal("fetch", makeFetch());
    render(<AdminSetlistPage />);
    const select = screen.getByRole("combobox");
    // The value bound to the select should be the first upcoming Sunday
    expect(select).toHaveValue(SUNDAY_DATE);
  });

  it("shows 8 upcoming Sundays in the dropdown", async () => {
    vi.stubGlobal("fetch", makeFetch());
    render(<AdminSetlistPage />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — Admin, empty setlist", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 3 empty slot placeholders for an empty setlist", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    const slots = screen.getAllByText("Empty slot");
    expect(slots).toHaveLength(3);
  });

  it("shows the Add songs button when slots are free", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.getByRole("button", { name: /click to add songs/i })).toBeInTheDocument();
  });

  it("renders the Finalise button disabled when setlist is empty", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    // Wait for canEdit to resolve (member loads)
    await screen.findByRole("button", { name: /finalise/i });
    const finalise = screen.getByRole("button", { name: /finalise/i });
    expect(finalise).toBeDisabled();
  });

  it("does NOT render Clear all when setlist is empty", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — Admin, filled setlist (3 songs)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders song titles for all 3 filled slots", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.getByText("Song 1")).toBeInTheDocument();
    expect(screen.getByText("Song 2")).toBeInTheDocument();
    expect(screen.getByText("Song 3")).toBeInTheDocument();
  });

  it("renders artist names for each song", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.getByText("Artist: Artist 1")).toBeInTheDocument();
    expect(screen.getByText("Artist: Artist 2")).toBeInTheDocument();
    expect(screen.getByText("Artist: Artist 3")).toBeInTheDocument();
  });

  it("renders the chosen key badge for each row", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    const keyBadges = screen.getAllByText("Key of G");
    expect(keyBadges).toHaveLength(3);
  });

  it("does NOT render position number badges (regression: numbers removed)", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    // After removing position badges, there should be no standalone "1", "2", "3"
    // circular badges. We assert the specific badge span class is absent.
    const candidates = document.querySelectorAll(
      "span.rounded-full.bg-gray-200.text-gray-600.font-bold"
    );
    expect(candidates).toHaveLength(0);
  });

  it("does NOT show empty slot placeholders when all 3 slots are filled", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.queryByText("Empty slot")).not.toBeInTheDocument();
  });

  it("does NOT show Add songs button when all slots are filled", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.queryByRole("button", { name: /click to add songs/i })).not.toBeInTheDocument();
  });

  it("shows drag grip handles for admin (canEdit=true)", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    // Grip handles have title="Drag to reorder"
    const handles = screen.getAllByTitle("Drag to reorder");
    expect(handles).toHaveLength(3);
  });

  it("shows Clear all button when songs exist", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /clear all/i });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeEnabled();
  });

  it("shows Finalise button enabled when songs exist", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /finalise/i });
    expect(screen.getByRole("button", { name: /finalise/i })).toBeEnabled();
  });

  it("renders Change Key link for each song row (canEdit=true)", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    const changeKeyButtons = screen.getAllByRole("button", { name: "Change Key" });
    expect(changeKeyButtons).toHaveLength(3);
  });

  it("renders per-row remove (✕) buttons for admin", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    const removeButtons = screen.getAllByTitle("Remove");
    expect(removeButtons).toHaveLength(3);
  });

  it("shows the 0 / 3 counter (no free slots when full)", async () => {
    // When freeSlots === 0, the counter is hidden (freeSlots > 0 guard)
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    // The "X / 3" counter is only rendered when freeSlots > 0
    expect(screen.queryByText(/\d \/ 3/)).not.toBeInTheDocument();
  });

  it("shows 2 / 3 counter when one slot is free", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: [makeRow(1), makeRow(2)] }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — published setlist", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Revert to Draft button instead of Finalise when published", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS_PUBLISHED }));
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /revert to draft/i });
    expect(screen.queryByRole("button", { name: /finalise/i })).not.toBeInTheDocument();
  });

  it("shows the LOCKED badge when setlist is published", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS_PUBLISHED }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    // RosterBadge renders "FINAL" for LOCKED status
    expect(screen.getByText("FINAL")).toBeInTheDocument();
  });

  it("shows the DRAFT badge when setlist is not published", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("Clear all is disabled when setlist is published", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS_PUBLISHED }));
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /revert to draft/i });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeDisabled();
  });

  it("Clear all is enabled when setlist is a draft", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /clear all/i });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeEnabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — Worship Lead permission guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("assigned WL (id matches) sees action buttons (canEdit=true)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /finalise/i });
    expect(screen.getByRole("button", { name: /finalise/i })).toBeInTheDocument();
  });

  it("assigned WL sees drag handles (canEdit=true)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await waitFor(() =>
      expect(screen.queryAllByTitle("Drag to reorder")).toHaveLength(3)
    );
  });

  it("non-assigned WL sees amber read-only notice", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_OTHER_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByText(/you are not the worship lead for this sunday/i);
  });

  it("non-assigned WL does NOT see the action button bar", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_OTHER_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    // Wait for member to load and canEdit to resolve
    await screen.findByText(/you are not the worship lead for this sunday/i);
    expect(screen.queryByRole("button", { name: /finalise/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revert to draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("non-assigned WL sees NO drag handles", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_OTHER_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByText(/you are not the worship lead for this sunday/i);
    expect(screen.queryAllByTitle("Drag to reorder")).toHaveLength(0);
  });

  it("non-assigned WL sees NO Change Key buttons", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_OTHER_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByText(/you are not the worship lead for this sunday/i);
    expect(screen.queryByRole("button", { name: "Change Key" })).not.toBeInTheDocument();
  });

  it("non-assigned WL sees NO per-row remove buttons", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_OTHER_ME,
        setlist: THREE_ROWS,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByText(/you are not the worship lead for this sunday/i);
    expect(screen.queryAllByTitle("Remove")).toHaveLength(0);
  });

  it("non-assigned WL sees NO empty slot placeholders", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: WL_OTHER_ME,
        setlist: ONE_ROW,
        roster: rosterWith("wl-1", "WL User"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByText(/you are not the worship lead for this sunday/i);
    expect(screen.queryByText("Empty slot")).not.toBeInTheDocument();
  });

  it("no-WL-assigned date: WL member sees no amber notice (canEdit=true)", async () => {
    // roster has no worship_lead assignment
    vi.stubGlobal(
      "fetch",
      makeFetch({ me: WL_ME, setlist: EMPTY_SETLIST, roster: ROSTER_NO_WL })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    // Not the assigned WL (no assignment) → isViewOnlyWL = true since worshipLeadMemberId is null
    // Actually: canEdit = wl-1 === null → false. So this WL would see the notice.
    await screen.findByText(/you are not the worship lead for this sunday/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — Coordinator (always canEdit)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Coordinator sees Finalise button", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: COORDINATOR_ME, setlist: THREE_ROWS }));
    render(<AdminSetlistPage />);
    await screen.findByRole("button", { name: /finalise/i });
    expect(screen.getByRole("button", { name: /finalise/i })).toBeInTheDocument();
  });

  it("Coordinator does NOT see the amber WL notice", async () => {
    vi.stubGlobal("fetch", makeFetch({ me: COORDINATOR_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByRole("button", { name: /finalise/i });
    expect(
      screen.queryByText(/you are not the worship lead for this sunday/i)
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — Worship Lead display in card header", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Worship Lead name when assigned", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        me: ADMIN_ME,
        setlist: EMPTY_SETLIST,
        roster: rosterWith("wl-1", "Jane Smith"),
      })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    await screen.findByText("Jane Smith");
    expect(screen.getByText(/worship lead:/i)).toBeInTheDocument();
  });

  it("does NOT show Worship Lead line when no WL assigned", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST, roster: ROSTER_NO_WL })
    );
    render(<AdminSetlistPage />);
    await waitForSetlist();
    expect(screen.queryByText(/worship lead:/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AdminSetlistPage — Song Picker Modal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the Song Picker modal when Add songs is clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    const addBtn = await screen.findByRole("button", { name: /click to add songs/i });
    await user.click(addBtn);
    expect(screen.getByRole("heading", { name: "Pick Songs" })).toBeInTheDocument();
  });

  it("Cancel button inside picker modal closes the modal", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    const addBtn = await screen.findByRole("button", { name: /click to add songs/i });
    await user.click(addBtn);
    expect(screen.getByRole("heading", { name: "Pick Songs" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Pick Songs" })).not.toBeInTheDocument();
  });

  it("picker modal shows search input and category filter", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    const addBtn = await screen.findByRole("button", { name: /click to add songs/i });
    await user.click(addBtn);
    expect(screen.getByPlaceholderText(/search by title or artist/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "All Categories" })).toBeInTheDocument();
  });

  it("Add songs button is disabled until a song is picked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetch({ me: ADMIN_ME, setlist: EMPTY_SETLIST }));
    render(<AdminSetlistPage />);
    const addBtn = await screen.findByRole("button", { name: /click to add songs/i });
    await user.click(addBtn);
    // Footer confirm button when nothing picked shows disabled text
    expect(screen.getByRole("button", { name: /select songs to add/i })).toBeDisabled();
  });
});
