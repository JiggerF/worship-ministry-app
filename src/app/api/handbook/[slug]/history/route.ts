import { NextRequest, NextResponse } from "next/server";
import { getDocHistory } from "@/lib/db/handbook";

// MVP2: returns full version history for a slug.
// Stubbed in MVP1 — returns empty array.
// Uncomment the body below when building the Version History panel.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const history = await getDocHistory(slug);
    return NextResponse.json(history);
  } catch (err) {
    console.error(`GET /api/handbook/${slug}/history error:`, err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
