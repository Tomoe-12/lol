import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { StockChangeReason } from "@prisma/client"
import { getAuthStaff } from "@/lib/auth-helper"

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

    // Branch Isolation Check for Manager/Cashier
    if (staff.role !== "OWNER" && staff.branchId !== existing.branchId) {
      return NextResponse.json({ error: "Forbidden: Branch isolation violation" }, { status: 403 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Stock deduction logic: If order status is NOT COMPLETED (e.g. CONFIRMED), deduct stock now!
      if (deliveryStatus === "DELIVERED" && existing.status !== "COMPLETED") {
        for (const item of existing.items) {
          await tx.stockLevel.upsert({
            where: {
              branchId_variantId: {
                branchId: existing.branchId,
                variantId: item.variantId,
              },
            },
            update: {
              quantity: { decrement: item.quantity },
            },
            create: {
              branchId: existing.branchId,
              variantId: item.variantId,
              quantity: -item.quantity,
            },
          })

          await tx.inventoryLog.create({
            data: {
              branchId: existing.branchId,
              variantId: item.variantId,
              change: -item.quantity,
              reason: StockChangeReason.SALES_ORDER_DELIVERED,
              note: `Delivery confirmed for Order #${existing.id.slice(-6).toUpperCase()}`,
            },
          })
        }
      }

      return await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: {
          deliveryStatus: deliveryStatus as "PENDING" | "DELIVERED",
          ...(deliveryStatus === "DELIVERED" ? { status: "COMPLETED" } : {}),
        },
        include: {
          customer: true,
          branch: { select: { id: true, name: true } },
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      })
    })

    return NextResponse.json({ success: true, order: updated })
  } catch (error) {
    console.error("PATCH /api/delivery/status error:", error)
    return NextResponse.json(
      { error: "Failed to update delivery status" },
      { status: 500 }
    )
  }
}
