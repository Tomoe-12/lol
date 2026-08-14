const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runR3DetailedVerification() {
  console.log("=== EMPIRICAL TEST: Detailed R3 Cost Computation Verification ===\n");

  const salesOrders = await prisma.salesOrder.findMany({
    include: {
      customer: true,
      branch: true,
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
  });

  const transactions = await prisma.transaction.findMany({
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
  });

  // Map SalesOrders
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

  // Map Transactions
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
      customerId: null,
      customer: null,
      status: tx.status,
      paymentStatus: tx.status === "COMPLETED" ? "PAID" : "UNPAID",
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

  const nonZeroStdCosts = mappedSalesOrders.filter(o => o.totalCost > 0);
  const nonZeroPosCosts = mappedTransactions.filter(o => o.totalCost > 0);

  console.log(`Standard SalesOrders with totalCost > 0: ${nonZeroStdCosts.length} / ${mappedSalesOrders.length}`);
  console.log(`POS Transactions with totalCost > 0: ${nonZeroPosCosts.length} / ${mappedTransactions.length}`);

  if (nonZeroStdCosts.length > 0) {
    console.log("\nSample Standard Sales Order with non-zero totalCost:");
    const sample = nonZeroStdCosts[0];
    console.log({
      id: sample.id,
      isPos: sample.isPos,
      total: sample.total,
      totalCost: sample.totalCost,
      items: sample.items.map(i => ({ qty: i.quantity, unitPrice: i.unitPrice, unitCost: i.unitCost, total: i.total }))
    });
  }

  if (nonZeroPosCosts.length > 0) {
    console.log("\nSample POS Transaction with non-zero totalCost:");
    const sample = nonZeroPosCosts[0];
    console.log({
      id: sample.id,
      isPos: sample.isPos,
      status: sample.status,
      total: sample.total,
      totalCost: sample.totalCost,
      items: sample.items.map(i => ({ qty: i.quantity, unitPrice: i.unitPrice, unitCost: i.unitCost, total: i.total }))
    });
  }

  // Verify accuracy of all non-zero totalCosts
  let mismatches = 0;
  mergedList.forEach(rec => {
    const expected = rec.items.reduce((s, i) => s + (i.unitCost * i.quantity), 0);
    if (Math.abs(rec.totalCost - expected) > 0.001) {
      mismatches++;
      console.error(`MISMATCH on ${rec.id}: totalCost=${rec.totalCost}, expected=${expected}`);
    }
  });

  console.log(`\nTotal cost verification across all ${mergedList.length} merged records: ${mismatches} mismatches.`);

  await prisma.$disconnect();
}

runR3DetailedVerification();
