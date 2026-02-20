import { NextRequest, NextResponse } from "next/server";
import { generateMagicToken } from "@/lib/db/members";

function extractIdFromContext(context: any) {
  const p = context?.params;
  if (!p) return undefined;
  if (typeof p.then === "function") {
    return p.then((resolved: any) => resolved?.id);
  }
  return p.id;
}

export async function POST(req: NextRequest, context: any) {
  const id = await extractIdFromContext(context);
  const token = await generateMagicToken(id);
  return NextResponse.json({ token });
}