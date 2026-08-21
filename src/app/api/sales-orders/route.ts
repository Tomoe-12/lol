import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { StockChangeReason } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    
    if (staff.role !== "OWNER" && branchId && branchId !== staff.branchId) {
      return NextResponse.json({ error: "Forbidden: Access is restricted to your assigned branch" }, { status: 403 });
    }

    const effectiveBranchId = staff.role === "OWNER" ? (branchId || undefined) : staff.branchId;

    const permCheck = checkStaffPermission(staff, "salesOrders", "read", effectiveBranchId);
    if (!permCheck.allowed) {
      const posCheck = checkStaffPermission(staff, "pos", "read", effectiveBranchId);
      if (!posCheck.allowed) {
        return posCheck.errorResponse || permCheck.errorResponse || NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const [salesOrders, transactions] = await Promise.all([
      prisma.salesOrder.findMany({
        where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
        include: {
          customer: true,
          branch: true,
          payments: {
            orderBy: { createdAt: "asc" },
          },
          items: {
            include: {
              variant: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.findMany({
        where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
        include: {
          branch: true,
          staff: true,
          items: {
            include: {
              product: true,
              variant: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const mappedSalesOrders = salesOrders.map((order) => {
      const items = order.items.map((item) => {
        const unitCost = item.unitCost || item.variant?.costPrice || 0;
        return {
          ...item,
          unitCost,
        };
      });
      const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
      return {
        ...order,
        items,
        totalCost,
        isPos: false,
      };
    });

    const mappedTransactions = transactions.map((tx) => {
      const items = tx.items.map((item) => {
        const unitCost = item.unitCost || item.variant?.costPrice || 0;
        const unitPrice = item.unitPrice;
        const itemTotal = item.total;
        const productName = item.product?.name || item.variant?.product?.name || "Product";
        const variantName = item.variant?.name || "";
        const barcode = item.variant?.barcode || "";

        return {
          id: item.id,
          salesOrderId: tx.id,
          variantId: item.variantId || "",
          quantity: item.quantity,
          unitPrice,
          unitCost,
          discount: item.discount,
          total: itemTotal,
          variant: {
            id: item.variantId || item.productId,
            productId: item.productId,
            name: variantName,
            barcode,
            costPrice: unitCost,
            product: {
              id: item.productId,
              name: productName,
              price: unitPrice,
            },
          },
        };
      });

      const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

      return {
        id: tx.id,
        branchId: tx.branchId,
        branch: tx.branch,
        staffId: tx.staffId,
        staff: tx.staff ? { id: tx.staff.id, name: tx.staff.name } : null,
        customerId: null,
        customer: null,
        status: tx.status,
        paymentStatus: tx.status === "COMPLETED" ? "PAID" : "PARTIAL",
        paymentMethod: tx.paymentMethod,
        subtotal: tx.subtotal,
        discount: tx.discountAmount,
        total: tx.total,
        totalCost,
        amountPaid: tx.status === "COMPLETED" ? tx.total : 0,
        note: tx.note || "POS Transaction",
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        items,
        isPos: true,
      };
    });

    const mergedList = [...mappedSalesOrders, ...mappedTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ salesOrders: mergedList });
  } catch (error) {
    console.error("Fetch sales orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { 
      branchId, 
      customerId, 
      items, // { variantId, quantity, unitPrice, discount, total }
      status, 
      paymentStatus,
      paymentMethod,
      amountPaid,
      subtotal,
      discount,
      total,
      note,
      deliveryDate
    } = body;

    const targetBranchId = branchId || staff.branchId;

    const permCheck = checkStaffPermission(staff, "salesOrders", "write", targetBranchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (!targetBranchId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine if DRAFT is triggered purely by request status
    const isDraft = status === "DRAFT";

    const variantIds = Array.from(new Set(items.map((i: { variantId: string }) => i.variantId).filter(Boolean)));
    const dbVariants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true }
    });
    const variantMap = new Map(dbVariants.map(v => [v.id, v]));

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        return NextResponse.json({ error: `Variant not found: ${item.variantId || "missing variant"}` }, { status: 400 });
      }
      const qty = Number(item.quantity);
      const uPrice = Number(item.unitPrice);
      const itemDiscount = Number(item.discount) || 0;
      if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(uPrice) || uPrice <= 0) {
        return NextResponse.json({ error: "Each sales-order item requires a whole-number quantity and selling price greater than 0." }, { status: 400 });
      }
      if (!Number.isFinite(itemDiscount) || itemDiscount < 0 || itemDiscount > qty * uPrice) {
        return NextResponse.json({ error: "Item discount must be between 0 and the item subtotal." }, { status: 400 });
      }
      const effectiveSellingPrice = uPrice - (itemDiscount / qty);
      const dbCostPrice = variant.costPrice || 0;

      if (!isDraft) {
        if (effectiveSellingPrice < dbCostPrice) {
          return NextResponse.json(
            { error: `Selling price (${effectiveSellingPrice}) for item "${variant.product.name} - ${variant.name}" is lower than cost price (${dbCostPrice}).` },
            { status: 400 }
          );
        }

        const stockLevel = await prisma.stockLevel.findUnique({
          where: { branchId_variantId: { branchId: targetBranchId, variantId: item.variantId } }
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

    // Calculate order prices
    const calculatedSubtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const calculatedDiscount = items.reduce((sum: number, item: { discount?: number }) => sum + (Number(item.discount) || 0), 0);
    const calculatedTotal = total !== undefined ? Number(total) : (calculatedSubtotal - calculatedDiscount);

    // R2 Backend Validation: Validate paymentStatus & amountPaid
    let finalAmountPaid = 0;
    let effectivePaymentStatus = paymentStatus || "PARTIAL";

    if (isDraft) {
      finalAmountPaid = Math.max(0, Number(amountPaid) || 0);
      effectivePaymentStatus = finalAmountPaid >= calculatedTotal && calculatedTotal > 0 ? "PAID" : "PARTIAL";
    } else {
      if (effectivePaymentStatus === "PARTIAL") {
        const numericAmountPaid = Number(amountPaid) || 0;
        const minRequired = calculatedTotal * 0.1;
        if (numericAmountPaid < minRequired || numericAmountPaid >= calculatedTotal) {
          return NextResponse.json(
            { error: `Partial payment amount (${numericAmountPaid}) must be at least 10% (${minRequired}) and less than total order price (${calculatedTotal}).` },
            { status: 400 }
          );
        }
        finalAmountPaid = numericAmountPaid;
      } else if (effectivePaymentStatus === "PAID") {
        finalAmountPaid = calculatedTotal;
      } else {
        finalAmountPaid = 0;
      }
    }

    const targetStatus = isDraft ? "DRAFT" : (status || "CONFIRMED");

    let customerInfo: { name: string; phone: string | null; address: string | null } | null = null;
    if (customerId) {
      customerInfo = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true, phone: true, address: true }
      });
    }

    const isDeliveryOrder = body.isDelivery !== undefined ? Boolean(body.isDelivery) : (targetStatus === "CONFIRMED");

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.salesOrder.create({
        data: {
          branchId: targetBranchId,
          customerId: customerId || null,
          status: targetStatus,
          paymentStatus: effectivePaymentStatus,
          paymentMethod: finalAmountPaid > 0 ? (paymentMethod || "CASH") : null,
          amountPaid: finalAmountPaid,
          subtotal: subtotal !== undefined ? Number(subtotal) : calculatedSubtotal,
          discount: discount !== undefined ? Number(discount) : calculatedDiscount,
          total: calculatedTotal,
          note,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          isDelivery: isDeliveryOrder,
          deliveryStatus: "PENDING",
          deliveryCustomerName: body.deliveryCustomerName || customerInfo?.name || null,
          deliveryPhone: body.deliveryPhone || customerInfo?.phone || null,
          deliveryAddress: body.deliveryAddress || customerInfo?.address || null,
          items: {
            create: items.map((item: { variantId: string; quantity: number; unitPrice: number; unitCost?: number; discount?: number; total?: number }) => {
              const variant = variantMap.get(item.variantId);
              const dbCostPrice = variant?.costPrice || 0;
              const qty = Math.max(1, Number(item.quantity) || 1);
              const uPrice = Number(item.unitPrice) || 0;
              const itemDiscount = Number(item.discount) || 0;
              const lineTotal = (qty * uPrice) - itemDiscount;

              return {
                variantId: item.variantId,
                quantity: qty,
                unitPrice: uPrice,
                unitCost: dbCostPrice,
                discount: itemDiscount,
                total: item.total !== undefined ? Number(item.total) : lineTotal
              };
            })
          },
          ...(finalAmountPaid > 0 ? {
            payments: {
              create: {
                amount: finalAmountPaid,
                method: paymentMethod || "CASH",
                note: "Initial payment on order creation"
              }
            }
          } : {})
        },
        include: {
          customer: true,
          items: {
            include: {
              variant: {
                include: {
                  product: true
                }
              }
            }
          }
        }
      });

      if (targetStatus === "COMPLETED") {
        for (const item of items) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          await tx.stockLevel.upsert({
            where: {
              branchId_variantId: {
                branchId: targetBranchId,
                variantId: item.variantId,
              }
            },
            update: {
              quantity: { decrement: qty }
            },
            create: {
              branchId: targetBranchId,
              variantId: item.variantId,
              quantity: -qty
            }
          });
          await tx.inventoryLog.create({
            data: {
              branchId: targetBranchId,
              variantId: item.variantId,
              change: -qty,
              reason: StockChangeReason.SALES_ORDER_DELIVERED,
              note: `Sales Order ${createdOrder.id.slice(-6)} delivered on creation.`
            }
          });
        }
      }

      return createdOrder;
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Create sales order error:", error);
    return NextResponse.json(
      { error: "Failed to create sales order" },
      { status: 500 }
    );
  }
}
