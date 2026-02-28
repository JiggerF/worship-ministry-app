import { NextResponse } from "next/server";
import { getHandbookMeta } from "@/lib/db/handbook";

export async function GET() {
  try {
    const docs = await getHandbookMeta();
    return NextResponse.json(docs);
  } catch (err) {
    console.error("GET /api/handbook error:", err);
    return NextResponse.json({ error: "Failed to load handbook" }, { status: 500 });
  }
}
