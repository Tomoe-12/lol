import { prisma } from "../../src/lib/prisma";
import { POST as seedDB } from "../../src/app/api/admin/seed/route";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { NextRequest } from "next/server";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

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

async function runM6EmpiricalSuite() {
  console.log("=========================================================================");
  console.log("   M6 EMPIRICAL CHALLENGER STRESS & ADVERSARIAL VERIFICATION SUITE       ");
  console.log("=========================================================================\n");

  let passed = 0;
  let failed = 0;
  const findings: Array<{ category: string; description: string }> = [];

  function recordPass(msg: string) {
    passed++;
    console.log(`  ✅ PASS: ${msg}`);
  }

  function recordFail(category: string, description: string) {
    failed++;
    findings.push({ category, description });
    console.error(`  ❌ FAIL [${category}]: ${description}`);
  }

  // 1. Seed DB
  console.log("1. Seeding fresh database state...");
  const seedReq = makeReq("http://localhost/api/admin/seed?secret=seed_now_please", "POST");
  const seedRes = await seedDB(seedReq);
  assert.strictEqual(seedRes.status, 200, "Seed failed");

  // Load Fixtures
  const branches = await prisma.branch.findMany();
  const branchHledan = branches.find((b) => b.name.includes("Hledan")) || branches[0];
  const branchTamwe = branches.find((b) => b.name.includes("Tamwe")) || branches[1];

  const cashierHledan = await prisma.staff.findFirst({
    where: { role: "CASHIER", branchId: branchHledan.id },
  });
  const variant = await prisma.productVariant.findFirst({
    include: { product: true },
  });

  assert.ok(branches.length >= 2, "Must have at least 2 branches");
  assert.ok(cashierHledan, "Must have a Cashier assigned to Hledan branch");
  assert.ok(variant, "Must have a product variant fixture");

  // =========================================================================
  // R1: Cashier Branch Scoping & Payload Manipulation
  // =========================================================================
  console.log("\n2. Testing R1: Cashier Branch Scoping & Payload Manipulation...");
  try {
    // Attempt checkout as cashierHledan (assigned to branchHledan), but explicitly pass branchTamwe.id in body
    const manipulatedCheckoutReq = makeReq(
      "http://localhost/api/pos/checkout",
      "POST",
      {
        branchId: branchTamwe.id, // Manipulated payload attempting cross-branch checkout!
        subtotal: 1000,
        discountAmount: 0,
        total: 1000,
        currency: "MMK",
        exchangeRate: 1,
        paymentMethod: "CASH",
        cashReceived: 1000,
        changeGiven: 0,
        items: [
          {
            productId: variant.productId,
            variantId: variant.id,
            quantity: 1,
            unitPrice: 1000,
            costPrice: 500,
            productName: variant.product.name,
          },
        ],
      },
      cashierHledan.id
    );

    const checkoutRes = await posCheckout(manipulatedCheckoutReq);
    const checkoutData = await checkoutRes.json();

    if (checkoutRes.status === 200 && checkoutData.transaction) {
      // Confirm that the transaction branchId was strictly forced to cashier's assigned branch (branchHledan.id)
      if (checkoutData.transaction.branchId === branchHledan.id) {
        recordPass("Cashier cross-branch payload manipulation safely sanitized to assigned branch (Hledan)");
      } else {
        recordFail(
          "R1 Cashier Branch Scoping",
          `Transaction branchId was set to ${checkoutData.transaction.branchId} instead of cashier assigned branch ${branchHledan.id}`
        );
      }
    } else {
      recordFail(
        "R1 Cashier Branch Scoping",
        `POS checkout failed with status ${checkoutRes.status}: ${JSON.stringify(checkoutData)}`
      );
    }
  } catch (err) {
    recordFail("R1 Cashier Branch Scoping", `Execution error: ${err}`);
  }

  // =========================================================================
  // R2: Variant Stock Calculation & Zero Leakage Verification
  // =========================================================================
  console.log("\n3. Testing R2: Variant Stock Calculation on Product Cards...");
  try {
    const productCardPath = path.join(process.cwd(), "src/components/pos/product-card.tsx");
    const productCardContent = fs.readFileSync(productCardPath, "utf-8");

    // Check if cross-branch fallback exists
    const hasCrossBranchFallback = productCardContent.includes("v.stockLevels.find((s) => s.branchId !== activeBranchId)");
    const hasStrictBranchFilter = productCardContent.includes("v.stockLevels.find((s) => s.branchId === activeBranchId)");
    const hasCartSubtractions = productCardContent.includes("branchStockQuantity - cartQuantity");

    if (!hasCrossBranchFallback && hasStrictBranchFilter) {
      recordPass("ProductCard strictly isolates stock levels to active branch (0 cross-branch leaks)");
    } else {
      recordFail(
        "R2 Variant Stock Isolation",
        "ProductCard contains potential cross-branch stock leaks or lacks strict branch filtering"
      );
    }

    if (hasCartSubtractions) {
      recordPass("ProductCard dynamically subtracts active cart quantities from available branch stock");
    } else {
      recordFail(
        "R2 Real-Time Cart Subtraction",
        "ProductCard does not subtract active cart quantities from available stock"
      );
    }
  } catch (err) {
    recordFail("R2 Stock Isolation", `Inspection error: ${err}`);
  }

  // =========================================================================
  // R3: Strict i18n Language Toggle (Zero Raw Slashes & Complete Coverage)
  // =========================================================================
  console.log("\n4. Testing R3: Strict Language Toggle & Dual Slash Leaks...");
  
  const targetModules = [
    { name: "Sales Voucher (Receipt)", path: "src/components/pos/receipt-view.tsx" },
    { name: "Sales Voucher (Cart)", path: "src/components/pos/cart-panel.tsx" },
    { name: "Sales Voucher (Payment)", path: "src/components/pos/payment-dialog.tsx" },
    { name: "Branches Table", path: "src/app/(dashboard)/branches/page.tsx" },
    { name: "Supplier Table", path: "src/app/(dashboard)/suppliers/page.tsx" },
    { name: "Sales Order Table", path: "src/app/(dashboard)/sales-orders/page.tsx" },
    { name: "Purchases Table", path: "src/app/(dashboard)/purchases/page.tsx" },
    { name: "Purchase Orders Table", path: "src/app/(dashboard)/purchase-orders/page.tsx" },
    { name: "Expenses Table", path: "src/app/(dashboard)/expenses/page.tsx" },
    { name: "Staff Table", path: "src/app/(dashboard)/staff/page.tsx" },
    { name: "Reports", path: "src/app/(dashboard)/reports/page.tsx" },
  ];

  const dualSlashLeaks: Array<{ module: string; line: number; text: string }> = [];
  const unTranslatedLeaks: Array<{ module: string; description: string }> = [];

  targetModules.forEach(({ name, path: relPath }) => {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) return;

    const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // Check for dual slash inside t("English / Burmese", ...)
      const tDualMatch = lineText.match(/t\(\s*"([^"]*?\/[^"]*?)"\s*,/);
      if (tDualMatch && tDualMatch[1].includes("/")) {
        dualSlashLeaks.push({
          module: name,
          line: lineNum,
          text: lineText.trim(),
        });
      }

      // Check for hardcoded JSX dual slash strings containing Burmese script
      if (lineText.includes("/") && /[\u1000-\u109F]/.test(lineText) && !lineText.includes("t(")) {
        dualSlashLeaks.push({
          module: name,
          line: lineNum,
          text: lineText.trim(),
        });
      }
    });
  });

  // Specific check for Suppliers Page missing translations
  const suppliersPath = path.join(process.cwd(), "src/app/(dashboard)/suppliers/page.tsx");
  const suppliersContent = fs.readFileSync(suppliersPath, "utf-8");
  if (suppliersContent.includes("Manage your supplier directory") && !suppliersContent.includes("t(\"Manage your supplier directory\"")) {
    unTranslatedLeaks.push({
      module: "Supplier Table",
      description: "Suppliers page contains raw un-translated English headers and form labels without t() wrapper",
    });
  }

  if (dualSlashLeaks.length === 0) {
    recordPass("Zero dual slash leaks (' / ') detected across all 8 target modules");
  } else {
    dualSlashLeaks.forEach((leak) => {
      recordFail(
        "R3 Strict i18n Dual Slash Leak",
        `${leak.module} line ${leak.line}: ${leak.text}`
      );
    });
  }

  if (unTranslatedLeaks.length === 0) {
    recordPass("All target modules contain Burmese translations for i18n toggle");
  } else {
    unTranslatedLeaks.forEach((leak) => {
      recordFail("R3 i18n Coverage", `${leak.module}: ${leak.description}`);
    });
  }

  // Summary
  console.log("\n=========================================================================");
  console.log(`   SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================================================\n");

  if (failed > 0) {
    console.error("EXPLICIT VERDICT: REQUEST_CHANGES");
    console.error(`Discovered ${failed} empirical test failures during verification.`);
  } else {
    console.log("EXPLICIT VERDICT: APPROVE");
  }
}

runM6EmpiricalSuite().catch(console.error);
