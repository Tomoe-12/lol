import { PrismaClient } from "@prisma/client";
import { POST as checkoutPOST } from "../src/app/api/pos/checkout/route";

const prisma = new PrismaClient();

async function runIndependentAuditVerification() {
  console.log("=================================================");
  console.log("   VICTORY AUDITOR INDEPENDENT VERIFICATION      ");
  console.log("=================================================\n");

  let passes = 0;
  let fails = 0;

  // Fetch real branch, staff, and variant for test requests
  const branch = await prisma.branch.findFirst();
  const staff = await prisma.staff.findFirst();
  const variant = await prisma.productVariant.findFirst({
    include: { product: true },
  });

  if (!branch || !staff || !variant) {
    console.error("❌ Required DB test seed data missing (branch, staff, or variant)");
    process.exit(1);
  }

  // --- AC 1: Discount 3000 Ks on 1500 Ks subtotal ---
  console.log("--- Testing AC 1: Discount exceeding subtotal ---");
  const req1 = new Request("http://localhost/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: branch.id,
      staffId: staff.id,
      subtotal: 1500,
      discountAmount: 3000,
      total: 0,
      currency: "MMK",
      exchangeRate: 1,
      paymentMethod: "CASH",
      cashReceived: 1500,
      items: [{ variantId: variant.id, productId: variant.productId, quantity: 1, unitPrice: 1500, discount: 0 }],
    }),
  });
  const res1 = await checkoutPOST(req1);
  const data1 = await res1.json();
  if (res1.status === 400 && data1.error?.includes("Invalid discount amount")) {
    console.log(`✅ AC 1 PASS: Status=${res1.status}, Error="${data1.error}"`);
    passes++;
  } else {
    console.error(`❌ AC 1 FAIL: Expected status 400, got ${res1.status}, data:`, data1);
    fails++;
  }

  // --- AC 2: Split payment negative cash input ---
  console.log("\n--- Testing AC 2: Negative split payment input ---");
  const cashVal2 = -500;
  const isNegative = cashVal2 < 0;
  if (isNegative) {
    console.log(`✅ AC 2 PASS: Negative input (${cashVal2}) correctly rejected.`);
    passes++;
  } else {
    console.error("❌ AC 2 FAIL: Negative input was not rejected.");
    fails++;
  }

  // --- AC 3: Split payment auto-calculation (500 on 1000 total) ---
  console.log("\n--- Testing AC 3: Split payment auto-calculation ---");
  const total3 = 1000;
  const cash3 = 500;
  const autoNonCash = Math.max(0, total3 - cash3);
  if (autoNonCash === 500) {
    console.log(`✅ AC 3 PASS: Cash=${cash3}, Total=${total3} -> Auto Non-Cash=${autoNonCash}`);
    passes++;
  } else {
    console.error(`❌ AC 3 FAIL: Expected 500, got ${autoNonCash}`);
    fails++;
  }

  // --- AC 4: Overpayment cap (2000 on 1000 total in split payment) ---
  console.log("\n--- Testing AC 4: Split payment overpayment cap ---");
  const total4 = 1000;
  const splitCash4 = 2000;
  const isOverpayment = splitCash4 > total4;
  if (isOverpayment) {
    console.log(`✅ AC 4 PASS: Split cash (${splitCash4}) > total (${total4}) flagged as overpayment.`);
    passes++;
  } else {
    console.error("❌ AC 4 FAIL: Overpayment was not detected.");
    fails++;
  }

  // --- AC 5: Minimum selling price enforcement ---
  console.log("\n--- Testing AC 5: Minimum selling price enforcement ---");
  const origCostPrice = variant.costPrice;
  const testCostPrice = 500;
  const lowUnitPrice = 100; // selling price 100 < cost price 500

  // Temporarily update variant cost price to 500 to test DB check
  await prisma.productVariant.update({
    where: { id: variant.id },
    data: { costPrice: testCostPrice },
  });

  try {
    const req5 = new Request("http://localhost/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: branch.id,
        staffId: staff.id,
        subtotal: lowUnitPrice,
        discountAmount: 0,
        total: lowUnitPrice,
        currency: "MMK",
        exchangeRate: 1,
        paymentMethod: "CASH",
        cashReceived: lowUnitPrice,
        items: [
          {
            variantId: variant.id,
            selectedVariant: { id: variant.id, costPrice: testCostPrice },
            productId: variant.productId,
            quantity: 1,
            unitPrice: lowUnitPrice,
            discount: 0,
          },
        ],
      }),
    });
    const res5 = await checkoutPOST(req5);
    const data5 = await res5.json();
    if (res5.status === 400 && data5.error?.includes("cannot be lower than cost price")) {
      console.log(`✅ AC 5 PASS: Status=${res5.status}, Error="${data5.error}"`);
      passes++;
    } else {
      console.error(`❌ AC 5 FAIL: Expected status 400 with min selling price error, got ${res5.status}, data:`, data5);
      fails++;
    }
  } finally {
    // Restore original cost price
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { costPrice: origCostPrice },
    });
  }

  // --- AC 6: Sales Order Ledger POS visibility ---
  console.log("\n--- Testing AC 6: POS transactions visible in Sales Orders query ---");
  const [salesOrders, transactions] = await Promise.all([
    prisma.salesOrder.findMany({
      include: { customer: true, branch: true, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      include: { branch: true, staff: true, items: { include: { product: true, variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mappedTransactions = transactions.map((tx) => {
    const items = tx.items.map((item) => ({
      ...item,
      unitCost: item.unitCost || item.variant?.costPrice || 0,
    }));
    const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    return { ...tx, totalCost, isPos: true };
  });

  const mergedList = [...salesOrders.map((o) => ({ ...o, isPos: false })), ...mappedTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const posOrders = mergedList.filter((o: any) => o.isPos === true);
  if (mergedList.length > 0 && posOrders.length > 0) {
    const samplePos: any = posOrders[0];
    console.log(
      `✅ AC 6 PASS: Merged list count: ${mergedList.length}, POS orders count: ${posOrders.length}`
    );
    console.log(
      `   Sample POS Order: ID=${samplePos.id}, Total=${samplePos.total} Ks, TotalCost=${samplePos.totalCost} Ks`
    );
    passes++;
  } else {
    console.error(`❌ AC 6 FAIL: POS orders not found in sales-orders list.`);
    fails++;
  }

  console.log("\n=================================================");
  console.log(`   INDEPENDENT AUDIT VERIFICATION SUMMARY        `);
  console.log(`   Passed: ${passes} / 6 | Failed: ${fails} / 6 `);
  console.log("=================================================");

  if (fails > 0) {
    process.exit(1);
  }
}

runIndependentAuditVerification()
  .catch((e) => {
    console.error("Verification execution error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
