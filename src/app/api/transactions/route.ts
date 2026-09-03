import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkStaffPermission, getAuthStaff } from "@/lib/auth-helper"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request)
    if (errorResponse) return errorResponse
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const requestedBranchId = searchParams.get("branchId")
    if (staff.role !== "OWNER" && requestedBranchId && requestedBranchId !== staff.branchId) {
      return NextResponse.json({ error: "Forbidden: Access is restricted to your assigned branch" }, { status: 403 })
    }
    const branchId = staff.role === "OWNER" ? (requestedBranchId || undefined) : staff.branchId
    const permission = checkStaffPermission(staff, "pos", "read", branchId)
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const transactions = await prisma.transaction.findMany({
      where: { status: "COMPLETED", ...(branchId ? { branchId } : {}) },
      include: {
        branch: true,
        staff: { select: { id: true, name: true } },
        items: { include: { product: true, variant: true } },
        customer: true,
        salesOrder: {
          select: {
            id: true,
            paymentStatus: true,
            depositStatus: true,
            amountPaid: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("GET transactions error:", error)
    return NextResponse.json({ error: "Failed to fetch sales transactions" }, { status: 500 })
  }
}
