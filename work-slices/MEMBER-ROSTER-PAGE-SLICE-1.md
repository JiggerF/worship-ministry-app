

# MVP 1
## Slice 1 Instruction
Your mission is a thin vertical slice to make the Members Portal roster page match the provided Figma design and behavior rules.
Goal:
Implement only what is required so that src/app/portal/roster/page.tsx renders the roster page as per Figma, driven by real API data from /api/roster?month=YYYY-MM.

Non-negotiable constraints
	1.	DO NOT modify database migrations, schema, or Supabase tables. Treat the schema as fixed.
	2.	DO NOT rename types or change type definitions in src/lib/types/database.ts. Assume types are canonical.
	3.	Prefer minimal changes outside the roster vertical slice.
	4.	You MAY modify:
	•	src/app/portal/roster/page.tsx (primary)
	•	src/components/sunday-card.tsx (only if needed to accept correct typed shape)
	•	src/app/api/roster/route.ts (only if necessary to make it conform to schema/types and return correct shape)
	•	Any files inside the Figma-exported folder you are instructed to use (see below)
	5.	Avoid as any and “type hacks”. If a mismatch exists, fix by aligning API response and/or using small mapping layers.
Inputs you must use
Figma design resources
	•	Guidelines: figma/roster-page/guidelines/Guidelines.md
	•	Components/styles TSX: figma/roster-page/src/**

Use these to implement the UI. Do not deviate from layout, spacing, fonts, or button styles unless strictly necessary.
Required UX behavior (must implement)

1) Upcoming Sunday logic (Melbourne Time)
	•	“Upcoming week” roster card should appear first in the list and be visually highlighted with the rounded black border box like in Figma.
	•	The “upcoming Sunday” is determined by Australia/Melbourne time, using these rules:

Rule A (before Sunday 12:00 PM Melbourne time):
	•	Upcoming Sunday is the nearest coming Sunday.
	•	Example: if today is Thu 19 Feb 2026, user expects to see Sun 22 Feb 2026 highlighted.

Rule B (at or after Sunday 12:00 PM Melbourne time):
	•	The “upcoming” becomes the next Sunday (T+7 days).
	•	Example: at Sun 22 Feb 2026 12:00 PM Melbourne time, the page should bump and highlight Sun 1 Mar 2026.

Implementation detail:
	•	If “now” is Sunday and time >= 12:00, upcoming = next Sunday.
	•	Otherwise upcoming = next Sunday on/after now.

2) Scrollability and default positioning
	•	Page is scrollable showing past and future Sunday cards for the selected month(s).
	•	It should default scroll to the upcoming week card (centered) after render.
	•	The upcoming card should also be the first card in the rendered list (even if it’s not the earliest date).

3) Status indicators (Prominent)
	•	If roster status is:
	•	LOCKED → show Green badge “FINAL”
	•	DRAFT → show Yellow badge “DRAFT”
	•	This badge must be visually prominent like the Figma example.

Notes:
	•	DB status is DRAFT | LOCKED (uppercase).
	•	UI badge text: “DRAFT” and “FINAL”.

4) Member view must be read-only
	•	Members can view but cannot edit.
	•	No dropdowns, no edit controls on portal roster.

Data requirements (must be real)
	•	The portal roster must load assignments via:
GET /api/roster?month=YYYY-MM
	•	Month selector shows current month + next month (based on Melbourne time), matching your Figma two-tab UX.
	•	For each Sunday in the month:
	•	Show card even if empty (but styled per Figma; empty state acceptable if no assignments).
	•	Assignments should show:
	•	Role label (short label like AG/VOC/KEYS etc per design constants)
	•	Member name
	•	Songs section: if setlist isn’t implemented yet, you may show the section with default text to indicate no assigned song yet; 
    Verify schema/type alignment (you must do this)

Before coding, verify the actual table names and columns used by /api/roster.

Expected schema (do not change):
	•	Table: public.roster
	•	date (date)
	•	role_id (int FK roles.id)
	•	member_id (uuid nullable FK members.id)
	•	status (text: DRAFT | LOCKED)
	•	assigned_at, locked_at
	•	Join with:
	•	roles → roles.id, roles.name
	•	members → members.id, members.name

If /api/roster/route.ts currently queries the wrong table or wrong fields (e.g., roster_assignments or role string), fix it to query public.roster and return the correct shape.

Return payload should be consistent and typed:
	•	For each assignment:
	•	id
	•	date
	•	member_id
	•	status as DRAFT | LOCKED
	•	role: { id, name }
	•	member?: { id, name } (nullable if unassigned)

Deliverables
	1.	A working portal roster page at:
	•	src/app/portal/roster/page.tsx
	2.	Uses Figma resources from:
	•	figma/roster-page/src/** and Guidelines.md
	3.	Correct “upcoming Sunday” logic in Melbourne time, including Sunday noon cutoff.
	4.	Correct “FINAL/DRAFT” badges.
	5.	Read-only members UX.
	6.	No schema/type edits. No any hacks.

Acceptance tests (you must pass these)
	1.	If today is Thu Feb 19 2026 (Melbourne time), the highlighted upcoming card is Sun Feb 22 2026.
	2.	If time is Sun Feb 22 2026 11:59 AM, highlight Feb 22.
	3.	If time is Sun Feb 22 2026 12:00 PM, highlight Mar 1 2026.
	4.	Upcoming card is rendered first and page scrolls to it on load.
	5.	LOCKED shows green “FINAL”, DRAFT shows yellow “DRAFT”.

⸻

Implementation hints (allowed)
	•	Use Intl.DateTimeFormat with timeZone: "Australia/Melbourne" to compute local date parts safely.
	•	Build helper functions in src/app/portal/roster/page.tsx:
	•	getMelbourneNowParts()
	•	getUpcomingSundayISO(melbourneNow)
	•	isSundayAfterNoon(melbourneNow)
	•	Structure roster by Sundays using getSundaysInMonth.

⸻

Output format
	•	Provide the final code for:
	•	src/app/portal/roster/page.tsx
	•	If you changed any other file, include full file contents too.
	•	Briefly explain what you changed and why, but keep it minimal.