import { NextResponse } from "next/server";
import { getRoles } from "@/lib/db/roles";

export async function GET() {
  const roles = await getRoles();
  return NextResponse.json({ roles });
}