import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/server/tenant";
import { getHandbookMeta } from "@/lib/db/handbook";

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  try {
    const docs = await getHandbookMeta(tenantId);
    return NextResponse.json(docs);
  } catch (err) {
    console.error("GET /api/handbook error:", err);
    return NextResponse.json({ error: "Failed to load handbook" }, { status: 500 });
  }
}
