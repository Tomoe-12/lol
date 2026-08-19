import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseOrderStatus, StockChangeReason, Role } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

// GET /api/purchase-orders — list all POs with supplier, branch, items (branch-isolated)
export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");
    const paramBranchId = searchParams.get("branchId");
    const status = searchParams.get("status") as PurchaseOrderStatus | null;

    // Non-owner staff are locked to their assigned branch; Owners can query any branch
    const effectiveBranchId = staff.role === Role.OWNER ? (paramBranchId || undefined) : staff.branchId;

    const permCheck = checkStaffPermission(staff, "purchases", "read", effectiveBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        ...(supplierId ? { supplierId } : {}),
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        supplier: true,
        branch: true,
        createdBy: { select: { id: true, name: true, role: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        items: {
          include: { variant: { include: { product: { include: { category: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET purchase orders error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// POST /api/purchase-orders — create a new PO with line items (branch-isolated)
export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { supplierId, branchId: bodyBranchId, items, note } = body as {
      supplierId: string;
      branchId: string;
      items: Array<{ variantId: string; quantity: number; unitCost: number; sellingPrice: number }>;
      note?: string;
    };

    // If OWNER, they can specify the branch. If non-owner, force their own branch.
    const targetBranchId = staff.role === Role.OWNER && bodyBranchId ? bodyBranchId : staff.branchId;

    const permCheck = checkStaffPermission(staff, "purchases", "write", targetBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (!supplierId || !targetBranchId || !items?.length) {
      return NextResponse.json(
        { error: "supplierId, branchId, and items are required" },
        { status: 400 }
      );
    }

    const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        branchId: targetBranchId,
        createdById: staff.id,
        note,
        totalCost,
        status: PurchaseOrderStatus.DRAFT,
        items: {
          create: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            sellingPrice: item.sellingPrice,
            total: item.quantity * item.unitCost,
          })),
        },
      },
      include: {
        supplier: true,
        branch: true,
        createdBy: { select: { id: true, name: true, role: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("POST purchase orders error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// PATCH /api/purchase-orders — update status of a PO (branch-isolated)
export async function PATCH(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status, items } = body as { 
      id: string; 
      status: PurchaseOrderStatus; 
      items?: { id: string; quantity: number; unitCost: number; sellingPrice: number }[];
    };

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    // Retrieve PO to check ownership
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });

    const permCheck = checkStaffPermission(staff, "purchases", "write", po.branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // Non-owner staff can only update POs of their own branch
    if (staff.role !== Role.OWNER && po.branchId !== staff.branchId) {
      return NextResponse.json(
        { error: "Access Denied: You cannot update a Purchase Order belonging to another branch" },
        { status: 403 }
      );
    }

    if (po.status === PurchaseOrderStatus.RECEIVED) {
      return NextResponse.json({ error: "Purchase Order has already been received" }, { status: 400 });
    }

    // If receiving, increment stock levels for all items
    if (status === PurchaseOrderStatus.RECEIVED) {
      await prisma.$transaction(async (tx) => {
        // Update items if provided (to set actual received quantities/costs)
        let finalItems = po.items;
        let newTotalCost = po.totalCost;
        if (items && items.length > 0) {
          newTotalCost = 0;
          for (const itemUpdate of items) {
            const updated = await tx.purchaseItem.update({
              where: { id: itemUpdate.id },
              data: {
                quantity: itemUpdate.quantity,
                unitCost: itemUpdate.unitCost,
                sellingPrice: itemUpdate.sellingPrice,
                total: itemUpdate.quantity * itemUpdate.unitCost,
              },
            });
            newTotalCost += updated.total;
          }
          finalItems = await tx.purchaseItem.findMany({ where: { purchaseOrderId: id } });
        }

        // Fetch variant for each item to resolve productId for stock level
        for (const item of finalItems) {
          const variant = await tx.productVariant.findUnique({ 
            where: { id: item.variantId }
          });
          if (!variant) continue;
          
          // Calculate Moving Average Cost (MAC) across entire franchise
          const allStock = await tx.stockLevel.findMany({
            where: { variantId: variant.id }
          });
          const totalStock = allStock.reduce((sum, sl) => sum + sl.quantity, 0);
          
          let newCostPrice = item.unitCost;
          if (totalStock > 0) {
            const currentTotalValue = totalStock * (variant.costPrice || 0);
            const incomingValue = item.quantity * item.unitCost;
            newCostPrice = (currentTotalValue + incomingValue) / (totalStock + item.quantity);
          }

          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              costPrice: newCostPrice,
              ...(item.sellingPrice !== undefined && item.sellingPrice > 0 ? { price: item.sellingPrice } : {}),
            },
          });

          // If parent product price is 0 or unassigned, initialize it
          const parentProd = await tx.product.findUnique({ where: { id: variant.productId } });
          if (parentProd && (parentProd.price === 0 || parentProd.price === undefined) && item.sellingPrice && item.sellingPrice > 0) {
            await tx.product.update({
              where: { id: variant.productId },
              data: { price: item.sellingPrice },
            });
          }

          await tx.stockLevel.upsert({
            where: { branchId_variantId: { branchId: po.branchId, variantId: variant.id } },
            update: { quantity: { increment: item.quantity } },
            create: {
              branchId: po.branchId,
              variantId: variant.id,
              quantity: item.quantity,
            },
          });

          await tx.inventoryLog.create({
            data: {
              branchId: po.branchId,
              variantId: variant.id,
              change: item.quantity,
              reason: StockChangeReason.PURCHASE_RECEIVED,
              note: `Received PO #${id}`,
            },
          });
        }

        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status,
            totalCost: newTotalCost,
            receivedById: staff.id,
            ...(!po.createdById ? { createdById: staff.id } : {}),
          },
        });
      });
    } else {
      await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status,
          ...(!po.createdById ? { createdById: staff.id } : {}),
        },
      });
    }

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        createdBy: { select: { id: true, name: true, role: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("PATCH purchase orders error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
