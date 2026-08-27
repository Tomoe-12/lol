import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkStaffPermission, getAuthStaff } from "@/lib/auth-helper"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request)
    if (errorResponse) return errorResponse
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const log = await prisma.inventoryLog.findUnique({
      where: { id },
      include: {
        branch: true,
        variant: { include: { product: true } },
        performedBy: { select: { id: true, name: true, role: true } },
        transaction: {
          include: {
            branch: true,
            staff: { select: { id: true, name: true } },
            customer: true,
            items: { include: { product: true, variant: true } },
          },
        },
        salesOrder: {
          include: {
            customer: true,
            branch: true,
            createdByStaff: { select: { id: true, name: true } },
            items: { include: { variant: { include: { product: true } } } },
          },
        },
        purchaseOrder: {
          include: {
            supplier: true,
            branch: true,
            createdBy: { select: { id: true, name: true } },
            receivedBy: { select: { id: true, name: true } },
            items: { include: { variant: { include: { product: true } } } },
          },
        },
      },
    })
    if (!log) return NextResponse.json({ error: "Inventory log not found" }, { status: 404 })
    const permission = checkStaffPermission(staff, "inventory", "read", log.branchId)
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let source: Record<string, unknown> | null = null
    let sourceType = "ADJUSTMENT"
    const note = log.note || ""
    if (log.salesOrder) {
      sourceType = "SALES_ORDER"
      source = log.salesOrder
    } else if (log.transaction) {
      sourceType = "POS_TRANSACTION"
      source = log.transaction
    } else if (log.purchaseOrder) {
      sourceType = "PURCHASE_ORDER"
      source = log.purchaseOrder
    } else if (log.reason === "PURCHASE_RECEIVED") {
      sourceType = "PURCHASE_ORDER"
      const token = note.match(/Received PO #(.+)$/i)?.[1]
      const purchase = token ? await prisma.purchaseOrder.findFirst({ where: { OR: [{ id: token }, { id: { endsWith: token } }] }, include: { supplier: true, branch: true, createdBy: { select: { name: true } }, receivedBy: { select: { name: true } }, items: { include: { variant: { include: { product: true } } } } } }) : null
      if (purchase) source = { id: purchase.id, status: purchase.status, totalCost: purchase.totalCost, amountPaid: purchase.amountPaid, supplier: purchase.supplier, branch: purchase.branch, createdBy: purchase.createdBy, receivedBy: purchase.receivedBy, items: purchase.items }
    } else if (log.reason === "SALE") {
      const salesOrderToken = note.match(/Sales Voucher fulfillment for Order #(.+)$/i)?.[1]
      const transactionToken = note.match(/POS checkout: Order #(.+)$/i)?.[1]
      if (salesOrderToken) {
        sourceType = "SALES_ORDER"
        const salesOrder = await prisma.salesOrder.findFirst({ where: { OR: [{ id: salesOrderToken }, { id: { endsWith: salesOrderToken } }] }, include: { customer: true, branch: true, items: { include: { variant: { include: { product: true } } } } } })
        if (salesOrder) source = salesOrder
      } else if (transactionToken) {
        sourceType = "POS_TRANSACTION"
        const transaction = await prisma.transaction.findUnique({ where: { id: transactionToken }, include: { branch: true, staff: { select: { id: true, name: true } }, items: { include: { product: true, variant: true } } } })
        if (transaction) source = transaction
      }
    } else if (log.reason === "TRANSFER_IN" || log.reason === "TRANSFER_OUT") {
      sourceType = "TRANSFER"
    }

    return NextResponse.json({ log, sourceType, source })
  } catch (error) {
    console.error("GET inventory log details error:", error)
    return NextResponse.json({ error: "Failed to fetch inventory log details" }, { status: 500 })
  }
}
