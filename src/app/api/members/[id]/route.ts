import { NextRequest, NextResponse } from "next/server";
import { getMember, updateMember, deleteMember } from "@/lib/db/members";

function extractIdFromContext(context: any) {
  const p = context?.params;
  if (!p) return undefined;
  if (typeof p.then === "function") {
    return p.then((resolved: any) => resolved?.id);
  }
  return p.id;
}

export async function GET(req: NextRequest, context: any) {
  const id = await extractIdFromContext(context);
  const member = await getMember(id);
  return NextResponse.json(member);
}

export async function PUT(req: NextRequest, context: any) {
  const id = await extractIdFromContext(context);
  const data = await req.json();
  const member = await updateMember(id, data);
  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest, context: any) {
  const id = await extractIdFromContext(context);
  await deleteMember(id);
  return NextResponse.json({ success: true });
}