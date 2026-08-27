import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { withCache, CACHE_KEYS, TTL } from "@/lib/redis";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramBranchId = searchParams.get("branchId");

    // Non-owner staff are locked to their assigned branch; Owners can query any branch or ALL
    const effectiveBranchId = staff.role === "OWNER"
      ? (paramBranchId && paramBranchId !== "ALL" ? paramBranchId : undefined)
      : staff.branchId;

    const permCheck = checkStaffPermission(staff, "dashboard", "read", effectiveBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const cacheKey = CACHE_KEYS.dashboardStats(effectiveBranchId || "ALL");

    const data = await withCache(
      cacheKey,
      TTL.STATS,
      async () => {
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const sevenDaysAgo = startOfDay(subDays(now, 7));

        const [
          todayTransactions,
          last7DaysTransactions,
          lowStockCountResult,
          totalStaffCount,
          branches,
          productSalesAggregates,
          staffSalesAggregates,
          allProducts,
          allStaff,
          todayOrderPayments,
          weekOrderPayments,
          pendingReceivablesAgg,
        ] = await withRetry(() => Promise.all([
          prisma.transaction.findMany({
            where: {
              createdAt: { gte: todayStart, lte: todayEnd },
              status: "COMPLETED",
              ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
            include: {
              branch: { select: { id: true, name: true } },
              staff: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.transaction.findMany({
            where: {
              createdAt: { gte: sevenDaysAgo },
              status: "COMPLETED",
              salesOrderId: null,
              ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
            select: { branchId: true, total: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          }),
          effectiveBranchId
            ? prisma.$queryRaw<[{ count: number | bigint }]>`
                SELECT COUNT(*) AS count
                FROM StockLevel sl
                JOIN ProductVariant pv ON sl.variantId = pv.id
                WHERE sl.quantity <= pv.lowStockThreshold AND sl.branchId = ${effectiveBranchId}
              `
            : prisma.$queryRaw<[{ count: number | bigint }]>`
                SELECT COUNT(*) AS count
                FROM StockLevel sl
                JOIN ProductVariant pv ON sl.variantId = pv.id
                WHERE sl.quantity <= pv.lowStockThreshold
              `,
          prisma.staff.count({
            where: {
              ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            }
          }),
          prisma.branch.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
          prisma.transactionItem.groupBy({
            by: ["productId"],
            where: {
              transaction: {
                status: "COMPLETED",
                ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
              }
            },
            _sum: { quantity: true, total: true },
          }),
          prisma.transaction.groupBy({
            by: ["staffId"],
            where: {
              status: "COMPLETED",
              salesOrderId: null,
              createdAt: { gte: todayStart, lte: todayEnd },
              ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
            _sum: { total: true },
            _count: true,
          }),
          prisma.product.findMany({
            select: { id: true, name: true },
          }),
          prisma.staff.findMany({
            where: {
              ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
            select: { id: true, name: true, role: true },
          }),
          prisma.orderPayment.findMany({
            where: {
              createdAt: { gte: todayStart, lte: todayEnd },
              ...(effectiveBranchId ? { salesOrder: { branchId: effectiveBranchId } } : {}),
            },
            select: { amount: true, createdAt: true, collectedByStaffId: true, salesOrder: { select: { branchId: true } } }
          }),
          prisma.orderPayment.findMany({
            where: {
              createdAt: { gte: sevenDaysAgo },
              ...(effectiveBranchId ? { salesOrder: { branchId: effectiveBranchId } } : {}),
            },
            select: { amount: true, createdAt: true, collectedByStaffId: true, salesOrder: { select: { branchId: true } } }
          }),
          prisma.salesOrder.aggregate({
            where: {
              status: { in: ["CONFIRMED", "COMPLETED"] },
              paymentStatus: { not: "PAID" },
              ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            },
            _sum: { total: true, amountPaid: true }
          })
        ]));

    const cashTransactions = todayTransactions.filter((tx) => !tx.salesOrderId);
    const totalPosRevenueMMK = cashTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalOrderPaymentMMK = todayOrderPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRevenueMMK = totalPosRevenueMMK + totalOrderPaymentMMK;
    const transactionCount = cashTransactions.length + todayOrderPayments.length;
    const lowStockCount = Number(lowStockCountResult[0]?.count ?? 0);
    const pendingReceivables = (pendingReceivablesAgg._sum.total ?? 0) - (pendingReceivablesAgg._sum.amountPaid ?? 0);

    const uniqueStaffToday = new Set([
      ...cashTransactions.map((tx) => tx.staffId),
      ...todayOrderPayments.map((payment) => payment.collectedByStaffId).filter(Boolean),
    ]);
    const activeStaffCount = uniqueStaffToday.size || totalStaffCount;

    const branchTxnMap = new Map<string, { revenue: number; txn: number }>();
    for (const tx of cashTransactions) {
      const current = branchTxnMap.get(tx.branchId) ?? { revenue: 0, txn: 0 };
      current.revenue += tx.total;
      current.txn += 1;
      branchTxnMap.set(tx.branchId, current);
    }
    for (const p of todayOrderPayments) {
      const bId = p.salesOrder.branchId;
      const current = branchTxnMap.get(bId) ?? { revenue: 0, txn: 0 };
      current.revenue += p.amount;
      current.txn += 1;
      branchTxnMap.set(bId, current);
    }

    const branchPerformance = branches.map((branch) => {
      const stats = branchTxnMap.get(branch.id);
      const txn = stats?.txn ?? 0;
      return {
        id: branch.id,
        name: branch.name,
        revenue: stats?.revenue ?? 0,
        txn,
        status: txn > 0 ? ("online" as const) : ("offline" as const),
      };
    });

    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
    const branchNames = branches.map((b) => b.name);

    const dailyRevenueMap: Record<string, Record<string, number>> = {};
    for (let i = 6; i >= 0; i--) {
      const dateStr = subDays(now, i).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dailyRevenueMap[dateStr] = Object.fromEntries(
        branchNames.map((name) => [name, 0])
      );
    }

    for (const tx of last7DaysTransactions) {
      const dateStr = new Date(tx.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const branchName = branchNameById.get(tx.branchId);
      if (branchName && dailyRevenueMap[dateStr]) {
        dailyRevenueMap[dateStr][branchName] += tx.total;
      }
    }
    for (const p of weekOrderPayments) {
      const dateStr = new Date(p.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const branchName = branchNameById.get(p.salesOrder.branchId);
      if (branchName && dailyRevenueMap[dateStr]) {
        dailyRevenueMap[dateStr][branchName] += p.amount;
      }
    }

    const revenueTrends = Object.entries(dailyRevenueMap).map(([date, branchRevenues]) => ({
      date,
      ...branchRevenues,
    }));

    const hourlyDistributionMap = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      amount: 0,
      txCount: 0,
    }));

    for (const tx of cashTransactions) {
      const hour = new Date(tx.createdAt).getHours();
      hourlyDistributionMap[hour].amount += tx.total;
      hourlyDistributionMap[hour].txCount += 1;
    }
    for (const p of todayOrderPayments) {
      const hour = new Date(p.createdAt).getHours();
      hourlyDistributionMap[hour].amount += p.amount;
      hourlyDistributionMap[hour].txCount += 1;
    }

    const peakHours = hourlyDistributionMap.filter((h) => h.amount > 0 || h.txCount > 0);
    const displayPeakHours =
      peakHours.length > 0 ? peakHours : hourlyDistributionMap.slice(9, 21);

    const productNameById = new Map(allProducts.map((p) => [p.id, p.name]));
    const productSalesMap = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    for (const row of productSalesAggregates) {
      productSalesMap.set(row.productId, {
        name: productNameById.get(row.productId) ?? "Unknown Product",
        quantity: row._sum.quantity ?? 0,
        revenue: row._sum.total ?? 0,
      });
    }

    const productSalesList = Array.from(productSalesMap.values());
    const bestSellers = [...productSalesList]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const unsoldProducts = allProducts
      .filter((p) => !productSalesMap.has(p.id))
      .map((p) => ({ name: p.name, quantity: 0, revenue: 0 }));

    const worstSellers = [...productSalesList, ...unsoldProducts]
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5);

    const staffStatsById = new Map(
      staffSalesAggregates.map((row) => [
        row.staffId,
        { txn: row._count, revenue: row._sum.total ?? 0 },
      ])
    );

    for (const payment of todayOrderPayments) {
      if (!payment.collectedByStaffId) continue;
      const current = staffStatsById.get(payment.collectedByStaffId) ?? { txn: 0, revenue: 0 };
      current.txn += 1;
      current.revenue += payment.amount;
      staffStatsById.set(payment.collectedByStaffId, current);
    }

    const staffRankings = allStaff
      .map((staff) => {
        const stats = staffStatsById.get(staff.id);
        return {
          name: staff.name,
          role: staff.role,
          txn: stats?.txn ?? 0,
          revenue: stats?.revenue ?? 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const liveFeed = cashTransactions.slice(0, 10).map((tx) => ({
      id: tx.id,
      branchName: tx.branch.name,
      staffName: tx.staff.name,
      total: tx.total,
      currency: tx.currency,
      paymentMethod: tx.paymentMethod,
      createdAt: tx.createdAt,
    }));

        return {
          success: true,
          stats: {
            revenueMMK: totalRevenueMMK,
            salesOrderDepositsMMK: totalOrderPaymentMMK,
            transactionCount,
            lowStockCount,
            pendingReceivables,
            activeStaffCount: `${activeStaffCount} / ${totalStaffCount}`,
          },
          branches: branches.map((b) => ({ id: b.id, name: b.name })),
          selectedBranchId: effectiveBranchId || "ALL",
          branchPerformance,
          revenueTrends,
          peakHours: displayPeakHours,
          bestSellers,
          worstSellers,
          staffRankings,
          liveFeed,
        };
      }
    );

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("Dashboard stats aggregation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
