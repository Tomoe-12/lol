import assert from "node:assert";
import {
  sanitizePermissions,
  getDefaultPermissionsForRole,
  hasModuleReadPermission,
  hasModuleWritePermission,
  getModuleKeyForPath,
  ALL_MODULE_KEYS,
  MODULE_LABELS,
  DEFAULT_OWNER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_CASHIER_PERMISSIONS,
  StaffPermissions,
  ModuleKey,
  UserLike,
} from "../../src/lib/permissions";

// Re-create navItems structure from src/components/sidebar.tsx for empirical testing
interface NavItem {
  titleEn: string;
  titleMy: string;
  href: string;
  roles: string[];
  moduleKey?: ModuleKey;
}

const navItems: NavItem[] = [
  { titleEn: "Dashboard", titleMy: "ဒက်ရှ်ဘုတ်", href: "/dashboard", roles: ["OWNER", "MANAGER"], moduleKey: "dashboard" },
  { titleEn: "Sales Voucher", titleMy: "အရောင်း ဘောက်ချာ", href: "/pos", roles: ["OWNER", "MANAGER", "CASHIER"], moduleKey: "pos" },
  { titleEn: "Stock Status", titleMy: "စတော့ အခြေအနေ", href: "/inventory", roles: ["OWNER", "MANAGER"], moduleKey: "inventory" },
  { titleEn: "Setup", titleMy: "ဆက်တင်", href: "/setup", roles: ["OWNER", "MANAGER"], moduleKey: "setup" },
  { titleEn: "Branches", titleMy: "ဆိုင်ခွဲများ", href: "/branches", roles: ["OWNER"], moduleKey: "setup" },
  { titleEn: "Suppliers", titleMy: "ပေးသွင်းသူများ", href: "/suppliers", roles: ["OWNER", "MANAGER"], moduleKey: "purchases" },
  { titleEn: "Customers", titleMy: "ဝယ်သူများ", href: "/customers", roles: ["OWNER", "MANAGER"], moduleKey: "salesOrders" },
  { titleEn: "Sales Orders", titleMy: "အရောင်း အမှာစာများ", href: "/sales-orders", roles: ["OWNER", "MANAGER"], moduleKey: "salesOrders" },
  { titleEn: "Purchases", titleMy: "အဝယ်များ", href: "/purchases", roles: ["OWNER", "MANAGER"], moduleKey: "purchases" },
  { titleEn: "Purchase Orders", titleMy: "အဝယ် အမှာစာများ", href: "/purchase-orders", roles: ["OWNER", "MANAGER"], moduleKey: "purchases" },
  { titleEn: "Expenses", titleMy: "စရိတ်များ", href: "/expenses", roles: ["OWNER", "MANAGER"], moduleKey: "expenses" },
  { titleEn: "Staff", titleMy: "ဝန်ထမ်းများ", href: "/staff", roles: ["OWNER", "MANAGER"], moduleKey: "staff" },
  { titleEn: "Reports", titleMy: "အစီရင်ခံစာများ", href: "/reports", roles: ["OWNER", "MANAGER"], moduleKey: "reports" },
  { titleEn: "Settings", titleMy: "ဆက်တင်များ", href: "/settings", roles: ["OWNER", "MANAGER"], moduleKey: "setup" },
];

function runM2ChallengerTestSuite() {
  console.log("=========================================================================");
  console.log("   M2 CHALLENGER EMPIRICAL VERIFICATION & STRESS TEST SUITE            ");
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
  // 1. DYNAMIC SIDEBAR FILTERING EMPIRICAL TESTS
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Dynamic Sidebar Item Filtering ---");

  function filterNavItems(user: UserLike | null | undefined, userRole: string) {
    return navItems.filter((item) => {
      if (item.moduleKey) {
        return hasModuleReadPermission(user, item.moduleKey);
      }
      return item.roles.includes(userRole);
    });
  }

  try {
    // 1.1 CASHIER default user
    const cashierUser: UserLike = { role: "CASHIER", permissions: DEFAULT_CASHIER_PERMISSIONS };
    const cashierFiltered = filterNavItems(cashierUser, "CASHIER");
    assert.strictEqual(cashierFiltered.length, 1, "Cashier should only see POS nav item");
    assert.strictEqual(cashierFiltered[0].href, "/pos", "Cashier item should be /pos");
    recordPass("CASHIER user correctly sees ONLY POS tab in sidebar");
  } catch (err: any) {
    recordFail(`Cashier sidebar filtering failed: ${err.message}`);
  }

  try {
    // 1.2 OWNER user
    const ownerUser: UserLike = { role: "OWNER", permissions: DEFAULT_OWNER_PERMISSIONS };
    const ownerFiltered = filterNavItems(ownerUser, "OWNER");
    assert.strictEqual(ownerFiltered.length, 14, "Owner should see all 14 nav items");
    recordPass("OWNER user sees all 14 sidebar navigation tabs");
  } catch (err: any) {
    recordFail(`Owner sidebar filtering failed: ${err.message}`);
  }

  try {
    // 1.3 MANAGER user with restricted permissions
    const restrictedManagerPerms: StaffPermissions = {
      ...DEFAULT_MANAGER_PERMISSIONS,
      inventory: { read: false, write: false },
      reports: { read: false, write: false },
      setup: { read: false, write: false },
    };
    const managerUser: UserLike = { role: "MANAGER", permissions: restrictedManagerPerms };
    const managerFiltered = filterNavItems(managerUser, "MANAGER");
    
    // Hidden: inventory (/inventory), setup (/setup, /branches, /settings), reports (/reports) -> 5 items hidden
    // Remaining: 14 - 5 = 9 items
    assert.strictEqual(managerFiltered.length, 9, "Restricted manager should have 9 nav items visible");
    const hrefs = managerFiltered.map((i) => i.href);
    assert.ok(!hrefs.includes("/inventory"), "/inventory must be hidden");
    assert.ok(!hrefs.includes("/reports"), "/reports must be hidden");
    assert.ok(!hrefs.includes("/setup"), "/setup must be hidden");
    assert.ok(!hrefs.includes("/branches"), "/branches must be hidden");
    assert.ok(!hrefs.includes("/settings"), "/settings must be hidden");
    assert.ok(hrefs.includes("/dashboard"), "/dashboard must be visible");
    assert.ok(hrefs.includes("/pos"), "/pos must be visible");
    assert.ok(hrefs.includes("/staff"), "/staff must be visible");
    recordPass("MANAGER user with restricted read permissions correctly filters out restricted sidebar items");
  } catch (err: any) {
    recordFail(`Restricted manager sidebar filtering failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 2. CLIENT-SIDE ROUTE GUARD & REDIRECT LOGIC EMPIRICAL TESTS
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing Client-Side Route Protection & Redirects ---");

  function evaluateRouteGuard(user: (UserLike & { publicMetadata?: { role?: string } }) | null, pathname: string): { redirect: string | null } {
    if (!user) {
      return { redirect: "/sign-in" };
    }
    const moduleKey = getModuleKeyForPath(pathname);
    if (
      moduleKey &&
      !hasModuleReadPermission(user, moduleKey) &&
      pathname !== "/access-denied"
    ) {
      const role = user.role || (user.publicMetadata?.role as string) || "CASHIER";
      if (role === "CASHIER") {
        return { redirect: "/pos" };
      } else {
        return { redirect: "/access-denied" };
      }
    }
    return { redirect: null };
  }

  try {
    const cashierUser = { role: "CASHIER", permissions: DEFAULT_CASHIER_PERMISSIONS };

    // Cashier accessing /dashboard -> redirect to /pos
    assert.strictEqual(evaluateRouteGuard(cashierUser, "/dashboard").redirect, "/pos");
    // Cashier accessing /inventory -> redirect to /pos
    assert.strictEqual(evaluateRouteGuard(cashierUser, "/inventory").redirect, "/pos");
    // Cashier accessing /staff -> redirect to /pos
    assert.strictEqual(evaluateRouteGuard(cashierUser, "/staff").redirect, "/pos");
    // Cashier accessing /reports -> redirect to /pos
    assert.strictEqual(evaluateRouteGuard(cashierUser, "/reports").redirect, "/pos");
    // Cashier accessing /pos -> no redirect
    assert.strictEqual(evaluateRouteGuard(cashierUser, "/pos").redirect, null);

    recordPass("CASHIER route guard redirects all unauthorized route attempts to /pos");
  } catch (err: any) {
    recordFail(`Cashier route guard redirect failed: ${err.message}`);
  }

  try {
    const managerUser = {
      role: "MANAGER",
      permissions: {
        ...DEFAULT_MANAGER_PERMISSIONS,
        staff: { read: false, write: false },
        reports: { read: false, write: false },
      },
    };

    // Manager accessing /staff -> redirect to /access-denied
    assert.strictEqual(evaluateRouteGuard(managerUser, "/staff").redirect, "/access-denied");
    // Manager accessing /reports -> redirect to /access-denied
    assert.strictEqual(evaluateRouteGuard(managerUser, "/reports").redirect, "/access-denied");
    // Manager accessing /dashboard (read: true) -> no redirect
    assert.strictEqual(evaluateRouteGuard(managerUser, "/dashboard").redirect, null);
    // Manager accessing /access-denied -> no redirect loop
    assert.strictEqual(evaluateRouteGuard(managerUser, "/access-denied").redirect, null);

    recordPass("MANAGER route guard redirects unauthorized route attempts to /access-denied");
  } catch (err: any) {
    recordFail(`Manager route guard redirect failed: ${err.message}`);
  }

  try {
    const ownerUser = { role: "OWNER", permissions: DEFAULT_OWNER_PERMISSIONS };
    const allRoutes = [
      "/dashboard", "/pos", "/inventory", "/sales-orders", "/customers",
      "/purchases", "/purchase-orders", "/suppliers", "/expenses", "/staff",
      "/reports", "/setup", "/settings", "/branches"
    ];
    allRoutes.forEach((route) => {
      assert.strictEqual(evaluateRouteGuard(ownerUser, route).redirect, null, `Owner should access ${route}`);
    });
    recordPass("OWNER route guard never redirects for any of the 14 application routes");
  } catch (err: any) {
    recordFail(`Owner route guard test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 3. STAFF DIRECTORY PERMISSION MANAGEMENT & BRANCH ISOLATION LOGIC
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing Staff Directory Permission Management & Branch Boundaries ---");

  interface StaffMemberMock {
    id: string;
    role: "OWNER" | "MANAGER" | "CASHIER";
    branchId: string;
  }

  function canManageMemberPermissions(
    user: (UserLike & { branchId?: string }) | null,
    member: StaffMemberMock
  ): boolean {
    if (!user) return false;
    const canWriteStaff = hasModuleWritePermission(user, "staff");
    if (!canWriteStaff) return false;

    const userRole = user.role ?? "CASHIER";
    if (userRole === "CASHIER") return false;
    if (userRole === "OWNER") return true;
    if (userRole === "MANAGER") {
      return member.branchId === user.branchId;
    }
    return false;
  }

  try {
    const ownerUser = { role: "OWNER", branchId: "branch-1", permissions: DEFAULT_OWNER_PERMISSIONS };
    const memberBranch1: StaffMemberMock = { id: "m1", role: "CASHIER", branchId: "branch-1" };
    const memberBranch2: StaffMemberMock = { id: "m2", role: "MANAGER", branchId: "branch-2" };

    assert.strictEqual(canManageMemberPermissions(ownerUser, memberBranch1), true);
    assert.strictEqual(canManageMemberPermissions(ownerUser, memberBranch2), true);
    recordPass("OWNER can view and edit permissions for staff members in ANY branch");
  } catch (err: any) {
    recordFail(`Owner staff permission boundary failed: ${err.message}`);
  }

  try {
    const managerUser = { role: "MANAGER", branchId: "branch-1", permissions: DEFAULT_MANAGER_PERMISSIONS };
    const sameBranchMember: StaffMemberMock = { id: "m1", role: "CASHIER", branchId: "branch-1" };
    const diffBranchMember: StaffMemberMock = { id: "m2", role: "CASHIER", branchId: "branch-2" };

    assert.strictEqual(canManageMemberPermissions(managerUser, sameBranchMember), true, "Manager should manage same branch staff");
    assert.strictEqual(canManageMemberPermissions(managerUser, diffBranchMember), false, "Manager MUST NOT manage diff branch staff");
    recordPass("MANAGER with staff.write can manage permissions ONLY for staff in their same branch");
  } catch (err: any) {
    recordFail(`Manager branch boundary check failed: ${err.message}`);
  }

  try {
    const cashierUser = { role: "CASHIER", branchId: "branch-1", permissions: DEFAULT_CASHIER_PERMISSIONS };
    const member: StaffMemberMock = { id: "m1", role: "CASHIER", branchId: "branch-1" };

    assert.strictEqual(canManageMemberPermissions(cashierUser, member), false);
    recordPass("CASHIER cannot access permission button or manage staff permissions under any circumstances");
  } catch (err: any) {
    recordFail(`Cashier permission access check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 4. INTERLOCKING CHECKBOX LOGIC EMPIRICAL TESTS
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing Interlocking Checkbox Modal State Logic ---");

  function handleToggleReadState(
    currentPerms: StaffPermissions,
    targetRole: string,
    key: ModuleKey,
    checked: boolean
  ): StaffPermissions {
    if (targetRole === "OWNER") return currentPerms;
    const currentMod = currentPerms[key] || { read: false, write: false };
    return {
      ...currentPerms,
      [key]: {
        read: checked,
        write: !checked ? false : currentMod.write,
      },
    };
  }

  function handleToggleWriteState(
    currentPerms: StaffPermissions,
    targetRole: string,
    key: ModuleKey,
    checked: boolean
  ): StaffPermissions {
    if (targetRole === "OWNER") return currentPerms;
    const currentMod = currentPerms[key] || { read: false, write: false };
    return {
      ...currentPerms,
      [key]: {
        read: checked ? true : currentMod.read,
        write: checked,
      },
    };
  }

  try {
    let perms = sanitizePermissions(null, "CASHIER");
    assert.strictEqual(perms.inventory.read, false);
    assert.strictEqual(perms.inventory.write, false);

    // Checking write should force read = true
    perms = handleToggleWriteState(perms, "CASHIER", "inventory", true);
    assert.strictEqual(perms.inventory.write, true, "inventory write should be true");
    assert.strictEqual(perms.inventory.read, true, "inventory read should automatically become true when write is checked");

    // Unchecking read should force write = false
    perms = handleToggleReadState(perms, "CASHIER", "inventory", false);
    assert.strictEqual(perms.inventory.read, false, "inventory read should be false");
    assert.strictEqual(perms.inventory.write, false, "inventory write should automatically become false when read is unchecked");

    recordPass("Interlocking checkbox logic correctly enforces read-write dependencies bidirectionally");
  } catch (err: any) {
    recordFail(`Interlocking checkbox logic test failed: ${err.message}`);
  }

  try {
    const ownerPerms = DEFAULT_OWNER_PERMISSIONS;
    const toggledRead = handleToggleReadState(ownerPerms, "OWNER", "dashboard", false);
    const toggledWrite = handleToggleWriteState(ownerPerms, "OWNER", "dashboard", false);

    assert.strictEqual(toggledRead.dashboard.read, true, "Owner dashboard read must remain true");
    assert.strictEqual(toggledWrite.dashboard.write, true, "Owner dashboard write must remain true");

    recordPass("OWNER target staff permissions cannot be modified by modal toggle handlers");
  } catch (err: any) {
    recordFail(`Owner target toggle block failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // 5. HARDENING & IMMUTABILITY CHECKS
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Testing Immutability & Deep Copy Isolation ---");

  try {
    const p1 = getDefaultPermissionsForRole("MANAGER");
    p1.pos.read = false; // Mutate copy

    const p2 = getDefaultPermissionsForRole("MANAGER");
    assert.strictEqual(p2.pos.read, true, "Mutating returned object from getDefaultPermissionsForRole must NOT affect future calls");

    recordPass("getDefaultPermissionsForRole returns isolated deep copies to prevent reference mutation bugs");
  } catch (err: any) {
    recordFail(`Deep copy isolation test failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=========================================================================");
  console.log(`   M2 STRESS TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed.`);
  console.log("=========================================================================");

  if (failed > 0) {
    console.error("Failures detected:");
    findings.forEach((f, idx) => console.error(` ${idx + 1}. ${f}`));
    process.exit(1);
  }
}

runM2ChallengerTestSuite();
