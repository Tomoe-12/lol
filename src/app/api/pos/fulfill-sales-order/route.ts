import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { DeliveryFeePayer, ExpenseCategory, PaymentMethod, SalesOrderStatus, StockChangeReason, TransactionStatus } from "@prisma/client";

type FulfillmentItem = { variantId: string; quantity: number; unitPrice: number; discount?: number };
const validPaymentMethods = new Set<PaymentMethod>([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.QR]);

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json() as {
      salesOrderId?: string;
      items?: FulfillmentItem[];
      discountAmount?: number;
      paymentMethod?: PaymentMethod;
      amountCollected?: number;
      cashReceived?: number;
      changeGiven?: number;
      note?: string;
      fulfillmentMode?: "STORE" | "DELIVERY";
      deliveryFee?: number;
      deliveryFeePayer?: DeliveryFeePayer;
      deliveryAddress?: string;
      deliveryPhone?: string;
    };
    if (!body.salesOrderId || !Array.isArray(body.items) || body.items.length === 0) return NextResponse.json({ error: "Sales order and fulfillment items are required." }, { status: 400 });

    const order = await prisma.salesOrder.findUnique({ where: { id: body.salesOrderId }, include: { items: true, customer: true } });
    if (!order) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
    if (order.status !== "CONFIRMED") return NextResponse.json({ error: "Only confirmed Sales Orders can be fulfilled in Sales Voucher." }, { status: 400 });
    const permission = checkStaffPermission(staff, "pos", "write", order.branchId);
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const variantIds = Array.from(new Set(body.items.map((item) => item.variantId))) as string[];
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const orderItemMap = new Map(order.items.map((item) => [item.variantId, item]));
    if (variants.length !== variantIds.length) return NextResponse.json({ error: "A fulfillment item references an unknown product variant." }, { status: 400 });

    const normalized = body.items.map((item) => {
      const orderItem = orderItemMap.get(item.variantId);
      const variant = variantMap.get(item.variantId);
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const discount = Number(item.discount || 0);
      if (!orderItem || !variant) throw new Error("Every fulfillment item must belong to the Sales Order.");
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > orderItem.quantity - orderItem.fulfilledQuantity) throw new Error(`Fulfillment quantity for ${variant.product.name} exceeds the remaining requested quantity.`);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`A final selling price is required for ${variant.product.name}.`);
      if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitPrice) throw new Error(`Invalid discount for ${variant.product.name}.`);
      const effectivePrice = (quantity * unitPrice - discount) / quantity;
      if (effectivePrice < variant.costPrice) throw new Error(`Selling price for ${variant.product.name} cannot be lower than cost price.`);
      const catalogPrice = variant.price > 0 ? variant.price : variant.product.price;
      if (catalogPrice <= 0 || effectivePrice >= catalogPrice) throw new Error(`Final sale price for ${variant.product.name} must be below the catalog price.`);
      return { ...item, quantity, unitPrice, discount, variant, orderItem, lineTotal: quantity * unitPrice - discount };
    });

    const subtotal = normalized.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const itemDiscount = normalized.reduce((sum, item) => sum + item.discount, 0);
    const orderDiscount = Number(body.discountAmount || 0);
    if (!Number.isFinite(orderDiscount) || orderDiscount < 0 || orderDiscount > subtotal - itemDiscount) return NextResponse.json({ error: "Order discount cannot exceed the fulfillment subtotal." }, { status: 400 });
    const total = subtotal - itemDiscount - orderDiscount;
    const fulfillmentMode = body.fulfillmentMode || "STORE";
    const deliveryFee = Number(body.deliveryFee || 0);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) return NextResponse.json({ error: "Delivery fee must be zero or greater." }, { status: 400 });
    if (fulfillmentMode === "DELIVERY" && deliveryFee > 0 && !body.deliveryFeePayer) return NextResponse.json({ error: "Choose who pays the delivery fee." }, { status: 400 });
    if (fulfillmentMode === "DELIVERY" && !(body.deliveryAddress || order.customer?.address)) return NextResponse.json({ error: "A delivery address is required." }, { status: 400 });
    const amountCollected = Number(body.amountCollected || 0);
    if (!Number.isFinite(amountCollected) || amountCollected < 0) return NextResponse.json({ error: "Collected amount must be zero or greater." }, { status: 400 });
    const totalPaidAfter = order.amountPaid + amountCollected;
    if (totalPaidAfter > total) return NextResponse.json({ error: "Collected amount plus the existing deposit cannot exceed the final sale total." }, { status: 400 });
    const paymentMethod = (body.paymentMethod || order.paymentMethod || "CASH") as PaymentMethod;
    if (amountCollected > 0 && !validPaymentMethods.has(paymentMethod)) return NextResponse.json({ error: "Payment method must be Cash, Card, or QR." }, { status: 400 });
    if (fulfillmentMode === "STORE" && amountCollected !== Math.max(0, total - order.amountPaid)) return NextResponse.json({ error: "Collect the exact remaining balance before completing the in-store fulfillment." }, { status: 400 });

    const transaction = await prisma.$transaction(async (tx) => {
      for (const item of normalized) {
        const stock = await tx.stockLevel.findUnique({ where: { branchId_variantId: { branchId: order.branchId, variantId: item.variantId } } });
        if (!stock || stock.quantity < item.quantity) throw new Error(`INSUFFICIENT_STOCK: ${item.variant.product.name} has only ${stock?.quantity || 0} available.`);
      }
      const created = await tx.transaction.create({
        data: {
          branchId: order.branchId,
          staffId: staff.id,
          subtotal,
          discountAmount: itemDiscount + orderDiscount,
          total,
          currency: "MMK",
          exchangeRate: 1,
          totalInMMK: total,
          paymentMethod,
          cashReceived: body.cashReceived,
          changeGiven: body.changeGiven,
          status: TransactionStatus.COMPLETED,
          note: body.note || `Fulfillment of Sales Order #${order.id.slice(-6).toUpperCase()}`,
          items: { create: normalized.map((item) => ({ productId: item.variant.productId, variantId: item.variantId, quantity: item.quantity, unitPrice: item.unitPrice, unitCost: item.variant.costPrice, discount: item.discount, total: item.lineTotal })) },
        },
        include: {
          branch: true,
          staff: { select: { id: true, name: true } },
          items: { include: { product: true, variant: true } },
        },
      });
      for (const item of normalized) {
        await tx.stockLevel.update({ where: { branchId_variantId: { branchId: order.branchId, variantId: item.variantId } }, data: { quantity: { decrement: item.quantity } } });
        await tx.inventoryLog.create({ data: { branchId: order.branchId, variantId: item.variantId, change: -item.quantity, reason: StockChangeReason.SALE, note: `Sales Voucher fulfillment for Order #${order.id.slice(-6).toUpperCase()}` } });
        await tx.salesOrderItem.update({ where: { id: item.orderItem.id }, data: { fulfilledQuantity: { increment: item.quantity }, unitPrice: item.unitPrice, unitCost: item.variant.costPrice, discount: item.discount, total: item.lineTotal } });
      }
      if (amountCollected > 0) await tx.orderPayment.create({ data: { salesOrderId: order.id, amount: amountCollected, method: paymentMethod, note: "Payment collected at Sales Voucher" } });
      const refreshedItems = await tx.salesOrderItem.findMany({ where: { salesOrderId: order.id } });
      const fullyFulfilled = refreshedItems.every((item) => item.fulfilledQuantity >= item.quantity);
      const finalStatus: SalesOrderStatus = fulfillmentMode === "DELIVERY" ? "DELIVERING" : (fullyFulfilled ? "COMPLETED" : "CONFIRMED");
      const updatedOrder = await tx.salesOrder.update({ where: { id: order.id }, data: { status: finalStatus, subtotal, discount: itemDiscount + orderDiscount, total, amountPaid: totalPaidAfter, paymentStatus: totalPaidAfter >= total ? "PAID" : "PARTIAL", ...(fulfillmentMode === "DELIVERY" ? { isDelivery: true, deliveryStatus: "PENDING", deliveryFee, deliveryFeePayer: body.deliveryFeePayer || null, deliveryCustomerName: order.customer?.name || null, deliveryPhone: body.deliveryPhone || order.customer?.phone || null, deliveryAddress: body.deliveryAddress || order.customer?.address || null } : {}) } });
      if (fulfillmentMode === "DELIVERY" && deliveryFee > 0 && body.deliveryFeePayer === DeliveryFeePayer.STORE) {
        await tx.expense.create({
          data: {
            branchId: order.branchId,
            category: ExpenseCategory.OTHER,
            amount: deliveryFee,
            currency: "MMK",
            note: `Delivery fee paid by store for Sales Order #${order.id.slice(-6).toUpperCase()}`,
          },
        });
      }
      await tx.auditLog.create({ data: { staffId: staff.id, action: "SALES_ORDER_FULFILLED", details: `Fulfilled Sales Order #${order.id.slice(-6).toUpperCase()} through Sales Voucher.` } });
      return { created, updatedOrder };
    });
    return NextResponse.json({ success: true, transaction: transaction.created, order: transaction.updatedOrder });
  } catch (error) {
    console.error("Sales Order fulfillment error:", error);
    const message = error instanceof Error ? error.message : "Failed to fulfill sales order.";
    return NextResponse.json({ error: message.replace("INSUFFICIENT_STOCK: ", "") }, { status: 400 });
  }
}
