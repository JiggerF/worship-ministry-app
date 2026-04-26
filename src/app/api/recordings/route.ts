import { NextRequest, NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { getTenantId } from "@/lib/server/tenant";
import { getRecordings, createRecording } from "@/lib/db/recordings";

const UPLOAD_ROLES = ["Admin", "Coordinator"];

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  try {
    const recordings = await getRecordings(tenantId);
    return NextResponse.json(recordings);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  if (!actor || !UPLOAD_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Not authorized to upload recordings" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.sunday_date || !body?.drive_url) {
    return NextResponse.json({ error: "Missing required fields: title, sunday_date, drive_url" }, { status: 400 });
  }

  // Parse optional duration "MM:SS" → seconds
  let duration_seconds: number | null = null;
  if (typeof body.duration === "string" && body.duration.trim()) {
    const parts = body.duration.trim().split(":");
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s)) duration_seconds = m * 60 + s;
    }
  }

  const featured_members_override =
    Array.isArray(body.featured_members_override) && body.featured_members_override.length > 0
      ? body.featured_members_override
      : null;

  try {
    const recording = await createRecording(actor.tenantId, {
      title: body.title,
      sunday_date: body.sunday_date,
      recording_type: body.recording_type === "video" ? "video" : "audio",
      drive_url: body.drive_url,
      duration_seconds,
      uploaded_by: actor.id,
      featured_members_override,
    });
    return NextResponse.json({ success: true, recording }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
