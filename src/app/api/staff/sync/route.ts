import { NextResponse } from "next/server";
import { getAuthStaff } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;

    return NextResponse.json({
      success: true,
      staff: {
        id: staff!.id,
        name: staff!.name,
        email: staff!.email,
        role: staff!.role,
        branchId: staff!.branchId,
        pin: staff!.pin,
      },
    });
  } catch (error) {
    console.error("Staff sync error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
