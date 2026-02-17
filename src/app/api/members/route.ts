import { NextRequest, NextResponse } from "next/server";
import { getMembers, createMember } from "@/lib/db/members";

export async function GET() {
  const members = await getMembers();
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const member = await createMember(data);
  return NextResponse.json(member, { status: 201 });
}