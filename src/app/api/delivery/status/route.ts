import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper"

export async function PATCH(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request)
    if (errorResponse) return errorResponse
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { salesOrderId, deliveryStatus } = body

    if (!salesOrderId || !deliveryStatus) {
      return NextResponse.json(
        { error: "salesOrderId and deliveryStatus are required" },
        { status: 400 }
      )
    }

    const existing = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 })
    }

    if (existing.status !== "DELIVERING" || !existing.isDelivery) return NextResponse.json({ error: "Only orders sent to Delivery can be marked delivered." }, { status: 400 })
    if (!['PENDING', 'DELIVERED'].includes(deliveryStatus)) return NextResponse.json({ error: "Invalid delivery status." }, { status: 400 })
    const permission = checkStaffPermission(staff, "delivery", "write", existing.branchId)
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const order = await prisma.salesOrder.update({ where: { id: salesOrderId }, data: { deliveryStatus, status: deliveryStatus === "DELIVERED" ? "COMPLETED" : "DELIVERING" } })
    return NextResponse.json({ success: true, order })

  } catch (error) {
    console.error("PATCH /api/delivery/status error:", error)
    return NextResponse.json(
      { error: "Failed to update delivery status" },
      { status: 500 }
    )
  }
}
