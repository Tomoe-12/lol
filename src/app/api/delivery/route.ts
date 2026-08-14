import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthStaff } from "@/lib/auth-helper"

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request)
    if (errorResponse) return errorResponse
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")
    const search = searchParams.get("search")
    const status = searchParams.get("status") // "PENDING" | "DELIVERED" | "ALL"

    // Branch filter rule: Managers/Cashiers locked to their own branch
    let effectiveBranchId: string | undefined = undefined
    if (staff.role !== "OWNER") {
      effectiveBranchId = staff.branchId
    } else if (branchId && branchId !== "ALL") {
      effectiveBranchId = branchId
    }

    const whereCondition: Record<string, unknown> = {
      isDelivery: true,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(status && status !== "ALL" ? { deliveryStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { deliveryCustomerName: { contains: search } },
              { deliveryPhone: { contains: search } },
              { deliveryAddress: { contains: search } },
              { customer: { name: { contains: search } } },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
    }

    const [orders, pendingCount, todayDeliveredCount] = await Promise.all([
      prisma.salesOrder.findMany({
        where: whereCondition,
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
        orderBy: { createdAt: "desc" },
      }),
      prisma.salesOrder.count({
        where: {
          isDelivery: true,
          deliveryStatus: "PENDING",
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
      }),
      prisma.salesOrder.count({
        where: {
          isDelivery: true,
          deliveryStatus: "DELIVERED",
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      orders,
      stats: {
        pendingCount,
        todayDeliveredCount,
        totalCount: orders.length,
      },
    })
  } catch (error) {
    console.error("GET /api/delivery error:", error)
    return NextResponse.json(
      { error: "Failed to fetch delivery orders" },
      { status: 500 }
    )
  }
}
