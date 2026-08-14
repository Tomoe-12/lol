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
  StaffPermissions,
} from "../../src/lib/permissions";

import { checkStaffPermission, AuthenticatedStaff } from "../../src/lib/auth-helper";

function runM1StressTestSuite() {
  console.log("=========================================================================");
  console.log("   M1 CORE PERMISSIONS & HELPERS EMPIRICAL STRESS TEST SUITE            ");
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
  // 1. DEFAULT PERMISSIONS TESTS
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing getDefaultPermissionsForRole ---");

  try {
    const ownerDefaults = getDefaultPermissionsForRole("OWNER");
    assert.strictEqual(Object.keys(ownerDefaults).length, ALL_MODULE_KEYS.length);
    ALL_MODULE_KEYS.forEach((mod) => {
      assert.strictEqual(ownerDefaults[mod].read, true, `Owner ${mod} read should be true`);
      assert.strictEqual(ownerDefaults[mod].write, true, `Owner ${mod} write should be true`);
    });
    recordPass(`getDefaultPermissionsForRole('OWNER') gives full read/write for all ${ALL_MODULE_KEYS.length} modules`);
  } catch (err: any) {
    recordFail(`getDefaultPermissionsForRole OWNER failed: ${err.message}`);
  }

  try {
    const managerDefaults = getDefaultPermissionsForRole("MANAGER");
    assert.strictEqual(Object.keys(managerDefaults).length, ALL_MODULE_KEYS.length);
    ALL_MODULE_KEYS.forEach((mod) => {
      assert.strictEqual(managerDefaults[mod].read, true, `Manager ${mod} read should be true`);
      assert.strictEqual(managerDefaults[mod].write, true, `Manager ${mod} write should be true`);
    });
    recordPass(`getDefaultPermissionsForRole('MANAGER') gives full read/write for all ${ALL_MODULE_KEYS.length} modules`);
  } catch (err: any) {
    recordFail(`getDefaultPermissionsForRole MANAGER failed: ${err.message}`);
  }

  try {
    const cashierDefaults = getDefaultPermissionsForRole("CASHIER");
    assert.strictEqual(Object.keys(cashierDefaults).length, ALL_MODULE_KEYS.length);
    assert.strictEqual(cashierDefaults.pos.read, true, "Cashier pos read should be true");
    assert.strictEqual(cashierDefaults.pos.write, true, "Cashier pos write should be true");
    assert.strictEqual(cashierDefaults.outstanding.read, true, "Cashier outstanding read should be true");
    assert.strictEqual(cashierDefaults.outstanding.write, true, "Cashier outstanding write should be true");
    assert.strictEqual(cashierDefaults.delivery.read, true, "Cashier delivery read should be true");
    assert.strictEqual(cashierDefaults.delivery.write, true, "Cashier delivery write should be true");
    ALL_MODULE_KEYS.filter((m) => !["pos", "outstanding", "delivery"].includes(m)).forEach((mod) => {
      assert.strictEqual(cashierDefaults[mod].read, false, `Cashier ${mod} read should be false`);
      assert.strictEqual(cashierDefaults[mod].write, false, `Cashier ${mod} write should be false`);
    });
    recordPass("getDefaultPermissionsForRole('CASHIER') grants POS/outstanding/delivery read/write, 8 others blocked");
  } catch (err: any) {
    recordFail(`getDefaultPermissionsForRole CASHIER failed: ${err.message}`);
  }

  try {
    const nullDefaults = getDefaultPermissionsForRole(null);
    const undefinedDefaults = getDefaultPermissionsForRole(undefined);
    const unknownDefaults = getDefaultPermissionsForRole("SUPERADMIN" as any);
    assert.deepStrictEqual(nullDefaults, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(undefinedDefaults, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(unknownDefaults, DEFAULT_CASHIER_PERMISSIONS);
    recordPass("getDefaultPermissionsForRole fallback for null/undefined/unknown role defaults to CASHIER");
  } catch (err: any) {
    recordFail(`getDefaultPermissionsForRole null/unknown fallback failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 2. SANITIZE PERMISSIONS STRESS TESTS
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Stress-Testing sanitizePermissions ---");

  // 2.1 Owner Demotion Prevention Invariant
  try {
    const demotedOwnerInput = {
      dashboard: { read: false, write: false },
      pos: { read: false, write: false },
      inventory: { read: false, write: false },
      salesOrders: { read: false, write: false },
      purchases: { read: false, write: false },
      expenses: { read: false, write: false },
      staff: { read: false, write: false },
      reports: { read: false, write: false },
      setup: { read: false, write: false },
    };
    const sanitizedOwner = sanitizePermissions(demotedOwnerInput, "OWNER");
    ALL_MODULE_KEYS.forEach((mod) => {
      assert.strictEqual(sanitizedOwner[mod].read, true, `Owner ${mod} read cannot be demoted`);
      assert.strictEqual(sanitizedOwner[mod].write, true, `Owner ${mod} write cannot be demoted`);
    });
    recordPass("sanitizePermissions OWNER demotion attempt blocked: always returns 100% read/write");
  } catch (err: any) {
    recordFail(`Owner demotion prevention test failed: ${err.message}`);
  }

  // 2.2 Null and Undefined inputs
  try {
    const nullPermsManager = sanitizePermissions(null, "MANAGER");
    const nullPermsCashier = sanitizePermissions(null, "CASHIER");
    const undefinedPermsManager = sanitizePermissions(undefined, "MANAGER");
    assert.deepStrictEqual(nullPermsManager, DEFAULT_MANAGER_PERMISSIONS);
    assert.deepStrictEqual(nullPermsCashier, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(undefinedPermsManager, DEFAULT_MANAGER_PERMISSIONS);
    recordPass("sanitizePermissions handles null and undefined inputs seamlessly with role defaults");
  } catch (err: any) {
    recordFail(`Null/undefined input test failed: ${err.message}`);
  }

  // 2.3 Malformed JSON string inputs
  try {
    const badJson1 = sanitizePermissions("{ invalid json }", "CASHIER");
    const badJson2 = sanitizePermissions("12345", "MANAGER");
    const badJson3 = sanitizePermissions('"just a string"', "CASHIER");
    const badJson4 = sanitizePermissions("true", "CASHIER");
    const badJson5 = sanitizePermissions("null", "MANAGER");
    const badJson6 = sanitizePermissions("[]", "CASHIER");

    assert.deepStrictEqual(badJson1, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(badJson2, DEFAULT_MANAGER_PERMISSIONS);
    assert.deepStrictEqual(badJson3, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(badJson4, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(badJson5, DEFAULT_MANAGER_PERMISSIONS);
    assert.deepStrictEqual(badJson6, DEFAULT_CASHIER_PERMISSIONS);
    recordPass("sanitizePermissions handles all malformed JSON strings without crashing, falling back to role defaults");
  } catch (err: any) {
    recordFail(`Malformed JSON string test failed: ${err.message}`);
  }

  // 2.4 Valid JSON string parsing
  try {
    const validJsonStr = JSON.stringify({
      pos: { read: true, write: true },
      reports: { read: true, write: false },
    });
    const parsedPerms = sanitizePermissions(validJsonStr, "CASHIER");
    assert.strictEqual(parsedPerms.pos.read, true);
    assert.strictEqual(parsedPerms.pos.write, true);
    assert.strictEqual(parsedPerms.reports.read, true);
    assert.strictEqual(parsedPerms.reports.write, false);
    assert.strictEqual(parsedPerms.inventory.read, false); // Default for cashier
    recordPass("sanitizePermissions correctly parses valid JSON strings");
  } catch (err: any) {
    recordFail(`Valid JSON string parsing test failed: ${err.message}`);
  }

  // 2.5 Non-object primitive / array inputs
  try {
    const numberPerms = sanitizePermissions(12345, "CASHIER");
    const arrayPerms = sanitizePermissions([1, 2, 3], "MANAGER");
    const boolPerms = sanitizePermissions(true, "CASHIER");

    assert.deepStrictEqual(numberPerms, DEFAULT_CASHIER_PERMISSIONS);
    assert.deepStrictEqual(arrayPerms, DEFAULT_MANAGER_PERMISSIONS);
    assert.deepStrictEqual(boolPerms, DEFAULT_CASHIER_PERMISSIONS);
    recordPass("sanitizePermissions handles primitive numbers, arrays, and booleans safely");
  } catch (err: any) {
    recordFail(`Primitive inputs test failed: ${err.message}`);
  }

  // 2.6 Interlocking Constraint: write: true forces read: true
  try {
    const writeWithoutReadInput = {
      pos: { read: false, write: true },
      expenses: { read: false, write: true },
    };
    const sanitized = sanitizePermissions(writeWithoutReadInput, "CASHIER");
    assert.strictEqual(sanitized.pos.write, true);
    assert.strictEqual(sanitized.pos.read, true, "write: true must force read: true for pos");
    assert.strictEqual(sanitized.expenses.write, true);
    assert.strictEqual(sanitized.expenses.read, true, "write: true must force read: true for expenses");
    recordPass("sanitizePermissions enforces interlocking constraint (write: true forces read: true)");
  } catch (err: any) {
    recordFail(`Interlocking constraint test failed: ${err.message}`);
  }

  // 2.7 Partial Module Map & Missing Keys
  try {
    const partialInput = {
      pos: { read: true, write: false },
    };
    const sanitizedManager = sanitizePermissions(partialInput, "MANAGER");
    assert.strictEqual(sanitizedManager.pos.read, true);
    assert.strictEqual(sanitizedManager.pos.write, false);
    // Other 8 modules should fall back to MANAGER defaults (read: true, write: true)
    assert.strictEqual(sanitizedManager.inventory.read, true);
    assert.strictEqual(sanitizedManager.inventory.write, true);

    const sanitizedCashier = sanitizePermissions(partialInput, "CASHIER");
    assert.strictEqual(sanitizedCashier.pos.read, true);
    assert.strictEqual(sanitizedCashier.pos.write, false);
    // Other 8 modules should fall back to CASHIER defaults (read: false, write: false)
    assert.strictEqual(sanitizedCashier.inventory.read, false);
    assert.strictEqual(sanitizedCashier.inventory.write, false);
    recordPass("sanitizePermissions correctly merges partial module maps with role defaults for missing keys");
  } catch (err: any) {
    recordFail(`Partial module map test failed: ${err.message}`);
  }

  // 2.8 Non-boolean truthy/falsy field values inside module objects
  try {
    const truthyInput = {
      pos: { read: 1, write: 0 },
      inventory: { read: "yes", write: "" },
    };
    const sanitized = sanitizePermissions(truthyInput, "CASHIER");
    assert.strictEqual(sanitized.pos.read, true);
    assert.strictEqual(sanitized.pos.write, false);
    assert.strictEqual(sanitized.inventory.read, true);
    assert.strictEqual(sanitized.inventory.write, false);
    recordPass("sanitizePermissions safely casts truthy/falsy non-boolean values to booleans");
  } catch (err: any) {
    recordFail(`Truthy/falsy field values test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 3. STRESS-TEST checkStaffPermission (SERVER-SIDE AUTHORIZATION GUARD)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Stress-Testing checkStaffPermission ---");

  const mockBranch1 = { id: "branch-1", name: "Hledan Branch", address: "Yangon", receiptHeader: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const mockBranch2 = { id: "branch-2", name: "Tamwe Branch", address: "Yangon", receiptHeader: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };

  const ownerStaff: AuthenticatedStaff = {
    id: "staff-owner-1",
    name: "Owner User",
    email: "owner@test.com",
    role: "OWNER",
    branchId: "branch-1",
    pin: "1234",
    passwordHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: mockBranch1,
    permissions: DEFAULT_OWNER_PERMISSIONS,
  };

  const manager1Staff: AuthenticatedStaff = {
    id: "staff-mgr-1",
    name: "Manager Branch 1",
    email: "mgr1@test.com",
    role: "MANAGER",
    branchId: "branch-1",
    pin: "1234",
    passwordHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: mockBranch1,
    permissions: DEFAULT_MANAGER_PERMISSIONS,
  };

  const cashier1Staff: AuthenticatedStaff = {
    id: "staff-cashier-1",
    name: "Cashier Branch 1",
    email: "cashier1@test.com",
    role: "CASHIER",
    branchId: "branch-1",
    pin: "1234",
    passwordHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: mockBranch1,
    permissions: DEFAULT_CASHIER_PERMISSIONS,
  };

  // 3.1 OWNER Bypass Tests
  try {
    const resSameBranch = checkStaffPermission(ownerStaff, "dashboard", "read", "branch-1");
    const resDiffBranch = checkStaffPermission(ownerStaff, "staff", "write", "branch-2");
    const resNoBranch = checkStaffPermission(ownerStaff, "reports", "read");

    assert.strictEqual(resSameBranch.allowed, true);
    assert.strictEqual(resDiffBranch.allowed, true);
    assert.strictEqual(resNoBranch.allowed, true);
    recordPass("checkStaffPermission OWNER bypass works across all branches, modules, and actions");
  } catch (err: any) {
    recordFail(`OWNER bypass test failed: ${err.message}`);
  }

  // 3.2 Cross-Branch Manager Boundary Checks
  try {
    const resSameBranch = checkStaffPermission(manager1Staff, "inventory", "write", "branch-1");
    const resCrossBranch = checkStaffPermission(manager1Staff, "inventory", "write", "branch-2");

    assert.strictEqual(resSameBranch.allowed, true);
    assert.strictEqual(resCrossBranch.allowed, false);
    assert.strictEqual(resCrossBranch.errorResponse?.status, 403);
    recordPass("checkStaffPermission blocks MANAGER cross-branch operation with HTTP 403 Forbidden");
  } catch (err: any) {
    recordFail(`Manager cross-branch check failed: ${err.message}`);
  }

  // 3.3 Cashier Module Permissions
  try {
    const posRead = checkStaffPermission(cashier1Staff, "pos", "read", "branch-1");
    const posWrite = checkStaffPermission(cashier1Staff, "pos", "write", "branch-1");
    const reportsRead = checkStaffPermission(cashier1Staff, "reports", "read", "branch-1");
    const staffWrite = checkStaffPermission(cashier1Staff, "staff", "write", "branch-1");

    assert.strictEqual(posRead.allowed, true);
    assert.strictEqual(posWrite.allowed, true);
    assert.strictEqual(reportsRead.allowed, false);
    assert.strictEqual(reportsRead.errorResponse?.status, 403);
    assert.strictEqual(staffWrite.allowed, false);
    assert.strictEqual(staffWrite.errorResponse?.status, 403);
    recordPass("checkStaffPermission permits Cashier POS access but blocks reports and staff write with 403");
  } catch (err: any) {
    recordFail(`Cashier module permission check failed: ${err.message}`);
  }

  // 3.4 Custom / Restricted Manager Permissions Check
  try {
    const restrictedManagerPerms: StaffPermissions = {
      ...DEFAULT_MANAGER_PERMISSIONS,
      reports: { read: false, write: false },
      staff: { read: true, write: false },
    };
    const restrictedManager: AuthenticatedStaff = {
      ...manager1Staff,
      permissions: restrictedManagerPerms,
    };

    const reportsRes = checkStaffPermission(restrictedManager, "reports", "read", "branch-1");
    const staffWriteRes = checkStaffPermission(restrictedManager, "staff", "write", "branch-1");
    const staffReadRes = checkStaffPermission(restrictedManager, "staff", "read", "branch-1");

    assert.strictEqual(reportsRes.allowed, false);
    assert.strictEqual(staffWriteRes.allowed, false);
    assert.strictEqual(staffReadRes.allowed, true);
    recordPass("checkStaffPermission respects customized permissions for MANAGER role");
  } catch (err: any) {
    recordFail(`Customized manager permissions check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 4. TESTING hasModuleReadPermission & hasModuleWritePermission
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing Client Navigation Helpers ---");

  try {
    assert.strictEqual(hasModuleReadPermission(null, "pos"), false);
    assert.strictEqual(hasModuleReadPermission(undefined, "pos"), false);
    assert.strictEqual(hasModuleWritePermission(null, "pos"), false);

    assert.strictEqual(hasModuleReadPermission({ role: "OWNER" }, "reports"), true);
    assert.strictEqual(hasModuleWritePermission({ role: "OWNER" }, "setup"), true);

    const cashierUser = { role: "CASHIER", permissions: DEFAULT_CASHIER_PERMISSIONS };
    assert.strictEqual(hasModuleReadPermission(cashierUser, "pos"), true);
    assert.strictEqual(hasModuleReadPermission(cashierUser, "reports"), false);
    assert.strictEqual(hasModuleWritePermission(cashierUser, "inventory"), false);

    recordPass("hasModuleReadPermission & hasModuleWritePermission evaluate null, OWNER, and Cashier correctly");
  } catch (err: any) {
    recordFail(`Client navigation helpers test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 5. TESTING getModuleKeyForPath
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Testing getModuleKeyForPath Route Resolution ---");

  try {
    assert.strictEqual(getModuleKeyForPath("/dashboard"), "dashboard");
    assert.strictEqual(getModuleKeyForPath("/pos"), "pos");
    assert.strictEqual(getModuleKeyForPath("/inventory"), "inventory");
    assert.strictEqual(getModuleKeyForPath("/sales-orders"), "salesOrders");
    assert.strictEqual(getModuleKeyForPath("/customers"), "salesOrders");
    assert.strictEqual(getModuleKeyForPath("/purchases"), "purchases");
    assert.strictEqual(getModuleKeyForPath("/purchase-orders"), "purchases");
    assert.strictEqual(getModuleKeyForPath("/suppliers"), "purchases");
    assert.strictEqual(getModuleKeyForPath("/expenses"), "expenses");
    assert.strictEqual(getModuleKeyForPath("/staff"), "staff");
    assert.strictEqual(getModuleKeyForPath("/reports"), "reports");
    assert.strictEqual(getModuleKeyForPath("/setup"), "setup");
    assert.strictEqual(getModuleKeyForPath("/settings"), "setup");
    assert.strictEqual(getModuleKeyForPath("/branches"), "setup");
    assert.strictEqual(getModuleKeyForPath("/unknown-page"), null);

    recordPass("getModuleKeyForPath maps all 14 application routes to 9 module keys accurately");
  } catch (err: any) {
    recordFail(`getModuleKeyForPath test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=========================================================================");
  console.log(`   M1 STRESS TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed.`);
  console.log("=========================================================================");

  if (failed > 0) {
    console.error("Failures detected:");
    findings.forEach((f, idx) => console.error(` ${idx + 1}. ${f}`));
    process.exit(1);
  }
}

runM1StressTestSuite();
