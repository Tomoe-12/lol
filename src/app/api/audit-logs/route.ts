import { NextResponse } from "next/server";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff: caller, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(caller, "reports", "read");
    if (!permCheck.allowed) {
      const staffCheck = checkStaffPermission(caller, "staff", "read");
      if (!staffCheck.allowed && permCheck.errorResponse) {
        return permCheck.errorResponse;
      }
    }

    if (caller.role === "CASHIER") {
      return NextResponse.json({ error: "Access Denied: Cashiers cannot view audit logs" }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        // Managers only see audit logs for staff in their own branch
        ...(caller.role === "MANAGER"
          ? { staff: { branchId: caller.branchId } }
          : {}),
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            role: true,
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500, // Return up to 500 entries (client-side filters the rest)
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("GET audit logs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
