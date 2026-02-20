import { NextRequest, NextResponse } from "next/server";
import { getMemberByEmail } from "@/lib/db/members";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });

  try {
    const member = await getMemberByEmail(email);
    return NextResponse.json(member);
  } catch (e: any) {
    if (e && e.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
