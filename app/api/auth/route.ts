import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correct = process.env.PORTAL_PASSWORD;
  if (!correct) return NextResponse.json({ error: "PORTAL_PASSWORD not set" }, { status: 500 });
  if (password !== correct) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  return NextResponse.json({ ok: true });
}