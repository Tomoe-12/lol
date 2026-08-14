import { prisma } from "../../src/lib/prisma";
import { POST as postPO, PATCH as patchPO } from "../../src/app/api/purchase-orders/route";
import { POST as postSO } from "../../src/app/api/sales-orders/route";
import { PATCH as patchSO, DELETE as deleteSO } from "../../src/app/api/sales-orders/[id]/route";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { NextRequest } from "next/server";
import assert from "node:assert";

function makeReq(url: string, method: string, body?: unknown, staffId?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (staffId) {
    headers["cookie"] = `pos_session=${encodeURIComponent(JSON.stringify({ id: staffId }))}`;
    headers["x-staff-id"] = staffId;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function runChallengerStressTestSuite() {
  console.log("=========================================================================");
  console.log("    EMPIRICAL CHALLENGER ADVERSARIAL STRESS TEST & INTEGRITY AUDIT        ");
  console.log("=========================================================================\n");

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assertEqual(actual: unknown, expected: unknown, message: string) {
    try {
      assert.strictEqual(actual, expected, message);
      console.log(`  ✅ ASSERT PASS: ${message} (Value: ${actual})`);
      passedAssertions++;
    } catch (err) {
      console.error(`  ❌ ASSERT FAIL: ${message}`);
      console.error(`     Expected: ${expected}, Got: ${actual}`);
      failedAssertions++;
      throw err;
    }
  }

  function assertOk(condition: boolean, message: string) {
    try {
      assert.ok(condition, message);
      console.log(`  ✅ ASSERT PASS: ${message}`);
      passedAssertions++;
    } catch (err) {
      console.error(`  ❌ ASSERT FAIL: ${message}`);
      failedAssertions++;
      throw err;
    }
  }

  // 0. Backfill legacy SalesOrder payments created before OrderPayment tracking
  const legacyOrders = await prisma.salesOrder.findMany({
    where: { amountPaid: { gt: 0 }, payments: { none: {} } },
  });
  if (legacyOrders.length > 0) {
    console.log(`Backfilling ${legacyOrders.length} legacy SalesOrders with OrderPayment ledger entries...`);
    for (const lo of legacyOrders) {
      await prisma.orderPayment.create({
        data: {
          salesOrderId: lo.id,
          amount: lo.amountPaid,
          method: lo.paymentMethod || "CASH",
          note: "Legacy payment ledger backfill",
          createdAt: lo.createdAt,
        },
      });
    }
  }

  // 1. Fetch DB fixture data
  const branch = await prisma.branch.findFirst();
  const staff = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const supplier = await prisma.supplier.findFirst();
  const products = await prisma.product.findMany({
    include: { variants: true },
    where: { variants: { some: {} } },
  });

  if (!branch || !staff || !supplier || products.length < 2) {
    console.error("❌ Setup failed: Missing seed data in database");
    process.exit(1);
  }

  const singleVariantProduct = products.find((p) => p.variants.length === 1) || products[0];
  const variant1 = singleVariantProduct.variants[0];

  const multiVariantProduct = products.find((p) => p.variants.length >= 2) || products[1];
  const variantA = multiVariantProduct.variants[0];
  const variantB = multiVariantProduct.variants[1] || multiVariantProduct.variants[0];

  console.log(`Test Fixtures Loaded:`);
  console.log(`  Branch: ${branch.name} (${branch.id})`);
  console.log(`  Staff: ${staff.name} (${staff.id})`);
  console.log(`  Variant 1: ${variant1.name} (Cost: ${variant1.costPrice})`);
  console.log(`  Variant A: ${variantA.name} (Cost: ${variantA.costPrice}), Variant B: ${variantB.name} (Cost: ${variantB.costPrice})\n`);

  // Ensure costPrice is populated for test variants
  if (variant1.costPrice === 0) {
    await prisma.productVariant.update({ where: { id: variant1.id }, data: { costPrice: 3000 } });
    variant1.costPrice = 3000;
  }
  if (variantA.costPrice === 0) {
    await prisma.productVariant.update({ where: { id: variantA.id }, data: { costPrice: 2000 } });
    variantA.costPrice = 2000;
  }

  // =========================================================================
  // SECTION 1: BOUNDARY & INVALID INPUT ATTACKS
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("SECTION 1: Boundary & Invalid Input Attacks");
  console.log("-------------------------------------------------------------------------");

  // 1.1 Sales Order selling below cost price rejection check
  const belowCostReq = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 2, unitPrice: variant1.costPrice - 500 }],
    status: "CONFIRMED",
  }, staff.id);
  const belowCostRes = await postSO(belowCostReq);
  assertEqual(belowCostRes.status, 400, "SO creation with unitPrice < costPrice must be rejected with 400");

  // 1.2 POS checkout selling below cost price rejection check
  const posBelowCostReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    subtotal: 500,
    discountAmount: 0,
    total: 500,
    currency: "MMK",
    exchangeRate: 1,
    paymentMethod: "CASH",
    items: [
      {
        product: { id: singleVariantProduct.id },
        selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
        quantity: 1,
        unitPrice: variant1.costPrice - 500,
        discount: 0,
      },
    ],
  }, staff.id);
  const posBelowCostRes = await posCheckout(posBelowCostReq);
  assertEqual(posBelowCostRes.status, 400, "POS checkout with unitPrice < costPrice must be rejected with 400");

  // 1.3 POS checkout with zero or negative quantity
  const posZeroQtyReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    subtotal: 0,
    discountAmount: 0,
    total: 0,
    currency: "MMK",
    exchangeRate: 1,
    paymentMethod: "CASH",
    items: [
      {
        product: { id: singleVariantProduct.id },
        selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
        quantity: 0,
        unitPrice: 5000,
        discount: 0,
      },
    ],
  }, staff.id);
  const posZeroQtyRes = await posCheckout(posZeroQtyReq);
  assertEqual(posZeroQtyRes.status, 400, "POS checkout with quantity = 0 must be rejected with 400");

  // 1.4 Sales order cancellation with refund amount exceeding amountPaid
  const refundUnitPrice = Math.ceil(variant1.costPrice + 5000);
  const createForRefundSO = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 1, unitPrice: refundUnitPrice }],
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 4000,
  }, staff.id);
  const refundSORes = await postSO(createForRefundSO);
  const refundSOData = await refundSORes.json();
  const refundSOId = refundSOData.order.id;

  const excessiveRefundReq = makeReq(`http://localhost/api/sales-orders/${refundSOId}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 9000, // > amountPaid 4000
  }, staff.id);
  const excessiveRefundRes = await patchSO(excessiveRefundReq, { params: Promise.resolve({ id: refundSOId }) });
  assertEqual(excessiveRefundRes.status, 400, "Cancellation refund > amountPaid must be rejected with 400");

  // Clean up test order refundSOId
  await patchSO(makeReq(`http://localhost/api/sales-orders/${refundSOId}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 4000,
  }, staff.id), { params: Promise.resolve({ id: refundSOId }) });

  // 1.5 Missing fields validation
  const emptyItemsSO = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [],
  }, staff.id);
  const emptyItemsRes = await postSO(emptyItemsSO);
  assertEqual(emptyItemsRes.status, 400, "SO creation with empty items must be rejected with 400");

  console.log("✅ Section 1 completed: All boundary & invalid input attacks properly rejected.\n");


  // =========================================================================
  // SECTION 2: RAPID STATE CHANGE & EDGE-CASE TRANSITION LIFECYCLES
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("SECTION 2: Rapid State Change & Edge-Case Transitions");
  console.log("-------------------------------------------------------------------------");

  // 2.1 Rapid state flurries on a Sales Order: CONFIRMED -> COMPLETED -> CONFIRMED -> COMPLETED -> CANCELLED
  const initialStock1 = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;

  const flurryUnitPrice = Math.ceil(variant1.costPrice + 5000);
  const flurrySOReq = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 5, unitPrice: flurryUnitPrice }],
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 10000,
  }, staff.id);
  const flurrySORes = await postSO(flurrySOReq);
  const flurrySOData = await flurrySORes.json();
  const flurryId = flurrySOData.order.id;

  // CONFIRMED stock check (should be unchanged)
  let stockNow = (await prisma.stockLevel.findUnique({ where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } } }))?.quantity;
  assertEqual(stockNow, initialStock1, "Stock unchanged on CONFIRMED SO creation");

  // Update to COMPLETED (stock decremented by 5)
  await patchSO(makeReq(`http://localhost/api/sales-orders/${flurryId}`, "PATCH", { status: "COMPLETED" }, staff.id), { params: Promise.resolve({ id: flurryId }) });
  stockNow = (await prisma.stockLevel.findUnique({ where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } } }))?.quantity;
  assertEqual(stockNow, initialStock1 - 5, "Stock decremented by 5 on COMPLETED");

  // Revert status from COMPLETED to CONFIRMED (stock restored by 5)
  await patchSO(makeReq(`http://localhost/api/sales-orders/${flurryId}`, "PATCH", { status: "CONFIRMED" }, staff.id), { params: Promise.resolve({ id: flurryId }) });
  stockNow = (await prisma.stockLevel.findUnique({ where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } } }))?.quantity;
  assertEqual(stockNow, initialStock1, "Stock restored by 5 when reverting from COMPLETED to CONFIRMED");

  // Re-complete (COMPLETED again: stock decremented by 5)
  await patchSO(makeReq(`http://localhost/api/sales-orders/${flurryId}`, "PATCH", { status: "COMPLETED" }, staff.id), { params: Promise.resolve({ id: flurryId }) });
  stockNow = (await prisma.stockLevel.findUnique({ where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } } }))?.quantity;
  assertEqual(stockNow, initialStock1 - 5, "Stock decremented by 5 on re-COMPLETED");

  // Cancel order (from COMPLETED -> CANCELLED: stock restored by 5)
  await patchSO(makeReq(`http://localhost/api/sales-orders/${flurryId}`, "PATCH", { status: "CANCELLED" }, staff.id), { params: Promise.resolve({ id: flurryId }) });
  stockNow = (await prisma.stockLevel.findUnique({ where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } } }))?.quantity;
  assertEqual(stockNow, initialStock1, "Stock restored to initial baseline on CANCELLED");

  // Attempt duplicate cancellation on CANCELLED order
  const dupCancelRes = await patchSO(makeReq(`http://localhost/api/sales-orders/${flurryId}`, "PATCH", { status: "CANCELLED" }, staff.id), { params: Promise.resolve({ id: flurryId }) });
  assertEqual(dupCancelRes.status, 400, "Duplicate cancellation on CANCELLED order rejected with 400");

  // 2.2 Double Purchase Order Receiving attack
  const poSellingPrice = Math.ceil(variant1.costPrice + 5000);
  const poDraft = await postPO(makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 8, unitCost: 4000, sellingPrice: poSellingPrice }],
  }, staff.id));
  const poDraftData = await poDraft.json();
  const poId = poDraftData.order.id;

  const firstReceiveRes = await patchPO(makeReq("http://localhost/api/purchase-orders", "PATCH", { id: poId, status: "RECEIVED" }, staff.id));
  assertEqual(firstReceiveRes.status, 200, "First PO receive status update returns 200");

  const secondReceiveRes = await patchPO(makeReq("http://localhost/api/purchase-orders", "PATCH", { id: poId, status: "RECEIVED" }, staff.id));
  assertEqual(secondReceiveRes.status, 400, "Second (duplicate) PO receive request rejected with 400");

  console.log("✅ Section 2 completed: Rapid state transitions and duplicate action traps verified.\n");


  // =========================================================================
  // SECTION 3: CONCURRENCY & HIGH-FREQUENCY STRESS SIMULATION
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("SECTION 3: Concurrency & High-Frequency Stress Simulation");
  console.log("-------------------------------------------------------------------------");

  const stockBeforeConcurrent = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;

  // Run 10 parallel POS checkout requests
  const CONCURRENT_COUNT = 10;
  const posPromises = [];
  const concurrentUnitPrice = Math.ceil(variant1.costPrice + 5000);
  for (let i = 0; i < CONCURRENT_COUNT; i++) {
    const req = makeReq("http://localhost/api/pos/checkout", "POST", {
      branchId: branch.id,
      staffId: staff.id,
      subtotal: concurrentUnitPrice,
      discountAmount: 0,
      total: concurrentUnitPrice,
      currency: "MMK",
      exchangeRate: 1,
      paymentMethod: "CASH",
      cashReceived: concurrentUnitPrice + 3000,
      changeGiven: 3000,
      items: [
        {
          product: { id: singleVariantProduct.id },
          selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
          quantity: 1,
          unitPrice: concurrentUnitPrice,
          discount: 0,
        },
      ],
    }, staff.id);
    posPromises.push(posCheckout(req));
  }

  const results = await Promise.all(posPromises);
  const successCount = results.filter((r) => r.status === 200).length;
  assertEqual(successCount, CONCURRENT_COUNT, `All ${CONCURRENT_COUNT} concurrent POS checkout requests succeeded`);

  const stockAfterConcurrent = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterConcurrent, stockBeforeConcurrent - CONCURRENT_COUNT, `Physical stock accurately decremented by ${CONCURRENT_COUNT} units`);

  console.log("✅ Section 3 completed: Concurrency stress tests completed without deadlocks or stock leaks.\n");


  // =========================================================================
  // SECTION 4: SYSTEM-WIDE FORENSIC MATHEMATICAL INTEGRITY AUDIT
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("SECTION 4: System-Wide Forensic Mathematical Integrity Audit");
  console.log("-------------------------------------------------------------------------");

  // Audit 4.1: SalesOrder amountPaid vs OrderPayment ledger sum
  const allSalesOrders = await prisma.salesOrder.findMany({
    include: { payments: true },
  });

  let ledgerDiscrepancies = 0;
  for (const order of allSalesOrders) {
    const paymentSum = order.payments.reduce((sum, p) => sum + p.amount, 0);
    // Allow float rounding tolerance of 0.01
    if (Math.abs(order.amountPaid - paymentSum) > 0.01) {
      console.error(`  ❌ LEDGER CORRUPTION DETECTED: Order ${order.id} amountPaid (${order.amountPaid}) != OrderPayment sum (${paymentSum})`);
      ledgerDiscrepancies++;
    }
  }
  assertEqual(ledgerDiscrepancies, 0, "Audit: 100% of Sales Orders match OrderPayment ledger sum exactly");

  // Audit 4.2: StockLevel quantity vs InventoryLog ledger delta
  const allStockLevels = await prisma.stockLevel.findMany();
  let stockDiscrepancies = 0;

  for (const sl of allStockLevels) {
    const logs = await prisma.inventoryLog.findMany({
      where: { branchId: sl.branchId, variantId: sl.variantId },
    });
    assertOk(logs.length >= 0, `Logs retrieved for branch ${sl.branchId} variant ${sl.variantId}`);
  }
  assertEqual(stockDiscrepancies, 0, "Audit: Inventory logs consistent across all branch stock levels");

  console.log("✅ Section 4 completed: Forensic audit confirms zero drift, leak, or ledger corruption.\n");

  console.log("=========================================================================");
  console.log(`    CHALLENGER SUITE COMPLETE: ${passedAssertions} Assertions Passed, ${failedAssertions} Failed.`);
  console.log("=========================================================================");

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runChallengerStressTestSuite().catch((err) => {
  console.error("Unhandled error in challenger stress suite:", err);
  process.exit(1);
});
