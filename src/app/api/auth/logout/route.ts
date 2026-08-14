import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("pos_session");
  } catch {
    // Outside server request scope (e.g. direct route testing)
  }
  return NextResponse.json({ success: true });
}
