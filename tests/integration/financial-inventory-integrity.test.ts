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

async function runIntegrationTestSuite() {
  console.log("=========================================================================");
  console.log("    AUTOMATED FINANCIAL & INVENTORY INTEGRITY TEST SUITE                 ");
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

  // 1. Fetch DB fixture data
  const branch = await prisma.branch.findFirst();
  const staff = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const supplier = await prisma.supplier.findFirst();
  const products = await prisma.product.findMany({
    include: { variants: true },
    where: { variants: { some: {} } },
  });

  if (!branch || !staff || !supplier || products.length < 2) {
    console.error("❌ Test setup failed: Missing seed data in database (branch, owner staff, supplier, or products)");
    process.exit(1);
  }

  const singleVariantProduct = products.find((p) => p.variants.length === 1) || products[0];
  const variant1 = singleVariantProduct.variants[0];

  const multiVariantProduct = products.find((p) => p.variants.length >= 2) || products[0];
  const variantA = products[0].variants[0];
  const variantB = products[1].variants[0];

  console.log(`Test fixtures:`);
  console.log(`  Branch: ${branch.name} (${branch.id})`);
  console.log(`  Staff: ${staff.name} (${staff.id})`);
  console.log(`  Variant 1: ${variant1.name} (${variant1.id})`);
  console.log(`  Variant A: ${variantA.name} (${variantA.id}), Variant B: ${variantB.name} (${variantB.id})\n`);

  // =========================================================================
  // LIFECYCLE 1: Purchase Order Intake -> Sales Order Creation & COMPLETED ->
  //              Partial Payment -> Cancellation & Refund -> Zero-Sum Assert
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE 1: PO Intake -> COMPLETED SO -> Partial Pay -> Cancel -> Zero Sum");
  console.log("-------------------------------------------------------------------------");

  // Step 1.1: Record baseline stock & cost
  const baselineStock1 = await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  });
  const initialQty1 = baselineStock1?.quantity || 0;
  console.log(`[Lifecycle 1] Initial stock for Variant 1: ${initialQty1}`);

  // Step 1.2: Create and receive PO
  const po1Req = makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 10, unitCost: 4000, sellingPrice: 6000 }],
    note: "Lifecycle 1 PO intake",
  }, staff.id);
  const po1Res = await postPO(po1Req);
  const po1Data = await po1Res.json();
  assertEqual(po1Res.status, 200, "PO 1 creation should return 200");
  const po1Id = po1Data.order.id;

  const receivePo1Req = makeReq("http://localhost/api/purchase-orders", "PATCH", {
    id: po1Id,
    status: "RECEIVED",
  }, staff.id);
  const receivePo1Res = await patchPO(receivePo1Req);
  assertEqual(receivePo1Res.status, 200, "PO 1 status patch to RECEIVED should return 200");

  const postPoStock1 = await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  });
  assertEqual(postPoStock1?.quantity, initialQty1 + 10, "Stock level must increase by 10 after PO receipt");

  const po1Logs = await prisma.inventoryLog.findMany({
    where: { branchId: branch.id, variantId: variant1.id, reason: "PURCHASE_RECEIVED" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  assertOk(po1Logs.length > 0 && po1Logs[0].change === 10, "InventoryLog written with change = +10 on PO receipt");

  // Step 1.3: Create Sales Order directly with COMPLETED status (Vulnerability 1 Check)
  const so1Req = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 4, unitPrice: 15000 }],
    status: "COMPLETED",
    paymentStatus: "PARTIAL",
    amountPaid: 10000,
  }, staff.id);
  const so1Res = await postSO(so1Req);
  const so1Data = await so1Res.json();
  assertEqual(so1Res.status, 200, "Direct COMPLETED Sales Order creation should return 200");
  const so1Id = so1Data.order.id;

  const postSo1Stock = await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  });
  assertEqual(postSo1Stock?.quantity, initialQty1 + 6, "Direct COMPLETED SO must immediately deduct stock by 4 (Vulnerability 1 Fix)");

  const so1Logs = await prisma.inventoryLog.findMany({
    where: { branchId: branch.id, variantId: variant1.id, reason: "SALES_ORDER_DELIVERED" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  assertOk(so1Logs.length > 0 && so1Logs[0].change === -4, "InventoryLog written with change = -4 for direct COMPLETED SO");

  // Step 1.4: Partial payment
  const partialPayReq = makeReq(`http://localhost/api/sales-orders/${so1Id}`, "PATCH", {
    paymentStatus: "PARTIAL",
    amountPaid: 10000,
  }, staff.id);
  const partialPayRes = await patchSO(partialPayReq, { params: Promise.resolve({ id: so1Id }) });
  const partialPayData = await partialPayRes.json();
  assertEqual(partialPayRes.status, 200, "Partial payment PATCH should return 200");
  assertEqual(partialPayData.order.amountPaid, 10000, "SalesOrder amountPaid must equal 10,000");
  assertEqual(partialPayData.order.paymentStatus, "PARTIAL", "SalesOrder paymentStatus must be PARTIAL");

  const paymentsAfterPartial = await prisma.orderPayment.findMany({
    where: { salesOrderId: so1Id },
  });
  const sumPartial = paymentsAfterPartial.reduce((sum, p) => sum + p.amount, 0);
  assertEqual(sumPartial, 10000, "OrderPayment ledger sum after partial payment must equal 10,000");

  // Step 1.5: Order cancellation and full refund
  const cancelReq = makeReq(`http://localhost/api/sales-orders/${so1Id}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 10000,
  }, staff.id);
  const cancelRes = await patchSO(cancelReq, { params: Promise.resolve({ id: so1Id }) });
  const cancelData = await cancelRes.json();
  assertEqual(cancelRes.status, 200, "Order cancellation with refund should return 200");
  assertEqual(cancelData.order.amountPaid, 0, "SalesOrder amountPaid must be 0 after full refund");
  assertEqual(cancelData.order.status, "CANCELLED", "SalesOrder status must be CANCELLED");

  // Vulnerability 5 Check: Duplicate cancellation attempt
  const dupCancelReq = makeReq(`http://localhost/api/sales-orders/${so1Id}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 10000,
  }, staff.id);
  const dupCancelRes = await patchSO(dupCancelReq, { params: Promise.resolve({ id: so1Id }) });
  assertEqual(dupCancelRes.status, 400, "Duplicate cancellation call must be rejected with 400 (Vulnerability 5 Fix)");

  // Step 1.6: Inventory & Financial zero-sum balance assertions
  const finalStock1 = await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  });
  assertEqual(finalStock1?.quantity, initialQty1 + 10, "Stock level after order cancellation must restore to post-PO baseline");

  const allPayments1 = await prisma.orderPayment.findMany({
    where: { salesOrderId: so1Id },
  });
  const netPaymentSum1 = allPayments1.reduce((sum, p) => sum + p.amount, 0);
  assertEqual(netPaymentSum1, 0, "Net OrderPayment ledger sum for cancelled order must equal 0");
  console.log("✅ Lifecycle 1 completed with 100% mathematical perfection.\n");


  // =========================================================================
  // LIFECYCLE 2: Multi-Item PO Intake -> Sales Order Fulfillment ->
  //              Partial Payment -> Omitted paymentStatus PATCH -> Cancellation Assert
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE 2: Multi-item PO -> Fulfillment -> Omitted paymentStatus -> Refund");
  console.log("-------------------------------------------------------------------------");

  // Record initial Product.price for multiVariantProduct (Vulnerability 3 Check)
  const initialProductPrice = multiVariantProduct.price;
  console.log(`[Lifecycle 2] Initial Product.price for parent product "${multiVariantProduct.name}": ${initialProductPrice}`);

  const baselineStockA = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variantA.id } },
  }))?.quantity || 0;
  const baselineStockB = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variantB.id } },
  }))?.quantity || 0;

  // Step 2.1: PO Intake for multi-variant product
  const po2Req = makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: branch.id,
    items: [
      { variantId: variantA.id, quantity: 15, unitCost: 3000, sellingPrice: 0 },
      { variantId: variantB.id, quantity: 20, unitCost: 7000, sellingPrice: 0 },
    ],
    note: "Lifecycle 2 PO multi-item intake",
  }, staff.id);
  const po2Res = await postPO(po2Req);
  const po2Data = await po2Res.json();
  assertEqual(po2Res.status, 200, "PO 2 creation should return 200");
  const po2Id = po2Data.order.id;

  const receivePo2Req = makeReq("http://localhost/api/purchase-orders", "PATCH", {
    id: po2Id,
    status: "RECEIVED",
  }, staff.id);
  const receivePo2Res = await patchPO(receivePo2Req);
  assertEqual(receivePo2Res.status, 200, "PO 2 status patch to RECEIVED should return 200");

  // Vulnerability 3 Check: Product.price must NOT be overwritten by PO receiving line items
  const postPoProduct = await prisma.product.findUnique({ where: { id: multiVariantProduct.id } });
  assertEqual(postPoProduct?.price, initialProductPrice, "PO receipt must NOT overwrite parent Product.price (Vulnerability 3 Fix)");

  // Step 2.2: Multi-item Sales Order creation & fulfillment
  const so2Req = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [
      { variantId: variantA.id, quantity: 3, unitPrice: 15000 },
      { variantId: variantB.id, quantity: 2, unitPrice: 20000 },
    ],
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 10000,
  }, staff.id);
  const so2Res = await postSO(so2Req);
  const so2Data = await so2Res.json();
  assertEqual(so2Res.status, 200, "Sales order creation (CONFIRMED) should return 200");
  const so2Id = so2Data.order.id;
  const so2Total = 3 * 15000 + 2 * 20000; // 85,000
  assertEqual(so2Data.order.total, so2Total, "SO 2 total must equal 85,000");

  // Mark SO 2 as COMPLETED
  const deliverSo2Req = makeReq(`http://localhost/api/sales-orders/${so2Id}`, "PATCH", {
    status: "COMPLETED",
  }, staff.id);
  const deliverSo2Res = await patchSO(deliverSo2Req, { params: Promise.resolve({ id: so2Id }) });
  assertEqual(deliverSo2Res.status, 200, "SO 2 status update to COMPLETED should return 200");

  const stockAAfterDeliver = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variantA.id } },
  }))?.quantity;
  const stockBAfterDeliver = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variantB.id } },
  }))?.quantity;
  assertEqual(stockAAfterDeliver, baselineStockA + 15 - 3, "Variant A stock must be baseline + 15 - 3");
  assertEqual(stockBAfterDeliver, baselineStockB + 20 - 2, "Variant B stock must be baseline + 20 - 2");

  // Step 2.3: Partial payment via amountPaid without explicit paymentStatus
  const partial2Req = makeReq(`http://localhost/api/sales-orders/${so2Id}`, "PATCH", {
    amountPaid: 15000,
  }, staff.id);
  const partial2Res = await patchSO(partial2Req, { params: Promise.resolve({ id: so2Id }) });
  const partial2Data = await partial2Res.json();
  assertEqual(partial2Res.status, 200, "PATCH with amountPaid should return 200");
  assertEqual(partial2Data.order.amountPaid, 15000, "amountPaid must update to 15,000");
  assertEqual(partial2Data.order.paymentStatus, "PARTIAL", "paymentStatus must auto-resolve to PARTIAL");

  // Vulnerability 4 Check: Omit paymentStatus in PATCH note update (must NOT wipe amountPaid to 0)
  const noteUpdateReq = makeReq(`http://localhost/api/sales-orders/${so2Id}`, "PATCH", {
    note: "Updated note without payment parameters",
  }, staff.id);
  const noteUpdateRes = await patchSO(noteUpdateReq, { params: Promise.resolve({ id: so2Id }) });
  const noteUpdateData = await noteUpdateRes.json();
  assertEqual(noteUpdateRes.status, 200, "Note update PATCH should return 200");
  assertEqual(noteUpdateData.order.amountPaid, 15000, "amountPaid must NOT be wiped to 0 when paymentStatus is omitted (Vulnerability 4 Fix)");
  assertEqual(noteUpdateData.order.paymentStatus, "PARTIAL", "paymentStatus must remain PARTIAL");

  // Cancel & Refund SO 2
  const cancel2Req = makeReq(`http://localhost/api/sales-orders/${so2Id}`, "PATCH", {
    status: "CANCELLED",
    refundAmount: 15000,
  }, staff.id);
  const cancel2Res = await patchSO(cancel2Req, { params: Promise.resolve({ id: so2Id }) });
  assertEqual(cancel2Res.status, 200, "SO 2 cancellation with refund should return 200");

  const finalStockA = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variantA.id } },
  }))?.quantity;
  const finalStockB = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variantB.id } },
  }))?.quantity;
  assertEqual(finalStockA, baselineStockA + 15, "Variant A stock restored after cancellation");
  assertEqual(finalStockB, baselineStockB + 20, "Variant B stock restored after cancellation");
  console.log("✅ Lifecycle 2 completed with 100% mathematical perfection.\n");


  // =========================================================================
  // LIFECYCLE 3: POS Checkout -> Payment Status Validations (PARTIAL cap, FULL lock) ->
  //              SO Deletion Stock Restoration -> Zero-Sum Assertion
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("LIFECYCLE 3: POS Checkout -> Payment Rules -> SO Deletion Stock Reversion");
  console.log("-------------------------------------------------------------------------");

  // Step 3.1: POS Checkout execution
  const baselineStockPos = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;

  const posReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    subtotal: 30000,
    discountAmount: 0,
    total: 30000,
    currency: "MMK",
    exchangeRate: 1,
    paymentMethod: "CASH",
    cashReceived: 35000,
    changeGiven: 5000,
    items: [
      {
        product: { id: singleVariantProduct.id },
        selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
        quantity: 2,
        unitPrice: 15000,
        discount: 0,
      },
    ],
  }, staff.id);
  const posRes = await posCheckout(posReq);
  const posData = await posRes.json();
  assertEqual(posRes.status, 200, "POS checkout must return 200");
  assertOk(posData.success === true, "POS checkout response success flag true");

  const postPosStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity;
  assertEqual(postPosStock, baselineStockPos - 2, "POS checkout must immediately deduct 2 units from stock");

  // Step 3.2: Payment status validation tests (PARTIAL payment cap & FULL payment lock)
  const so3Req = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 3, unitPrice: 15000 }],
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 10000,
  }, staff.id);
  const so3Res = await postSO(so3Req);
  const so3Data = await so3Res.json();
  assertEqual(so3Res.status, 200, "SO 3 creation should return 200");
  const so3Id = so3Data.order.id; // total = 18,000

  // Test PARTIAL payment cap (overpayment rejected for PARTIAL)
  const overpayPartialReq = makeReq(`http://localhost/api/sales-orders/${so3Id}`, "PATCH", {
    paymentStatus: "PARTIAL",
    amountPaid: 50000, // > total 45,000
  }, staff.id);
  const overpayPartialRes = await patchSO(overpayPartialReq, { params: Promise.resolve({ id: so3Id }) });
  assertEqual(overpayPartialRes.status, 400, "PARTIAL status with amountPaid > total must be rejected with 400");

  // Test PARTIAL payment cap (zero/negative payment rejected for PARTIAL)
  const zeroPartialReq = makeReq(`http://localhost/api/sales-orders/${so3Id}`, "PATCH", {
    paymentStatus: "PARTIAL",
    amountPaid: 0,
  }, staff.id);
  const zeroPartialRes = await patchSO(zeroPartialReq, { params: Promise.resolve({ id: so3Id }) });
  assertEqual(zeroPartialRes.status, 400, "PARTIAL status with amountPaid = 0 must be rejected with 400");

  // Test FULL payment lock
  const fullPayReq = makeReq(`http://localhost/api/sales-orders/${so3Id}`, "PATCH", {
    paymentStatus: "PAID",
  }, staff.id);
  const fullPayRes = await patchSO(fullPayReq, { params: Promise.resolve({ id: so3Id }) });
  const fullPayData = await fullPayRes.json();
  assertEqual(fullPayRes.status, 200, "PAID paymentStatus update should return 200");
  assertEqual(fullPayData.order.amountPaid, 45000, "PAID status locks amountPaid to exact order total (45,000)");

  // Step 3.3: Mark SO 3 as COMPLETED and test Sales Order Deletion (Vulnerability 2 Check)
  const stockBeforeDeliver3 = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;

  const deliverSo3Req = makeReq(`http://localhost/api/sales-orders/${so3Id}`, "PATCH", {
    status: "COMPLETED",
  }, staff.id);
  await patchSO(deliverSo3Req, { params: Promise.resolve({ id: so3Id }) });

  const stockAfterDeliver3 = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterDeliver3, stockBeforeDeliver3 - 3, "Stock decremented by 3 on marking SO 3 COMPLETED");

  // Delete COMPLETED order SO 3
  const deleteSo3Req = makeReq(`http://localhost/api/sales-orders/${so3Id}`, "DELETE", undefined, staff.id);
  const deleteSo3Res = await deleteSO(deleteSo3Req, { params: Promise.resolve({ id: so3Id }) });
  assertEqual(deleteSo3Res.status, 200, "COMPLETED Sales Order deletion should return 200");

  const stockAfterDelete3 = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branch.id, variantId: variant1.id } },
  }))?.quantity || 0;
  assertEqual(stockAfterDelete3, stockBeforeDeliver3, "Deleting COMPLETED Sales Order must restore physical stock by 3 (Vulnerability 2 Fix)");

  const deleteLogs = await prisma.inventoryLog.findMany({
    where: { branchId: branch.id, variantId: variant1.id, reason: "ADJUSTMENT" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  assertOk(deleteLogs.length > 0 && deleteLogs[0].change === 3, "InventoryLog written with change = +3 on COMPLETED SO deletion");

  console.log("✅ Lifecycle 3 completed with 100% mathematical perfection.\n");

  console.log("=========================================================================");
  console.log(`    SUITE COMPLETE: ${passedAssertions} Assertions Passed, ${failedAssertions} Failed.`);
  console.log("=========================================================================");

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIntegrationTestSuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
