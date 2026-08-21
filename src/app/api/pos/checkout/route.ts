import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymentMethod, StockChangeReason, TransactionStatus } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      subtotal,
      discountAmount,
      total,
      currency,
      exchangeRate,
      paymentMethod,
      cashReceived,
      changeGiven,
      note,
      receiptEmail,
      items,
    } = body;

    let branchId = staff.role !== "OWNER" ? (staff.branchId || body.branchId) : (body.branchId || staff.branchId);

    // Validate branchId exists in database to prevent P2003 foreign key constraint errors
    const targetBranch = branchId ? await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    }) : null;

    if (!targetBranch) {
      const staffBranch = staff.branchId ? await prisma.branch.findUnique({
        where: { id: staff.branchId },
        select: { id: true },
      }) : null;

      if (staffBranch) {
        branchId = staffBranch.id;
      } else {
        const firstBranch = await prisma.branch.findFirst({ select: { id: true } });
        if (firstBranch) {
          branchId = firstBranch.id;
        } else {
          return NextResponse.json(
            { error: "No valid branch found in system. Please setup a branch first." },
            { status: 400 }
          );
        }
      }
    }

    const staffId = staff.id;

    const permCheck = checkStaffPermission(staff, "pos", "write", branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    // Basic validation
    if (!branchId || !staffId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: branchId, staffId, or items" },
        { status: 400 }
      );
    }

    // 1. Discount Validation (R1)
    if (typeof discountAmount !== "number" || discountAmount < 0 || discountAmount > subtotal) {
      return NextResponse.json(
        { error: "Invalid discount amount. Discount must be between 0 and subtotal." },
        { status: 400 }
      );
    }

    // Normalize item shapes to support both product/selectedVariant objects and direct productId/variantId strings
    type CheckoutItemInput = {
      productId?: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      costPrice?: number;
      productName?: string;
      product?: { id?: string; name?: string };
      selectedVariant?: { id?: string; costPrice?: number };
    };

    const normalizedItems = await Promise.all(
      items.map(async (item: CheckoutItemInput) => {
        const variantId = item.selectedVariant?.id || item.variantId;
        let productId = item.product?.id || item.productId;
        let costPrice = item.selectedVariant?.costPrice;
        let productName = item.product?.name;

        if (variantId && (!productId || costPrice === undefined || !productName)) {
          const variant = await prisma.productVariant.findUnique({
            where: { id: variantId },
            include: { product: true },
          });
          if (variant) {
            productId = productId || variant.productId;
            costPrice = costPrice !== undefined ? costPrice : variant.costPrice;
            productName = productName || variant.product?.name;
          }
        }

        return {
          ...item,
          productId,
          variantId,
          costPrice: costPrice || 0,
          productName: productName || "Product",
        };
      })
    );

    for (const item of normalizedItems) {
      if (!item.productId || !item.variantId) {
        return NextResponse.json({ error: `A valid product and variant are required for ${item.productName}` }, { status: 400 });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ error: "Item quantity must be a whole number greater than 0" }, { status: 400 });
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
        return NextResponse.json({ error: `Selling price for ${item.productName} must be greater than 0` }, { status: 400 });
      }
      const itemSubtotal = item.unitPrice * item.quantity;
      if (!Number.isFinite(item.discount || 0) || (item.discount || 0) < 0 || (item.discount || 0) > itemSubtotal) {
        return NextResponse.json({ error: `Invalid discount for ${item.productName}` }, { status: 400 });
      }
    }

    // 2. Minimum Selling Price Enforcement (R2)
    for (const item of normalizedItems) {
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: "Item quantity must be greater than 0" },
          { status: 400 }
        );
      }

      if (item.costPrice > 0) {
        const effectiveSellingPrice = (item.unitPrice * item.quantity - (item.discount || 0)) / item.quantity;
        if (effectiveSellingPrice < item.costPrice) {
          return NextResponse.json(
            {
              error: `Selling price for ${item.productName} (${effectiveSellingPrice} Ks) cannot be lower than cost price (${item.costPrice} Ks)`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Run database operations in a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Create Transaction and TransactionItems
      const totalInMMK = currency === "USD" ? total * exchangeRate : total;
      
      const newTransaction = await tx.transaction.create({
        data: {
          branchId,
          staffId,
          subtotal,
          discountAmount,
          total,
          currency,
          exchangeRate,
          totalInMMK,
          paymentMethod: paymentMethod as PaymentMethod,
          cashReceived,
          changeGiven,
          status: TransactionStatus.COMPLETED,
          note,
          receiptEmail,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.costPrice || 0,
              discount: item.discount || 0,
              total: (item.unitPrice * item.quantity) - (item.discount || 0),
              note: item.note || null,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          branch: true,
          staff: true,
        },
      });

      // 2. Update stock levels and create inventory logs
      for (const item of normalizedItems) {
        const variantId = item.variantId;
        if (!variantId) {
          throw new Error(`Variant ID is missing for item ${item.productName}`);
        }
        const quantity = item.quantity;

        const currentStock = await tx.stockLevel.findUnique({
          where: { branchId_variantId: { branchId, variantId } },
        });
        if (!currentStock || currentStock.quantity < quantity) {
          throw new Error(`INSUFFICIENT_STOCK: ${item.productName} has only ${currentStock?.quantity || 0} available`);
        }

        await tx.stockLevel.update({
          where: {
            branchId_variantId: {
              branchId,
              variantId,
            },
          },
          data: { quantity: { decrement: quantity } },
        });

        // Log the inventory deduction
        await tx.inventoryLog.create({
          data: {
            branchId,
            variantId,
            change: 0 - quantity,
            reason: StockChangeReason.SALE,
            note: `POS checkout: Order #${newTransaction.id}`,
          },
        });
      }

      // 3. If delivery, customerId is provided, or paymentMethod is DEBT or amountPaid < total, create linked SalesOrder for delivery & outstanding tracking
      const paidAmount = paymentMethod === "DEBT" ? (cashReceived || 0) : (paymentMethod === "CASH" || paymentMethod === "CARD" || paymentMethod === "QR" ? totalInMMK : (cashReceived || totalInMMK));
      const isPartialOrDebt = paymentMethod === "DEBT" || paidAmount < totalInMMK;

      if (body.isDelivery || body.customerId || isPartialOrDebt) {
        await tx.salesOrder.create({
          data: {
            branchId,
            customerId: body.customerId || null,
            status: "COMPLETED",
            paymentStatus: isPartialOrDebt ? "PARTIAL" : "PAID",
            paymentMethod: paymentMethod as PaymentMethod,
            subtotal,
            discount: discountAmount,
            total: totalInMMK,
            amountPaid: Math.min(paidAmount, totalInMMK),
            note: note || (body.isDelivery ? "POS Delivery Order" : "POS Transaction"),
            isDelivery: Boolean(body.isDelivery),
            deliveryStatus: "PENDING",
            deliveryCustomerName: body.deliveryCustomerName || null,
            deliveryPhone: body.deliveryPhone || null,
            deliveryAddress: body.deliveryAddress || null,
            items: {
              create: normalizedItems.map((item) => ({
                variantId: item.variantId || item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.costPrice || 0,
                discount: item.discount || 0,
                total: (item.unitPrice * item.quantity) - (item.discount || 0),
              })),
            },
            ...(paidAmount > 0 ? {
              payments: {
                create: {
                  amount: Math.min(paidAmount, totalInMMK),
                  method: paymentMethod as PaymentMethod,
                  note: "Initial payment at POS checkout",
                },
              },
            } : {}),
          },
        });
      }

      // 4. Log Audit Activity
      await tx.auditLog.create({
        data: {
          staffId,
          action: "CHECKOUT_COMPLETED",
          details: `Processed transaction #${newTransaction.id} of total ${total} ${currency}.`,
        },
      });

      return newTransaction;
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Checkout transaction error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json({ error: errorMessage.replace("INSUFFICIENT_STOCK: ", "") }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
