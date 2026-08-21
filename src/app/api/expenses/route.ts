import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExpenseCategory, Role } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

// GET /api/expenses — list expenses with branch isolation and date filters
export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const paramBranchId = searchParams.get("branchId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Non-owner staff are locked to their assigned branch; Owners can filter by any branch
    const effectiveBranchId = staff.role === Role.OWNER ? (paramBranchId || undefined) : staff.branchId;

    const permCheck = checkStaffPermission(staff, "expenses", "read", effectiveBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // Build branch list for summary
    const branches = await prisma.branch.findMany({
      where: {
        ...(effectiveBranchId ? { id: effectiveBranchId } : {}),
      },
      orderBy: { name: "asc" },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      include: { branch: true },
      orderBy: { date: "desc" },
    });

    // Calculate revenue per branch (sum of completed transactions in the period)
    const revenueByBranch = await prisma.transaction.groupBy({
      by: ["branchId"],
      where: {
        status: "COMPLETED",
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      _sum: { totalInMMK: true },
    });

    // Build expense totals per branch
    const expenseByBranch = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.branchId] = (acc[e.branchId] ?? 0) + e.amount;
      return acc;
    }, {});

    const summary = branches.map((branch) => {
      const revenue = revenueByBranch.find((r) => r.branchId === branch.id)?._sum.totalInMMK ?? 0;
      const totalExpenses = expenseByBranch[branch.id] ?? 0;
      return {
        branch,
        revenue,
        totalExpenses,
        netProfit: revenue - totalExpenses,
      };
    });

    return NextResponse.json({ expenses, summary });
  } catch (error) {
    console.error("GET expenses error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// POST /api/expenses — create a new expense entry
export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { branchId: bodyBranchId, category, amount, currency, note, date } = body as {
      branchId: string;
      category: ExpenseCategory;
      amount: number;
      currency?: string;
      note?: string;
      date?: string;
    };

    // Non-owner staff are forced to use their assigned branchId; Owners can specify any branchId
    const targetBranchId = staff.role === Role.OWNER ? (bodyBranchId || staff.branchId) : staff.branchId;

    const permCheck = checkStaffPermission(staff, "expenses", "write", targetBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (!targetBranchId || !category || amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "branchId, category, and an amount greater than 0 are required" },
        { status: 400 }
      );
    }

    if (date && Number.isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: "Expense date is invalid" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        branchId: targetBranchId,
        category,
        amount: Number(amount),
        currency: currency ?? "MMK",
        note,
        date: date ? new Date(date) : new Date(),
      },
      include: { branch: true },
    });

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("POST expenses error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// DELETE /api/expenses — delete an expense entry
export async function DELETE(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Expense ID required" }, { status: 400 });

    const targetExpense = await prisma.expense.findUnique({ where: { id } });
    if (!targetExpense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    const permCheck = checkStaffPermission(staff, "expenses", "write", targetExpense.branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE expenses error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
