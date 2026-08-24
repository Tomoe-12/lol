import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { DepositStatus, PaymentMethod, SalesOrderStatus } from "@prisma/client";

type OrderItemInput = { variantId: string; quantity: number; unitPrice?: number; discount?: number };
const validPaymentMethods = new Set<PaymentMethod>([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.QR]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.salesOrder.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return NextResponse.json({ error: "Sales Order not found" }, { status: 404 });
    const permission = checkStaffPermission(staff, "salesOrders", "write", existing.branchId);
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (existing.status === "CANCELLED") return NextResponse.json({ error: "Sales Order is already cancelled" }, { status: 400 });

    const body = await request.json();
    const targetStatus = (body.status || existing.status) as SalesOrderStatus;
    if (!["DRAFT", "CONFIRMED", "CANCELLED"].includes(targetStatus)) return NextResponse.json({ error: "Sales Orders can only be Draft, Confirmed, or Cancelled. Complete them in Sales Voucher." }, { status: 400 });

    const requestedItems: OrderItemInput[] = body.items || existing.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity, unitPrice: item.unitPrice ?? undefined, discount: item.discount }));
    if (body.items !== undefined && existing.status !== "DRAFT") return NextResponse.json({ error: "Only draft Sales Orders can be edited." }, { status: 400 });

    let normalizedItems: { variantId: string; quantity: number; unitPrice: number | null; unitCost: number | null; discount: number; total: number | null }[] | undefined;
    let calculatedSubtotal = 0;
    let calculatedDiscount = 0;
    let calculatedTotal = 0;

    if (targetStatus === "CONFIRMED") {
      if (!requestedItems.length) return NextResponse.json({ error: "At least one item is required before confirmation." }, { status: 400 });
      const ids = Array.from(new Set(requestedItems.map((item) => item.variantId))) as string[];
      const variants = await prisma.productVariant.findMany({ where: { id: { in: ids } }, include: { product: true } });
      if (variants.length !== ids.length) return NextResponse.json({ error: "Every order item must reference a valid product variant." }, { status: 400 });
      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

      normalizedItems = requestedItems.map((item) => {
        const variant = variantMap.get(item.variantId);
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const discount = Number(item.discount || 0);
        if (!variant || !Number.isInteger(quantity) || quantity <= 0) throw new Error("Each requested quantity must be a whole number greater than zero.");
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`Enter the agreed selling price for ${variant.product.name}.`);
        if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitPrice) throw new Error(`Invalid discount for ${variant.product.name}.`);
        const effectivePrice = (quantity * unitPrice - discount) / quantity;
        const catalogPrice = variant.price > 0 ? variant.price : variant.product.price;
        if (effectivePrice < variant.costPrice) throw new Error(`Agreed price for ${variant.product.name} cannot be below cost price.`);
        if (catalogPrice <= 0 || effectivePrice >= catalogPrice) throw new Error(`Agreed price for ${variant.product.name} must be below catalog price.`);
        return { variantId: item.variantId, quantity, unitPrice, unitCost: variant.costPrice, discount, total: quantity * unitPrice - discount };
      });

      for (const item of normalizedItems) {
        const stock = await prisma.stockLevel.findUnique({ where: { branchId_variantId: { branchId: existing.branchId, variantId: item.variantId } } });
        if (!stock || stock.quantity < item.quantity) {
          const variant = variantMap.get(item.variantId);
          throw new Error(`INSUFFICIENT_STOCK: ${variant?.product.name || "Item"} has only ${stock?.quantity || 0} available.`);
        }
      }
      calculatedSubtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0);
      calculatedDiscount = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
      calculatedTotal = calculatedSubtotal - calculatedDiscount;
    } else if (body.items !== undefined) {
      const ids = Array.from(new Set(requestedItems.map((item) => item.variantId))) as string[];
      const variants = await prisma.productVariant.findMany({ where: { id: { in: ids } } });
      if (variants.length !== ids.length) return NextResponse.json({ error: "Every order item must reference a valid product variant." }, { status: 400 });
      normalizedItems = requestedItems.map((item) => {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Each requested quantity must be a whole number greater than zero.");
        return { variantId: item.variantId, quantity, unitPrice: null, unitCost: null, discount: 0, total: null };
      });
    }

    const rawDeposit = body.amountPaid !== undefined ? Number(body.amountPaid) : existing.amountPaid;
    if (!Number.isFinite(rawDeposit) || rawDeposit < 0) return NextResponse.json({ error: "Deposit amount must be zero or greater." }, { status: 400 });
    if (targetStatus === "CONFIRMED" && rawDeposit > calculatedTotal) return NextResponse.json({ error: "Deposit cannot exceed the confirmed order total." }, { status: 400 });

    const refund = targetStatus === "CANCELLED" ? (body.refundAmount === undefined ? existing.amountPaid : Number(body.refundAmount)) : 0;
    if (refund < 0 || refund > existing.amountPaid) return NextResponse.json({ error: "Refund cannot exceed the recorded deposit." }, { status: 400 });
    const finalDeposit = targetStatus === "CANCELLED" ? existing.amountPaid - refund : rawDeposit;
    const finalTotal = targetStatus === "CONFIRMED" ? calculatedTotal : existing.total;
    const paymentStatus = targetStatus === "CONFIRMED" && finalDeposit >= finalTotal ? "PAID" : "PARTIAL";
    const depositStatus: DepositStatus = finalDeposit <= 0 ? "NO_PAY" : (paymentStatus === "PAID" ? "PAID" : "PARTIAL");
    const paymentDifference = targetStatus === "CANCELLED" ? -refund : rawDeposit - existing.amountPaid;
    if (paymentDifference > 0 && (!body.paymentMethod || !validPaymentMethods.has(body.paymentMethod as PaymentMethod))) return NextResponse.json({ error: "Payment method must be Cash, Card, or QR. Debt is not available for Sales Orders." }, { status: 400 });

    const order = await prisma.$transaction(async (tx) => {
      if (normalizedItems) {
        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
        await tx.salesOrderItem.createMany({ data: normalizedItems.map((item) => ({ salesOrderId: id, variantId: item.variantId, quantity: item.quantity, fulfilledQuantity: 0, unitPrice: item.unitPrice, unitCost: item.unitCost, discount: item.discount, total: item.total })) });
      }
      return tx.salesOrder.update({
        where: { id },
        data: {
          status: targetStatus, amountPaid: finalDeposit, depositStatus, paymentStatus,
          subtotal: targetStatus === "CONFIRMED" ? calculatedSubtotal : existing.subtotal,
          discount: targetStatus === "CONFIRMED" ? calculatedDiscount : existing.discount,
          total: finalTotal,
          paymentMethod: body.paymentMethod || existing.paymentMethod || null,
          note: body.note !== undefined ? body.note : existing.note,
          ...(paymentDifference !== 0 ? { payments: { create: { amount: paymentDifference, method: (body.paymentMethod || existing.paymentMethod || "CASH") as PaymentMethod, note: paymentDifference < 0 ? "Sales Order deposit refund" : "Additional Sales Order deposit" } } } : {}),
        },
        include: { customer: true, items: { include: { variant: { include: { product: true } } } }, payments: { orderBy: { createdAt: "asc" } } },
      });
    });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Update sales order error:", error);
    const message = error instanceof Error ? error.message : "Failed to update sales order";
    return NextResponse.json({ error: message.replace("INSUFFICIENT_STOCK: ", "") }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff, errorResponse } = await getAuthStaff(request);
  if (errorResponse) return errorResponse;
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.salesOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Sales Order not found" }, { status: 404 });
  const permission = checkStaffPermission(staff, "salesOrders", "write", existing.branchId);
  if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (existing.status === "COMPLETED") return NextResponse.json({ error: "Completed orders must be reversed from Sales Voucher." }, { status: 400 });
  await prisma.salesOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
