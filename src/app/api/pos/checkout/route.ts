import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymentMethod, StockChangeReason, TransactionStatus } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { isValidMyanmarPhone, normalizePhone } from "@/lib/phone";

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
      paymentMethod,
      cashReceived,
      changeGiven,
      note,
      receiptEmail,
      customerId,
      wholesaleSale,
      wholesalePaid,
      isDelivery,
      deliveryCustomerName,
      deliveryPhone,
      deliveryAddress,
      items,
    } = body;

    if (staff.role !== "OWNER" && body.branchId && body.branchId !== staff.branchId) {
      return NextResponse.json({ error: "Forbidden: POS checkout is restricted to your assigned branch" }, { status: 403 });
    }
    let branchId = staff.role !== "OWNER" ? staff.branchId : (body.branchId || staff.branchId);

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

    if (currency !== undefined && currency !== "MMK") {
      return NextResponse.json({ error: "Only MMK currency is supported" }, { status: 400 });
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

    if (isDelivery && (!deliveryCustomerName || !deliveryPhone || !deliveryAddress)) {
      return NextResponse.json({ error: "Delivery customer name, phone, and address are required" }, { status: 400 });
    }
    if (isDelivery && !isValidMyanmarPhone(normalizePhone(deliveryPhone))) {
      return NextResponse.json({ error: "Delivery phone must be exactly 11 digits and start with 09." }, { status: 400 });
    }
    const isWholesaleSale = wholesaleSale === true;
    const wholesalePayment = Number(wholesalePaid ?? 0);
    if (isWholesaleSale && !customerId) return NextResponse.json({ error: "A named customer is required for a wholesale / credit sale." }, { status: 400 });
    if (isWholesaleSale && (!Number.isFinite(wholesalePayment) || wholesalePayment < 0 || wholesalePayment > total)) return NextResponse.json({ error: "Wholesale payment must be between zero and the sale total." }, { status: 400 });
    if (isWholesaleSale && wholesalePayment === 0 && paymentMethod !== "DEBT") return NextResponse.json({ error: "No-pay wholesale sales must use the Credit payment method." }, { status: 400 });
    if (isWholesaleSale && wholesalePayment > 0 && paymentMethod === "DEBT") return NextResponse.json({ error: "Partial wholesale payments must use Cash, Card, or QR." }, { status: 400 });
    if (isWholesaleSale && (!Number.isFinite(Number(subtotal)) || Number(subtotal) < 0 || !Number.isFinite(Number(total)) || Number(total) < 0)) return NextResponse.json({ error: "Wholesale subtotal and total must be valid amounts." }, { status: 400 });
    if (isWholesaleSale) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 400 });
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
      catalogPrice?: number;
      availableStock?: number;
    };

    const normalizedItems = await Promise.all(
      items.map(async (item: CheckoutItemInput) => {
        const variantId = item.selectedVariant?.id || item.variantId;
        let productId = item.product?.id || item.productId;
        let costPrice = item.selectedVariant?.costPrice;
        let productName = item.product?.name;

        if (variantId && (isWholesaleSale || !productId || costPrice === undefined || !productName)) {
          const variant = await prisma.productVariant.findUnique({
            where: { id: variantId },
            include: { product: true, stockLevels: isWholesaleSale ? { where: { branchId }, select: { quantity: true } } : undefined },
          });
          if (variant) {
            productId = isWholesaleSale ? variant.productId : (productId || variant.productId);
            costPrice = isWholesaleSale ? variant.costPrice : (costPrice !== undefined ? costPrice : variant.costPrice);
            productName = isWholesaleSale ? variant.product?.name : (productName || variant.product?.name);
            return {
              ...item,
              productId,
              variantId,
              costPrice: costPrice || 0,
              productName: productName || "Product",
              catalogPrice: variant.price || variant.product?.price || 0,
              availableStock: variant.stockLevels?.[0]?.quantity ?? 0,
            };
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
      if (isWholesaleSale && item.catalogPrice !== undefined && item.unitPrice > item.catalogPrice) {
        return NextResponse.json({ error: `Selling price for ${item.productName} cannot be higher than the catalog price (${item.catalogPrice.toLocaleString()} Ks)` }, { status: 400 });
      }
      if (isWholesaleSale && item.availableStock !== undefined && item.quantity > item.availableStock) {
        return NextResponse.json({ error: `Not enough stock for ${item.productName}. Available: ${item.availableStock}` }, { status: 400 });
      }
      const itemSubtotal = item.unitPrice * item.quantity;
      if (!Number.isFinite(item.discount || 0) || (item.discount || 0) < 0 || (item.discount || 0) > itemSubtotal) {
        return NextResponse.json({ error: `Invalid discount for ${item.productName}` }, { status: 400 });
      }
    }

    if (isWholesaleSale) {
      const variantIds = normalizedItems.map((item) => item.variantId).filter(Boolean);
      if (new Set(variantIds).size !== variantIds.length) {
        return NextResponse.json({ error: "The same product cannot be added more than once." }, { status: 400 });
      }
      const calculatedSubtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      if (Math.abs(calculatedSubtotal - Number(subtotal)) > 0.01) {
        return NextResponse.json({ error: "Wholesale subtotal does not match the item quantities and prices." }, { status: 400 });
      }
      if (Number(discountAmount) < 0 || Number(discountAmount) > calculatedSubtotal || Math.abs(calculatedSubtotal - Number(discountAmount) - Number(total)) > 0.01) {
        return NextResponse.json({ error: "Wholesale total or discount does not match the item details." }, { status: 400 });
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
              error: `Selling price for ${item.productName} (${effectiveSellingPrice.toLocaleString()} Ks) cannot be lower than cost price (${item.costPrice.toLocaleString()} Ks)`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Run database operations in a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Create Transaction and TransactionItems
      const totalInMMK = total;
      
      const newTransaction = await tx.transaction.create({
        data: {
          branchId,
          staffId,
          customerId: customerId || null,
          subtotal,
          discountAmount,
          total,
          currency: "MMK",
          exchangeRate: 1,
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
            performedByStaffId: staff.id,
            transactionId: newTransaction.id,
            note: `POS checkout: Order #${newTransaction.id}`,
          },
        });
      }

      if (isWholesaleSale || isDelivery) {
        const wholesaleOrder = await tx.salesOrder.create({
          data: {
            branchId,
            customerId: customerId || null,
            status: isDelivery ? "DELIVERING" : "COMPLETED",
            paymentStatus: isWholesaleSale ? (wholesalePayment >= total ? "PAID" : "PARTIAL") : "PAID",
            depositStatus: isWholesaleSale ? (wholesalePayment <= 0 ? "NO_PAY" : wholesalePayment >= total ? "PAID" : "PARTIAL") : "PAID",
            subtotal,
            discount: discountAmount,
            total,
            amountPaid: isWholesaleSale ? wholesalePayment : total,
            paymentMethod: (isWholesaleSale ? paymentMethod : paymentMethod) as PaymentMethod,
            note: `POS transaction #${newTransaction.id}${note ? ` — ${note}` : ""}`,
            isDelivery,
            deliveryStatus: isDelivery ? "PENDING" : "DELIVERED",
            deliveryCustomerName: isDelivery ? deliveryCustomerName : null,
            deliveryPhone: isDelivery ? normalizePhone(deliveryPhone) : null,
            deliveryAddress: isDelivery ? deliveryAddress : null,
            createdByStaffId: staff.id,
            items: {
              create: normalizedItems.map((item) => ({
                variantId: item.variantId as string,
                requestedQuantity: item.quantity,
                quantity: item.quantity,
                fulfilledQuantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.costPrice || 0,
                discount: item.discount || 0,
                total: (item.unitPrice * item.quantity) - (item.discount || 0),
              })),
            },
            payments: isWholesaleSale && wholesalePayment > 0 ? { create: { amount: wholesalePayment, method: paymentMethod as PaymentMethod, collectedByStaffId: staff.id, note: "Wholesale sale payment at POS" } } : undefined,
          },
        });
        if (wholesaleOrder) {
          await tx.inventoryLog.updateMany({ where: { transactionId: newTransaction.id }, data: { salesOrderId: wholesaleOrder.id } });
        }
      }

      // 3. Log Audit Activity. Sales Orders are fulfilled separately through
      // /api/pos/fulfill-sales-order and are never created by a normal voucher.
      await tx.auditLog.create({
        data: {
          staffId,
          action: "CHECKOUT_COMPLETED",
          details: `Processed transaction #${newTransaction.id} of total ${total} MMK.`,
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
