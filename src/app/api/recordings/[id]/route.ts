import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { deleteRecording, updateRecording } from "@/lib/db/recordings";

const EDIT_ROLES = ["Admin", "Coordinator"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || !EDIT_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Not authorized to edit recordings" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  // Parse optional duration "MM:SS" → seconds
  let duration_seconds: number | null | undefined = undefined;
  if (typeof body.duration === "string") {
    if (!body.duration.trim()) {
      duration_seconds = null;
    } else {
      const parts = body.duration.trim().split(":");
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const s = parseInt(parts[1], 10);
        if (!isNaN(m) && !isNaN(s)) duration_seconds = m * 60 + s;
      }
    }
  }

  const payload: Record<string, unknown> = {};
  if (body.title) payload.title = body.title;
  if (body.sunday_date) payload.sunday_date = body.sunday_date;
  if (body.recording_type === "audio" || body.recording_type === "video") payload.recording_type = body.recording_type;
  if (body.drive_url) payload.drive_url = body.drive_url;
  if (duration_seconds !== undefined) payload.duration_seconds = duration_seconds;
  // null means "clear the override and revert to roster"; array means "use this lineup"
  if ("featured_members_override" in body) {
    payload.featured_members_override = body.featured_members_override ?? null;
  }

  try {
    const recording = await updateRecording(actor.tenantId, id, payload);
    return NextResponse.json({ success: true, recording });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActorFromRequest(req);
  if (!actor || !EDIT_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Not authorized to delete recordings" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await deleteRecording(actor.tenantId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
