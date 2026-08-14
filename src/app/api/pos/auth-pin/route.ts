import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    // 1. Get the currently logged-in user's staff record
    const authResult = await getAuthStaff(request);
    if (!authResult.staff) {
      return authResult.errorResponse!;
    }

    const loggedInStaff = authResult.staff;

    const permCheck = checkStaffPermission(loggedInStaff, "pos", "read");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // 2. Verify the PIN matches ONLY the logged-in user's own staff record
    const staffByPin = await prisma.staff.findFirst({
      where: { pin: pin },
      include: { branch: true },
    });

    if (!staffByPin) {
      return NextResponse.json(
        { error: "Invalid PIN / ပင်နံပါတ်မှားယွင်းနေပါသည်" },
        { status: 401 }
      );
    }

    // 3. The PIN must belong to the currently logged-in user
    if (staffByPin.id !== loggedInStaff.id) {
      return NextResponse.json(
        { error: "Incorrect PIN / ဤပင်နံပါတ်သည် သင့်အကောင့်နှင့်မကိုက်ညီပါ" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: {
        id: staffByPin.id,
        name: staffByPin.name,
        email: staffByPin.email,
        role: staffByPin.role,
        branchId: staffByPin.branchId,
        branchName: staffByPin.branch.name,
      },
    });
  } catch (error) {
    console.error("PIN authentication error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
