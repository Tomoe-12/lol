import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, CACHE_KEYS, TTL } from "@/lib/redis";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

async function fetchBranchInventory(branchId: string) {
  const [products, stockLevels, logs] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, variants: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockLevel.findMany({
      where: { branchId },
    }),
    prisma.inventoryLog.findMany({
      where: { branchId },
      include: {
        branch: { select: { id: true, name: true } },
        variant: { include: { product: { select: { name: true } } } },
        performedBy: { select: { id: true, name: true, role: true } },
        transaction: {
          select: {
            id: true,
            staff: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true, phone: true, phones: true } },
          },
        },
        salesOrder: {
          select: {
            id: true,
            customer: { select: { id: true, name: true, phone: true, phones: true } },
            createdByStaff: { select: { id: true, name: true } },
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            supplier: { select: { id: true, name: true, contact: true, email: true } },
            receivedBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const stockByVariantId = new Map(
    stockLevels.map((stock) => [stock.variantId, stock])
  );

  const mergedStock = [];
  for (const product of products) {
    for (const variant of product.variants) {
      const stock = stockByVariantId.get(variant.id);
      
      // If the product has never been stocked (no StockLevel record), hide it from the inventory view.
      if (!stock) continue;
      
      mergedStock.push({
        id: stock?.id || `temp-${variant.id}`,
        branchId,
        variantId: variant.id,
        variant: {
          id: variant.id,
          name: variant.name,
          barcode: variant.barcode,
          costPrice: variant.costPrice ?? 0,
          price: product.price ?? 0,
          lowStockThreshold: variant.lowStockThreshold,
          product: {
            id: product.id,
            name: product.name,
            price: product.price ?? 0,
            imageUrl: product.imageUrl,
            category: product.category,
          },
        },
        quantity: stock?.quantity ?? 0,
        lowStockThreshold: variant.lowStockThreshold,
      });
    }
  }

  return { stockLevels: mergedStock, logs, activeBranchId: branchId };
}

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "inventory", "read");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const paramBranchId = searchParams.get("branchId");
    const withStock = searchParams.get("withStock") === "true";

    // Non-owner staff are locked to their assigned branch; Owners can query any branch
    const effectiveBranchId = staff.role === "OWNER" ? (paramBranchId || undefined) : staff.branchId;

    // If branchId is specified, return stock + logs for that branch
    if (effectiveBranchId && !withStock) {
      const inventory = await withCache(
        CACHE_KEYS.inventory(effectiveBranchId),
        TTL.INVENTORY,
        () => fetchBranchInventory(effectiveBranchId)
      );
      return NextResponse.json(inventory);
    }

    // Otherwise, we are loading branches
    const branches = await prisma.branch.findMany({
      orderBy: { name: "asc" },
    });

    if (withStock) {
      const firstBranchId = staff.role === "OWNER" ? branches[0]?.id : staff.branchId;
      if (!firstBranchId) {
        return NextResponse.json({
          branches,
          stockLevels: [],
          logs: [],
          activeBranchId: null,
        });
      }

      const inventory = await fetchBranchInventory(firstBranchId);
      return NextResponse.json({ branches, ...inventory });
    }

    return NextResponse.json({ branches });
  } catch (error) {
    console.error("Inventory fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
