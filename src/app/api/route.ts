// app/api/availability/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMemberByMagicToken, getAvailabilityByMemberId, setAvailabilityForMember } from '@/lib/db/members';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const member = await getMemberByMagicToken(params.token);
  if (!member) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const availability = await getAvailabilityByMemberId(member.id);
  return NextResponse.json({ member: { id: member.id, name: member.name }, availability });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const member = await getMemberByMagicToken(params.token);
  if (!member) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const data = await req.json();
  await setAvailabilityForMember(member.id, data.availability);
  return NextResponse.json({ success: true });
}