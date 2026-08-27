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
    const { fromBranchId, toBranchId, variantId, quantity, note } = body;

    const permCheck = checkStaffPermission(staff, "inventory", "write", fromBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (staff.role === "CASHIER") {
      return NextResponse.json({ error: "Access Denied: Cashiers cannot transfer stock" }, { status: 403 });
    }

    if (!fromBranchId || !toBranchId || !variantId || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid required fields: fromBranchId, toBranchId, variantId, quantity" },
        { status: 400 }
      );
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json(
        { error: "Source and destination branches cannot be the same" },
        { status: 400 }
      );
    }

    // Managers can only transfer stock FROM their own branch
    if (staff.role === "MANAGER" && fromBranchId !== staff.branchId) {
      return NextResponse.json(
        { error: "Access Denied: Managers can only transfer stock from their own branch" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if the source branch has sufficient stock
      const sourceStock = await tx.stockLevel.findUnique({
        where: {
          branchId_variantId: {
            branchId: fromBranchId,
            variantId,
          },
        },
      });

      if (!sourceStock || sourceStock.quantity < quantity) {
        throw new Error(`Insufficient stock in source branch. Available: ${sourceStock?.quantity || 0}`);
      }

      // 2. Decrement origin stock level
      const updatedSourceStock = await tx.stockLevel.update({
        where: {
          branchId_variantId: {
            branchId: fromBranchId,
            variantId,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      // 3. Increment destination stock level (upsert)
      const updatedDestStock = await tx.stockLevel.upsert({
        where: {
          branchId_variantId: {
            branchId: toBranchId,
            variantId,
          },
        },
        update: {
          quantity: {
            increment: quantity,
          },
        },
        create: {
          branchId: toBranchId,
          variantId,
          quantity,
        },
      });

      // Fetch branch names for nice descriptive log notes
      const fromBranch = await tx.branch.findUnique({ where: { id: fromBranchId } });
      const toBranch = await tx.branch.findUnique({ where: { id: toBranchId } });
      const fromBranchName = fromBranch?.name || "Source Branch";
      const toBranchName = toBranch?.name || "Destination Branch";

      // 4. Create TRANSFER_OUT log for origin branch
      const outLog = await tx.inventoryLog.create({
        data: {
          branchId: fromBranchId,
          variantId,
          change: -quantity,
          reason: StockChangeReason.TRANSFER_OUT,
          performedByStaffId: staff.id,
          note: note || `Transferred ${quantity} units to ${toBranchName}`,
        },
      });

      // 5. Create TRANSFER_IN log for destination branch
      const inLog = await tx.inventoryLog.create({
        data: {
          branchId: toBranchId,
          variantId,
          change: quantity,
          reason: StockChangeReason.TRANSFER_IN,
          performedByStaffId: staff.id,
          note: note || `Transferred ${quantity} units from ${fromBranchName}`,
        },
      });

      return {
        updatedSourceStock,
        updatedDestStock,
        outLog,
        inLog,
      };
    });

    // Bust cache for both branches since their stock changed
    await invalidateCache(
      CACHE_KEYS.inventory(fromBranchId),
      CACHE_KEYS.inventory(toBranchId),
      CACHE_KEYS.notifications()
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Stock transfer error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
