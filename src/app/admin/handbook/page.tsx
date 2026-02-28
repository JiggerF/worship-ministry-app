"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AppRole, Member } from "@/lib/types/database";
import type { HandbookDocument, ChangeType } from "@/lib/types/handbook";
import { versionLabel } from "@/lib/types/handbook";

// ─── Auth hook ────────────────────────────────────────────────────────────────

function useCurrentMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setMember(d ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { member, loading };
}

// ─── Handbook permissions hook ────────────────────────────────────────────────

function useHandbookPermissions() {
  const [editorRoles, setEditorRoles] = useState<AppRole[]>(["Admin", "Coordinator"]);
  const [editorMemberIds, setEditorMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/handbook-permissions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) {
          if (d.editor_roles) setEditorRoles(d.editor_roles);
          if (d.editor_member_ids) setEditorMemberIds(d.editor_member_ids);
        }
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { editorRoles, editorMemberIds, loading };
}

// ─── Section navigation ───────────────────────────────────────────────────────

type LeafSection = { label: string; slug: string };
type GroupSection = { label: string; slug: null; children: LeafSection[] };
type Section = LeafSection | GroupSection;

const SECTIONS: Section[] = [
  { label: "Vision & Values", slug: "vision-values" },
  {
    label: "Roles & Responsibilities",
    slug: null,
    children: [
      { label: "Worship Lead", slug: "roles-worship-lead" },
      { label: "Worship Coordinator", slug: "roles-worship-coordinator" },
      { label: "Music Coordinator", slug: "roles-music-coordinator" },
    ],
  },
  { label: "Weekly Rhythm", slug: "weekly-rhythm" },
  { label: "Decision Rights & Escalation", slug: "decision-rights" },
];

const DEFAULT_SLUG = "vision-values";

const ALL_LEAVES: LeafSection[] = SECTIONS.flatMap((s) =>
  "children" in s && s.children ? s.children : [s as LeafSection]
);

// ─── Starter templates ────────────────────────────────────────────────────────

const ROLE_TEMPLATE = `## Purpose
_1–2 sentences: why this role exists._

## Key Responsibilities
- Responsibility 1
- Responsibility 2
- _(5–8 bullets max)_

## Decision Rights
_What this role can decide without asking anyone._
- Decision 1

## Inputs & Outputs
**Inputs:** What this role receives from others.
**Outputs:** What this role must deliver.

## Boundaries
_What this role does NOT own._

## Success Measures
1. Measure 1
2. Measure 2
3. Measure 3

---
> "We work as one team; role clarity exists to avoid confusion, not to avoid serving."`;

const STARTER: Record<string, string> = {
  "vision-values": `## Why We Exist
_Write your team's purpose here — 10 lines max._

## Core Values
- Value 1
- Value 2
- Value 3

---
> "We work as one team; role clarity exists to avoid confusion, not to avoid serving."`,

  "roles-worship-lead": ROLE_TEMPLATE,
  "roles-worship-coordinator": ROLE_TEMPLATE,
  "roles-music-coordinator": ROLE_TEMPLATE,

  "weekly-rhythm": `## Setlist
- Songs due: **[day, time]**

## Rehearsal
- Time: **[day, time]**
- Location: **[location]**

## Roster
- Draft published: **[day]**
- Roster locked: **[day before Sunday]**`,

  "decision-rights": `## How We Resolve Conflicts

_Describe the escalation path here._

## Owner vs Support

**Owner** — accountable for the outcome and decisions in their lane.
**Support** — can help, but does not override the owner's decisions.

### Example
- Tech Coordinator **owns** Sunday readiness.
- Others can help carry gear — but Tech Coordinator decides setup order.

## Escalation Path
1. Raise it with the role owner first.
2. If unresolved within 24 hours, bring it to the Worship Coordinator.
3. If still unresolved, escalate to the Admin.`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Returns a "Updated N days ago …" string if doc changed within 7 days and is not the seed row. */
function recentUpdateBanner(doc: HandbookDocument): string | null {
  if (doc.major_version === 1 && doc.minor_version === 0) return null;
  const diffDays = Math.floor(
    (Date.now() - new Date(doc.created_at).getTime()) / 86_400_000
  );
  if (diffDays > 7) return null;
  const when =
    diffDays === 0 ? "today" : diffDays === 1 ? "yesterday" : `${diffDays} days ago`;
  const by = doc.created_by_name ? ` by ${doc.created_by_name}` : "";
  const note = doc.what_changed?.[0] ? ` — "${doc.what_changed[0]}"` : "";
  return `Updated ${when}${by}${note}`;
}

function ChangeTypePill({ type }: { type: ChangeType }) {
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
        type === "major"
          ? "bg-purple-50 text-purple-700"
          : "bg-blue-50 text-blue-700"
      }`}
    >
      {type === "major" ? "Major" : "Minor"}
    </span>
  );
}

// ─── Markdown component map (explicit styles — no CSS plugin needed) ──────────

const MD_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-gray-900 mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-1.5">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-gray-700 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-500">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-500">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-200 my-4" />,
  code: ({ children }) => (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-3 py-1.5 bg-gray-50 text-left text-xs font-semibold text-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-3 py-1.5 text-sm text-gray-700">{children}</td>
  ),
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HandbookPage() {
  const { member, loading: memberLoading } = useCurrentMember();
  const { editorRoles, editorMemberIds, loading: permsLoading } = useHandbookPermissions();

  const canEdit =
    !memberLoading &&
    !permsLoading &&
    member !== null &&
    (editorRoles.includes(member.app_role) || editorMemberIds.includes(member.id));

  // ── Router + unsaved-changes guard ──
  const router = useRouter();
  const routerRef = useRef(router);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => { routerRef.current = router; }, [router]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Mount-only: browser close/refresh + in-app anchor click interception
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href === window.location.pathname) return;
      if (anchor.target === "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      setPendingAction(() => () => routerRef.current.push(href));
    };
    document.addEventListener("click", handleAnchorClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorClick, true);
    };
  }, []);

  // ── Section selection ──
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_SLUG);

  // ── Current document ──
  const [doc, setDoc] = useState<HandbookDocument | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  // ── Edit mode ──
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  // ── Change log form ──
  const [changeType, setChangeType] = useState<ChangeType>("minor");
  const [whatChanged, setWhatChanged] = useState("");
  const [whyChanged, setWhyChanged] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── MVP2: History panel ──
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HandbookDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // ── MVP2: Version view modal ──
  const [viewVersion, setViewVersion] = useState<HandbookDocument | null>(null);

  // ── Toast ──
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Load current document on slug change
  useEffect(() => {
    let cancelled = false;
    setDocLoading(true);
    setIsEditing(false);
    setDoc(null);
    setShowHistory(false);
    setViewVersion(null);
    fetch(`/api/handbook/${selectedSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setDoc(d);
          setDocLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  // ── Edit handlers ──

  function startEdit() {
    setEditContent(doc?.content ?? "");
    setChangeType("minor");
    setWhatChanged("");
    setWhyChanged("");
    setFormError(null);
    setPreviewMode(false);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setIsDirty(false);
    setFormError(null);
  }

  async function handleSave() {
    if (saving) return;
    if (!whatChanged.trim()) {
      setFormError("'What changed' is required.");
      return;
    }
    if (!whyChanged.trim()) {
      setFormError("'Why it changed' is required.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/handbook/${selectedSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent,
          change_type: changeType,
          what_changed: [whatChanged.trim()],
          why_changed: whyChanged.trim(),
        }),
      });
      let json: (HandbookDocument & { error?: string }) | null = null;
      try {
        json = await res.json();
      } catch { /* ignore */ }
      if (!res.ok) {
        showToast(json?.error ?? "Failed to save", "error");
        return;
      }
      setDoc(json);
      setIsEditing(false);
      setIsDirty(false);
      showToast("Saved successfully");
    } catch (err) {
      console.error("handleSave error:", err);
      showToast("An unexpected error occurred", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── MVP2: History handlers ──

  async function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/handbook/${selectedSlug}/history`);
      setHistory(res.ok ? await res.json() : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleRestore(version: HandbookDocument) {
    if (restoring) return;
    if (
      !window.confirm(
        `Restore ${versionLabel(version)}?\n\nA new version will be created with that content. Nothing is permanently deleted.`
      )
    )
      return;

    setRestoring(true);
    try {
      const res = await fetch(
        `/api/handbook/${selectedSlug}/restore/${version.id}`,
        { method: "POST" }
      );
      let json: (HandbookDocument & { error?: string }) | null = null;
      try {
        json = await res.json();
      } catch { /* ignore */ }
      if (!res.ok) {
        showToast(json?.error ?? "Failed to restore", "error");
        return;
      }
      setDoc(json);
      setShowHistory(false);
      setViewVersion(null);
      showToast(`Restored to ${versionLabel(version)}`);
    } catch (err) {
      console.error("handleRestore error:", err);
      showToast("An unexpected error occurred", "error");
    } finally {
      setRestoring(false);
    }
  }

  // ── Section navigation guard ──
  function navigateSection(slug: string) {
    if (isDirty) {
      setPendingAction(() => () => {
        setIsDirty(false);
        setSelectedSlug(slug);
      });
      return;
    }
    setSelectedSlug(slug);
  }

  // ── Derived values ──

  const docTitle = ALL_LEAVES.find((s) => s.slug === selectedSlug)?.label ?? "";
  const isEmpty = !doc?.content?.trim();
  const starterTemplate = STARTER[selectedSlug] ?? "";
  const displayContent = isEmpty ? starterTemplate : (doc?.content ?? "");
  const updateBanner = doc ? recentUpdateBanner(doc) : null;

  function nextVersionLabel(type: ChangeType) {
    if (!doc) return "v1.0";
    return type === "major"
      ? `v${doc.major_version + 1}.0`
      : `v${doc.major_version}.${doc.minor_version + 1}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full -m-6">

      {/* ── Section sidebar ── */}
      <aside className="w-52 border-r border-gray-200 bg-white flex flex-col shrink-0 pt-5 pb-4">
        <p className="px-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Team Handbook
        </p>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {SECTIONS.map((section) => {
            if ("children" in section && section.children) {
              return (
                <div key="roles-group">
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500">
                    {section.label}
                  </p>
                  {section.children.map((child) => (
                    <button
                      key={child.slug}
                      onClick={() => navigateSection(child.slug)}
                      className={`w-full text-left pl-6 pr-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedSlug === child.slug
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                      }`}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              );
            }
            const leaf = section as LeafSection;
            return (
              <button
                key={leaf.slug}
                onClick={() => navigateSection(leaf.slug)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedSlug === leaf.slug
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                {leaf.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {docLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Loading…
          </div>
        ) : isEditing ? (

          /* ─── Edit view ─── */
          <div className="flex-1 flex flex-col overflow-hidden p-6">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{docTitle}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewMode(false)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                    !previewMode
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Write
                </button>
                <button
                  onClick={() => setPreviewMode(true)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                    previewMode
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {previewMode ? (
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-5 bg-white">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                  {editContent || "*Nothing to preview yet.*"}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={editContent}
                onChange={(e) => { setEditContent(e.target.value); setIsDirty(true); }}
                placeholder={starterTemplate}
                className="flex-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-0"
              />
            )}

            {/* Change log */}
            <div className="mt-4 shrink-0 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Change Log — required to save
              </p>

              <div className="flex gap-6">
                {(["minor", "major"] as ChangeType[]).map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="changeType"
                      value={t}
                      checked={changeType === t}
                      onChange={() => setChangeType(t)}
                      className="accent-gray-900"
                    />
                    <span>
                      {t === "minor" ? "Minor edit" : "Major restructure"}
                      <span className="ml-1.5 text-xs text-gray-400">
                        ({doc ? versionLabel(doc) : "v1.0"} → {nextVersionLabel(t)})
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  What changed
                </p>
                <input
                  type="text"
                  value={whatChanged}
                  onChange={(e) => setWhatChanged(e.target.value)}
                  placeholder="Brief description of what changed"
                  className="w-full border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  Why it changed <span className="text-gray-400">(1 bullet)</span>
                </p>
                <input
                  type="text"
                  value={whyChanged}
                  onChange={(e) => setWhyChanged(e.target.value)}
                  placeholder="• Reason or context (e.g. agreed in Feb team meeting)"
                  className="w-full border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Save New Version"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

        ) : (

          /* ─── Read view ─── */
          <div className="flex-1 flex flex-col overflow-hidden p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-3 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{docTitle}</h2>
                {doc && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {versionLabel(doc)}
                    {doc.created_by_name && ` · ${doc.created_by_name}`}
                    {doc.created_at && ` · ${formatDate(doc.created_at)}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={openHistory}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  History
                </button>
                {canEdit && (
                  <button
                    onClick={startEdit}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* "Recently updated" accountability banner */}
            {updateBanner && (
              <div className="mb-3 shrink-0 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                {updateBanner}
              </div>
            )}

            {/* Empty state */}
            {isEmpty && (
              <div className="mb-4 shrink-0 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                {canEdit
                  ? "This section is empty. Click Edit to start writing — a starter template is pre-filled for you."
                  : "This section hasn't been written yet. Check back soon."}
              </div>
            )}

            {/* Rendered markdown */}
            <div className="flex-1 overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {displayContent}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* ─── History panel (slide-in from right, within main content) ─── */}
        {showHistory && (
          <>
            <div
              className="absolute inset-0 bg-black/20 z-30"
              onClick={() => setShowHistory(false)}
            />
            <div className="absolute right-0 top-0 h-full w-96 bg-white border-l border-gray-200 flex flex-col z-40 shadow-xl">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Version History
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{docTitle}</p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
                  aria-label="Close history"
                >
                  ×
                </button>
              </div>

              {/* Version list */}
              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                    Loading…
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                    No history yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {history.map((v, i) => (
                      <li key={v.id} className="px-5 py-4">
                        {/* Version label + badges */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {versionLabel(v)}
                          </span>
                          <ChangeTypePill type={v.change_type} />
                          {i === 0 && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                              Current
                            </span>
                          )}
                        </div>

                        {/* Author + date */}
                        <p className="text-xs text-gray-500 mb-2">
                          {v.created_by_name ?? "—"}
                          {v.created_at && ` · ${formatDate(v.created_at)}`}
                        </p>

                        {/* Change log bullets */}
                        {(v.what_changed?.some(Boolean) || v.why_changed) && (
                          <div className="mb-2 text-xs text-gray-600 space-y-0.5">
                            {v.what_changed?.filter(Boolean).map((line, j) => (
                              <p key={j}>• {line}</p>
                            ))}
                            {v.why_changed && (
                              <p className="text-gray-400 italic">
                                Why: {v.why_changed}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewVersion(v)}
                            className="px-2.5 py-1 rounded border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50"
                          >
                            View
                          </button>
                          {canEdit && i !== 0 && (
                            <button
                              onClick={() => handleRestore(v)}
                              disabled={restoring}
                              className="px-2.5 py-1 rounded border border-gray-300 text-xs text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {restoring ? "Restoring…" : "Restore"}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Version view modal ─── */}
      {viewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">
                    {docTitle} — {versionLabel(viewVersion)}
                  </h3>
                  <ChangeTypePill type={viewVersion.change_type} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {viewVersion.created_by_name ?? "—"}
                  {viewVersion.created_at && ` · ${formatDate(viewVersion.created_at)}`}
                </p>
              </div>
              <button
                onClick={() => setViewVersion(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1 mt-0.5"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Change log */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Change Log
              </p>
              <div className="text-xs text-gray-700 space-y-0.5">
                {viewVersion.what_changed?.filter(Boolean).map((line, i) => (
                  <p key={i}>• {line}</p>
                ))}
                {viewVersion.why_changed && (
                  <p className="text-gray-400 italic mt-1">
                    Why: {viewVersion.why_changed}
                  </p>
                )}
              </div>
            </div>

            {/* Version content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {viewVersion.content || "*This version has no content.*"}
              </ReactMarkdown>
            </div>

            {/* Modal footer */}
            <div className="flex items-center px-6 py-4 border-t border-gray-200 shrink-0 gap-3">
              {canEdit && viewVersion.id !== doc?.id && (
                <button
                  onClick={() => handleRestore(viewVersion)}
                  disabled={restoring}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {restoring ? "Restoring…" : "Restore this version"}
                </button>
              )}
              <button
                onClick={() => setViewVersion(null)}
                className="ml-auto px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes guard modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Unsaved changes</h2>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved edits. If you leave now your changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Stay &amp; keep editing
              </button>
              <button
                onClick={() => {
                  const action = pendingAction;
                  setPendingAction(null);
                  setIsDirty(false);
                  action();
                }}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-gray-900 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
