import { prisma } from "../../src/lib/prisma";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { GET as getSO, POST as postSO } from "../../src/app/api/sales-orders/route";
import { PATCH as patchSO, DELETE as deleteSO } from "../../src/app/api/sales-orders/[id]/route";
import { PATCH as patchDeliveryStatus } from "../../src/app/api/delivery/status/route";
import { GET as getOutstanding } from "../../src/app/api/outstanding/route";
import { POST as postOutstandingPay } from "../../src/app/api/outstanding/pay/route";
import { POST as postPO, PATCH as patchPO } from "../../src/app/api/purchase-orders/route";
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

async function runM2BusinessLifecyclesSuite() {
  console.log("=========================================================================");
  console.log("    MILESTONE 2: E2E BUSINESS FLOW INTEGRITY VERIFICATION SUITE          ");
  console.log("=========================================================================\n");

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assertEqual(actual: unknown, expected: unknown, message: string) {
    try {
      assert.strictEqual(actual, expected, message);
      console.log(`  ✅ ASSERT PASS: ${message} (Value: ${JSON.stringify(actual)})`);
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

  // 1. Fetch DB fixture data
  const branch = await prisma.branch.findFirst();
  const staff = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const supplier = await prisma.supplier.findFirst();
  const customer = await prisma.customer.findFirst();
  const products = await prisma.product.findMany({
    include: { variants: true },
    where: { variants: { some: {} } },
  });

  if (!branch || !staff || !supplier || products.length < 2) {
    console.error("❌ Test setup failed: Missing seed data in database (branch, owner staff, supplier, or products)");
    process.exit(1);
  }

  const product1 = products.find((p) => p.variants.length >= 1) || products[0];
  const variant1 = product1.variants[0];

  const product2 = products.find((p) => p.id !== product1.id) || products[1];
  const variant2 = product2.variants[0];

  console.log(`Test Fixtures Initialized:`);
  console.log(`  Branch: ${branch.name} (${branch.id})`);
  console.log(`  Staff: ${staff.name} (${staff.id})`);
  console.log(`  Supplier: ${supplier.name} (${supplier.id})`);
  console.log(`  Customer: ${customer?.name || "Default Customer"} (${customer?.id || "N/A"})`);
  console.log(`  Variant 1: ${product1.name} - ${variant1.name} (${variant1.id})`);
  console.log(`  Variant 2: ${product2.name} - ${variant2.name} (${variant2.id})\n`);

  // =========================================================================
  // LIFECYCLE A: POS Voucher Checkout Lifecycle
  //   - Subtotals, discounts, split payments, delivery checkbox toggle,
  //   - immediate stock reduction, transaction ledger entries, price bound check
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE A: POS Voucher Checkout Lifecycle");
  console.log("-------------------------------------------------------------------------");

  // Record baseline stock level for Variant 1
  const baselineStockPos = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  console.log(`[Lifecycle A] Initial stock for Variant 1: ${baselineStockPos}`);

  // A.1: Validate Discount Upper Bound (Discount > Subtotal rejected with 400)
  const invalidDiscountReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    subtotal: 20000,
    discountAmount: 25000, // > subtotal
    total: 0,
    currency: "MMK",
    exchangeRate: 1,
    paymentMethod: "CASH",
    items: [
      {
        product: { id: product1.id },
        selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
        quantity: 1,
        unitPrice: 20000,
        discount: 0,
      },
    ],
  }, staff.id);
  const invalidDiscountRes = await posCheckout(invalidDiscountReq);
  assertEqual(invalidDiscountRes.status, 400, "POS Checkout with discount > subtotal must be rejected with 400");

  // A.2: Validate Minimum Selling Price Limit (selling price < cost price rejected)
  if (variant1.costPrice > 0) {
    const lowPriceReq = makeReq("http://localhost/api/pos/checkout", "POST", {
      branchId: branch.id,
      staffId: staff.id,
      subtotal: variant1.costPrice - 100,
      discountAmount: 0,
      total: variant1.costPrice - 100,
      currency: "MMK",
      exchangeRate: 1,
      paymentMethod: "CASH",
      items: [
        {
          product: { id: product1.id },
          selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
          quantity: 1,
          unitPrice: variant1.costPrice - 100,
          discount: 0,
        },
      ],
    }, staff.id);
    const lowPriceRes = await posCheckout(lowPriceReq);
    assertEqual(lowPriceRes.status, 400, "POS Checkout selling price below cost price must be rejected with 400");
  }

  // A.3: Valid POS Checkout Execution with Delivery Checkbox Toggle in MMK
  const posCheckoutReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    customerId: customer?.id || null,
    subtotal: 35000,
    discountAmount: 0,
    total: 35000,
    currency: "MMK",
    exchangeRate: 1,
    paymentMethod: "CASH",
    cashReceived: 35000,
    changeGiven: 0,
    isDelivery: true,
    deliveryCustomerName: "Delivery Test Customer",
    deliveryPhone: "09123456789",
    deliveryAddress: "123 Yangon Street",
    items: [
      {
        product: { id: product1.id },
        selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
        quantity: 2,
          unitPrice: 17500,
        discount: 0,
      },
    ],
  }, staff.id);
  const posCheckoutRes = await posCheckout(posCheckoutReq);
  const posCheckoutData = await posCheckoutRes.json();
  assertEqual(posCheckoutRes.status, 200, "Valid POS Checkout should return 200");
  assertOk(posCheckoutData.success === true, "POS Checkout response success flag must be true");

  const posTxId = posCheckoutData.transaction.id;
  assertOk(Boolean(posTxId), "POS Checkout transaction ID created");

  // A.4: Verify Immediate Stock Reduction & Inventory Log
  const stockAfterPos = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterPos, baselineStockPos - 2, "POS Checkout must immediately deduct 2 units from physical stock");

  const posLog = await prisma.inventoryLog.findFirst({
    where: { branchId: branch.id, variantId: variant1.id, reason: "SALE" },
    orderBy: { createdAt: "desc" },
  });
  assertOk(posLog !== null && posLog.change === -2, "InventoryLog written with reason=SALE and change=-2");

  // A.5: Verify Transaction Ledger Entry
  const dbTx = await prisma.transaction.findUnique({
    where: { id: posTxId },
    include: { items: true },
  });
  assertOk(dbTx !== null, "Transaction ledger entry exists in DB");
  assertEqual(dbTx?.totalInMMK, 35000, "Transaction totalInMMK is recorded in MMK");
  assertEqual(dbTx?.items.length, 1, "Transaction item count equals 1");

  // A.6: Verify Linked Sales Order creation for delivery toggle
  const posLinkedSO = await prisma.salesOrder.findFirst({
    where: { branchId: branch.id, isDelivery: true, note: { contains: "POS" } },
    orderBy: { createdAt: "desc" },
  });
  assertOk(posLinkedSO !== null, "POS Checkout with isDelivery=true created a linked SalesOrder");
  assertEqual(posLinkedSO?.status, "DELIVERING", "POS Linked SalesOrder status must be DELIVERING");
  assertEqual(posLinkedSO?.deliveryStatus, "PENDING", "POS Linked SalesOrder deliveryStatus must be PENDING");

  console.log("✅ LIFECYCLE A verified with 100% mathematical perfection.\n");


  // =========================================================================
  // LIFECYCLE B: Sales Orders & Delivery Lifecycle
  //   - Create SO -> Partial Advance Payment (10% min check) ->
  //   - Mark Delivered in /delivery -> automatic stock reduction ->
  //   - Assert 0 double-deduction for POS completed orders -> debt in /outstanding
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE B: Sales Orders & Delivery Lifecycle");
  console.log("-------------------------------------------------------------------------");

  const baselineStockB = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant2.id } },
  }))?.quantity || 0;

  // B.1: 10% Minimum Deposit Check (Deposit < 10% rejected with 400)
  const lowDepositReq = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    customerId: customer?.id || null,
    items: [{ variantId: variant2.id, quantity: 4, unitPrice: 20000 }], // total = 80,000
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 5000, // 5,000 < 10% (8,000) -> Invalid
  }, staff.id);
  const lowDepositRes = await postSO(lowDepositReq);
  assertEqual(lowDepositRes.status, 400, "Sales Order with deposit < 10% total must be rejected with 400");

  // B.2: Create Valid Sales Order with 25% Deposit (20,000 of 80,000)
  const validSOReq = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    customerId: customer?.id || null,
    items: [{ variantId: variant2.id, quantity: 4, unitPrice: 20000 }], // total = 80,000
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 20000, // >= 10% (8,000) -> Valid
    isDelivery: true,
  }, staff.id);
  const validSORes = await postSO(validSOReq);
  const validSOData = await validSORes.json();
  assertEqual(validSORes.status, 200, "Valid Sales Order creation with >= 10% deposit should return 200");
  const soLifecycleBId = validSOData.order.id;
  assertEqual(validSOData.order.total, 80000, "Sales Order total must be 80,000 MMK");
  assertEqual(validSOData.order.amountPaid, 20000, "Sales Order amountPaid must be 20,000 MMK");

  // Verify stock is NOT deducted while CONFIRMED and deliveryStatus is PENDING
  const stockBeforeDelivery = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant2.id } },
  }))?.quantity || 0;
  assertEqual(stockBeforeDelivery, baselineStockB, "CONFIRMED Sales Order before delivery must NOT deduct physical stock yet");

  // B.3: Mark Sales Order as DELIVERED in /delivery/status
  const markDeliveredReq = makeReq("http://localhost/api/delivery/status", "PATCH", {
    salesOrderId: soLifecycleBId,
    deliveryStatus: "DELIVERED",
  }, staff.id);
  const markDeliveredRes = await patchDeliveryStatus(markDeliveredReq);
  const markDeliveredData = await markDeliveredRes.json();
  assertEqual(markDeliveredRes.status, 200, "Marking deliveryStatus=DELIVERED should return 200");
  assertEqual(markDeliveredData.order.deliveryStatus, "DELIVERED", "Order deliveryStatus updated to DELIVERED");
  assertEqual(markDeliveredData.order.status, "COMPLETED", "Order status updated to COMPLETED upon delivery");

  // Verify automatic stock deduction occurred on delivery for CONFIRMED order
  const stockAfterDelivery = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant2.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterDelivery, baselineStockB - 4, "Physical stock must be decremented by 4 upon delivery of CONFIRMED Sales Order");

  const deliveryLog = await prisma.inventoryLog.findFirst({
    where: { branchId: branch.id, variantId: variant2.id, reason: "SALES_ORDER_DELIVERED" },
    orderBy: { createdAt: "desc" },
  });
  assertOk(deliveryLog !== null && deliveryLog.change === -4, "InventoryLog written with reason=SALES_ORDER_DELIVERED and change=-4");

  // B.4: Zero Double-Deduction Assertion for POS Completed Orders
  // Take POS order created in Lifecycle A (posLinkedSO)
  const posSOId = posLinkedSO!.id;
  const stockBeforePosDelivery = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;

  const deliverPosSOReq = makeReq("http://localhost/api/delivery/status", "PATCH", {
    salesOrderId: posSOId,
    deliveryStatus: "DELIVERED",
  }, staff.id);
  const deliverPosSORes = await patchDeliveryStatus(deliverPosSOReq);
  assertEqual(deliverPosSORes.status, 200, "Delivering POS order should return 200");

  const stockAfterPosDelivery = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterPosDelivery, stockBeforePosDelivery, "POS COMPLETED order delivery MUST NOT cause double stock deduction (0 double-deduction)");

  // B.5: Outstanding Debt Ledger Verification in /outstanding
  const outstandingReq = makeReq("http://localhost/api/outstanding", "GET", undefined, staff.id);
  const outstandingRes = await getOutstanding(outstandingReq);
  const outstandingData = await outstandingRes.json();
  assertEqual(outstandingRes.status, 200, "GET /api/outstanding should return 200");

  const bOutstandingOrder = outstandingData.orders.find((o: { id: string }) => o.id === soLifecycleBId);
  assertOk(bOutstandingOrder !== undefined, "Sales Order B listed in /outstanding");
  const expectedRemaining = 80000 - 20000; // 60,000 MMK
  assertEqual(bOutstandingOrder.remainingDebt, expectedRemaining, "Remaining debt in /outstanding must equal 60,000 MMK (80k - 20k)");

  console.log("✅ LIFECYCLE B verified with 100% mathematical perfection.\n");


  // =========================================================================
  // LIFECYCLE C: Debt Collection & Repayment Capping
  //   - Repayment collection in /outstanding -> repayment capping check (amount <= remainingDebt) ->
  //   - debt balance update & customer ledger update
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE C: Debt Collection & Repayment Capping");
  console.log("-------------------------------------------------------------------------");

  const remainingDebtC = 60000;

  // C.1: Overpayment Capping Check (Payment > remaining debt rejected with 400)
  const overpayReq = makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: soLifecycleBId,
    amount: 70000, // 70,000 > 60,000 remaining debt
    method: "CASH",
  }, staff.id);
  const overpayRes = await postOutstandingPay(overpayReq);
  assertEqual(overpayRes.status, 400, "Debt repayment exceeding remaining debt must be rejected with 400");

  // C.2: Zero or Negative Repayment Check (Payment <= 0 rejected with 400)
  const zeroPayReq = makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: soLifecycleBId,
    amount: 0,
    method: "CASH",
  }, staff.id);
  const zeroPayRes = await postOutstandingPay(zeroPayReq);
  assertEqual(zeroPayRes.status, 400, "Debt repayment of 0 must be rejected with 400");

  // C.3: Partial Repayment (Collect 25,000 MMK)
  const partialDebtPayReq = makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: soLifecycleBId,
    amount: 25000,
    method: "CARD",
    note: "First debt installment",
  }, staff.id);
  const partialDebtPayRes = await postOutstandingPay(partialDebtPayReq);
  const partialDebtPayData = await partialDebtPayRes.json();
  assertEqual(partialDebtPayRes.status, 200, "Partial debt payment should return 200");
  assertEqual(partialDebtPayData.order.amountPaid, 45000, "Sales Order amountPaid updated to 45,000 MMK (20k + 25k)");
  assertEqual(partialDebtPayData.order.paymentStatus, "PARTIAL", "Payment status remains PARTIAL");

  // C.4: Final Debt Repayment (Collect remaining 35,000 MMK)
  const finalDebtPayReq = makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: soLifecycleBId,
    amount: 35000,
    method: "QR",
    note: "Final debt settlement",
  }, staff.id);
  const finalDebtPayRes = await postOutstandingPay(finalDebtPayReq);
  const finalDebtPayData = await finalDebtPayRes.json();
  assertEqual(finalDebtPayRes.status, 200, "Final debt payment should return 200");
  assertEqual(finalDebtPayData.order.amountPaid, 80000, "Sales Order amountPaid updated to 80,000 MMK (full total)");
  assertEqual(finalDebtPayData.order.paymentStatus, "PAID", "Payment status updated to PAID upon full repayment");

  // Verify Customer Ledger / OrderPayment records
  const dbPayments = await prisma.orderPayment.findMany({
    where: { salesOrderId: soLifecycleBId },
    orderBy: { createdAt: "asc" },
  });
  assertEqual(dbPayments.length, 3, "Total 3 OrderPayment ledger entries recorded (initial 20k + 25k + 35k)");
  const totalLedgerSum = dbPayments.reduce((sum, p) => sum + p.amount, 0);
  assertEqual(totalLedgerSum, 80000, "Sum of all OrderPayment ledger entries equals exact order total (80,000 MMK)");

  // Verify /outstanding no longer lists fully paid order
  const postPayOutstandingReq = makeReq("http://localhost/api/outstanding", "GET", undefined, staff.id);
  const postPayOutstandingRes = await getOutstanding(postPayOutstandingReq);
  const postPayOutstandingData = await postPayOutstandingRes.json();
  const resolvedOrderInOutstanding = postPayOutstandingData.orders.find((o: { id: string }) => o.id === soLifecycleBId);
  assertEqual(resolvedOrderInOutstanding, undefined, "Fully paid order is removed from /outstanding list");

  console.log("✅ LIFECYCLE C verified with 100% mathematical perfection.\n");


  // =========================================================================
  // LIFECYCLE D: Purchase Orders & Inventory Moving Average Cost (MAC)
  //   - Create PO -> Receive Goods -> automatic stock increase &
  //   - franchise-wide Moving Average Cost (MAC) formula recalculation
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE D: Purchase Orders & Inventory Moving Average Cost (MAC)");
  console.log("-------------------------------------------------------------------------");

  // D.1: Record total franchise stock and current cost price for Variant 1
  const allStockLevelsBeforePO = await prisma.stockLevel.findMany({
    where: { variantId: variant1.id },
  });
  const totalFranchiseStockBeforePO = allStockLevelsBeforePO.reduce((sum, sl) => sum + sl.quantity, 0);
  const currentCostPriceD = variant1.costPrice;

  const targetBranchStockBeforePO = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;

  console.log(`[Lifecycle D] Variant 1 total franchise stock: ${totalFranchiseStockBeforePO}, current cost: ${currentCostPriceD}`);

  // D.2: Create Purchase Order (10 units @ 5,000 MMK unit cost)
  const poIntakeReq = makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: branch.id,
    items: [
      {
        variantId: variant1.id,
        quantity: 10,
        unitCost: 5000,
        sellingPrice: 0, // 0 = default (do not overwrite selling price)
      },
    ],
    note: "Lifecycle D PO Intake Test",
  }, staff.id);
  const poIntakeRes = await postPO(poIntakeReq);
  const poIntakeData = await poIntakeRes.json();
  assertEqual(poIntakeRes.status, 200, "Create Purchase Order should return 200");
  const poIdD = poIntakeData.order.id;

  // D.3: Receive Goods in Purchase Order
  const receivePOReq = makeReq("http://localhost/api/purchase-orders", "PATCH", {
    id: poIdD,
    status: "RECEIVED",
  }, staff.id);
  const receivePORes = await patchPO(receivePOReq);
  const receivePOData = await receivePORes.json();
  assertEqual(receivePORes.status, 200, "Receive Purchase Order should return 200");

  // D.4: Verify Automatic Stock Increase & Inventory Log
  const targetBranchStockAfterPO = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  assertEqual(targetBranchStockAfterPO, targetBranchStockBeforePO + 10, "Stock level in target branch must increase by 10");

  const poInventoryLog = await prisma.inventoryLog.findFirst({
    where: { branchId: branch.id, variantId: variant1.id, reason: "PURCHASE_RECEIVED" },
    orderBy: { createdAt: "desc" },
  });
  assertOk(poInventoryLog !== null && poInventoryLog.change === 10, "InventoryLog written with reason=PURCHASE_RECEIVED and change=+10");

  // D.5: Verify Moving Average Cost (MAC) Formula Calculation
  // Expected MAC: (totalStockBefore * currentCost + incomingQty * unitCost) / (totalStockBefore + incomingQty)
  let expectedMAC = 5000;
  if (totalFranchiseStockBeforePO > 0) {
    expectedMAC = (totalFranchiseStockBeforePO * currentCostPriceD + 10 * 5000) / (totalFranchiseStockBeforePO + 10);
  }

  const updatedVariant1 = await prisma.productVariant.findUnique({
    where: { id: variant1.id },
  });
  assertEqual(updatedVariant1?.costPrice, expectedMAC, `ProductVariant costPrice updated to exact MAC formula value (${expectedMAC})`);

  // D.6: Parent Product Price Integrity Check (sellingPrice=0 in PO items must NOT overwrite Product.price)
  const parentProductD = await prisma.product.findUnique({ where: { id: product1.id } });
  assertEqual(parentProductD?.price, product1.price, "PO receipt with sellingPrice=0 must NOT corrupt parent Product.price");

  console.log("✅ LIFECYCLE D verified with 100% mathematical perfection.\n");


  // =========================================================================
  // LIFECYCLE E: Order Cancellation & Refund
  //   - Initiate SO cancellation with partial deposit -> mandatory refund prompt (refundAmount <= amountPaid),
  //   - negative payment ledger entry, and stock restoration for completed orders.
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE E: Order Cancellation & Refund");
  console.log("-------------------------------------------------------------------------");

  // E.1: Create Sales Order with COMPLETED status and partial payment (30,000 paid of 60,000)
  const baselineStockE = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant2.id } },
  }))?.quantity || 0;

  const soEReq = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    customerId: customer?.id || null,
    items: [{ variantId: variant2.id, quantity: 3, unitPrice: 20000 }], // total = 60,000
    status: "COMPLETED",
    paymentStatus: "PARTIAL",
    amountPaid: 30000,
  }, staff.id);
  const soERes = await postSO(soEReq);
  const soEData = await soERes.json();
  assertEqual(soERes.status, 200, "Direct COMPLETED Sales Order creation for Lifecycle E should return 200");
  const soEId = soEData.order.id;

  const stockAfterSOE = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant2.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterSOE, baselineStockE - 3, "COMPLETED Sales Order deducted physical stock by 3");

  // E.2: Refund Capping Check (refundAmount > amountPaid rejected with 400)
  const excessRefundReq = makeReq(`http://localhost/api/sales-orders/${soEId}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 50000, // 50,000 > 30,000 amount paid
  }, staff.id);
  const excessRefundRes = await patchSO(excessRefundReq, { params: Promise.resolve({ id: soEId }) });
  assertEqual(excessRefundRes.status, 400, "Refund amount exceeding amount paid must be rejected with 400");

  // E.3: Execute Valid Order Cancellation & Full Refund (refund 30,000 MMK)
  const cancelEReq = makeReq(`http://localhost/api/sales-orders/${soEId}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 30000,
  }, staff.id);
  const cancelERes = await patchSO(cancelEReq, { params: Promise.resolve({ id: soEId }) });
  const cancelEData = await cancelERes.json();
  assertEqual(cancelERes.status, 200, "Valid cancellation with refund should return 200");
  assertEqual(cancelEData.order.status, "CANCELLED", "Order status updated to CANCELLED");
  assertEqual(cancelEData.order.amountPaid, 0, "Order amountPaid reset to 0 after full refund");

  // E.4: Verify Negative Payment Ledger Entry
  const refundPayments = await prisma.orderPayment.findMany({
    where: { salesOrderId: soEId },
  });
  const netPaymentSumE = refundPayments.reduce((sum, p) => sum + p.amount, 0);
  assertEqual(netPaymentSumE, 0, "Net OrderPayment sum for fully cancelled and refunded order equals 0");

  // E.5: Verify Stock Restoration for COMPLETED Order
  const restoredStockE = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant2.id } },
  }))?.quantity || 0;
  assertEqual(restoredStockE, baselineStockE, "Cancelling COMPLETED order restores physical stock to original baseline");

  const cancellationLog = await prisma.inventoryLog.findFirst({
    where: { branchId: branch.id, variantId: variant2.id, reason: "ADJUSTMENT" },
    orderBy: { createdAt: "desc" },
  });
  assertOk(cancellationLog !== null && cancellationLog.change === 3, "InventoryLog written with reason=ADJUSTMENT and change=+3");

  // E.6: Duplicate Cancellation Guard
  const duplicateCancelReq = makeReq(`http://localhost/api/sales-orders/${soEId}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 30000,
  }, staff.id);
  const duplicateCancelRes = await patchSO(duplicateCancelReq, { params: Promise.resolve({ id: soEId }) });
  assertEqual(duplicateCancelRes.status, 400, "Duplicate cancellation call on already cancelled order must be rejected with 400");

  console.log("✅ LIFECYCLE E verified with 100% mathematical perfection.\n");


  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  console.log("=========================================================================");
  console.log(`    MILESTONE 2 SUITE COMPLETE: ${passedAssertions} Assertions Passed, ${failedAssertions} Failed.`);
  console.log("    ZERO MONEY / STOCK LEAKS VERIFIED ACROSS ALL 5 LIFECYCLES.");
  console.log("=========================================================================");

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runM2BusinessLifecyclesSuite().catch((err) => {
  console.error("Unhandled error in M2 Business Lifecycles Suite:", err);
  process.exit(1);
});
