import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActorFromRequest } from "@/lib/server/get-actor";
import { getTenantId } from "@/lib/server/tenant";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceKey);

interface UpdateRequest {
  songId: string;
  chordUrl: string;
}

export async function POST(req: NextRequest) {
  // Auth: Admin, Coordinator, MusicCoordinator, WorshipLeader can update via Song Health
  const ALLOWED_ROLES = ["Admin", "Coordinator", "MusicCoordinator", "WorshipLeader"];
  const actor = await getActorFromRequest(req);
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Not authorized to update chord sheets" }, { status: 403 });
  }

  const tenantId = getTenantId(req);
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates: UpdateRequest[] = body.updates;
  let updatedCount = 0;
  const errors: Array<{ songId: string; error: string }> = [];

  for (const update of updates) {
    try {
      // Validate URL
      if (!update.chordUrl.trim().startsWith("https://")) {
        errors.push({
          songId: update.songId,
          error: "URL must start with https://",
        });
        continue;
      }

      // Find or create chord chart entry
      const { data: existing } = await supabase
        .from("chord_charts")
        .select("id")
        .eq("song_id", update.songId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateErr } = await supabase
          .from("chord_charts")
          .update({ file_url: update.chordUrl.trim() })
          .eq("id", existing.id)
          .eq("song_id", update.songId);

        if (updateErr) {
          errors.push({
            songId: update.songId,
            error: updateErr.message,
          });
        } else {
          updatedCount++;
        }
      } else {
        // Create new chord chart entry
        const { error: insertErr } = await supabase
          .from("chord_charts")
          .insert({
            song_id: update.songId,
            key: "?", // Placeholder key
            file_url: update.chordUrl.trim(),
            storage_path: null,
            created_at: new Date().toISOString(),
          });

        if (insertErr) {
          errors.push({
            songId: update.songId,
            error: insertErr.message,
          });
        } else {
          updatedCount++;
        }
      }
    } catch (err) {
      errors.push({
        songId: update.songId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    updated: updatedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
