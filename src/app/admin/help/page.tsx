"use client";

import { useState } from "react";

type RoleKey = "coordinator" | "worship-lead" | "music-coordinator";

const ROLES: Array<{ key: RoleKey; label: string; icon: string; subtitle: string }> = [
  {
    key: "coordinator",
    label: "Worship Coordinator",
    icon: "📋",
    subtitle: "Manages the roster, availability, and team scheduling",
  },
  {
    key: "worship-lead",
    label: "Worship Lead",
    icon: "🎤",
    subtitle: "Leads worship on Sundays and selects songs for the setlist",
  },
  {
    key: "music-coordinator",
    label: "Music Coordinator",
    icon: "🎶",
    subtitle: "Curates setlists and manages song selections for each Sunday",
  },
];

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </div>
      <div className="flex-1 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <div className="text-sm text-gray-600 space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
      <span className="flex-shrink-0">💡</span>
      <span>{children}</span>
    </div>
  );
}

function AccessBadge({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${allowed ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-400 border border-gray-200"}`}>
      {allowed ? "✓" : "✗"} {label}
    </span>
  );
}

import React from "react";

export default function AdminHelpPage() {
  const [activeRole, setActiveRole] = useState<RoleKey>("coordinator");

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Help & Workflow Guide</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Step-by-step guides to replace the manual spreadsheet and Google Form workflows. Select your role below.
        </p>
      </div>

      {/* Role Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {ROLES.map((role) => (
          <button
            key={role.key}
            onClick={() => setActiveRole(role.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              activeRole === role.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span>{role.icon}</span>
            {role.label}
          </button>
        ))}
      </div>

      {/* ── Worship Coordinator ── */}
      {activeRole === "coordinator" && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Worship Coordinator</h2>
            <p className="text-sm text-gray-600 mb-3">
              You replace the manual spreadsheet + Google Form workflow. You manage who serves each Sunday, collect availability from the team, and lock in the roster before each month begins.
            </p>
            <div className="flex flex-wrap gap-2">
              <AccessBadge label="Roster (edit)" allowed={true} />
              <AccessBadge label="Availability" allowed={true} />
              <AccessBadge label="Setlist" allowed={true} />
              <AccessBadge label="Song Manager (view)" allowed={true} />
              <AccessBadge label="People (view)" allowed={true} />
              <AccessBadge label="Settings" allowed={false} />
              <AccessBadge label="Audit Log" allowed={false} />
            </div>
          </div>

          <div className="space-y-0">
            <Step number={1} title="Open a new Availability Period (every 2 months)">
              <p>Instead of sending a Google Form manually, create a period in the app:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Availability</strong> in the sidebar.</li>
                <li>Click <strong>+ New Period</strong>.</li>
                <li>Enter a label (e.g. <em>Apr–May 2026</em>), start date (first Sunday of the first month), end date (last Sunday of the last month), and a response deadline.</li>
                <li>Click <strong>Open Period</strong>. The app will track this period and suggest the next one automatically.</li>
              </ol>
              <Tip>The app suggests the next period dates based on the last closed period — you won&apos;t need to calculate dates manually.</Tip>
            </Step>

            <Step number={2} title="Send magic links to musicians">
              <p>Each musician has a unique personal link — no account needed. This replaces the Google Form link you used to blast via Viber.</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>People</strong> in the sidebar.</li>
                <li>Find the musician and click <strong>Copy Link</strong> next to their name.</li>
                <li>Paste and send it to them via Viber or WhatsApp.</li>
              </ol>
              <p className="mt-2">Each link is permanent and tied to that person — they can use the same link for every new period.</p>
              <Tip>Add new team members via the Admin account if someone&apos;s link is missing from People.</Tip>
            </Step>

            <Step number={3} title="Track who has responded">
              <p>Instead of chasing people through WhatsApp to confirm who filled in the form:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Availability</strong> and click on the open period.</li>
                <li>The detail page shows each musician&apos;s response status per Sunday.</li>
                <li>Follow up manually (Viber/WhatsApp) with anyone who hasn&apos;t responded before the deadline.</li>
              </ol>
            </Step>

            <Step number={4} title="Build the Roster">
              <p>Instead of filling in a spreadsheet, use the roster grid:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Roster Manager</strong> and navigate to the correct month.</li>
                <li>Each row is a Sunday. Each column is a role (Worship Lead, Vocals, Guitar, Bass, Keys, Drums, etc.).</li>
                <li>Click the dropdown for any cell to assign a musician. The dropdown is grouped:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li><strong>✓ Available</strong> — confirmed they can serve that Sunday</li>
                    <li><strong>— No response</strong> — haven&apos;t replied yet</li>
                    <li><strong>✗ Unavailable</strong> — said they can&apos;t make it</li>
                  </ul>
                </li>
                <li>Watch for warning icons:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li><strong>⚠ amber</strong> — you&apos;ve assigned someone who marked themselves unavailable</li>
                    <li><strong>⚠ red</strong> — the same person is assigned to two roles on the same Sunday</li>
                  </ul>
                </li>
              </ol>
              <Tip>Only musicians who have that instrument role set in their People profile will appear in each column&apos;s dropdown.</Tip>
            </Step>

            <Step number={5} title="Save Draft and Finalise">
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Click <strong>Save Draft</strong> at any time to save your progress — it won&apos;t be visible to musicians yet.</li>
                <li>Once all roles are filled and you&apos;re ready, click <strong>Finalise</strong> to publish the roster. Musicians can then see it on the portal.</li>
                <li>After the 20th of the month, assignments are automatically locked. If an urgent change is needed after that, you can still swap a locked assignment by clicking the cell, choosing a replacement, and providing a reason — this is called an &ldquo;emergency swap&rdquo; (not a separate feature or button).</li>
              </ol>
            </Step>

            <Step number={6} title="Close the Availability Period">
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Once you&apos;ve collected enough responses and finalized the roster, go back to <strong>Availability</strong>.</li>
                <li>Click on the open period and then click <strong>Close Period</strong>.</li>
                <li>This marks it as completed and lets the app suggest the next period automatically.</li>
              </ol>
            </Step>
          </div>
        </div>
      )}

      {/* ── Worship Lead ── */}
      {activeRole === "worship-lead" && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Worship Lead</h2>
            <p className="text-sm text-gray-600 mb-3">
              You lead worship on assigned Sundays. Your main job in this app is to select the songs for your Sundays and set the keys — replacing the manual process of messaging the coordinator with a song list.
            </p>
            <div className="flex flex-wrap gap-2">
              <AccessBadge label="Roster (view only)" allowed={true} />
              <AccessBadge label="Setlist (edit)" allowed={true} />
              <AccessBadge label="Song Manager (view)" allowed={true} />
              <AccessBadge label="People (view)" allowed={true} />
              <AccessBadge label="Availability" allowed={false} />
              <AccessBadge label="Settings" allowed={false} />
            </div>
          </div>

          <div className="space-y-0">
            <Step number={1} title="Check which Sundays you're leading">
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Roster Manager</strong> in the sidebar.</li>
                <li>Look for your name in the <strong>Worship Lead</strong> column — each row is one Sunday.</li>
                <li>Use the month navigation arrows to check upcoming months.</li>
              </ol>
              <Tip>You can also see your assigned Sundays in the <strong>Setlist</strong> page — your dates are marked with a ★ indicator in the Sunday dropdown.</Tip>
            </Step>

            <Step number={2} title="Select songs for your Sunday">
              <p>Instead of texting a song list to the coordinator, you add it directly:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Setlist</strong> in the sidebar.</li>
                <li>Select your Sunday from the date dropdown at the top. Your assigned Sundays are marked with ★.</li>
                <li>Click <strong>+ Add Songs</strong>.</li>
                <li>Search by song title or artist. Use the category filter to narrow by <em>Opener, Mid-set, Response</em>, etc.</li>
                <li>Tick the songs you want (typically 3–5) and click <strong>Confirm Selection</strong>.</li>
              </ol>
            </Step>

            <Step number={3} title="Set the key for each song">
              <p>After adding songs, you can set the performance key for each one:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>On the Setlist page, each song shows its default chart key as a badge (e.g. <em>G</em>).</li>
                <li>Click the key badge to open a dropdown and select the key you&apos;ll be leading in.</li>
                <li>The chosen key will be shown on the chord chart PDF that musicians download.</li>
              </ol>
              <Tip>If a song has no chord chart uploaded yet, let the Music Coordinator know so they can add it to the Song Manager.</Tip>
            </Step>

            <Step number={4} title="Download the chord chart PDF">
              <p>You can download all charts for your Sunday as a single compiled PDF:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>On the Setlist page, once songs are set, click <strong>Download PDF Bundle</strong>.</li>
                <li>The PDF includes all chord charts in the keys you selected.</li>
                <li>Share with your team if needed, or they can download it themselves from the musician portal.</li>
              </ol>
            </Step>

            <Step number={5} title="View your team lineup">
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Roster Manager</strong> and find your Sunday row.</li>
                <li>Each column shows the assigned musician for each role — Vocals, Guitar, Bass, Keys, Drums, Sound, Setup.</li>
                <li>If you need a change to the lineup, contact the Worship Coordinator directly.</li>
              </ol>
            </Step>
          </div>
        </div>
      )}

      {/* ── Music Coordinator ── */}
      {activeRole === "music-coordinator" && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Music Coordinator</h2>
            <p className="text-sm text-gray-600 mb-3">
              You are the primary caretaker of the Song Library and setlist quality. You ensure every song in the system is fully set up — chord charts uploaded, YouTube video linked, and all fields accurate. You also help Worship Leads with song selection and keys, and can act as a Worship Lead yourself when rostered.
            </p>
            <div className="flex flex-wrap gap-2">
              <AccessBadge label="Roster (view only)" allowed={true} />
              <AccessBadge label="Setlist (edit)" allowed={true} />
              <AccessBadge label="Song Manager (edit)" allowed={true} />
              <AccessBadge label="People (view)" allowed={true} />
              <AccessBadge label="Availability" allowed={false} />
              <AccessBadge label="Settings" allowed={false} />
            </div>
          </div>

          <div className="space-y-0">
            <Step number={1} title="Maintain the Song Library (your primary responsibility)">
              <p>The Song Manager is yours to keep accurate and up to date:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Song Manager</strong> in the sidebar.</li>
                <li>For each song, ensure these fields are complete: title, artist, category, scripture anchor, YouTube video URL, status, and at least one chord chart uploaded.</li>
                <li>Click <strong>Edit</strong> on any song row to update its details.</li>
                <li>If a chord chart is missing, you are responsible for creating it and uploading it — do not leave a song without one if the team is actively using it.</li>
              </ol>
              <Tip>Songs in <strong>Learning</strong> status are ones the team is still practicing. Move them to <strong>Published</strong> once they are service-ready and have a chord chart.</Tip>
            </Step>

            <Step number={2} title="Approve and onboard new songs">
              <p>New songs must go through Pastoral approval before being used in services:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>The Worship Coordinator creates the song entry in the system (via <strong>Song Manager → + Add Song</strong>).</li>
                <li>Before the song can be used, Pastoral staff must approve it for theological alignment — this happens outside the app (e.g. via conversation or email).</li>
                <li>Once approved, it&apos;s your job to: create or source the chord chart, upload it to the song entry, find and add the YouTube video link, and set the correct status.</li>
                <li>Only move a song to <strong>Published</strong> after it&apos;s been approved and fully set up.</li>
              </ol>
            </Step>

            <Step number={3} title="Help with setlists and song keys">
              <p>You have full edit access to the Setlist page and can assist any Worship Lead:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Setlist</strong> in the sidebar and select the Sunday you want to help with.</li>
                <li>You can add songs, remove songs, or adjust the performance key for any song in the setlist.</li>
                <li>To change a key: find the song&apos;s key badge (e.g. <em>D</em>), click it, and select the correct key from the dropdown.</li>
                <li>Use <strong>Download PDF Bundle</strong> to generate a compiled chord chart PDF in the correct keys for the team.</li>
              </ol>
              <Tip>Coordinate with the Worship Lead before changing keys — they may have specific range preferences for that Sunday.</Tip>
            </Step>

            <Step number={4} title="When you are the Worship Lead for a Sunday">
              <p>If you&apos;re rostered as Worship Lead, your workflow is the same as any Worship Lead:</p>
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Setlist</strong> and select your Sunday — it will be marked with ★ in the dropdown.</li>
                <li>Click <strong>+ Add Songs</strong>, pick your 3–5 songs, and confirm.</li>
                <li>Set the performance key for each song using the key badge.</li>
                <li>Click <strong>✓ Finalise</strong> when the setlist is ready for the team to see.</li>
                <li>Use <strong>Download PDF Bundle</strong> to get all chord charts in a single PDF.</li>
              </ol>
              <Tip>Your assigned Sundays are marked with ★ in the Setlist date dropdown — check the Roster Manager to see all your upcoming dates.</Tip>
            </Step>

            <Step number={5} title="Check the roster for context">
              <ol className="list-decimal pl-4 mt-2 space-y-1">
                <li>Go to <strong>Roster Manager</strong> to see who is leading each Sunday.</li>
                <li>Use this to coordinate with Worship Leads on song choices or keys, and to know in advance which Sundays you&apos;re leading yourself.</li>
                <li>The roster is read-only for your account — contact the Worship Coordinator for any assignment changes.</li>
              </ol>
            </Step>
          </div>
        </div>
      )}
    </div>
  );
}
