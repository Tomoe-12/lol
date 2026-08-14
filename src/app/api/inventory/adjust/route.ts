import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StockChangeReason } from "@prisma/client";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { variantId, changeAmount, reason, note } = body;
    const branchId = body.branchId || staff.branchId;

    const permCheck = checkStaffPermission(staff, "inventory", "write", branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (!branchId || !variantId || typeof changeAmount !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: branchId, variantId, or changeAmount" },
        { status: 400 }
      );
    }

    // Determine the prisma enum reason
    const enumReason = Object.values(StockChangeReason).includes(reason as StockChangeReason)
      ? (reason as StockChangeReason)
      : StockChangeReason.ADJUSTMENT;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update StockLevel (upsert)
      const stock = await tx.stockLevel.upsert({
        where: {
          branchId_variantId: {
            branchId,
            variantId,
          },
        },
        update: {
          quantity: {
            increment: changeAmount,
          },
        },
        create: {
          branchId,
          variantId,
          quantity: changeAmount,
        },
      });

      // 2. Create InventoryLog
      const log = await tx.inventoryLog.create({
        data: {
          branchId,
          variantId,
          change: changeAmount,
          reason: enumReason,
          note: note || `Manual adjustment of ${changeAmount}`,
        },
      });

      return { stock, log };
    });

    await invalidateCache(CACHE_KEYS.inventory(branchId), CACHE_KEYS.notifications());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Stock adjustment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
