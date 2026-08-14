import { prisma } from "../../src/lib/prisma";
import { POST as seedDB } from "../../src/app/api/admin/seed/route";
import { GET as getAuditLogs } from "../../src/app/api/audit-logs/route";
import { POST as postLogin } from "../../src/app/api/auth/login/route";
import { POST as postLogout } from "../../src/app/api/auth/logout/route";
import { GET as getAuthMe } from "../../src/app/api/auth/me/route";
import { GET as getBranches, POST as postBranches } from "../../src/app/api/branches/route";
import { GET as getCategories, POST as postCategories } from "../../src/app/api/categories/route";
import { GET as getCustomers, POST as postCustomers } from "../../src/app/api/customers/route";
import { GET as getDashboardExport } from "../../src/app/api/dashboard/export/route";
import { GET as getDashboardStats } from "../../src/app/api/dashboard/stats/route";
import { GET as getDelivery } from "../../src/app/api/delivery/route";
import { PATCH as patchDeliveryStatus } from "../../src/app/api/delivery/status/route";
import { GET as getExpenses, POST as postExpenses } from "../../src/app/api/expenses/route";
import { POST as postInventoryAdjust } from "../../src/app/api/inventory/adjust/route";
import { GET as getInventory } from "../../src/app/api/inventory/route";
import { POST as postInventoryTransfer } from "../../src/app/api/inventory/transfer/route";
import { GET as getNotifications } from "../../src/app/api/notifications/route";
import { GET as getOutstanding } from "../../src/app/api/outstanding/route";
import { POST as postOutstandingPay } from "../../src/app/api/outstanding/pay/route";
import { POST as postAuthPin } from "../../src/app/api/pos/auth-pin/route";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { GET as getExchangeRate, POST as postExchangeRate } from "../../src/app/api/pos/exchange-rate/route";
import { GET as getProducts, POST as postProducts } from "../../src/app/api/products/route";
import { GET as getPO, POST as postPO, PATCH as patchPO } from "../../src/app/api/purchase-orders/route";
import { GET as getReports } from "../../src/app/api/reports/route";
import { GET as getSO, POST as postSO } from "../../src/app/api/sales-orders/route";
import { PATCH as patchSO, DELETE as deleteSO } from "../../src/app/api/sales-orders/[id]/route";
import { GET as getSchedule, POST as postSchedule } from "../../src/app/api/schedule/route";
import { POST as postShiftsClock } from "../../src/app/api/shifts/clock/route";
import { GET as getShiftsLogs } from "../../src/app/api/shifts/logs/route";
import { GET as getStaff, POST as postStaff } from "../../src/app/api/staff/route";
import { GET as getStaffPermissions, PUT as putStaffPermissions } from "../../src/app/api/staff/[id]/permissions/route";
import { POST as postStaffSync } from "../../src/app/api/staff/sync/route";
import { GET as getSuppliers, POST as postSuppliers } from "../../src/app/api/suppliers/route";

import {
  ALL_MODULE_KEYS,
  DEFAULT_OWNER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_CASHIER_PERMISSIONS,
  getModuleKeyForPath,
  hasModuleReadPermission,
  hasModuleWritePermission,
  sanitizePermissions,
} from "../../src/lib/permissions";
import { checkStaffPermission } from "../../src/lib/auth-helper";

import { NextRequest } from "next/server";
import assert from "node:assert";

// Page Component Imports for Traversal Verification
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

import HomePage from "../../src/app/page";
import SignInPage from "../../src/app/sign-in/[[...sign-in]]/page";
import SignUpPage from "../../src/app/sign-up/[[...sign-up]]/page";
import AccessDeniedPage from "../../src/app/access-denied/page";

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

async function runM1RBACSafetySuite() {
  console.log("=========================================================================");
  console.log("    MILESTONE 1: COMPREHENSIVE MULTI-ROLE RBAC & ISOLATION INTEGRATION SUITE");
  console.log("=========================================================================\n");

  let passedAssertions = 0;

  function assertEqual(actual: unknown, expected: unknown, message: string) {
    assert.strictEqual(actual, expected, message);
    console.log(`  ✅ ASSERT PASS: ${message} [Val: ${JSON.stringify(actual)}]`);
    passedAssertions++;
  }

  function assertOk(condition: boolean, message: string) {
    assert.ok(condition, message);
    console.log(`  ✅ ASSERT PASS: ${message}`);
    passedAssertions++;
  }

  // -------------------------------------------------------------------------
  // STEP 1: Database Seeding
  // -------------------------------------------------------------------------
  console.log("--- STEP 1: Database Initialization via Seed API ---");
  const seedReq = makeReq("http://localhost/api/admin/seed?secret=seed_now_please", "POST");
  const seedRes = await seedDB(seedReq);
  const seedData = await seedRes.json();
  assertEqual(seedRes.status, 200, "POST /api/admin/seed returns 200 OK");
  assertOk(seedData.success === true, "Seed payload success is true");
  console.log(`  Seeded: ${seedData.summary.branches} branches, ${seedData.summary.staff} staff.\n`);

  // Load baseline entities
  const branches = await prisma.branch.findMany();
  const ownerStaff = (await prisma.staff.findFirst({ where: { role: "OWNER" }, include: { branch: true } }))!;
  const hledanManager = (await prisma.staff.findFirst({ where: { role: "MANAGER", branch: { name: { contains: "Hledan" } } }, include: { branch: true } }))!;
  const tamweManager = (await prisma.staff.findFirst({ where: { role: "MANAGER", branch: { name: { contains: "Tamwe" } } }, include: { branch: true } }))!;
  const cashierStaff = (await prisma.staff.findFirst({ where: { role: "CASHIER" }, include: { branch: true } }))!;
  const variant = (await prisma.productVariant.findFirst())!;
  const supplier = (await prisma.supplier.findFirst())!;

  const hledanBranch = branches.find((b) => b.id === hledanManager.branchId)!;
  const tamweBranch = branches.find((b) => b.id === tamweManager.branchId)!;

  // -------------------------------------------------------------------------
  // STEP 2: OWNER Role Permissions & Capabilities Verification
  // -------------------------------------------------------------------------
  console.log("--- STEP 2: OWNER Role Permissions & Access Verification ---");
  assertOk(ownerStaff !== null, "OWNER staff exists");
  assertEqual(ownerStaff.role, "OWNER", "Owner role is OWNER");

  // OWNER gets 100% read/write across all modules
  ALL_MODULE_KEYS.forEach((mod) => {
    const perm = checkStaffPermission(ownerStaff as any, mod, "read");
    const permWrite = checkStaffPermission(ownerStaff as any, mod, "write");
    assertOk(perm.allowed, `OWNER allowed read for module '${mod}'`);
    assertOk(permWrite.allowed, `OWNER allowed write for module '${mod}'`);
  });

  // OWNER can access unassigned/all branches
  const ownerBranchAccessRes = await getPO(makeReq(`http://localhost/api/purchase-orders?branchId=${tamweBranch.id}`, "GET", undefined, ownerStaff.id));
  assertEqual(ownerBranchAccessRes.status, 200, "OWNER can access Tamwe branch purchase orders");

  // OWNER can modify staff permissions
  const updatePermsReq = makeReq(`http://localhost/api/staff/${cashierStaff.id}/permissions`, "PUT", {
    permissions: DEFAULT_CASHIER_PERMISSIONS,
  }, ownerStaff.id);
  const updatePermsRes = await putStaffPermissions(updatePermsReq, { params: Promise.resolve({ id: cashierStaff.id }) });
  assertEqual(updatePermsRes.status, 200, "OWNER can update staff permissions (returns 200 OK)");

  // -------------------------------------------------------------------------
  // STEP 3: MANAGER Role Boundaries & Branch Isolation Verification
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 3: MANAGER Role Boundaries & Branch Isolation ---");
  assertOk(hledanManager !== null, "Hledan Manager exists");
  assertEqual(hledanManager.role, "MANAGER", "Manager role is MANAGER");

  // Manager within assigned branch (Hledan)
  const mgrOwnBranchPoReq = makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: hledanBranch.id,
    items: [{ variantId: variant.id, quantity: 2, unitCost: 1000, sellingPrice: 1500 }],
  }, hledanManager.id);
  const mgrOwnBranchPoRes = await postPO(mgrOwnBranchPoReq);
  assertEqual(mgrOwnBranchPoRes.status, 200, "MANAGER creating PO in assigned branch (Hledan) returns 200");

  // Manager attempting cross-branch PO creation -> auto-forced to manager's branch
  const mgrCrossBranchPoReq = makeReq("http://localhost/api/purchase-orders", "POST", {
    supplierId: supplier.id,
    branchId: tamweBranch.id, // Trying to target Tamwe
    items: [{ variantId: variant.id, quantity: 2, unitCost: 1000, sellingPrice: 1500 }],
  }, hledanManager.id);
  const mgrCrossBranchPoRes = await postPO(mgrCrossBranchPoReq);
  const mgrCrossData = await mgrCrossBranchPoRes.json();
  assertEqual(mgrCrossData.order.branchId, hledanBranch.id, "MANAGER cannot create PO for unassigned branch (forced to assigned branch Hledan)");

  // Manager modifying same-branch cashier permissions -> HTTP 200 OK
  const mgrPutPermReq = makeReq(`http://localhost/api/staff/${cashierStaff.id}/permissions`, "PUT", {
    permissions: DEFAULT_CASHIER_PERMISSIONS,
  }, hledanManager.id);
  const mgrPutPermRes = await putStaffPermissions(mgrPutPermReq, { params: Promise.resolve({ id: cashierStaff.id }) });
  assertEqual(mgrPutPermRes.status, 200, "MANAGER modifying same-branch cashier permissions returns 200 OK");

  // Manager attempting to inspect staff permissions of staff in another branch -> HTTP 403 Forbidden
  const mgrGetCrossStaffPermReq = makeReq(`http://localhost/api/staff/${tamweManager.id}/permissions`, "GET", undefined, hledanManager.id);
  const mgrGetCrossStaffPermRes = await getStaffPermissions(mgrGetCrossStaffPermReq, { params: Promise.resolve({ id: tamweManager.id }) });
  assertEqual(mgrGetCrossStaffPermRes.status, 403, "MANAGER accessing staff permissions of unassigned branch staff returns HTTP 403 Forbidden");

  // -------------------------------------------------------------------------
  // STEP 4: CASHIER Role Boundaries & Strict Block Verification
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 4: CASHIER Role Boundaries & Strict Block Verification ---");
  assertOk(cashierStaff !== null, "Cashier staff exists");
  assertEqual(cashierStaff.role, "CASHIER", "Cashier role is CASHIER");

  // CASHIER allowed endpoints
  const cashierDeliveryReq = makeReq("http://localhost/api/delivery", "GET", undefined, cashierStaff.id);
  const cashierDeliveryRes = await getDelivery(cashierDeliveryReq);
  assertEqual(cashierDeliveryRes.status, 200, "CASHIER accessing /api/delivery returns 200 OK");

  const cashierOutstandingReq = makeReq("http://localhost/api/outstanding", "GET", undefined, cashierStaff.id);
  const cashierOutstandingRes = await getOutstanding(cashierOutstandingReq);
  assertEqual(cashierOutstandingRes.status, 200, "CASHIER accessing /api/outstanding returns 200 OK");

  // CASHIER strictly blocked endpoints (HTTP 403 Forbidden)
  const blockedEndpoints = [
    { name: "GET /api/staff", fn: () => getStaff(makeReq("http://localhost/api/staff", "GET", undefined, cashierStaff.id)) },
    { name: "GET /api/reports", fn: () => getReports(makeReq("http://localhost/api/reports", "GET", undefined, cashierStaff.id)) },
    { name: "GET /api/inventory", fn: () => getInventory(makeReq("http://localhost/api/inventory", "GET", undefined, cashierStaff.id)) },
    { name: "GET /api/purchase-orders", fn: () => getPO(makeReq("http://localhost/api/purchase-orders", "GET", undefined, cashierStaff.id)) },
    { name: "GET /api/expenses", fn: () => getExpenses(makeReq("http://localhost/api/expenses", "GET", undefined, cashierStaff.id)) },
    { name: "POST /api/branches", fn: () => postBranches(makeReq("http://localhost/api/branches", "POST", { name: "Forbidden Branch" }, cashierStaff.id)) },
    { name: "GET /api/dashboard/stats", fn: () => getDashboardStats(makeReq("http://localhost/api/dashboard/stats", "GET", undefined, cashierStaff.id)) },
    { name: "GET /api/audit-logs", fn: () => getAuditLogs(makeReq("http://localhost/api/audit-logs", "GET", undefined, cashierStaff.id)) },
    { name: "POST /api/inventory/adjust", fn: () => postInventoryAdjust(makeReq("http://localhost/api/inventory/adjust", "POST", { branchId: hledanBranch.id, variantId: variant.id, changeAmount: 1, reason: "ADJUSTMENT" }, cashierStaff.id)) },
  ];

  for (const item of blockedEndpoints) {
    const res = await item.fn();
    assertEqual(res.status, 403, `CASHIER calling ${item.name} is strictly blocked with HTTP 403 Forbidden`);
  }

  // Client-Side UI Navigation Permission Evaluation for Cashier
  const restrictedModulesForCashier = ["staff", "reports", "setup", "inventory", "purchases", "expenses", "dashboard", "salesOrders"] as const;
  restrictedModulesForCashier.forEach((mod) => {
    assertOk(!hasModuleReadPermission(cashierStaff as any, mod), `Client navigation helper denies Cashier read for '${mod}'`);
    assertOk(!hasModuleWritePermission(cashierStaff as any, mod), `Client navigation helper denies Cashier write for '${mod}'`);
  });

  // -------------------------------------------------------------------------
  // STEP 5: Multi-Branch Data Isolation Verification
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 5: Multi-Branch Data Isolation Verification ---");

  // Get stock levels across Hledan and Tamwe before adjustment
  const initialHledanStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: hledanBranch.id, variantId: variant.id } },
  }))?.quantity || 0;

  const initialTamweStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: tamweBranch.id, variantId: variant.id } },
  }))?.quantity || 0;

  // Execute inventory adjustment in Hledan branch
  const adjustReq = makeReq("http://localhost/api/inventory/adjust", "POST", {
    branchId: hledanBranch.id,
    variantId: variant.id,
    changeAmount: 25,
    reason: "ADJUSTMENT",
    note: "M1 Multi-Branch Isolation Test",
  }, ownerStaff.id);
  const adjustRes = await postInventoryAdjust(adjustReq);
  assertEqual(adjustRes.status, 200, "Inventory adjustment in Hledan returns 200");

  const finalHledanStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: hledanBranch.id, variantId: variant.id } },
  }))?.quantity;

  const finalTamweStock = (await prisma.stockLevel.findUnique({
    where: { branchId_variantId: { branchId: tamweBranch.id, variantId: variant.id } },
  }))?.quantity;

  assertEqual(finalHledanStock, initialHledanStock + 25, "Hledan branch stock increased by 25");
  assertEqual(finalTamweStock, initialTamweStock, "Tamwe branch stock level strictly isolated and unchanged");

  // -------------------------------------------------------------------------
  // STEP 6: System Pages & API Traversal
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 6: System Pages & API Endpoints Traversal ---");

  const pages = [
    { path: "/dashboard", component: DashboardPage },
    { path: "/pos", component: POSPage },
    { path: "/inventory", component: InventoryPage },
    { path: "/setup", component: SetupPage },
    { path: "/suppliers", component: SuppliersPage },
    { path: "/customers", component: CustomersPage },
    { path: "/sales-orders", component: SalesOrdersPage },
    { path: "/purchases", component: PurchasesPage },
    { path: "/purchase-orders", component: PurchaseOrdersPage },
    { path: "/expenses", component: ExpensesPage },
    { path: "/staff", component: StaffPage },
    { path: "/reports", component: ReportsPage },
    { path: "/settings", component: SettingsPage },
    { path: "/schedule", component: SchedulePage },
    { path: "/", component: HomePage },
    { path: "/sign-in", component: SignInPage },
    { path: "/sign-up", component: SignUpPage },
    { path: "/access-denied", component: AccessDeniedPage },
  ];

  pages.forEach((p) => {
    assertOk(typeof p.component === "function", `Page Component for ${p.path} loaded cleanly`);
  });

  console.log("\n=========================================================================");
  console.log(`    MILESTONE 1 INTEGRATION SUITE COMPLETE: ${passedAssertions} ASSERTIONS PASSED.`);
  console.log("=========================================================================");
}

runM1RBACSafetySuite().catch((err) => {
  console.error("Unhandled exception in M1 Integration Suite:", err);
  process.exit(1);
});
