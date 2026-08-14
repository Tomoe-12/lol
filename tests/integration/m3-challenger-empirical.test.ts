import { prisma } from "../../src/lib/prisma";
import { POST as seedDB } from "../../src/app/api/admin/seed/route";
import { GET as getAuthMe } from "../../src/app/api/auth/me/route";
import { GET as getStaffPermissions, PUT as putStaffPermissions } from "../../src/app/api/staff/[id]/permissions/route";
import { GET as getStaff, POST as postStaff, PUT as putStaff, DELETE as deleteStaff } from "../../src/app/api/staff/route";
import { GET as getExpenses, POST as postExpenses } from "../../src/app/api/expenses/route";
import { GET as getReports } from "../../src/app/api/reports/route";
import { GET as getCategories, POST as postCategories, PUT as putCategories, DELETE as deleteCategories } from "../../src/app/api/categories/route";
import { GET as getProducts, POST as postProducts, PUT as putProducts, DELETE as deleteProducts } from "../../src/app/api/products/route";
import { GET as getSalesOrders, POST as postSalesOrders } from "../../src/app/api/sales-orders/route";
import { GET as getBranches, POST as postBranches } from "../../src/app/api/branches/route";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { POST as adjustInventory } from "../../src/app/api/inventory/adjust/route";
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

async function runEmpiricalSuite() {
  console.log("=========================================================================");
  console.log("   M3 EMPIRICAL CHALLENGER DIRECT VERIFICATION SUITE                     ");
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
  console.log("Seeding fresh database state...");
  const seedReq = makeReq("http://localhost/api/admin/seed?secret=seed_now_please", "POST");
  const seedRes = await seedDB(seedReq);
  assert.strictEqual(seedRes.status, 200, "Seed failed");

  // Load Fixtures
  const branches = await prisma.branch.findMany();
  const branchHledan = branches.find((b) => b.name.includes("Hledan")) || branches[0];
  const branchTamwe = branches.find((b) => b.name.includes("Tamwe")) || branches[1];

  const owner = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const managerHledan = await prisma.staff.findFirst({ where: { role: "MANAGER", branchId: branchHledan.id } });
  const managerTamwe = await prisma.staff.findFirst({ where: { role: "MANAGER", branchId: branchTamwe.id } });
  const cashierHledan = await prisma.staff.findFirst({ where: { role: "CASHIER", branchId: branchHledan.id } });
  const cashierTamwe = await prisma.staff.findFirst({ where: { role: "CASHIER", branchId: branchTamwe.id } });
  const variant = await prisma.productVariant.findFirst({ include: { product: true } });

  assert.ok(owner && managerHledan && managerTamwe && cashierHledan && cashierTamwe && variant);

  // Setup Manager Hledan & Cashier permissions
  await prisma.staff.update({
    where: { id: managerHledan.id },
    data: {
      permissions: JSON.parse(JSON.stringify({
        dashboard: { read: true, write: true },
        pos: { read: true, write: true },
        inventory: { read: true, write: true },
        salesOrders: { read: true, write: true },
        purchases: { read: true, write: true },
        expenses: { read: true, write: true },
        staff: { read: true, write: true },
        reports: { read: true, write: true },
        setup: { read: true, write: true },
      })),
    },
  });

  await prisma.staff.update({
    where: { id: cashierHledan.id },
    data: {
      permissions: JSON.parse(JSON.stringify({
        dashboard: { read: false, write: false },
        pos: { read: true, write: true },
        inventory: { read: false, write: false },
        salesOrders: { read: false, write: false },
        purchases: { read: false, write: false },
        expenses: { read: false, write: false },
        staff: { read: false, write: false },
        reports: { read: false, write: false },
        setup: { read: false, write: false },
      })),
    },
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 1: 401 Unauthorized for missing session
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------");
  console.log("TEST GROUP 1: 401 Unauthorized for missing session");
  console.log("-------------------------------------------------------------------------");

  const unauthEndpoints = [
    { name: "GET /api/auth/me", call: () => getAuthMe(makeReq("http://localhost/api/auth/me", "GET")) },
    { name: "GET /api/staff", call: () => getStaff(makeReq("http://localhost/api/staff", "GET")) },
    { name: "GET /api/staff/[id]/permissions", call: () => getStaffPermissions(makeReq(`http://localhost/api/staff/${cashierHledan.id}/permissions`, "GET"), { params: Promise.resolve({ id: cashierHledan.id }) }) },
    { name: "GET /api/expenses", call: () => getExpenses(makeReq("http://localhost/api/expenses", "GET")) },
    { name: "GET /api/reports", call: () => getReports(makeReq("http://localhost/api/reports", "GET")) },
    { name: "GET /api/categories", call: () => getCategories(makeReq("http://localhost/api/categories", "GET")) },
    { name: "GET /api/products", call: () => getProducts(makeReq("http://localhost/api/products", "GET")) },
    { name: "GET /api/sales-orders", call: () => getSalesOrders(makeReq("http://localhost/api/sales-orders", "GET")) },
  ];

  for (const ep of unauthEndpoints) {
    const res = await ep.call();
    if (res.status === 401) {
      recordPass(`${ep.name} correctly returned HTTP 401 Unauthorized`);
    } else {
      recordFail("Missing Session Defect", `${ep.name} returned status ${res.status} instead of 401`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: 403 Forbidden for Cashier accessing restricted endpoints
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------");
  console.log("TEST GROUP 2: 403 Forbidden for Cashier accessing restricted endpoints");
  console.log("-------------------------------------------------------------------------");

  const cashierRestrictedEndpoints = [
    { name: "GET /api/expenses", call: () => getExpenses(makeReq("http://localhost/api/expenses", "GET", undefined, cashierHledan.id)) },
    { name: "POST /api/expenses", call: () => postExpenses(makeReq("http://localhost/api/expenses", "POST", { branchId: branchHledan.id, category: "OTHER", amount: 5000 }, cashierHledan.id)) },
    { name: "GET /api/reports", call: () => getReports(makeReq("http://localhost/api/reports", "GET", undefined, cashierHledan.id)) },
    { name: "GET /api/staff", call: () => getStaff(makeReq("http://localhost/api/staff", "GET", undefined, cashierHledan.id)) },
    { name: "GET /api/staff/[id]/permissions", call: () => getStaffPermissions(makeReq(`http://localhost/api/staff/${cashierTamwe.id}/permissions`, "GET", undefined, cashierHledan.id), { params: Promise.resolve({ id: cashierTamwe.id }) }) },
    { name: "POST /api/categories", call: () => postCategories(makeReq("http://localhost/api/categories", "POST", { name: "Restricted Category" }, cashierHledan.id)) },
    { name: "POST /api/products", call: () => postProducts(makeReq("http://localhost/api/products", "POST", { name: "Restricted Product", categoryId: "cat1", variants: [] }, cashierHledan.id)) },
    { name: "GET /api/sales-orders", call: () => getSalesOrders(makeReq("http://localhost/api/sales-orders", "GET", undefined, cashierHledan.id)) },
  ];

  for (const ep of cashierRestrictedEndpoints) {
    const res = await ep.call();
    if (res.status === 403) {
      recordPass(`${ep.name} correctly returned HTTP 403 Forbidden for Cashier`);
    } else {
      recordFail("Cashier Authorization Defect", `${ep.name} returned status ${res.status} instead of 403 for Cashier`);
    }
  }

  // Confirm Cashier GET categories & products is allowed for POS checkout display
  const cashierGetCatRes = await getCategories(makeReq("http://localhost/api/categories", "GET", undefined, cashierHledan.id));
  assert.strictEqual(cashierGetCatRes.status, 200, "Cashier with pos.read should be allowed to GET categories for POS UI");
  recordPass("GET /api/categories returned HTTP 200 for Cashier with pos.read (POS UI requirement)");

  const cashierGetProdRes = await getProducts(makeReq("http://localhost/api/products", "GET", undefined, cashierHledan.id));
  assert.strictEqual(cashierGetProdRes.status, 200, "Cashier with pos.read should be allowed to GET products for POS UI");
  recordPass("GET /api/products returned HTTP 200 for Cashier with pos.read (POS UI requirement)");

  // -------------------------------------------------------------------------
  // TEST GROUP 3: 403 Forbidden for Manager accessing another branch
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------");
  console.log("TEST GROUP 3: 403 Forbidden for Manager accessing another branch");
  console.log("-------------------------------------------------------------------------");

  const managerCrossBranchTests = [
    {
      name: "GET /api/staff/[id]/permissions for cross-branch staff",
      call: () => getStaffPermissions(makeReq(`http://localhost/api/staff/${cashierTamwe.id}/permissions`, "GET", undefined, managerHledan.id), { params: Promise.resolve({ id: cashierTamwe.id }) }),
    },
    {
      name: "PUT /api/staff/[id]/permissions for cross-branch staff",
      call: () => putStaffPermissions(makeReq(`http://localhost/api/staff/${cashierTamwe.id}/permissions`, "PUT", { permissions: {} }, managerHledan.id), { params: Promise.resolve({ id: cashierTamwe.id }) }),
    },
    {
      name: "PUT /api/staff for cross-branch staff update",
      call: () => putStaff(makeReq(`http://localhost/api/staff`, "PUT", { id: cashierTamwe.id, name: "Tamwe Updated", email: cashierTamwe.email, role: "CASHIER", branchId: branchTamwe.id }, managerHledan.id)),
    },
    {
      name: "DELETE /api/staff for cross-branch staff",
      call: () => deleteStaff(makeReq(`http://localhost/api/staff?id=${cashierTamwe.id}`, "DELETE", undefined, managerHledan.id)),
    },
    {
      name: "POST /api/staff creating staff in another branch",
      call: () => postStaff(makeReq(`http://localhost/api/staff`, "POST", { name: "Cross Branch Staff", email: "crossbranch@test.com", role: "CASHIER", branchId: branchTamwe.id }, managerHledan.id)),
    },
    {
      name: "POST /api/pos/checkout in another branch",
      call: () => posCheckout(makeReq("http://localhost/api/pos/checkout", "POST", {
        branchId: branchTamwe.id,
        items: [{ product: { id: variant.productId }, selectedVariant: { id: variant.id, costPrice: variant.costPrice }, quantity: 1, unitPrice: 2000, discount: 0 }],
        paymentMethod: "CASH",
        subtotal: 2000,
        discountAmount: 0,
        total: 2000,
        cashReceived: 2000,
        changeGiven: 0,
      }, managerHledan.id)),
    },
    {
      name: "POST /api/inventory/adjust in another branch",
      call: () => adjustInventory(makeReq("http://localhost/api/inventory/adjust", "POST", {
        branchId: branchTamwe.id,
        variantId: variant.id,
        changeAmount: 1,
        reason: "ADJUSTMENT",
      }, managerHledan.id)),
    },
  ];

  for (const ep of managerCrossBranchTests) {
    const res = await ep.call();
    if (res.status === 403) {
      recordPass(`${ep.name} correctly returned HTTP 403 Forbidden for Manager cross-branch access`);
    } else {
      recordFail("Manager Cross-Branch Defect", `${ep.name} returned status ${res.status} instead of 403 for Manager cross-branch access`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 4: 200/201 Authorized for Owner and Manager in their own branch
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------");
  console.log("TEST GROUP 4: 200/201 Authorized for Owner and Manager in their own branch");
  console.log("-------------------------------------------------------------------------");

  // 4.1 Owner viewing & creating expense
  const ownerGetExpRes = await getExpenses(makeReq("http://localhost/api/expenses", "GET", undefined, owner.id));
  if (ownerGetExpRes.status === 200) {
    recordPass("Owner GET /api/expenses returned HTTP 200");
  } else {
    recordFail("Owner Authorization Defect", `Owner GET /api/expenses returned status ${ownerGetExpRes.status}`);
  }

  const ownerPostExpRes = await postExpenses(makeReq("http://localhost/api/expenses", "POST", {
    branchId: branchHledan.id,
    category: "OTHER",
    amount: 10000,
    note: "Owner test expense",
  }, owner.id));
  if (ownerPostExpRes.status === 200 || ownerPostExpRes.status === 201) {
    recordPass("Owner POST /api/expenses returned HTTP 200/201");
  } else {
    recordFail("Owner Authorization Defect", `Owner POST /api/expenses returned status ${ownerPostExpRes.status}`);
  }

  // 4.2 Manager viewing & creating expense in their assigned branch
  const mgrGetExpRes = await getExpenses(makeReq("http://localhost/api/expenses", "GET", undefined, managerHledan.id));
  if (mgrGetExpRes.status === 200) {
    recordPass("Manager GET /api/expenses returned HTTP 200");
  } else {
    recordFail("Manager Authorization Defect", `Manager GET /api/expenses returned status ${mgrGetExpRes.status}`);
  }

  const mgrPostExpRes = await postExpenses(makeReq("http://localhost/api/expenses", "POST", {
    branchId: branchHledan.id,
    category: "SUPPLIES",
    amount: 5000,
    note: "Manager Hledan test expense",
  }, managerHledan.id));
  if (mgrPostExpRes.status === 200 || mgrPostExpRes.status === 201) {
    recordPass("Manager POST /api/expenses in assigned branch returned HTTP 200/201");
  } else {
    recordFail("Manager Authorization Defect", `Manager POST /api/expenses returned status ${mgrPostExpRes.status}`);
  }

  // 4.3 Manager GET & PUT permissions for Cashier in their own branch
  const mgrGetPermRes = await getStaffPermissions(makeReq(`http://localhost/api/staff/${cashierHledan.id}/permissions`, "GET", undefined, managerHledan.id), { params: Promise.resolve({ id: cashierHledan.id }) });
  if (mgrGetPermRes.status === 200) {
    recordPass("Manager GET /api/staff/[sameBranchCashierId]/permissions returned HTTP 200");
  } else {
    recordFail("Manager Authorization Defect", `Manager GET permissions for same branch cashier returned ${mgrGetPermRes.status}`);
  }

  const mgrPutPermRes = await putStaffPermissions(makeReq(`http://localhost/api/staff/${cashierHledan.id}/permissions`, "PUT", {
    permissions: {
      dashboard: { read: true, write: false },
      pos: { read: true, write: true },
      inventory: { read: false, write: false },
      salesOrders: { read: false, write: false },
      purchases: { read: false, write: false },
      expenses: { read: false, write: false },
      staff: { read: false, write: false },
      reports: { read: false, write: false },
      setup: { read: false, write: false },
    },
  }, managerHledan.id), { params: Promise.resolve({ id: cashierHledan.id }) });
  if (mgrPutPermRes.status === 200) {
    recordPass("Manager PUT /api/staff/[sameBranchCashierId]/permissions returned HTTP 200");
  } else {
    recordFail("Manager Authorization Defect", `Manager PUT permissions for same branch cashier returned ${mgrPutPermRes.status}`);
  }

  // 4.4 Owner GET & PUT permissions for Manager
  const ownerGetPermRes = await getStaffPermissions(makeReq(`http://localhost/api/staff/${managerHledan.id}/permissions`, "GET", undefined, owner.id), { params: Promise.resolve({ id: managerHledan.id }) });
  if (ownerGetPermRes.status === 200) {
    recordPass("Owner GET /api/staff/[managerId]/permissions returned HTTP 200");
  } else {
    recordFail("Owner Authorization Defect", `Owner GET permissions returned ${ownerGetPermRes.status}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=========================================================================");
  console.log(`   M3 EMPIRICAL DIRECT SUITE COMPLETE: ${passed} Passed, ${failed} Failed.`);
  console.log("=========================================================================");

  if (failed > 0) {
    console.error("\nSummary of Failures:");
    findings.forEach((f, idx) => {
      console.error(` ${idx + 1}. [${f.category}] ${f.description}`);
    });
    process.exit(1);
  }
}

runEmpiricalSuite().catch((err) => {
  console.error("M3 Empirical Suite Exception:", err);
  process.exit(1);
});
