import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { withCache, CACHE_KEYS, TTL } from "@/lib/redis";
import { getAuthStaff } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const effectiveBranchId = staff.role === "MANAGER" ? staff.branchId : undefined;

    const data = await withCache(
      CACHE_KEYS.notifications(staff.id ?? undefined),
      TTL.NOTIFICATIONS,
      async () => {
        // Run queries in a single transaction to use one pooler connection
        const [stockLevels, exchangeRates, criticalLogs] = await withRetry(() =>
          prisma.$transaction([
            // 1. Stock levels for low-stock alerts
            prisma.stockLevel.findMany({
              where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
              include: {
                variant: { select: { id: true, name: true, barcode: true, lowStockThreshold: true, product: { select: { id: true, name: true } } } },
                branch: { select: { id: true, name: true } },
              },
            }),

            // 2. Recent exchange rate updates
            prisma.exchangeRate.findMany({
              where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
              include: {
                setByStaff: { select: { name: true } },
                branch: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 5,
            }),

            // 3. Critical audit logs
            prisma.auditLog.findMany({
              where: {
                action: {
                  in: ["VOIDED", "REFUNDED", "INVENTORY_ADJUSTMENT", "EXCHANGE_RATE_UPDATE", "TRANSFER_STOCK"],
                },
                ...(effectiveBranchId ? { staff: { branchId: effectiveBranchId } } : {}),
              },
              include: {
                staff: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ])
        );

        const lowStockAlerts = stockLevels
          .filter((s) => s.quantity <= (s.variant.lowStockThreshold || 10))
          .map((s) => ({
            type: "LOW_STOCK",
            title: "Low Stock Alert",
            message: `${s.variant.product.name} (${s.variant.name}) is low in stock (${s.quantity} remaining at ${s.branch.name})`,
            timestamp: new Date().toISOString(),
            metadata: {
              variantId: s.variant.id,
              productId: s.variant.product.id,
              barcode: s.variant.barcode || "N/A",
              branchId: s.branchId,
              quantity: s.quantity,
            },
          }));

        const exchangeAlerts = exchangeRates.map((r) => ({
          type: "EXCHANGE_RATE",
          title: "Exchange Rate Modified",
          message: `Exchange rate updated to 1 USD = ${r.mmkPerUsd.toLocaleString()} Ks at ${r.branch.name} by ${r.setByStaff.name}`,
          timestamp: r.createdAt.toISOString(),
          metadata: {
            rateId: r.id,
            rate: r.mmkPerUsd,
          },
        }));

        const auditAlerts = criticalLogs.map((l) => ({
          type: "CRITICAL_LOG",
          title: `Action: ${l.action}`,
          message: `${l.staff.name}: ${l.details}`,
          timestamp: l.createdAt.toISOString(),
          metadata: {
            logId: l.id,
          },
        }));

        const allNotifications = [
          ...lowStockAlerts,
          ...exchangeAlerts,
          ...auditAlerts,
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { notifications: allNotifications };
      }
    );

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("GET notifications error:", error);
    return NextResponse.json({ notifications: [] }, { status: 200 });
  }
}
