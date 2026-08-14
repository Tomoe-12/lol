import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const branchIdParam = searchParams.get("branchId");
    const customerIdParam = searchParams.get("customerId");
    const searchQuery = searchParams.get("q") || "";

    const effectiveBranchId =
      staff.role === "OWNER" && branchIdParam
        ? branchIdParam
        : staff.role !== "OWNER"
        ? staff.branchId
        : undefined;

    const permCheck = checkStaffPermission(staff, "outstanding", "read", effectiveBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // Fetch all confirmed/completed sales orders where amountPaid < total
    const outstandingOrders = await prisma.salesOrder.findMany({
      where: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        paymentStatus: { not: "PAID" },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(customerIdParam ? { customerId: customerIdParam } : {}),
        ...(searchQuery
          ? {
              OR: [
                { id: { contains: searchQuery } },
                { customer: { name: { contains: searchQuery } } },
                { customer: { phone: { contains: searchQuery } } },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
        branch: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mappedDebts = outstandingOrders.map((o) => {
      const remainingDebt = Math.max(0, o.total - o.amountPaid);
      const lastPayment = o.payments[0] || null;
      return {
        id: o.id,
        salesOrderId: o.id,
        branchId: o.branchId,
        branchName: o.branch.name,
        customerId: o.customerId,
        customerName: o.customer?.name || "Walk-in Customer",
        customerPhone: o.customer?.phone || null,
        total: o.total,
        amountPaid: o.amountPaid,
        remainingDebt,
        paymentStatus: o.paymentStatus,
        status: o.status,
        createdAt: o.createdAt,
        lastPaymentDate: lastPayment?.createdAt || o.createdAt,
        itemsCount: o.items.length,
        payments: o.payments,
      };
    });

    const totalOutstandingDebt = mappedDebts.reduce((sum, d) => sum + d.remainingDebt, 0);
    const uniqueDebtors = new Set(mappedDebts.map((d) => d.customerId || d.customerName)).size;

    return NextResponse.json({
      totalOutstandingDebt,
      totalDebtors: uniqueDebtors,
      pendingOrdersCount: mappedDebts.length,
      debts: mappedDebts,
    });
  } catch (error) {
    console.error("GET /api/outstanding error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch outstanding debts" },
      { status: 500 }
    );
  }
}
