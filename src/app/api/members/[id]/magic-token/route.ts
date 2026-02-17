import { NextRequest, NextResponse } from "next/server";
import { generateMagicToken } from "@/lib/db/members";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await generateMagicToken(params.id);
  return NextResponse.json({ token });
}