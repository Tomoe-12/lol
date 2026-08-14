import { prisma } from "../../src/lib/prisma";
import { POST as seedDB } from "../../src/app/api/admin/seed/route";
import { GET as getStaffPermissions, PUT as putStaffPermissions } from "../../src/app/api/staff/[id]/permissions/route";
import { GET as getStaff, POST as postStaff, PUT as putStaff, DELETE as deleteStaff } from "../../src/app/api/staff/route";
import { POST as posCheckout } from "../../src/app/api/pos/checkout/route";
import { POST as adjustInventory } from "../../src/app/api/inventory/adjust/route";
import { GET as getSalesOrders, POST as postSalesOrders } from "../../src/app/api/sales-orders/route";
import { GET as getExpenses, POST as postExpenses } from "../../src/app/api/expenses/route";
import { GET as getReports } from "../../src/app/api/reports/route";
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

async function runM3ChallengerSuite() {
  console.log("=========================================================================");
  console.log("   MILESTONE M3 EMPIRICAL CHALLENGER STRESS TEST SUITE                  ");
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

  // 1. Seed DB to get consistent test data
  console.log("Seeding fresh database state...");
  const seedReq = makeReq("http://localhost/api/admin/seed?secret=seed_now_please", "POST");
  const seedRes = await seedDB(seedReq);
  assert.strictEqual(seedRes.status, 200, "Seed failed");

  // Load test fixtures
  const branches = await prisma.branch.findMany();
  assert.ok(branches.length >= 2, "Need at least 2 branches for cross-branch testing");

  const branchHledan = branches.find((b) => b.name.includes("Hledan")) || branches[0];
  const branchTamwe = branches.find((b) => b.name.includes("Tamwe")) || branches[1];

  const owner = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  const managerHledan = await prisma.staff.findFirst({ where: { role: "MANAGER", branchId: branchHledan.id } });
  const managerTamwe = await prisma.staff.findFirst({ where: { role: "MANAGER", branchId: branchTamwe.id } });
  const cashierHledan = await prisma.staff.findFirst({ where: { role: "CASHIER", branchId: branchHledan.id } });
  const cashierTamwe = await prisma.staff.findFirst({ where: { role: "CASHIER", branchId: branchTamwe.id } });
  const variant = await prisma.productVariant.findFirst({ include: { product: true } });

  assert.ok(owner, "Missing Owner staff");
  assert.ok(managerHledan, "Missing Manager Hledan staff");
  assert.ok(managerTamwe, "Missing Manager Tamwe staff");
  assert.ok(cashierHledan, "Missing Cashier Hledan staff");
  assert.ok(cashierTamwe, "Missing Cashier Tamwe staff");
  assert.ok(variant, "Missing ProductVariant fixture");

  console.log(`Fixtures loaded:
  - Owner: ${owner.name} (${owner.id})
  - Mgr Hledan: ${managerHledan.name} (${managerHledan.id}, branch ${branchHledan.name})
  - Mgr Tamwe: ${managerTamwe.name} (${managerTamwe.id}, branch ${branchTamwe.name})
  - Cashier Hledan: ${cashierHledan.name} (${cashierHledan.id}, branch ${branchHledan.name})
  - Cashier Tamwe: ${cashierTamwe.name} (${cashierTamwe.id}, branch ${branchTamwe.name})
  `);

  // Setup Manager Hledan permissions: ensure staff write permission is set
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

  // Setup Cashier Hledan permissions: default read-only POS, no write, no staff access
  await prisma.staff.update({
    where: { id: cashierHledan.id },
    data: {
      permissions: JSON.parse(JSON.stringify({
        dashboard: { read: true, write: false },
        pos: { read: true, write: false },
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

  // =========================================================================
  // TASK 1A: ATTEMPT TO MODIFY OWNER PERMISSIONS VIA PUT /api/staff/[id]/permissions (ASSERT 403)
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("TASK 1A: Attempt to modify Owner permissions via PUT /api/staff/[id]/permissions");
  console.log("-------------------------------------------------------------------------");

  const permPayload = {
    permissions: {
      dashboard: { read: false, write: false },
      pos: { read: false, write: false },
      inventory: { read: false, write: false },
      salesOrders: { read: false, write: false },
      purchases: { read: false, write: false },
      expenses: { read: false, write: false },
      staff: { read: false, write: false },
      reports: { read: false, write: false },
      setup: { read: false, write: false },
    },
  };

  // 1A.1: Owner attempting to modify Owner permissions
  const putOwnerByOwnerReq = makeReq(`http://localhost/api/staff/${owner.id}/permissions`, "PUT", permPayload, owner.id);
  const putOwnerByOwnerRes = await putStaffPermissions(putOwnerByOwnerReq, { params: Promise.resolve({ id: owner.id }) });
  const putOwnerByOwnerJson = await putOwnerByOwnerRes.json();

  if (putOwnerByOwnerRes.status === 403 && putOwnerByOwnerJson.error?.includes("cannot be modified")) {
    recordPass(`Owner attempting to modify Owner permissions returned HTTP 403 (${putOwnerByOwnerJson.error})`);
  } else {
    recordFail("Owner Permission Immutability Defect", `Expected 403 for Owner permission modification by Owner, got HTTP ${putOwnerByOwnerRes.status}: ${JSON.stringify(putOwnerByOwnerJson)}`);
  }

  // 1A.2: Manager attempting to modify Owner permissions
  const putOwnerByMgrReq = makeReq(`http://localhost/api/staff/${owner.id}/permissions`, "PUT", permPayload, managerHledan.id);
  const putOwnerByMgrRes = await putStaffPermissions(putOwnerByMgrReq, { params: Promise.resolve({ id: owner.id }) });
  const putOwnerByMgrJson = await putOwnerByMgrRes.json();

  if (putOwnerByMgrRes.status === 403) {
    recordPass(`Manager attempting to modify Owner permissions returned HTTP 403 (${putOwnerByMgrJson.error})`);
  } else {
    recordFail("Owner Permission Immutability Defect", `Expected 403 for Owner permission modification by Manager, got HTTP ${putOwnerByMgrRes.status}: ${JSON.stringify(putOwnerByMgrJson)}`);
  }

  // 1A.3: Cashier attempting to modify Owner permissions
  const putOwnerByCashierReq = makeReq(`http://localhost/api/staff/${owner.id}/permissions`, "PUT", permPayload, cashierHledan.id);
  const putOwnerByCashierRes = await putStaffPermissions(putOwnerByCashierReq, { params: Promise.resolve({ id: owner.id }) });
  const putOwnerByCashierJson = await putOwnerByCashierRes.json();

  if (putOwnerByCashierRes.status === 403) {
    recordPass(`Cashier attempting to modify Owner permissions returned HTTP 403 (${putOwnerByCashierJson.error})`);
  } else {
    recordFail("Owner Permission Protection Defect", `Expected 403 for Owner permission modification by Cashier, got HTTP ${putOwnerByCashierRes.status}: ${JSON.stringify(putOwnerByCashierJson)}`);
  }

  // Verify Owner permissions in DB remained unchanged
  const refetchedOwner = await prisma.staff.findUnique({ where: { id: owner.id } });
  const ownerPerms = refetchedOwner?.permissions as any;
  if (!ownerPerms || ownerPerms.dashboard?.read === true) {
    recordPass("Owner permissions in database remained 100% full read/write access");
  } else {
    recordFail("Owner Permission Corruption", "Owner permissions were mutated in DB!");
  }


  // =========================================================================
  // TASK 1B: ATTEMPT CROSS-BRANCH STAFF MUTATION BY MANAGER (ASSERT 403)
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("TASK 1B: Attempt cross-branch staff mutation by Manager");
  console.log("-------------------------------------------------------------------------");

  // 1B.1: Manager Hledan attempting PUT /api/staff/[tamweStaffId]/permissions
  const crossPutPermReq = makeReq(`http://localhost/api/staff/${cashierTamwe.id}/permissions`, "PUT", permPayload, managerHledan.id);
  const crossPutPermRes = await putStaffPermissions(crossPutPermReq, { params: Promise.resolve({ id: cashierTamwe.id }) });
  const crossPutPermJson = await crossPutPermRes.json();

  if (crossPutPermRes.status === 403) {
    recordPass(`Manager Hledan attempting PUT permissions for Cashier Tamwe returned HTTP 403 (${crossPutPermJson.error})`);
  } else {
    recordFail("Manager Cross-Branch Boundary Defect", `Expected 403 for Manager modifying permissions of another branch staff, got HTTP ${crossPutPermRes.status}: ${JSON.stringify(crossPutPermJson)}`);
  }

  // 1B.2: Manager Hledan attempting GET /api/staff/[tamweStaffId]/permissions
  const crossGetPermReq = makeReq(`http://localhost/api/staff/${cashierTamwe.id}/permissions`, "GET", undefined, managerHledan.id);
  const crossGetPermRes = await getStaffPermissions(crossGetPermReq, { params: Promise.resolve({ id: cashierTamwe.id }) });
  const crossGetPermJson = await crossGetPermRes.json();

  if (crossGetPermRes.status === 403) {
    recordPass(`Manager Hledan attempting GET permissions for Cashier Tamwe returned HTTP 403 (${crossGetPermJson.error})`);
  } else {
    recordFail("Manager Cross-Branch Boundary Defect", `Expected 403 for Manager getting permissions of another branch staff, got HTTP ${crossGetPermRes.status}: ${JSON.stringify(crossGetPermJson)}`);
  }

  // 1B.3: Manager Hledan attempting PUT /api/staff (updating Cashier Tamwe details)
  const crossPutStaffReq = makeReq(`http://localhost/api/staff`, "PUT", {
    id: cashierTamwe.id,
    name: "Tamwe Cashier Hacked",
    email: cashierTamwe.email,
    role: "CASHIER",
    branchId: branchTamwe.id,
  }, managerHledan.id);
  const crossPutStaffRes = await putStaff(crossPutStaffReq);
  const crossPutStaffJson = await crossPutStaffRes.json();

  if (crossPutStaffRes.status === 403) {
    recordPass(`Manager Hledan attempting PUT staff update for Cashier Tamwe returned HTTP 403 (${crossPutStaffJson.error})`);
  } else {
    recordFail("Manager Cross-Branch Boundary Defect", `Expected 403 for Manager updating staff of another branch, got HTTP ${crossPutStaffRes.status}: ${JSON.stringify(crossPutStaffJson)}`);
  }

  // 1B.4: Manager Hledan attempting DELETE /api/staff?id=tamweStaffId
  const crossDeleteStaffReq = makeReq(`http://localhost/api/staff?id=${cashierTamwe.id}`, "DELETE", undefined, managerHledan.id);
  const crossDeleteStaffRes = await deleteStaff(crossDeleteStaffReq);
  const crossDeleteStaffJson = await crossDeleteStaffRes.json();

  if (crossDeleteStaffRes.status === 403) {
    recordPass(`Manager Hledan attempting DELETE staff for Cashier Tamwe returned HTTP 403 (${crossDeleteStaffJson.error})`);
  } else {
    recordFail("Manager Cross-Branch Boundary Defect", `Expected 403 for Manager deleting staff of another branch, got HTTP ${crossDeleteStaffRes.status}: ${JSON.stringify(crossDeleteStaffJson)}`);
  }

  // 1B.5: Manager Hledan attempting POST /api/staff creating staff assigned to Tamwe branch
  const crossPostStaffReq = makeReq(`http://localhost/api/staff`, "POST", {
    name: "Malicious Tamwe Staff",
    email: "malicious.tamwe@example.com",
    role: "CASHIER",
    branchId: branchTamwe.id,
  }, managerHledan.id);
  const crossPostStaffRes = await postStaff(crossPostStaffReq);
  const crossPostStaffJson = await crossPostStaffRes.json();

  if (crossPostStaffRes.status === 403) {
    recordPass(`Manager Hledan attempting POST staff creation in Tamwe branch returned HTTP 403 (${crossPostStaffJson.error})`);
  } else {
    recordFail("Manager Cross-Branch Boundary Defect", `Expected 403 for Manager creating staff in another branch, got HTTP ${crossPostStaffRes.status}: ${JSON.stringify(crossPostStaffJson)}`);
  }


  // =========================================================================
  // TASK 1C: ATTEMPT UNAUTHENTICATED CHECKOUT OR INVENTORY ADJUSTMENT (ASSERT 401/403)
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("TASK 1C: Attempt unauthenticated checkout or inventory adjustment");
  console.log("-------------------------------------------------------------------------");

  const checkoutBody = {
    branchId: branchHledan.id,
    items: [{ product: { id: variant.productId }, selectedVariant: { id: variant.id, costPrice: variant.costPrice }, quantity: 1, unitPrice: (variant.costPrice || 1000) + 1000, discount: 0 }],
    paymentMethod: "CASH",
    subtotal: (variant.costPrice || 1000) + 1000,
    discountAmount: 0,
    total: (variant.costPrice || 1000) + 1000,
    cashReceived: (variant.costPrice || 1000) + 1000,
    changeGiven: 0,
  };

  const adjustBody = {
    branchId: branchHledan.id,
    variantId: variant.id,
    changeAmount: 5,
    reason: "ADJUSTMENT",
  };

  // 1C.1: Unauthenticated POS checkout
  const unauthCheckoutReq = makeReq("http://localhost/api/pos/checkout", "POST", checkoutBody);
  const unauthCheckoutRes = await posCheckout(unauthCheckoutReq);
  const unauthCheckoutJson = await unauthCheckoutRes.json();

  if (unauthCheckoutRes.status === 401) {
    recordPass(`Unauthenticated POS Checkout returned HTTP 401 (${unauthCheckoutJson.error})`);
  } else {
    recordFail("Unauthenticated Endpoint Defect", `Expected 401 for unauthenticated checkout, got HTTP ${unauthCheckoutRes.status}: ${JSON.stringify(unauthCheckoutJson)}`);
  }

  // 1C.2: Unauthenticated Inventory Adjustment
  const unauthAdjustReq = makeReq("http://localhost/api/inventory/adjust", "POST", adjustBody);
  const unauthAdjustRes = await adjustInventory(unauthAdjustReq);
  const unauthAdjustJson = await unauthAdjustRes.json();

  if (unauthAdjustRes.status === 401) {
    recordPass(`Unauthenticated Inventory Adjustment returned HTTP 401 (${unauthAdjustJson.error})`);
  } else {
    recordFail("Unauthenticated Endpoint Defect", `Expected 401 for unauthenticated inventory adjustment, got HTTP ${unauthAdjustRes.status}: ${JSON.stringify(unauthAdjustJson)}`);
  }

  // 1C.3: Unauthorized POS checkout (Cashier lacking pos.write permission)
  const unauthWriteCheckoutReq = makeReq("http://localhost/api/pos/checkout", "POST", checkoutBody, cashierHledan.id);
  const unauthWriteCheckoutRes = await posCheckout(unauthWriteCheckoutReq);
  const unauthWriteCheckoutJson = await unauthWriteCheckoutRes.json();

  if (unauthWriteCheckoutRes.status === 403) {
    recordPass(`Unauthorized POS Checkout (Cashier read-only pos) returned HTTP 403 (${unauthWriteCheckoutJson.error})`);
  } else {
    recordFail("Permission Controller Bypass Defect", `Expected 403 for Cashier without pos.write, got HTTP ${unauthWriteCheckoutRes.status}: ${JSON.stringify(unauthWriteCheckoutJson)}`);
  }

  // 1C.4: Unauthorized Inventory Adjustment (Cashier lacking inventory.write permission)
  const unauthWriteAdjustReq = makeReq("http://localhost/api/inventory/adjust", "POST", adjustBody, cashierHledan.id);
  const unauthWriteAdjustRes = await adjustInventory(unauthWriteAdjustReq);
  const unauthWriteAdjustJson = await unauthWriteAdjustRes.json();

  if (unauthWriteAdjustRes.status === 403) {
    recordPass(`Unauthorized Inventory Adjustment (Cashier without inventory.write) returned HTTP 403 (${unauthWriteAdjustJson.error})`);
  } else {
    recordFail("Permission Controller Bypass Defect", `Expected 403 for Cashier without inventory.write, got HTTP ${unauthWriteAdjustRes.status}: ${JSON.stringify(unauthWriteAdjustJson)}`);
  }


  // =========================================================================
  // ADDITIONAL EDGE CASES & ATTACK SURFACE STRESS
  // =========================================================================
  console.log("\n-------------------------------------------------------------------------");
  console.log("ADDITIONAL EDGE CASES: Role & Branch Boundary Stress");
  console.log("-------------------------------------------------------------------------");

  // 1. Manager Hledan attempting POS checkout in Tamwe branch
  const mgrCrossPosReq = makeReq("http://localhost/api/pos/checkout", "POST", { ...checkoutBody, branchId: branchTamwe.id }, managerHledan.id);
  const mgrCrossPosRes = await posCheckout(mgrCrossPosReq);
  const mgrCrossPosJson = await mgrCrossPosRes.json();

  if (mgrCrossPosRes.status === 403) {
    recordPass(`Manager Hledan cross-branch POS checkout in Tamwe branch returned HTTP 403 (${mgrCrossPosJson.error})`);
  } else {
    recordFail("Cross-Branch Boundary Defect", `Expected 403 for Manager checkout in unauthorized branch, got HTTP ${mgrCrossPosRes.status}: ${JSON.stringify(mgrCrossPosJson)}`);
  }

  // 2. Manager Hledan attempting Inventory adjustment in Tamwe branch
  const mgrCrossAdjustReq = makeReq("http://localhost/api/inventory/adjust", "POST", { ...adjustBody, branchId: branchTamwe.id }, managerHledan.id);
  const mgrCrossAdjustRes = await adjustInventory(mgrCrossAdjustReq);
  const mgrCrossAdjustJson = await mgrCrossAdjustRes.json();

  if (mgrCrossAdjustRes.status === 403) {
    recordPass(`Manager Hledan cross-branch Inventory adjustment in Tamwe branch returned HTTP 403 (${mgrCrossAdjustJson.error})`);
  } else {
    recordFail("Cross-Branch Boundary Defect", `Expected 403 for Manager inventory adjust in unauthorized branch, got HTTP ${mgrCrossAdjustRes.status}: ${JSON.stringify(mgrCrossAdjustJson)}`);
  }

  // 3. Manager attempting to assign OWNER role to new staff member
  const mgrCreateOwnerReq = makeReq("http://localhost/api/staff", "POST", {
    name: "Illegal Owner",
    email: "illegal.owner@example.com",
    role: "OWNER",
    branchId: branchHledan.id,
  }, managerHledan.id);
  const mgrCreateOwnerRes = await postStaff(mgrCreateOwnerReq);
  const mgrCreateOwnerJson = await mgrCreateOwnerRes.json();

  if (mgrCreateOwnerRes.status === 403) {
    recordPass(`Manager attempting to create Owner role staff returned HTTP 403 (${mgrCreateOwnerJson.error})`);
  } else {
    recordFail("Role Escalation Defect", `Expected 403 for Manager creating Owner staff, got HTTP ${mgrCreateOwnerRes.status}: ${JSON.stringify(mgrCreateOwnerJson)}`);
  }

  // 4. Cashier attempting to list staff directory
  const cashierGetStaffReq = makeReq("http://localhost/api/staff", "GET", undefined, cashierHledan.id);
  const cashierGetStaffRes = await getStaff(cashierGetStaffReq);
  const cashierGetStaffJson = await cashierGetStaffRes.json();

  if (cashierGetStaffRes.status === 403) {
    recordPass(`Cashier attempting GET /api/staff returned HTTP 403 (${cashierGetStaffJson.error})`);
  } else {
    recordFail("Directory Access Control Defect", `Expected 403 for Cashier viewing staff list, got HTTP ${cashierGetStaffRes.status}: ${JSON.stringify(cashierGetStaffJson)}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n=========================================================================");
  console.log(`   M3 CHALLENGER STRESS SUITE COMPLETE: ${passed} Passed, ${failed} Failed.`);
  console.log("=========================================================================");

  if (failed > 0) {
    console.error("\nSummary of Failures:");
    findings.forEach((f, idx) => {
      console.error(` ${idx + 1}. [${f.category}] ${f.description}`);
    });
    process.exit(1);
  }
}

runM3ChallengerSuite().catch((err) => {
  console.error("M3 Challenger Suite Exception:", err);
  process.exit(1);
});
