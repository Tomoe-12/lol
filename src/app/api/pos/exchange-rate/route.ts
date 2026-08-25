import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Currency conversion is disabled. The system uses MMK only." }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: "Currency conversion is disabled. The system uses MMK only." }, { status: 410 });
}
