import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { DepositStatus, PaymentMethod, SalesOrderStatus } from "@prisma/client";
import { CACHE_KEYS, invalidateCache } from "@/lib/redis";

export const dynamic = "force-dynamic";
const validPaymentMethods = new Set<PaymentMethod>([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.QR]);


export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId");
    if (staff.role !== "OWNER" && requestedBranchId && requestedBranchId !== staff.branchId) return NextResponse.json({ error: "Forbidden: Access is restricted to your assigned branch" }, { status: 403 });
    const branchId = staff.role === "OWNER" ? (requestedBranchId || undefined) : staff.branchId;
    const permission = checkStaffPermission(staff, "salesOrders", "read", branchId);
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const salesOrders = await prisma.salesOrder.findMany({
      where: branchId ? { branchId } : undefined,
      include: { customer: true, branch: true, payments: { orderBy: { createdAt: "asc" } }, items: { include: { variant: { include: { product: true, stockLevels: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ salesOrders: salesOrders.map((order) => ({ ...order, totalCost: null, isPos: false, remainingDeposit: order.amountPaid, remainingQuantity: order.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.fulfilledQuantity), 0) })) });
  } catch (error) {
    console.error("Fetch sales orders error:", error);
    return NextResponse.json({ error: "Failed to fetch sales orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { branchId: requestedBranchId, customerId, items, amountPaid = 0, paymentMethod, note, deliveryDate } = body;
    const branchId = staff.role === "OWNER" ? (requestedBranchId || staff.branchId) : staff.branchId;
    const permission = checkStaffPermission(staff, "salesOrders", "write", branchId);
    if (!permission.allowed) return permission.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!branchId || !customerId || !Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Customer, branch, and at least one item are required." }, { status: 400 });
    const deposit = Number(amountPaid);
    if (!Number.isFinite(deposit) || deposit < 0) return NextResponse.json({ error: "Deposit amount must be zero or greater." }, { status: 400 });
    if (deposit > 0 && (!paymentMethod || !validPaymentMethods.has(paymentMethod))) return NextResponse.json({ error: "A valid payment method is required for a deposit." }, { status: 400 });
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 400 });
    const variantIds = Array.from(new Set(items.map((item: { variantId?: string }) => item.variantId).filter(Boolean))) as string[];
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
    if (variantIds.length !== items.length) return NextResponse.json({ error: "The same product cannot be requested more than once." }, { status: 400 });
    if (variants.length !== variantIds.length) return NextResponse.json({ error: "Every order item must reference a valid product variant." }, { status: 400 });
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const normalizedItems = items.map((item: { variantId: string; quantity: number }) => {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0 || !variantMap.has(item.variantId)) throw new Error("Each requested quantity must be a whole number greater than zero.");
      return { variantId: item.variantId, quantity };
    });
    // Deposits may be collected while the request is still a Draft. The order
    // becomes Confirmed only after price and stock are reviewed explicitly.
    const status: SalesOrderStatus = "DRAFT";
    const depositStatus: DepositStatus = deposit <= 0 ? "NO_PAY" : "PARTIAL";
    const order = await prisma.$transaction(async (tx) => tx.salesOrder.create({
      data: {
        branchId, customerId, createdByStaffId: staff.id, status, paymentStatus: "PARTIAL", depositStatus, amountPaid: deposit,
        paymentMethod: deposit > 0 ? paymentMethod : null, subtotal: 0, discount: 0, total: 0, note,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null, isDelivery: false,
        items: { create: normalizedItems.map((item) => ({ variantId: item.variantId, requestedQuantity: item.quantity, quantity: item.quantity, fulfilledQuantity: 0, unitPrice: null, unitCost: null, total: null })) },
        ...(deposit > 0 ? { payments: { create: { amount: deposit, method: paymentMethod, collectedByStaffId: staff.id, note: "Sales Order deposit" } } } : {}),
      },
      include: { customer: true, items: { include: { variant: { include: { product: true } } } }, payments: true },
    }));
    await invalidateCache(CACHE_KEYS.dashboardStats(), CACHE_KEYS.dashboardStats(branchId));
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Create sales order error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create sales order" }, { status: 400 });
  }
}
