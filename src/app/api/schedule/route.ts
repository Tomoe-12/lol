import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ schedules: [] });
}

export async function POST() {
  return NextResponse.json({ error: "Schedule feature is disabled" }, { status: 400 });
}

export async function PUT() {
  return NextResponse.json({ error: "Schedule feature is disabled" }, { status: 400 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Schedule feature is disabled" }, { status: 400 });
}
