import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const branchIdParam = searchParams.get("branchId");

    const startDate = startDateParam ? new Date(startDateParam) : new Date(new Date().setHours(0,0,0,0));
    const endDate = endDateParam ? new Date(endDateParam) : new Date(new Date().setHours(23,59,59,999));

    const effectiveBranchId = staff.role === "OWNER" && branchIdParam ? branchIdParam : (staff.role !== "OWNER" ? staff.branchId : undefined);

    const permCheck = checkStaffPermission(staff, "reports", "read", effectiveBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // Fetch Sales data (Transactions)
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: "COMPLETED",
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {})
      },
      include: {
        branch: { select: { name: true } },
        staff: { select: { name: true, role: true } },
        items: {
          include: {
            product: { select: { name: true, categoryId: true } },
            variant: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch Order Payments
    const orderPayments = await prisma.orderPayment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(effectiveBranchId ? { salesOrder: { branchId: effectiveBranchId } } : {})
      },
      include: {
        salesOrder: {
          include: {
            branch: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {})
      },
      include: {
        branch: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    
    // Fetch Categories (for joining later if needed)
    const categories = await prisma.category.findMany();

    // Fetch Sales Orders for COGS calculation
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {})
      },
      include: {
        items: true,
        branch: { select: { name: true } }
      }
    });

    return NextResponse.json({
      transactions,
      orderPayments,
      expenses,
      categories,
      salesOrders
    });

  } catch (error) {
    console.error("Reports API Error:", error);
    return NextResponse.json({ error: "Failed to fetch report data" }, { status: 500 });
  }
}
