import { NextRequest, NextResponse } from "next/server";
import { generateMagicToken } from "@/lib/db/members";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const p = context?.params;
  const id: string = typeof (p as Promise<{ id: string }>).then === "function"
    ? (await (p as Promise<{ id: string }>)).id
    : (p as { id: string }).id;
  const token = await generateMagicToken(id);
  return NextResponse.json({ token });
}