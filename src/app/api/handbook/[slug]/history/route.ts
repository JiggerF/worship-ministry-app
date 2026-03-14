import { NextRequest, NextResponse } from "next/server";
import { getDocHistory } from "@/lib/db/handbook";
import { getTenantId } from "@/lib/server/tenant";

// MVP2: returns full version history for a slug.
// Stubbed in MVP1 — returns empty array.
// Uncomment the body below when building the Version History panel.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenantId = getTenantId(_req);
  try {
    const history = await getDocHistory(tenantId, slug);
    return NextResponse.json(history);
  } catch (err) {
    console.error(`GET /api/handbook/${slug}/history error:`, err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
