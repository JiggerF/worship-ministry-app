import { NextRequest, NextResponse } from "next/server";
import { getMember, updateMember, deleteMember } from "@/lib/db/members";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const member = await getMember(params.id);
  return NextResponse.json(member);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const member = await updateMember(params.id, data);
  return NextResponse.json(member);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await deleteMember(params.id);
  return NextResponse.json({ success: true });
}