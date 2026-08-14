import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { StockChangeReason } from "@prisma/client";

interface SalesOrderItemInput {
  variantId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total?: number;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id: id },
      include: { items: { include: { variant: { include: { product: true } } } } }
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Sales Order not found" }, { status: 404 });
    }

    const permCheck = checkStaffPermission(staff, "salesOrders", "write", existingOrder.branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { status, paymentStatus, amountPaid, paymentMethod, refundAmount, items, note, deliveryDate, isDelivery, deliveryCustomerName, deliveryPhone, deliveryAddress } = body;

    // Vulnerability 5 fix: Block duplicate cancellation / refund requests if already cancelled
    if (existingOrder.status === "CANCELLED") {
      if (status === "CANCELLED" || refundAmount !== undefined) {
        return NextResponse.json(
          { error: "Sales Order is already cancelled" },
          { status: 400 }
        );
      }
    }

    // Determine target status
    const targetStatus = status !== undefined ? status : existingOrder.status;

    // Recalculate totals if items are updated (Only allowed for DRAFT orders)
    let calculatedSubtotal = existingOrder.subtotal;
    let calculatedDiscount = existingOrder.discount;
    let calculatedTotal = existingOrder.total;

    if (items) {
      if (existingOrder.status !== "DRAFT") {
        return NextResponse.json(
          { error: "Cannot edit items on a confirmed or completed sales order." },
          { status: 400 }
        );
      }

      calculatedSubtotal = items.reduce((sum: number, item: SalesOrderItemInput) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      calculatedDiscount = items.reduce((sum: number, item: SalesOrderItemInput) => sum + (Number(item.discount) || 0), 0);
      calculatedTotal = calculatedSubtotal - calculatedDiscount;
    }

    // Validate prices & stock levels if status is upgraded from DRAFT to CONFIRMED or COMPLETED
    if ((targetStatus === "CONFIRMED" || targetStatus === "COMPLETED") && (items || existingOrder.status === "DRAFT")) {
      const itemsToValidate = items || existingOrder.items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      }));

      const variantIds = Array.from(new Set(itemsToValidate.map((i: SalesOrderItemInput) => i.variantId).filter(Boolean))) as string[];
      const dbVariants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true }
      });
      const variantMap = new Map(dbVariants.map(v => [v.id, v]));

      for (const item of itemsToValidate) {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          return NextResponse.json({ error: `Variant not found for ID ${item.variantId}` }, { status: 400 });
        }
        const qty = Math.max(1, Number(item.quantity) || 1);
        const uPrice = Number(item.unitPrice) || 0;
        const itemDiscount = Number(item.discount) || 0;
        const effectiveSellingPrice = uPrice - (itemDiscount / qty);
        const dbCostPrice = variant.costPrice || 0;

        if (effectiveSellingPrice < dbCostPrice) {
          return NextResponse.json(
            { error: `Selling price (${effectiveSellingPrice}) for item "${variant.product.name} - ${variant.name}" is lower than cost price (${dbCostPrice}).` },
            { status: 400 }
          );
        }

        // Verify stock level
        const stockLevel = await prisma.stockLevel.findUnique({
          where: { branchId_variantId: { branchId: existingOrder.branchId, variantId: item.variantId } }
        });
        const avail = stockLevel ? stockLevel.quantity : 0;
        if (qty > avail) {
          return NextResponse.json(
            { error: `Requested quantity (${qty}) for item "${variant.product.name} - ${variant.name}" exceeds available stock (${avail}).` },
            { status: 400 }
          );
        }
      }
    }

    // Validate payments
    let targetAmountPaid = existingOrder.amountPaid;
    let targetPaymentStatus = existingOrder.paymentStatus;

    if (targetStatus === "CANCELLED" && existingOrder.status !== "CANCELLED") {
      const refund = refundAmount !== undefined ? Number(refundAmount) : existingOrder.amountPaid;
      if (refund > existingOrder.amountPaid) {
        return NextResponse.json(
          { error: `Refund amount (${refund}) cannot exceed amount paid (${existingOrder.amountPaid}).` },
          { status: 400 }
        );
      }
      targetAmountPaid = existingOrder.amountPaid - refund;
      if (targetAmountPaid <= 0) {
        targetAmountPaid = 0;
        targetPaymentStatus = "PARTIAL";
      } else if (targetAmountPaid >= calculatedTotal) {
        targetPaymentStatus = "PAID";
      } else {
        targetPaymentStatus = "PARTIAL";
      }
    } else {
      if (targetStatus === "DRAFT") {
        targetAmountPaid = amountPaid !== undefined ? Math.max(0, Number(amountPaid)) : existingOrder.amountPaid;
        targetPaymentStatus = targetAmountPaid >= calculatedTotal && calculatedTotal > 0 ? "PAID" : "PARTIAL";
      } else {
        if (paymentStatus !== undefined) {
          if (paymentStatus === "PAID") {
            targetAmountPaid = calculatedTotal;
            targetPaymentStatus = "PAID";
          } else if (paymentStatus === "PARTIAL") {
            targetAmountPaid = amountPaid !== undefined ? Number(amountPaid) : existingOrder.amountPaid;
            targetPaymentStatus = "PARTIAL";
            const minRequired = calculatedTotal * 0.1;
            if (targetAmountPaid < minRequired || targetAmountPaid >= calculatedTotal) {
              return NextResponse.json(
                { error: `Partial payment amount (${targetAmountPaid}) must be at least 10% (${minRequired}) and less than total order price (${calculatedTotal}).` },
                { status: 400 }
              );
            }
          }
        } else if (amountPaid !== undefined) {
          const val = Number(amountPaid);
          if (val <= 0) {
            targetAmountPaid = 0;
            targetPaymentStatus = "PARTIAL";
          } else if (val >= calculatedTotal) {
            targetAmountPaid = calculatedTotal;
            targetPaymentStatus = "PAID";
          } else {
            targetAmountPaid = val;
            targetPaymentStatus = "PARTIAL";
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (note !== undefined) updateData.note = note;
    if (deliveryDate !== undefined) updateData.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;

    const targetIsDelivery = isDelivery !== undefined ? Boolean(isDelivery) : (targetStatus === "CONFIRMED" ? true : existingOrder.isDelivery);
    updateData.isDelivery = targetIsDelivery;

    if (targetIsDelivery) {
      const cust = existingOrder.customerId ? await prisma.customer.findUnique({
        where: { id: existingOrder.customerId },
        select: { name: true, phone: true, address: true }
      }) : null;

      updateData.deliveryCustomerName = deliveryCustomerName || existingOrder.deliveryCustomerName || cust?.name || null;
      updateData.deliveryPhone = deliveryPhone || existingOrder.deliveryPhone || cust?.phone || null;
      updateData.deliveryAddress = deliveryAddress || existingOrder.deliveryAddress || cust?.address || null;
    }

    updateData.amountPaid = targetAmountPaid;
    updateData.paymentStatus = targetPaymentStatus;
    updateData.subtotal = calculatedSubtotal;
    updateData.discount = calculatedDiscount;
    updateData.total = calculatedTotal;

    let needsStockDeduction = false;
    if (targetStatus === "COMPLETED" && existingOrder.status !== "COMPLETED") {
      needsStockDeduction = true;
    }

    let needsStockRestore = false;
    if (existingOrder.status === "COMPLETED" && targetStatus !== "COMPLETED") {
      needsStockRestore = true;
    }

    const paymentDifference = targetAmountPaid - existingOrder.amountPaid;

    const result = await prisma.$transaction(async (tx) => {
      // Recreate items if passed
      if (items) {
        // Fetch cost prices
        const variantIds = Array.from(new Set(items.map((i: SalesOrderItemInput) => i.variantId).filter(Boolean))) as string[];
        const dbVariants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } }
        });
        const variantMap = new Map(dbVariants.map(v => [v.id, v]));

        await tx.salesOrderItem.deleteMany({
          where: { salesOrderId: id }
        });

        await tx.salesOrderItem.createMany({
          data: items.map((item: SalesOrderItemInput) => {
            const variant = variantMap.get(item.variantId);
            const dbCost = variant?.costPrice || 0;
            const qty = Math.max(1, Number(item.quantity) || 1);
            const uPrice = Number(item.unitPrice) || 0;
            const itemDiscount = Number(item.discount) || 0;
            const lineTotal = (qty * uPrice) - itemDiscount;

            return {
              salesOrderId: id,
              variantId: item.variantId,
              quantity: qty,
              unitPrice: uPrice,
              unitCost: dbCost,
              discount: itemDiscount,
              total: item.total !== undefined ? Number(item.total) : lineTotal
            };
          })
        });
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id: id },
        data: updateData,
        include: {
          customer: true,
          items: {
            include: {
              variant: {
                include: { product: true }
              }
            }
          }
        }
      });

      if (needsStockDeduction) {
        const freshItems = await tx.salesOrderItem.findMany({
          where: { salesOrderId: id }
        });
        for (const item of freshItems) {
          await tx.stockLevel.upsert({
            where: {
              branchId_variantId: {
                branchId: existingOrder.branchId,
                variantId: item.variantId,
              }
            },
            update: {
              quantity: { decrement: item.quantity }
            },
            create: {
              branchId: existingOrder.branchId,
              variantId: item.variantId,
              quantity: -item.quantity
            }
          });
          await tx.inventoryLog.create({
            data: {
              branchId: existingOrder.branchId,
              variantId: item.variantId,
              change: -item.quantity,
              reason: StockChangeReason.SALES_ORDER_DELIVERED,
              note: `Sales Order ${existingOrder.id.slice(-6)} fulfilled.`
            }
          });
        }
      }

      if (needsStockRestore) {
        const freshItems = await tx.salesOrderItem.findMany({
          where: { salesOrderId: id }
        });
        for (const item of freshItems) {
          await tx.stockLevel.upsert({
            where: {
              branchId_variantId: {
                branchId: existingOrder.branchId,
                variantId: item.variantId,
              }
            },
            update: {
              quantity: { increment: item.quantity }
            },
            create: {
              branchId: existingOrder.branchId,
              variantId: item.variantId,
              quantity: item.quantity
            }
          });
          await tx.inventoryLog.create({
            data: {
              branchId: existingOrder.branchId,
              variantId: item.variantId,
              change: item.quantity,
              reason: StockChangeReason.ADJUSTMENT,
              note: `Sales Order ${existingOrder.id.slice(-6)} reversed from delivered.`
            }
          });
        }
      }

      if (paymentDifference !== 0) {
        await tx.orderPayment.create({
          data: {
            salesOrderId: existingOrder.id,
            amount: paymentDifference,
            method: paymentMethod || existingOrder.paymentMethod || "CASH",
            note: paymentDifference > 0 ? "Subsequent payment" : "Refund on cancellation"
          }
        });
      }

      return await tx.salesOrder.findUnique({
        where: { id: id },
        include: {
          customer: true,
          payments: { orderBy: { createdAt: "asc" } },
          items: {
            include: {
              variant: {
                include: { product: true }
              }
            }
          }
        }
      });
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error) {
    console.error("Update sales order error:", error);
    return NextResponse.json(
      { error: "Failed to update sales order" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Sales Order not found" }, { status: 404 });
    }

    const permCheck = checkStaffPermission(staff, "salesOrders", "write", existingOrder.branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    await prisma.$transaction(async (tx) => {
      if (existingOrder.status === "COMPLETED") {
        for (const item of existingOrder.items) {
          await tx.stockLevel.upsert({
            where: {
              branchId_variantId: {
                branchId: existingOrder.branchId,
                variantId: item.variantId,
              }
            },
            update: {
              quantity: { increment: item.quantity }
            },
            create: {
              branchId: existingOrder.branchId,
              variantId: item.variantId,
              quantity: item.quantity
            }
          });
          await tx.inventoryLog.create({
            data: {
              branchId: existingOrder.branchId,
              variantId: item.variantId,
              change: item.quantity,
              reason: StockChangeReason.ADJUSTMENT,
              note: `Sales Order ${existingOrder.id.slice(-6)} restored on deletion.`
            }
          });
        }
      }

      await tx.salesOrder.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete sales order error:", error);
    return NextResponse.json(
      { error: "Failed to delete sales order" },
      { status: 500 }
    );
  }
}
