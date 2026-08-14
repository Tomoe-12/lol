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

async function verifyM1() {
  console.log("=== INDEPENDENT FORENSIC VERIFICATION FOR MILESTONE M1 ===");

  // 1. Check Default Roles
  const ownerPerms = getDefaultPermissionsForRole("OWNER");
  assert.strictEqual(ownerPerms.dashboard.read, true);
  assert.strictEqual(ownerPerms.setup.write, true);

  const mgrPerms = getDefaultPermissionsForRole("MANAGER");
  assert.strictEqual(mgrPerms.pos.read, true);
  assert.strictEqual(mgrPerms.staff.write, true);

  const cashierPerms = getDefaultPermissionsForRole("CASHIER");
  assert.strictEqual(cashierPerms.pos.read, true);
  assert.strictEqual(cashierPerms.pos.write, true);
  assert.strictEqual(cashierPerms.reports.read, false);
  assert.strictEqual(cashierPerms.staff.write, false);

  // 2. Sanitization & Interlocking Constraint
  const sanitizedWriteOnly = sanitizePermissions({ pos: { read: false, write: true } }, "CASHIER");
  assert.strictEqual(sanitizedWriteOnly.pos.write, true);
  assert.strictEqual(sanitizedWriteOnly.pos.read, true, "Write MUST force read");

  // 3. Stringified JSON parsing
  const strJson = JSON.stringify({ reports: { read: true, write: false } });
  const sanitizedStr = sanitizePermissions(strJson, "CASHIER");
  assert.strictEqual(sanitizedStr.reports.read, true);
  assert.strictEqual(sanitizedStr.reports.write, false);

  // 4. Owner demotion protection
  const demoteAttempt = sanitizePermissions({ dashboard: { read: false, write: false } }, "OWNER");
  assert.strictEqual(demoteAttempt.dashboard.read, true);
  assert.strictEqual(demoteAttempt.dashboard.write, true);

  // 5. Server Permission Guard & Branch Isolation
  const branchA = { id: "branch-a", name: "Branch A", address: "A", receiptHeader: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const branchB = { id: "branch-b", name: "Branch B", address: "B", receiptHeader: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };

  const mgrStaff: AuthenticatedStaff = {
    id: "m1",
    name: "Manager A",
    email: "m1@test.com",
    role: "MANAGER",
    branchId: "branch-a",
    pin: "1234",
    password: "pass",
    clerkId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    branch: branchA,
    permissions: DEFAULT_MANAGER_PERMISSIONS,
  };

  const sameBranchCheck = checkStaffPermission(mgrStaff, "inventory", "write", "branch-a");
  assert.strictEqual(sameBranchCheck.allowed, true);

  const crossBranchCheck = checkStaffPermission(mgrStaff, "inventory", "write", "branch-b");
  assert.strictEqual(crossBranchCheck.allowed, false);
  assert.strictEqual(crossBranchCheck.errorResponse?.status, 403);

  // 6. Path Resolver
  assert.strictEqual(getModuleKeyForPath("/dashboard"), "dashboard");
  assert.strictEqual(getModuleKeyForPath("/pos"), "pos");
  assert.strictEqual(getModuleKeyForPath("/inventory"), "inventory");
  assert.strictEqual(getModuleKeyForPath("/sales-orders"), "salesOrders");
  assert.strictEqual(getModuleKeyForPath("/purchases"), "purchases");
  assert.strictEqual(getModuleKeyForPath("/expenses"), "expenses");
  assert.strictEqual(getModuleKeyForPath("/staff"), "staff");
  assert.strictEqual(getModuleKeyForPath("/reports"), "reports");
  assert.strictEqual(getModuleKeyForPath("/setup"), "setup");

  console.log("=== ALL INDEPENDENT VERIFICATION CHECKS PASSED PERFECTLY ===");
}

verifyM1().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
