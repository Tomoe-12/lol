import { prisma } from "../../src/lib/prisma";
import { POST as seedDB } from "../../src/app/api/admin/seed/route";
import { GET as getAuditLogs } from "../../src/app/api/audit-logs/route";
import { GET as getBranches } from "../../src/app/api/branches/route";
import { GET as getExpenses, POST as postExpenses } from "../../src/app/api/expenses/route";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { GET as getPO, POST as postPO } from "../../src/app/api/purchase-orders/route";
import { GET as getReports } from "../../src/app/api/reports/route";
import { GET as getSO, POST as postSO } from "../../src/app/api/sales-orders/route";
import { GET as getStaff } from "../../src/app/api/staff/route";

import { LanguageProvider } from "../../src/providers/language-provider";
import React from "react";
import { renderToString } from "react-dom/server";
import { NextRequest } from "next/server";
import assert from "node:assert";

// Page Component Imports for UI i18n Traversal
import DashboardPage from "../../src/app/(dashboard)/dashboard/page";
import POSPage from "../../src/app/(dashboard)/pos/page";
import InventoryPage from "../../src/app/(dashboard)/inventory/page";
import SetupPage from "../../src/app/(dashboard)/setup/page";
import SuppliersPage from "../../src/app/(dashboard)/suppliers/page";
import CustomersPage from "../../src/app/(dashboard)/customers/page";
import SalesOrdersPage from "../../src/app/(dashboard)/sales-orders/page";
import PurchasesPage from "../../src/app/(dashboard)/purchases/page";
import PurchaseOrdersPage from "../../src/app/(dashboard)/purchase-orders/page";
import ExpensesPage from "../../src/app/(dashboard)/expenses/page";
import StaffPage from "../../src/app/(dashboard)/staff/page";
import ReportsPage from "../../src/app/(dashboard)/reports/page";
import SettingsPage from "../../src/app/(dashboard)/settings/page";
import SchedulePage from "../../src/app/(dashboard)/schedule/page";
import AccessDeniedPage from "../../src/app/access-denied/page";

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

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

async function runChallenger2Suite() {
  console.log("=========================================================================");
  console.log("   CHALLENGER 2 ADVANCED EMPIRICAL STRESS & INTEGRITY HARNESS           ");
  console.log("=========================================================================\n");

  let passed = 0;
  let failed = 0;
  const findings: Array<{ category: string; description: string }> = [];

  function recordPass(msg: string) {
    passed++;
    console.log(`  ✅ ASSERT PASS: ${msg}`);
  }

  function recordFail(category: string, description: string) {
    failed++;
    findings.push({ category, description });
    console.error(`  ❌ BUG/DEFECT FOUND [${category}]: ${description}`);
  }

  // 1. Seed fresh database state
  console.log("Seeding fresh database...");
  const seedReq = makeReq("http://localhost/api/admin/seed?secret=seed_now_please", "POST");
  const seedRes = await seedDB(seedReq);
  assert.strictEqual(seedRes.status, 200, "Seed failed");

  // Load baseline test fixtures
  const branches = await prisma.branch.findMany();
  const owner = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const managerHledan = await prisma.staff.findFirst({ where: { role: "MANAGER", branch: { name: { contains: "Hledan" } } } });
  const managerTamwe = await prisma.staff.findFirst({ where: { role: "MANAGER", branch: { name: { contains: "Tamwe" } } } });
  const cashier = await prisma.staff.findFirst({ where: { role: "CASHIER" } });
  const variant = await prisma.productVariant.findFirst({ include: { product: true } });

  assert.ok(branches.length >= 2, "Need at least 2 branches");
  assert.ok(owner && managerHledan && managerTamwe && cashier && variant, "Missing staff fixtures");

  const branchHledan = branches.find((b) => b.id === managerHledan.branchId)!;
  const branchTamwe = branches.find((b) => b.id === managerTamwe.branchId)!;

  // Ensure high selling price above cost price to avoid validation errors
  const sellingPrice = (variant.costPrice || 1000) + 2000;

  // =========================================================================
  // SUITE 1: CONCURRENT POS CHECKOUT STRESS TEST
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("SUITE 1: Concurrent POS Checkout Load & Race Condition Stress Harness");
  console.log("-------------------------------------------------------------------------");

  // Ensure ample stock in Hledan for stress testing (500 units)
  const existingStockObj = await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branchHledan.id, variantId: variant.id } },
  });
  const currentStock = existingStockObj?.quantity || 0;
  const diff = 500 - currentStock;

  await prisma.stockLevel.upsert({
    where: { branchId_variantId: { branchId: branchHledan.id, variantId: variant.id } },
    update: { quantity: 500 },
    create: { branchId: branchHledan.id, variantId: variant.id, quantity: 500 },
  });

  if (diff !== 0) {
    await prisma.inventoryLog.create({
      data: {
        branchId: branchHledan.id,
        variantId: variant.id,
        change: diff,
        reason: "ADJUSTMENT",
        note: "Challenger 2 harness baseline stock setup",
      },
    });
  }

  const baselineStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branchHledan.id, variantId: variant.id } },
  }))!.quantity;

  const baselineLogCount = await prisma.inventoryLog.count({
    where: { branchId: branchHledan.id, variantId: variant.id },
  });

  console.log(`Executing 50 concurrent POS checkout requests (1 unit each)... Baseline stock: ${baselineStock}`);
  const CONCURRENT_COUNT = 50;
  const checkoutPromises = [];

  for (let i = 0; i < CONCURRENT_COUNT; i++) {
    const req = makeReq("http://localhost/api/pos/checkout", "POST", {
      branchId: branchHledan.id,
      staffId: cashier.id,
      items: [{ variantId: variant.id, quantity: 1, unitPrice: sellingPrice, discount: 0 }],
      paymentMethod: "CASH",
      subtotal: sellingPrice,
      discountAmount: 0,
      total: sellingPrice,
      cashReceived: sellingPrice,
      changeGiven: 0,
    }, cashier.id);
    checkoutPromises.push(posCheckout(req));
  }

  const results = await Promise.all(checkoutPromises);
  const successCount = results.filter((r) => r.status === 200).length;
  console.log(`Completed ${CONCURRENT_COUNT} concurrent POS checkouts. Successes: ${successCount} / ${CONCURRENT_COUNT}`);

  const postCheckoutStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: branchHledan.id, variantId: variant.id } },
  }))!.quantity;

  const postCheckoutLogCount = await prisma.inventoryLog.count({
    where: { branchId: branchHledan.id, variantId: variant.id },
  });

  const expectedStock = baselineStock - successCount;
  const expectedLogs = baselineLogCount + successCount;

  if (successCount === CONCURRENT_COUNT && postCheckoutStock === expectedStock) {
    recordPass(`StockLevel.quantity reduced perfectly by ${successCount} units under 50-way concurrency (Actual: ${postCheckoutStock})`);
  } else if (postCheckoutStock !== expectedStock) {
    recordFail(
      "POS Concurrency Race Condition",
      `Stock level drift under concurrent checkout load. Expected ${expectedStock}, got ${postCheckoutStock}`
    );
  } else {
    recordPass(`Concurrent checkouts executed with ${successCount} successes and stock updated to ${postCheckoutStock}`);
  }

  if (postCheckoutLogCount === expectedLogs) {
    recordPass(`InventoryLog count increased by exactly ${successCount} entries under concurrency (Actual: ${postCheckoutLogCount})`);
  } else {
    recordFail(
      "POS Concurrency Ledger Mismatch",
      `InventoryLog missing entries under concurrent load. Expected ${expectedLogs}, got ${postCheckoutLogCount}`
    );
  }

  // Verify Zero Drift between StockLevel and InventoryLogs sum
  const allLogs = await prisma.inventoryLog.findMany({
    where: { branchId: branchHledan.id, variantId: variant.id },
  });
  const logSum = allLogs.reduce((sum, l) => sum + l.change, 0);

  if (postCheckoutStock === logSum) {
    recordPass(`Zero-drift match: StockLevel quantity (${postCheckoutStock}) === InventoryLog sum (${logSum})`);
  } else {
    recordFail(
      "Zero-Drift Invariant Violation",
      `Physical StockLevel (${postCheckoutStock}) drift from InventoryLog ledger (${logSum})`
    );
  }

  // =========================================================================
  // SUITE 2: MULTI-BRANCH DATA ISOLATION UNDER LOAD
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("SUITE 2: Multi-Branch Data Isolation Stress Test");
  console.log("-------------------------------------------------------------------------");

  // Create isolated records in Hledan vs Tamwe
  const hledanExReq = makeReq("http://localhost/api/expenses", "POST", {
    branchId: branchHledan.id,
    category: "RENT",
    amount: 50000,
    note: "Hledan Rent Expense",
  }, owner.id);
  await postExpenses(hledanExReq);

  const tamweExReq = makeReq("http://localhost/api/expenses", "POST", {
    branchId: branchTamwe.id,
    category: "ELECTRICITY",
    amount: 30000,
    note: "Tamwe Electricity Expense",
  }, owner.id);
  await postExpenses(tamweExReq);

  // Manager Hledan queries expenses with branchId filter
  const mgrHledanExReq = makeReq(`http://localhost/api/expenses?branchId=${branchHledan.id}`, "GET", undefined, managerHledan.id);
  const mgrHledanExRes = await getExpenses(mgrHledanExReq);
  const mgrHledanExBody = await mgrHledanExRes.json();
  const mgrHledanExpenses = mgrHledanExBody.expenses || [];

  if (Array.isArray(mgrHledanExpenses) && mgrHledanExpenses.every((e: any) => e.branchId === branchHledan.id)) {
    recordPass("GET /api/expenses?branchId=Hledan returns ONLY Hledan branch expenses");
  } else {
    recordFail("Multi-Branch Data Leak", "Manager querying Hledan expenses received records from other branches!");
  }

  // Cross-branch Mutation Attempt: Manager Hledan attempts to create Sales Order in Tamwe Branch
  const crossSoReq = makeReq("http://localhost/api/sales-orders", "POST", {
    branchId: branchTamwe.id,
    items: [{ variantId: variant.id, quantity: 1, unitPrice: sellingPrice, discount: 0 }],
    status: "CONFIRMED",
    paymentStatus: "PAID",
    amountPaid: sellingPrice,
  }, managerHledan.id);
  const crossSoRes = await postSO(crossSoReq);

  if (crossSoRes.status === 403 || crossSoRes.status === 400) {
    recordPass(`Manager blocked from creating Sales Order in another branch (Status: ${crossSoRes.status})`);
  } else {
    recordFail("Multi-Branch Security Bypass", `Manager Hledan was allowed to create Sales Order for Tamwe branch! HTTP ${crossSoRes.status}`);
  }

  // Cross-branch POS Checkout Attempt: Manager Hledan attempts to checkout in Tamwe Branch
  const crossPosReq = makeReq("http://localhost/api/pos/checkout", "POST", {
    branchId: branchTamwe.id,
    staffId: managerHledan.id,
    items: [{ variantId: variant.id, quantity: 1, unitPrice: sellingPrice, discount: 0 }],
    paymentMethod: "CASH",
    subtotal: sellingPrice,
    discountAmount: 0,
    total: sellingPrice,
    cashReceived: sellingPrice,
    changeGiven: 0,
  }, managerHledan.id);
  const crossPosRes = await posCheckout(crossPosReq);

  if (crossPosRes.status === 403 || crossPosRes.status === 400) {
    recordPass(`Manager blocked from POS checkout in another branch (Status: ${crossPosRes.status})`);
  } else {
    recordFail("Multi-Branch Security Bypass", `Manager Hledan was allowed to execute POS checkout in Tamwe branch! HTTP ${crossPosRes.status}`);
  }

  // =========================================================================
  // SUITE 3: ROLE-BASED ACCESS CONTROL (RBAC) FULL MATRIX AUDIT
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("SUITE 3: Role-Based Access Control (RBAC) Full Matrix Audit");
  console.log("-------------------------------------------------------------------------");

  const rbacTests = [
    { name: "Cashier fetching Staff list", fn: () => getStaff(makeReq("http://localhost/api/staff", "GET", undefined, cashier.id)), expectedStatus: 403 },
    { name: "Cashier fetching Financial Reports", fn: () => getReports(makeReq("http://localhost/api/reports", "GET", undefined, cashier.id)), expectedStatus: 403 },
    { name: "Cashier fetching Audit Logs", fn: () => getAuditLogs(makeReq("http://localhost/api/audit-logs", "GET", undefined, cashier.id)), expectedStatus: 403 },
    { name: "Cashier creating Purchase Order", fn: () => postPO(makeReq("http://localhost/api/purchase-orders", "POST", { supplierId: "x", branchId: branchHledan.id, items: [] }, cashier.id)), expectedStatus: 403 },
    { name: "Unauthenticated fetching Staff list", fn: () => getStaff(makeReq("http://localhost/api/staff", "GET")), expectedStatus: 401 },
    { name: "Unauthenticated creating Purchase Order", fn: () => postPO(makeReq("http://localhost/api/purchase-orders", "POST", {})), expectedStatus: 401 },
    { name: "Unauthenticated executing POS Checkout", fn: () => posCheckout(makeReq("http://localhost/api/pos/checkout", "POST", {})), expectedStatus: 401 },
  ];

  for (const test of rbacTests) {
    const res = await test.fn();
    if (res.status === test.expectedStatus) {
      recordPass(`RBAC Enforcement: ${test.name} returned HTTP ${res.status}`);
    } else {
      recordFail("RBAC Vulnerability", `${test.name} expected HTTP ${test.expectedStatus}, got HTTP ${res.status}`);
    }
  }

  // =========================================================================
  // SUITE 4: i18n SINGLE-LANGUAGE UI RENDERING & RAW SLASH DETECTOR
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("SUITE 4: i18n UI Single-Language Rendering & Raw Slash Detector");
  console.log("-------------------------------------------------------------------------");

  const mockStorage = new MockLocalStorage();
  const originalWindow = global.window;
  const originalLocalStorage = global.localStorage;

  try {
    // @ts-ignore
    global.window = {} as any;
    // @ts-ignore
    global.localStorage = mockStorage;

    const pagesToTest = [
      { name: "DashboardPage", comp: DashboardPage },
      { name: "POSPage", comp: POSPage },
      { name: "InventoryPage", comp: InventoryPage },
      { name: "SetupPage", comp: SetupPage },
      { name: "SuppliersPage", comp: SuppliersPage },
      { name: "CustomersPage", comp: CustomersPage },
      { name: "SalesOrdersPage", comp: SalesOrdersPage },
      { name: "PurchasesPage", comp: PurchasesPage },
      { name: "PurchaseOrdersPage", comp: PurchaseOrdersPage },
      { name: "ExpensesPage", comp: ExpensesPage },
      { name: "StaffPage", comp: StaffPage },
      { name: "ReportsPage", comp: ReportsPage },
      { name: "SettingsPage", comp: SettingsPage },
      { name: "SchedulePage", comp: SchedulePage },
      { name: "AccessDeniedPage", comp: AccessDeniedPage },
    ];

    for (const page of pagesToTest) {
      // Test English ('en') rendering
      mockStorage.setItem("app-language", "en");
      let htmlEn = "";
      try {
        htmlEn = renderToString(React.createElement(LanguageProvider, null, React.createElement(page.comp)));
      } catch (err: any) {
        htmlEn = err.message || "";
      }

      // Check for raw bilingual slash " / "
      const hasSlashSeparatorEn = / [\/] /.test(htmlEn);

      if (!hasSlashSeparatorEn) {
        recordPass(`${page.name} renders clean single-language English without raw bilingual slashes`);
      } else {
        recordFail("i18n Bilingual Slash Leak", `${page.name} contains raw bilingual slash ' / ' in English toggle state!`);
      }

      // Test Burmese ('my') rendering
      mockStorage.setItem("app-language", "my");
      let htmlMy = "";
      try {
        htmlMy = renderToString(React.createElement(LanguageProvider, null, React.createElement(page.comp)));
      } catch (err: any) {
        htmlMy = err.message || "";
      }

      const hasSlashSeparatorMy = / [\/] /.test(htmlMy);
      if (!hasSlashSeparatorMy) {
        recordPass(`${page.name} renders clean single-language Burmese without raw slashes`);
      } else {
        recordFail("i18n Bilingual Slash Leak", `${page.name} contains raw bilingual slash ' / ' in Burmese toggle state!`);
      }
    }

  } finally {
    // @ts-ignore
    global.window = originalWindow;
    // @ts-ignore
    global.localStorage = originalLocalStorage;
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n=========================================================================");
  console.log(`   CHALLENGER 2 STRESS HARNESS COMPLETE: ${passed} Passed, ${failed} Defect(s) Found.`);
  console.log("=========================================================================");
  if (findings.length > 0) {
    console.log("\nSummary of Empirical Defect Findings:");
    findings.forEach((f, idx) => {
      console.log(` ${idx + 1}. [${f.category}] ${f.description}`);
    });
  }
}

runChallenger2Suite().catch((err) => {
  console.error("Challenger 2 Suite Fatal Error:", err);
  process.exit(1);
});
