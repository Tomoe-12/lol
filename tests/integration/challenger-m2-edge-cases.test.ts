import { prisma } from "../../src/lib/prisma";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { POST as postSO, GET as getSO } from "../../src/app/api/sales-orders/route";
import { PATCH as patchSO } from "../../src/app/api/sales-orders/[id]/route";
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

export async function runM2EdgeCasesStressTest() {
  console.log("=========================================================================");
  console.log("    M2 EMPIRICAL CHALLENGER FINANCIAL EDGE CASES STRESS SUITE            ");
  console.log("=========================================================================\n");

  let passed = 0;
  let failed = 0;

  function assertEqual(actual: unknown, expected: unknown, message: string) {
    try {
      assert.strictEqual(actual, expected, message);
      console.log(`  ✅ PASS: ${message} (Value: ${JSON.stringify(actual)})`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${message} | Expected: ${expected}, Got: ${actual}`);
      failed++;
      throw err;
    }
  }

  function assertOk(condition: boolean, message: string) {
    try {
      assert.ok(condition, message);
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
      throw err;
    }
  }

  // Load fixtures
  const branch = await prisma.branch.findFirst();
  const staff = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const supplier = await prisma.supplier.findFirst();
  const products = await prisma.product.findMany({ include: { variants: true } });
  const variant1 = products[0]?.variants[0];

  if (!branch || !staff || !supplier || !variant1) {
    console.error("❌ Setup failed: missing seed fixtures");
    process.exit(1);
  }

  // 1. SPLIT PAYMENT ROUNDING & MULTI-CURRENCY CONVERSION
  console.log("--- Edge Case 1: Split Payment Rounding & Multi-Currency USD Conversion ---");
  const usdReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    subtotal: 15.5, // $15.50
    discountAmount: 0.5, // $0.50 discount
    total: 15.0, // $15.00 total
    currency: "USD",
    exchangeRate: 3550, // 15 * 3550 = 53,250 MMK
    paymentMethod: "CASH",
    cashReceived: 53250,
    changeGiven: 0,
    items: [
      {
        product: { id: products[0].id },
        selectedVariant: { id: variant1.id, costPrice: variant1.costPrice },
        quantity: 1,
        unitPrice: 15.5,
        discount: 0.5,
      },
    ],
  }, staff.id);

  const usdRes = await posCheckout(usdReq);
  const usdData = await usdRes.json();
  assertEqual(usdRes.status, 200, "USD Checkout with fractional amount succeeds");
  assertEqual(usdData.transaction.totalInMMK, 53250, "totalInMMK equals 15 * 3550 = 53,250 MMK without precision loss");

  // 2. USD EXCHANGE RATE EDGE CASES
  console.log("\n--- Edge Case 2: USD Exchange Rate Edge Cases ---");
  // Zero exchange rate should yield 0 MMK
  const zeroRateReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branch.id,
    staffId: staff.id,
    subtotal: 10,
    discountAmount: 0,
    total: 10,
    currency: "USD",
    exchangeRate: 0,
    paymentMethod: "CASH",
    items: [
      {
        product: { id: products[0].id },
        selectedVariant: { id: variant1.id, costPrice: 0 },
        quantity: 1,
        unitPrice: 10,
        discount: 0,
      },
    ],
  }, staff.id);
  const zeroRateRes = await posCheckout(zeroRateReq);
  const zeroRateData = await zeroRateRes.json();
  assertEqual(zeroRateRes.status, 200, "POS Checkout with exchange rate 0 succeeds");
  assertEqual(zeroRateData.transaction.totalInMMK, 0, "totalInMMK with rate 0 equals 0");

  // 3. OVERPAYMENT CAPPING (amount > remainingDebt)
  console.log("\n--- Edge Case 3: Overpayment Capping (amount > remainingDebt) ---");
  const soOverpay = await postSO(makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 1, unitPrice: 20000 }],
    status: "CONFIRMED",
    paymentStatus: "PARTIAL",
    amountPaid: 5000, // 15,000 remaining debt
  }, staff.id));
  const soOverpayData = await soOverpay.json();
  const overpaySOId = soOverpayData.order.id;

  // Attempt payment of 20,000 (> 15,000 remaining)
  const overpayAttemptRes = await postOutstandingPay(makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: overpaySOId,
    amount: 20000,
    method: "CASH",
  }, staff.id));
  assertEqual(overpayAttemptRes.status, 400, "Debt repayment > remaining debt (20k > 15k) rejected with HTTP 400");

  // Exact payment of 15,000
  const exactPayRes = await postOutstandingPay(makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: overpaySOId,
    amount: 15000,
    method: "CASH",
  }, staff.id));
  assertEqual(exactPayRes.status, 200, "Exact remaining debt payment (15k) succeeds with 200");

  // Subsequent payment when remaining debt is 0
  const postFullPayRes = await postOutstandingPay(makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: overpaySOId,
    amount: 1000,
    method: "CASH",
  }, staff.id));
  assertEqual(postFullPayRes.status, 400, "Repayment on fully settled debt (remaining = 0) rejected with HTTP 400");

  // 4. NEGATIVE PAYMENTS & ZERO PAYMENTS
  console.log("\n--- Edge Case 4: Negative & Zero Payment Rejections ---");
  const negPayRes = await postOutstandingPay(makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: overpaySOId,
    amount: -5000,
    method: "CASH",
  }, staff.id));
  assertEqual(negPayRes.status, 400, "Negative payment amount (-5000) rejected with HTTP 400");

  const zeroPayRes = await postOutstandingPay(makeReq("http://localhost/api/outstanding/pay", "POST", {
    salesOrderId: overpaySOId,
    amount: 0,
    method: "CASH",
  }, staff.id));
  assertEqual(zeroPayRes.status, 400, "Zero payment amount (0) rejected with HTTP 400");

  // 5. MOVING AVERAGE COST (MAC) CALCULATIONS
  console.log("\n--- Edge Case 5: Moving Average Cost (MAC) Formula Verification ---");
  // Fetch current franchise stock and cost price
  const stockBeforeMAC = (await prisma.stockLevel.findMany({ where: { variantId: variant1.id } }))
    .reduce((sum, s) => sum + s.quantity, 0);
  const costBeforeMAC = variant1.costPrice || 0;

  // Create PO with 5 units @ 6000 unit cost
  const poMAC = await postPO(makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: branch.id,
    items: [{ variantId: variant1.id, quantity: 5, unitCost: 6000, sellingPrice: 0 }],
  }, staff.id));
  const poMACData = await poMAC.json();

  // Receive PO
  await patchPO(makeReq("http://localhost/api/purchase-orders", "PATCH", {
    id: poMACData.order.id,
    status: "RECEIVED",
  }, staff.id));

  const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant1.id } });
  const expectedMAC = stockBeforeMAC > 0
    ? (stockBeforeMAC * costBeforeMAC + 5 * 6000) / (stockBeforeMAC + 5)
    : 6000;

  assertEqual(updatedVariant?.costPrice, expectedMAC, `Updated costPrice matches franchise MAC formula (${expectedMAC})`);

  console.log(`\n=========================================================================`);
  console.log(`    M2 EDGE CASES STRESS SUITE COMPLETE: ${passed} Passed, ${failed} Failed.`);
  console.log(`=========================================================================`);
}

if (require.main === module) {
  runM2EdgeCasesStressTest().catch(console.error);
}
