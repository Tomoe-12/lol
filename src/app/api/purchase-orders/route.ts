import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PurchaseOrderStatus, PurchasePaymentStatus, StockChangeReason, Role } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

type PurchaseItemInput = {
  id?: string;
  variantId: string;
  quantity: number;
  unitCost?: number;
  sellingPrice?: number;
};

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isBeforeToday(date: Date | null | undefined) {
  if (!date) return false;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10) < todayKey;
}

function validatePayment(
  paymentStatus: PurchasePaymentStatus,
  amountPaid: number,
  items: PurchaseItemInput[],
  totalCost: number
) {
  if (!Object.values(PurchasePaymentStatus).includes(paymentStatus)) {
    return "Invalid supplier payment status";
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return "Paid amount cannot be negative";
  }
  if (paymentStatus === PurchasePaymentStatus.NO_PAY && amountPaid !== 0) {
    return "No Pay orders cannot have a paid amount";
  }
  if (paymentStatus === PurchasePaymentStatus.PARTIAL && amountPaid <= 0) {
    return "Partial Pay requires a paid amount greater than 0";
  }
  if (paymentStatus === PurchasePaymentStatus.PAID) {
    if (items.some((item) => (item.unitCost ?? 0) <= 0 || (item.sellingPrice ?? 0) <= 0)) {
      return "Fully Paid orders require cost price and selling price greater than 0";
    }
    if (totalCost <= 0) return "Fully Paid orders require a total cost greater than 0";
  }
  if (items.some((item) => (item.unitCost ?? 0) > 0 && (item.sellingPrice ?? 0) > 0 && (item.sellingPrice ?? 0) < (item.unitCost ?? 0))) {
    return "Selling price cannot be less than cost price";
  }
  return null;
}

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
    const { supplierId, branchId: bodyBranchId, items, note, paymentStatus = PurchasePaymentStatus.NO_PAY, amountPaid = 0, arrivalDate, voucherNumber } = body as {
      supplierId: string;
      branchId: string;
      items: PurchaseItemInput[];
      note?: string;
      paymentStatus?: PurchasePaymentStatus;
      amountPaid?: number;
      arrivalDate?: string | null;
      voucherNumber?: string | null;
    };

    // If OWNER, they can specify the branch. If non-owner, force their own branch.
    const targetBranchId = staff.role === Role.OWNER ? bodyBranchId : staff.branchId;

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

    if (items.some((item) => !item.variantId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || (item.unitCost !== undefined && !Number.isFinite(Number(item.unitCost))) || (item.sellingPrice !== undefined && !Number.isFinite(Number(item.sellingPrice))) || Number(item.unitCost ?? 0) < 0 || Number(item.sellingPrice ?? 0) < 0)) {
      return NextResponse.json({ error: "Each item requires a variant and quantity greater than 0; prices cannot be negative" }, { status: 400 });
    }

    const [supplier, branch, variants] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }),
      prisma.branch.findUnique({ where: { id: targetBranchId }, select: { id: true } }),
      prisma.productVariant.findMany({ where: { id: { in: items.map((item) => item.variantId) } }, select: { id: true } }),
    ]);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 400 });
    if (!branch) return NextResponse.json({ error: "Destination branch not found" }, { status: 400 });
    if (variants.length !== new Set(items.map((item) => item.variantId)).size) {
      return NextResponse.json({ error: "One or more product variants were not found" }, { status: 400 });
    }
    if (new Set(items.map((item) => item.variantId)).size !== items.length) {
      return NextResponse.json({ error: "The same product variant cannot be added more than once" }, { status: 400 });
    }

    const normalizedItems = items.map((item) => ({ ...item, quantity: Number(item.quantity), unitCost: Number(item.unitCost) || 0, sellingPrice: Number(item.sellingPrice) || 0 }));
    const totalCost = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const parsedArrivalDate = parseOptionalDate(arrivalDate);
    if (!arrivalDate || parsedArrivalDate === null) {
      return NextResponse.json({ error: "Arrival date is required" }, { status: 400 });
    }
    if (arrivalDate !== undefined && parsedArrivalDate === undefined) {
      return NextResponse.json({ error: "Arrival date is invalid" }, { status: 400 });
    }
    if (isBeforeToday(parsedArrivalDate)) {
      return NextResponse.json({ error: "Arrival date cannot be before today" }, { status: 400 });
    }
    const normalizedAmountPaid = Number(amountPaid);
    if (!Number.isFinite(normalizedAmountPaid) || normalizedAmountPaid < 0) {
      return NextResponse.json({ error: "Paid amount cannot be negative or invalid" }, { status: 400 });
    }
    const effectivePaymentStatus = paymentStatus === PurchasePaymentStatus.PARTIAL && totalCost > 0 && normalizedAmountPaid >= totalCost
      ? PurchasePaymentStatus.PAID
      : paymentStatus;
    const paymentError = validatePayment(effectivePaymentStatus, normalizedAmountPaid, normalizedItems, totalCost);
    if (paymentError) return NextResponse.json({ error: paymentError }, { status: 400 });
    if (effectivePaymentStatus !== PurchasePaymentStatus.NO_PAY && !voucherNumber?.trim()) {
      return NextResponse.json({ error: "Voucher number is required for Partial Pay and Fully Paid orders" }, { status: 400 });
    }

    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        branchId: targetBranchId,
        createdById: staff.id,
        note,
        totalCost,
        paymentStatus: effectivePaymentStatus,
        amountPaid: effectivePaymentStatus === PurchasePaymentStatus.PAID ? Math.max(totalCost, normalizedAmountPaid) : normalizedAmountPaid,
        arrivalDate: parsedArrivalDate,
        voucherNumber: voucherNumber?.trim() || null,
        status: PurchaseOrderStatus.DRAFT,
        items: {
          create: normalizedItems.map((item) => ({
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
    const { id, status, items, paymentStatus, amountPaid, arrivalDate, voucherNumber, refundAmount, supplierCredit } = body as {
      id: string; 
      status: PurchaseOrderStatus; 
      items?: PurchaseItemInput[];
      paymentStatus?: PurchasePaymentStatus;
      amountPaid?: number;
      arrivalDate?: string | null;
      voucherNumber?: string | null;
      refundAmount?: number;
      supplierCredit?: number;
    };

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }
    if (!Object.values(PurchaseOrderStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid purchase order status" }, { status: 400 });
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

    if (po.status === PurchaseOrderStatus.RECEIVED || po.status === PurchaseOrderStatus.CANCELLED) {
      return NextResponse.json({ error: "Purchase Order has already been received" }, { status: 400 });
    }

    let nextPaymentStatus = paymentStatus ?? po.paymentStatus;
    const nextAmountPaid = amountPaid === undefined ? po.amountPaid : Number(amountPaid);
    const nextVoucherNumber = voucherNumber === undefined ? po.voucherNumber : voucherNumber;
    if (!Number.isFinite(nextAmountPaid) || nextAmountPaid < 0) {
      return NextResponse.json({ error: "Paid amount cannot be negative or invalid" }, { status: 400 });
    }
    if (status !== PurchaseOrderStatus.RECEIVED && nextAmountPaid < po.amountPaid) {
      return NextResponse.json({ error: "Paid amount cannot be reduced" }, { status: 400 });
    }
    if (po.paymentStatus === PurchasePaymentStatus.PARTIAL && nextPaymentStatus === PurchasePaymentStatus.NO_PAY) {
      return NextResponse.json({ error: "Partial Pay purchase orders cannot change back to No Pay" }, { status: 400 });
    }
    const parsedArrivalDate = parseOptionalDate(arrivalDate);
    const nextArrivalDate = arrivalDate === undefined ? po.arrivalDate : parsedArrivalDate;
    if (!nextArrivalDate) {
      return NextResponse.json({ error: "Arrival date is required" }, { status: 400 });
    }
    if (arrivalDate !== undefined && parsedArrivalDate === undefined) {
      return NextResponse.json({ error: "Arrival date is invalid" }, { status: 400 });
    }
    if (isBeforeToday(nextArrivalDate)) {
      return NextResponse.json({ error: "Arrival date cannot be before today" }, { status: 400 });
    }

    if (items?.some((item) => !item.id || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitCost ?? 0)) || !Number.isFinite(Number(item.sellingPrice ?? 0)) || Number(item.unitCost ?? 0) < 0 || Number(item.sellingPrice ?? 0) < 0)) {
      return NextResponse.json({ error: "Each item requires quantity greater than 0 and prices cannot be negative" }, { status: 400 });
    }
    if (items && new Set(items.map((item) => item.id)).size !== items.length) {
      return NextResponse.json({ error: "The same purchase item cannot be submitted more than once" }, { status: 400 });
    }

    const finalInputItems = items?.map((item) => ({ ...item, quantity: Number(item.quantity), unitCost: Number(item.unitCost) || 0, sellingPrice: Number(item.sellingPrice) || 0 })) ?? po.items;
    if (items?.some((item) => !po.items.some((existing) => existing.id === item.id))) {
      return NextResponse.json({ error: "One or more purchase items do not belong to this order" }, { status: 400 });
    }
    const finalTotalCost = finalInputItems.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0);
    if (status !== PurchaseOrderStatus.RECEIVED && nextPaymentStatus === PurchasePaymentStatus.PARTIAL && finalTotalCost > 0 && nextAmountPaid >= finalTotalCost) {
      nextPaymentStatus = PurchasePaymentStatus.PAID;
    }
    const paidOrderNeedsBalance = po.paymentStatus === PurchasePaymentStatus.PAID && nextPaymentStatus === PurchasePaymentStatus.PARTIAL && Boolean(items) && finalTotalCost > nextAmountPaid;
    if (po.paymentStatus === PurchasePaymentStatus.PAID && nextPaymentStatus !== PurchasePaymentStatus.PAID && !paidOrderNeedsBalance) {
      return NextResponse.json({ error: "Fully Paid purchase orders can only become Partial Pay when a price change creates a remaining balance" }, { status: 400 });
    }
    if (status === PurchaseOrderStatus.RECEIVED && finalInputItems.some((item) => (item.unitCost ?? 0) <= 0 || (item.sellingPrice ?? 0) <= 0)) {
      return NextResponse.json({ error: "Actual cost price and selling price are required when receiving goods" }, { status: 400 });
    }
    if (status === PurchaseOrderStatus.RECEIVED && nextPaymentStatus !== PurchasePaymentStatus.PAID) {
      return NextResponse.json({ error: "Supplier payment must be Fully Paid before receiving goods" }, { status: 400 });
    }
    if (status === PurchaseOrderStatus.RECEIVED && nextAmountPaid < finalTotalCost) {
      return NextResponse.json({ error: "The full actual purchase cost must be paid before receiving goods" }, { status: 400 });
    }
    if (finalInputItems.some((item) => (item.unitCost ?? 0) > 0 && (item.sellingPrice ?? 0) > 0 && (item.sellingPrice ?? 0) < (item.unitCost ?? 0))) {
      return NextResponse.json({ error: "Selling price cannot be less than cost price" }, { status: 400 });
    }
    if (status === PurchaseOrderStatus.RECEIVED && nextPaymentStatus === PurchasePaymentStatus.PARTIAL && nextAmountPaid > finalTotalCost) {
      return NextResponse.json({ error: "Partial paid amount cannot exceed the actual received total cost" }, { status: 400 });
    }
    const paymentError = validatePayment(nextPaymentStatus, nextAmountPaid, finalInputItems, finalTotalCost);
    if (paymentError && status !== PurchaseOrderStatus.CANCELLED) {
      return NextResponse.json({ error: paymentError }, { status: 400 });
    }
    if (nextPaymentStatus !== PurchasePaymentStatus.NO_PAY && !nextVoucherNumber?.trim()) {
      return NextResponse.json({ error: "Voucher number is required for Partial Pay and Fully Paid orders" }, { status: 400 });
    }
    const normalizedRefund = refundAmount === undefined ? 0 : Number(refundAmount);
    const normalizedSupplierCredit = supplierCredit === undefined ? 0 : Number(supplierCredit);
    if (status !== PurchaseOrderStatus.RECEIVED && (!Number.isFinite(normalizedRefund) || normalizedRefund < 0 || !Number.isFinite(normalizedSupplierCredit) || normalizedSupplierCredit < 0)) {
      return NextResponse.json({ error: "Refund and supplier credit amounts must be valid and non-negative" }, { status: 400 });
    }

    if (status === PurchaseOrderStatus.CANCELLED) {
      const paidBeforeRefund = nextPaymentStatus === PurchasePaymentStatus.PAID ? Math.max(po.amountPaid, finalTotalCost) : nextAmountPaid;
      if (!Number.isFinite(normalizedRefund) || normalizedRefund < 0 || normalizedRefund > paidBeforeRefund) {
        return NextResponse.json({ error: "Refund amount must be between 0 and the amount paid" }, { status: 400 });
      }
      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status,
          paymentStatus: nextPaymentStatus,
          amountPaid: paidBeforeRefund,
          cashFlowAmount: paidBeforeRefund,
          refundAmount: normalizedRefund,
          supplierCredit: 0,
          cashFlowDate: new Date(),
          ...(parsedArrivalDate !== undefined ? { arrivalDate: parsedArrivalDate } : {}),
          ...(voucherNumber !== undefined ? { voucherNumber: voucherNumber?.trim() || null } : {}),
        },
      });
      return NextResponse.json({ order: updated });
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
                unitCost: Number(itemUpdate.unitCost) || 0,
                sellingPrice: Number(itemUpdate.sellingPrice) || 0,
                total: itemUpdate.quantity * (Number(itemUpdate.unitCost) || 0),
              },
            });
            newTotalCost += updated.total;
          }
          finalItems = await tx.purchaseItem.findMany({ where: { purchaseOrderId: id } });
        }

        // Fetch variant for each item to resolve productId for stock level
        for (const item of finalItems) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: { include: { variants: { select: { id: true } } } } },
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
            },
          });

          // A product can have multiple variants with independent prices. Only
          // update the variant represented by this purchase line. Keep the
          // legacy product-level fields in sync only for single-variant products;
          // for multi-variant products those fields cannot represent one price.
          if (variant.product.variants.length === 1) {
            await tx.product.update({
              where: { id: variant.productId },
              data: { costPrice: newCostPrice },
            });
          }

          if (item.sellingPrice !== undefined && item.sellingPrice > 0) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: { price: item.sellingPrice },
            });
            if (variant.product.variants.length === 1) {
              await tx.product.update({
                where: { id: variant.productId },
                data: { price: item.sellingPrice },
              });
            }
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
              performedByStaffId: staff.id,
              purchaseOrderId: id,
              note: `Received PO #${id}`,
            },
          });
        }

        const totalPaidAtReceive = Math.max(po.amountPaid, nextAmountPaid);
        const overpayment = Math.max(0, totalPaidAtReceive - newTotalCost);
        const automaticRefund = overpayment;
        const totalPaidAfterReceive = totalPaidAtReceive;
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status,
            totalCost: newTotalCost,
            paymentStatus: nextPaymentStatus,
            amountPaid: totalPaidAfterReceive,
            cashFlowAmount: totalPaidAfterReceive,
            refundAmount: automaticRefund,
            supplierCredit: 0,
            cashFlowDate: new Date(),
            ...(parsedArrivalDate !== undefined ? { arrivalDate: parsedArrivalDate } : {}),
            ...(voucherNumber !== undefined ? { voucherNumber: voucherNumber?.trim() || null } : {}),
            receivedById: staff.id,
            ...(!po.createdById ? { createdById: staff.id } : {}),
          },
        });
      });
    } else if (items && items.length > 0) {
      await prisma.$transaction(async (tx) => {
        const newTotalCost = items.reduce((total, item) => total + item.quantity * (Number(item.unitCost) || 0), 0);
        for (const item of items) {
          await tx.purchaseItem.update({
            where: { id: item.id },
            data: {
              quantity: item.quantity,
              unitCost: Number(item.unitCost) || 0,
              sellingPrice: Number(item.sellingPrice) || 0,
              total: item.quantity * (Number(item.unitCost) || 0),
            },
          });
        }
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status,
            totalCost: newTotalCost,
            paymentStatus: nextPaymentStatus,
            amountPaid: nextAmountPaid,
            ...(parsedArrivalDate !== undefined ? { arrivalDate: parsedArrivalDate } : {}),
            ...(voucherNumber !== undefined ? { voucherNumber: voucherNumber?.trim() || null } : {}),
            ...(!po.createdById ? { createdById: staff.id } : {}),
          },
        });
      });
    } else {
      await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status,
          paymentStatus: nextPaymentStatus,
          amountPaid: nextAmountPaid,
          ...(parsedArrivalDate !== undefined ? { arrivalDate: parsedArrivalDate } : {}),
          ...(voucherNumber !== undefined ? { voucherNumber: voucherNumber?.trim() || null } : {}),
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
