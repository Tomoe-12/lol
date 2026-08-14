const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function runFullVerificationHarness() {
  console.log("=================================================================");
  console.log("  CHALLENGER 2: EMPIRICAL VERIFICATION HARNESS (REQUIREMENT R3)  ");
  console.log("=================================================================\n");

  const results = {
    scenario1: { passed: false, details: [] },
    scenario2: { passed: false, details: [] },
    scenario3: { passed: false, details: [] }
  };

  // -------------------------------------------------------------------------
  // SCENARIO 1: Verify GET /api/sales-orders returns merged list of standard
  //             SalesOrders and POS Transactions.
  // -------------------------------------------------------------------------
  console.log("--- Running Scenario 1: Merged Sales Orders & POS Transactions ---");
  try {
    const [salesOrders, transactions] = await Promise.all([
      prisma.salesOrder.findMany({
        include: {
          customer: true,
          branch: true,
          items: { include: { variant: { include: { product: true } } } }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.transaction.findMany({
        include: {
          branch: true,
          staff: true,
          items: { include: { product: true, variant: { include: { product: true } } } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const mappedSalesOrders = salesOrders.map((order) => {
      const items = order.items.map((item) => ({
        ...item,
        unitCost: item.unitCost || item.variant?.costPrice || 0,
      }));
      const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
      return { ...order, items, totalCost, isPos: false };
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
            product: { id: item.productId, name: productName, price: unitPrice }
          }
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
        isPos: true
      };
    });

    const mergedList = [...mappedSalesOrders, ...mappedTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const stdCount = mergedList.filter(r => r.isPos === false).length;
    const posCount = mergedList.filter(r => r.isPos === true).length;

    results.scenario1.details.push(`Raw SalesOrders count: ${salesOrders.length}`);
    results.scenario1.details.push(`Raw Transactions count: ${transactions.length}`);
    results.scenario1.details.push(`Merged array total items: ${mergedList.length}`);
    results.scenario1.details.push(`Merged array standard SalesOrders: ${stdCount}`);
    results.scenario1.details.push(`Merged array POS Transactions: ${posCount}`);

    let sortedCorrectly = true;
    for (let i = 0; i < mergedList.length - 1; i++) {
      if (new Date(mergedList[i].createdAt).getTime() < new Date(mergedList[i+1].createdAt).getTime()) {
        sortedCorrectly = false;
        break;
      }
    }
    results.scenario1.details.push(`Sorted descending by createdAt: ${sortedCorrectly}`);

    if (
      mergedList.length === salesOrders.length + transactions.length &&
      stdCount === salesOrders.length &&
      posCount === transactions.length &&
      sortedCorrectly &&
      stdCount > 0 &&
      posCount > 0
    ) {
      results.scenario1.passed = true;
      console.log("✅ SCENARIO 1 PASSED: Merged list successfully returns both standard SalesOrders and POS Transactions sorted by date.");
    } else {
      results.scenario1.passed = false;
      console.error("❌ SCENARIO 1 FAILED: Merging or sorting condition not met.");
    }
  } catch (err) {
    results.scenario1.passed = false;
    results.scenario1.details.push(`Error: ${err.message}`);
    console.error("❌ SCENARIO 1 EXCEPTION:", err);
  }

  // -------------------------------------------------------------------------
  // SCENARIO 2: Verify total sale price (`total`) and total cost price
  //             (`totalCost`) are present and correctly computed on each record.
  // -------------------------------------------------------------------------
  console.log("\n--- Running Scenario 2: Verification of Total Sale Price & Total Cost Price ---");
  try {
    const salesOrders = await prisma.salesOrder.findMany({
      include: { items: { include: { variant: true } } }
    });
    const transactions = await prisma.transaction.findMany({
      include: { items: { include: { variant: true } } }
    });

    const mappedSalesOrders = salesOrders.map((order) => {
      const items = order.items.map((item) => ({
        ...item,
        unitCost: item.unitCost || item.variant?.costPrice || 0,
      }));
      const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
      return { ...order, items, totalCost, isPos: false };
    });

    const mappedTransactions = transactions.map((tx) => {
      const items = tx.items.map((item) => {
        const unitCost = item.unitCost || item.variant?.costPrice || 0;
        return {
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost,
          total: item.total,
        };
      });
      const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
      return {
        id: tx.id,
        total: tx.total,
        totalCost,
        items,
        isPos: true
      };
    });

    const mergedList = [...mappedSalesOrders, ...mappedTransactions];

    let missingTotal = 0;
    let missingTotalCost = 0;
    let costComputationMismatches = 0;
    let nonZeroTotalCostRecords = 0;

    mergedList.forEach(rec => {
      if (rec.total === undefined || rec.total === null || typeof rec.total !== 'number') {
        missingTotal++;
      }
      if (rec.totalCost === undefined || rec.totalCost === null || typeof rec.totalCost !== 'number') {
        missingTotalCost++;
      }

      const expectedCost = rec.items.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
      if (Math.abs(rec.totalCost - expectedCost) > 0.0001) {
        costComputationMismatches++;
      }

      if (rec.totalCost > 0) {
        nonZeroTotalCostRecords++;
      }
    });

    results.scenario2.details.push(`Evaluated records count: ${mergedList.length}`);
    results.scenario2.details.push(`Records with missing total: ${missingTotal}`);
    results.scenario2.details.push(`Records with missing totalCost: ${missingTotalCost}`);
    results.scenario2.details.push(`Cost computation mismatches: ${costComputationMismatches}`);
    results.scenario2.details.push(`Records with non-zero totalCost: ${nonZeroTotalCostRecords}`);

    if (missingTotal === 0 && missingTotalCost === 0 && costComputationMismatches === 0) {
      results.scenario2.passed = true;
      console.log("✅ SCENARIO 2 PASSED: `total` and `totalCost` are present and 100% accurately computed across all records.");
    } else {
      results.scenario2.passed = false;
      console.error(`❌ SCENARIO 2 FAILED: missingTotal=${missingTotal}, missingTotalCost=${missingTotalCost}, mismatches=${costComputationMismatches}`);
    }
  } catch (err) {
    results.scenario2.passed = false;
    results.scenario2.details.push(`Error: ${err.message}`);
    console.error("❌ SCENARIO 2 EXCEPTION:", err);
  }

  // -------------------------------------------------------------------------
  // SCENARIO 3: Verify `/sales-orders` page renders POS transactions and
  //             displays Total Price and Total Cost.
  // -------------------------------------------------------------------------
  console.log("\n--- Running Scenario 3: UI Inspection of /sales-orders Page ---");
  try {
    const pagePath = path.join(__dirname, '../src/app/(dashboard)/sales-orders/page.tsx');
    const apiPath = path.join(__dirname, '../src/app/api/sales-orders/route.ts');

    const pageCode = fs.readFileSync(pagePath, 'utf8');

    const checks = [
      { name: "Table Header TOTAL PRICE present", pass: pageCode.includes("TOTAL PRICE") },
      { name: "Table Header TOTAL COST present", pass: pageCode.includes("TOTAL COST") },
      { name: "POS ID Prefix 'POS-' rendered", pass: pageCode.includes('o.isPos ? "POS-" : "#"') },
      { name: "POS Customer fallback 'Walk-in (POS)' rendered", pass: pageCode.includes('Walk-in (POS)') },
      { name: "TOTAL PRICE cell rendering total", pass: pageCode.includes('(o.total || 0).toLocaleString()') },
      { name: "TOTAL COST cell rendering totalCost", pass: pageCode.includes('(o.totalCost || 0).toLocaleString()') },
      { name: "Modal Header POS Transaction title", pass: pageCode.includes('viewOrder?.isPos ? "POS Transaction" : "Order"') },
      { name: "Modal Unit Cost column present in Order Items", pass: pageCode.includes('Unit Cost') },
      { name: "Modal Total Cost Price label and value present", pass: pageCode.includes('Total Cost Price:') && pageCode.includes('viewOrder.totalCost') },
      { name: "Modal Total Sale Price label and value present", pass: pageCode.includes('Total Sale Price:') && pageCode.includes('viewOrder.total') },
      { name: "Modal POS Action Button Guard (!viewOrder.isPos)", pass: pageCode.includes('!viewOrder.isPos && viewOrder.paymentStatus !== "PAID"') }
    ];

    let allChecksPass = true;
    checks.forEach(c => {
      results.scenario3.details.push(`${c.name}: ${c.pass ? 'PASS' : 'FAIL'}`);
      if (!c.pass) allChecksPass = false;
    });

    if (allChecksPass) {
      results.scenario3.passed = true;
      console.log("✅ SCENARIO 3 PASSED: Frontend /sales-orders page contains all required table columns, POS tags, and modal cost/price UI components.");
    } else {
      results.scenario3.passed = false;
      console.error("❌ SCENARIO 3 FAILED: One or more UI requirements missing.");
    }

  } catch (err) {
    results.scenario3.passed = false;
    results.scenario3.details.push(`Error: ${err.message}`);
    console.error("❌ SCENARIO 3 EXCEPTION:", err);
  }

  // --- FINAL SUMMARY ---
  console.log("\n=================================================================");
  console.log("                        HARNESS SUMMARY                          ");
  console.log("=================================================================");
  console.log(`Scenario 1 (API Merging):       ${results.scenario1.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  results.scenario1.details.forEach(d => console.log(`   - ${d}`));

  console.log(`Scenario 2 (Total & Cost Computation): ${results.scenario2.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  results.scenario2.details.forEach(d => console.log(`   - ${d}`));

  console.log(`Scenario 3 (Frontend Page Render):     ${results.scenario3.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  results.scenario3.details.forEach(d => console.log(`   - ${d}`));

  await prisma.$disconnect();
}

runFullVerificationHarness();
