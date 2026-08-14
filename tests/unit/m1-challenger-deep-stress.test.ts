import assert from "node:assert";
import {
  sanitizePermissions,
  getDefaultPermissionsForRole,
  hasModuleReadPermission,
  hasModuleWritePermission,
  getModuleKeyForPath,
  ALL_MODULE_KEYS,
  DEFAULT_OWNER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_CASHIER_PERMISSIONS,
} from "../../src/lib/permissions";
import { checkStaffPermission, AuthenticatedStaff } from "../../src/lib/auth-helper";

function runDeepChallengerTestSuite() {
  console.log("=========================================================================");
  console.log("   CHALLENGER 1 DEEP ADVERSARIAL STRESS TEST SUITE                       ");
  console.log("=========================================================================\n");

  let passed = 0;
  let failed = 0;
  const findings: string[] = [];

  function recordPass(msg: string) {
    passed++;
    console.log(`  ✅ PASS: ${msg}`);
  }

  function recordFail(description: string) {
    failed++;
    findings.push(description);
    console.error(`  ❌ FAIL: ${description}`);
  }

  // -------------------------------------------------------------------------
  // 1. MUTATION & CONTAMINATION ATTACKS
  // -------------------------------------------------------------------------
  console.log("--- 1. Mutation & State Contamination Tests ---");

  try {
    const ownerPerms1 = getDefaultPermissionsForRole("OWNER");
    // Attempt to mutate ownerPerms1
    ownerPerms1.dashboard.read = false;
    ownerPerms1.dashboard.write = false;

    const ownerPerms2 = getDefaultPermissionsForRole("OWNER");
    assert.strictEqual(
      ownerPerms2.dashboard.read,
      true,
      "Mutating object returned by getDefaultPermissionsForRole('OWNER') must not contaminate default state!"
    );
    recordPass("getDefaultPermissionsForRole('OWNER') is isolated from external mutation contamination");
  } catch (err: any) {
    recordFail(`Owner mutation contamination test failed: ${err.message}`);
  }

  try {
    const sanitizedOwner1 = sanitizePermissions(null, "OWNER");
    sanitizedOwner1.inventory.read = false;

    const sanitizedOwner2 = sanitizePermissions(null, "OWNER");
    assert.strictEqual(
      sanitizedOwner2.inventory.read,
      true,
      "Mutating result of sanitizePermissions(null, 'OWNER') must not contaminate default state!"
    );
    recordPass("sanitizePermissions('OWNER') is isolated from external mutation contamination");
  } catch (err: any) {
    recordFail(`Sanitize permissions owner mutation test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 2. WEIRD / NON-PLAIN-OBJECT MODULE INPUT ATTACKS
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Weird / Non-Plain-Object Module Input Tests ---");

  try {
    // Array as module value: { pos: [1, 2, 3] }
    const arrayModInput = { pos: [1, 2, 3] };
    const resArray = sanitizePermissions(arrayModInput, "CASHIER");
    // Array should not override cashier default for pos
    assert.strictEqual(resArray.pos.read, true, "Array input for pos should fall back to default read: true");
    assert.strictEqual(resArray.pos.write, true, "Array input for pos should fall back to default write: true");
    recordPass("sanitizePermissions safely rejects Array as module object and falls back to role default");
  } catch (err: any) {
    recordFail(`Array module input test failed: ${err.message}`);
  }

  try {
    // Primitive string/number as module value
    const primitiveModInput = { pos: "string_val", inventory: 12345, reports: true };
    const resPrimitive = sanitizePermissions(primitiveModInput, "CASHIER");
    assert.strictEqual(resPrimitive.pos.read, true, "Primitive input for pos should fall back to default cashier read: true");
    assert.strictEqual(resPrimitive.inventory.read, false, "Primitive input for inventory should fall back to cashier default read: false");
    recordPass("sanitizePermissions safely ignores non-object module values (string, number, boolean)");
  } catch (err: any) {
    recordFail(`Primitive module input test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 3. INTERLOCKING CONSTRAINT ALL 9 MODULES
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Interlocking Constraint Across All 9 Modules ---");

  try {
    const inputAllWriteNoRead: Record<string, any> = {};
    ALL_MODULE_KEYS.forEach((mod) => {
      inputAllWriteNoRead[mod] = { read: false, write: true };
    });

    const resInterlock = sanitizePermissions(inputAllWriteNoRead, "CASHIER");
    ALL_MODULE_KEYS.forEach((mod) => {
      assert.strictEqual(resInterlock[mod].write, true, `${mod} write should be true`);
      assert.strictEqual(
        resInterlock[mod].read,
        true,
        `Interlocking failure: ${mod} write:true must force read:true!`
      );
    });
    recordPass("Interlocking constraint verified for all 9 modules (write: true forces read: true)");
  } catch (err: any) {
    recordFail(`Interlocking constraint test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 4. ROUTE RESOLUTION EXHAUSTIVE MATRIX
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Exhaustive Route Matching Tests ---");

  const routeMap: Record<string, string | null> = {
    "/dashboard": "dashboard",
    "/dashboard/analytics": "dashboard",
    "/dashboard?tab=overview": "dashboard",
    "/pos": "pos",
    "/pos/checkout": "pos",
    "/inventory": "inventory",
    "/inventory/products": "inventory",
    "/inventory/items/123": "inventory",
    "/sales-orders": "salesOrders",
    "/sales-orders/create": "salesOrders",
    "/customers": "salesOrders",
    "/customers/456/edit": "salesOrders",
    "/purchases": "purchases",
    "/purchases/new": "purchases",
    "/purchase-orders": "purchases",
    "/purchase-orders/detail": "purchases",
    "/suppliers": "purchases",
    "/suppliers/789": "purchases",
    "/expenses": "expenses",
    "/expenses/log": "expenses",
    "/staff": "staff",
    "/staff/permissions": "staff",
    "/reports": "reports",
    "/reports/export": "reports",
    "/setup": "setup",
    "/setup/branches": "setup",
    "/settings": "setup",
    "/branches": "setup",
    "/access-denied": null,
    "/sign-in": null,
    "/api/auth/me": null,
    "/": null,
  };

  try {
    Object.entries(routeMap).forEach(([path, expectedModule]) => {
      const resolved = getModuleKeyForPath(path);
      assert.strictEqual(
        resolved,
        expectedModule,
        `Path '${path}' should map to '${expectedModule}', got '${resolved}'`
      );
    });
    recordPass("getModuleKeyForPath correctly maps all 32 tested route variations");
  } catch (err: any) {
    recordFail(`Route resolution test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 5. SERVER AUTHORIZATION CHECK (checkStaffPermission) HTTP RESPONSES
  // -------------------------------------------------------------------------
  console.log("\n--- 5. checkStaffPermission HTTP Response Inspection ---");

  const mockBranch1 = { id: "branch-1", name: "Branch 1", address: "YGN", receiptHeader: null, createdAt: new Date(), updatedAt: new Date() };

  const cashierStaff: AuthenticatedStaff = {
    id: "cashier-1",
    name: "Cashier 1",
    email: "cashier@test.com",
    role: "CASHIER",
    branchId: "branch-1",
    pin: "1234",
    passwordHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: mockBranch1,
    permissions: DEFAULT_CASHIER_PERMISSIONS,
  };

  try {
    const res = checkStaffPermission(cashierStaff, "staff", "read", "branch-1");
    assert.strictEqual(res.allowed, false);
    assert.notStrictEqual(res.errorResponse, null);
    assert.strictEqual(res.errorResponse!.status, 403);
    recordPass("checkStaffPermission returns status 403 when permission denied");
  } catch (err: any) {
    recordFail(`checkStaffPermission HTTP response inspection failed: ${err.message}`);
  }

  try {
    const crossBranchRes = checkStaffPermission(cashierStaff, "pos", "read", "branch-2");
    assert.strictEqual(crossBranchRes.allowed, false);
    assert.strictEqual(crossBranchRes.errorResponse!.status, 403);
    recordPass("checkStaffPermission returns status 403 when branch boundary violated");
  } catch (err: any) {
    recordFail(`Cross-branch response inspection failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=========================================================================");
  console.log(`   DEEP ADVERSARIAL STRESS TEST COMPLETE: ${passed} Passed, ${failed} Failed.`);
  console.log("=========================================================================");

  if (failed > 0) {
    console.error("Failures detected:");
    findings.forEach((f, idx) => console.error(` ${idx + 1}. ${f}`));
    process.exit(1);
  }
}

runDeepChallengerTestSuite();
