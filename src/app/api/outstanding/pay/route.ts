import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { PaymentMethod } from "@prisma/client";

const validPaymentMethods = new Set<PaymentMethod>([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.QR]);

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { salesOrderId, amount, method, note } = body;

    if (!salesOrderId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Sales order ID and a valid payment amount (> 0) are required." },
        { status: 400 }
      );
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: true,
        branch: true,
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
    }

    if (order.status === "DRAFT") {
      return NextResponse.json(
        { error: "Draft Sales Orders must receive their deposit through Sales Orders before fulfillment." },
        { status: 400 }
      );
    }

    const permCheck = checkStaffPermission(staff, "outstanding", "write", order.branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (!validPaymentMethods.has(method as PaymentMethod)) return NextResponse.json({ error: "Payment method must be Cash, Card, or QR." }, { status: 400 });
    const deliveryFeeDue = order.deliveryFeePayer === "CUSTOMER" ? order.deliveryFee : 0;
    const currentRemaining = Math.max(0, order.total + deliveryFeeDue - order.amountPaid);
    if (amount > currentRemaining) {
      return NextResponse.json(
        { error: `Payment amount (${amount.toLocaleString()} Ks) cannot exceed remaining debt (${currentRemaining.toLocaleString()} Ks).` },
        { status: 400 }
      );
    }

    const newAmountPaid = order.amountPaid + amount;
    const isFullyPaid = newAmountPaid >= order.total + deliveryFeeDue;
    const newPaymentStatus = isFullyPaid ? "PAID" : "PARTIAL";
    const paymentMethodEnum: PaymentMethod = (method as PaymentMethod) || "CASH";

    const updated = await prisma.$transaction(async (tx) => {
      // Create payment ledger record
      const payment = await tx.orderPayment.create({
        data: {
          salesOrderId: order.id,
          amount,
          method: paymentMethodEnum,
          note: note || "Debt collection payment",
        },
      });

      // Update SalesOrder record
      const updatedOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
          paymentMethod: paymentMethodEnum,
        },
        include: {
          customer: true,
          branch: true,
          payments: { orderBy: { createdAt: "desc" } },
        },
      });

      // Also log audit entry
      await tx.auditLog.create({
        data: {
          staffId: staff.id,
          action: "DEBT_COLLECTION_PAYMENT",
          details: `Collected ${amount.toLocaleString()} Ks debt payment for Sales Order #${order.id.slice(-6).toUpperCase()} (${order.customer?.name || "Customer"})`,
        },
      });

      return { payment, updatedOrder };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully collected ${amount.toLocaleString()} Ks debt payment!`,
      payment: updated.payment,
      order: updated.updatedOrder,
    });
  } catch (error) {
    console.error("POST /api/outstanding/pay error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process debt collection payment" },
      { status: 500 }
    );
  }
}
