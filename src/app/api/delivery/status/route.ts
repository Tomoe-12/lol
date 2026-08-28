import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper"
import { isValidMyanmarPhone, normalizePhone } from "@/lib/phone"
import { ExpenseCategory } from "@prisma/client"

export async function PATCH(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request)
    if (errorResponse) return errorResponse
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { salesOrderId, deliveryStatus, delivererName, delivererPhone, receiverName, receiverPhone, serviceName, servicePhone, receiptNumber, deliveryFee, deliveryFeePayer } = body

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
    const normalizedServiceName = typeof serviceName === "string" ? serviceName.trim() : existing.deliveryServiceName || ""
    const normalizedReceiptNumber = typeof receiptNumber === "string" ? receiptNumber.trim() : existing.deliveryReceiptNumber || ""
    if (deliveryStatus === "DELIVERED" && !normalizedServiceName) return NextResponse.json({ error: "Enter the delivery service name." }, { status: 400 })
    if (deliveryStatus === "DELIVERED" && normalizedServiceName.toLowerCase() !== "own staff delivery" && !normalizedReceiptNumber) return NextResponse.json({ error: "Enter the delivery receipt or tracking number for an external delivery service." }, { status: 400 })
    const phones = [delivererPhone, receiverPhone, servicePhone].filter((phone) => typeof phone === "string" && phone.trim())
    if (phones.some((phone) => !isValidMyanmarPhone(normalizePhone(phone)))) return NextResponse.json({ error: "Delivery phone numbers must be exactly 11 digits and start with 09." }, { status: 400 })
    const normalizedDeliveryFee = Number(deliveryFee ?? existing.deliveryFee ?? 0)
    if (!Number.isFinite(normalizedDeliveryFee) || normalizedDeliveryFee < 0) return NextResponse.json({ error: "Delivery fee must be zero or greater." }, { status: 400 })
    const normalizedFeePayer = deliveryFeePayer === "STORE" || deliveryFeePayer === "CUSTOMER" ? deliveryFeePayer : existing.deliveryFeePayer
    if (normalizedDeliveryFee > 0 && !normalizedFeePayer) return NextResponse.json({ error: "Choose who pays the delivery fee." }, { status: 400 })
    const permission = checkStaffPermission(staff, "delivery", "write", existing.branchId)
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({ where: { id: salesOrderId }, data: { deliveryStatus, status: deliveryStatus === "DELIVERED" ? "COMPLETED" : "DELIVERING", deliveryFee: normalizedDeliveryFee, deliveryFeePayer: normalizedFeePayer, deliveryServiceName: normalizedServiceName || null, deliveryServicePhone: typeof servicePhone === "string" ? normalizePhone(servicePhone) || null : existing.deliveryServicePhone, deliveryReceiptNumber: normalizedReceiptNumber || null, ...(deliveryStatus === "DELIVERED" ? { deliveryDelivererName: typeof delivererName === "string" ? delivererName.trim() || null : null, deliveryReceiverName: typeof receiverName === "string" ? receiverName.trim() || null : null, deliveryDelivererPhone: typeof delivererPhone === "string" ? normalizePhone(delivererPhone) || null : null, deliveryReceiverPhone: typeof receiverPhone === "string" ? normalizePhone(receiverPhone) || null : null } : {}) } })
      if (deliveryStatus === "DELIVERED" && normalizedDeliveryFee > 0 && normalizedFeePayer === "STORE") {
        await tx.expense.create({ data: { branchId: existing.branchId, category: ExpenseCategory.OTHER, amount: normalizedDeliveryFee, currency: "MMK", note: `Delivery fee paid by store for Sales Order #${existing.id.slice(-6).toUpperCase()}` } })
      }
      return updated
    })
    return NextResponse.json({ success: true, order })

  } catch (error) {
    console.error("PATCH /api/delivery/status error:", error)
    return NextResponse.json(
      { error: "Failed to update delivery status" },
      { status: 500 }
    )
  }
}
