/**
 * src/lib/permissions.ts
 * Granular Staff Permission definitions, default role permission matrices,
 * and evaluation helper functions for kind-shannon Retail POS.
 */

export type ModuleKey =
  | "dashboard"
  | "pos"
  | "inventory"
  | "salesOrders"
  | "outstanding"
  | "delivery"
  | "purchases"
  | "expenses"
  | "staff"
  | "reports"
  | "setup";

export interface ModulePermission {
  read: boolean;
  write: boolean;
}

export type StaffPermissions = Record<ModuleKey, ModulePermission>;

export const ALL_MODULE_KEYS: readonly ModuleKey[] = [
  "dashboard",
  "pos",
  "inventory",
  "salesOrders",
  "outstanding",
  "delivery",
  "purchases",
  "expenses",
  "staff",
  "reports",
  "setup",
] as const;

export const MODULE_LABELS: Record<ModuleKey, { en: string; my: string }> = {
  dashboard: { en: "Dashboard", my: "ပင်မစာမျက်နှာ" },
  pos: { en: "POS (Sales Voucher)", my: "အရောင်းဘောင်ချာ (POS)" },
  inventory: { en: "Inventory", my: "ကုန်ပစ္စည်းစာရင်း" },
  salesOrders: { en: "Sales Orders", my: "အရောင်းအော်ဒါများ" },
  outstanding: { en: "Outstanding Debts", my: "ကြွေးကျန်များ" },
  delivery: { en: "Delivery", my: "ပို့ဆောင်ရေးများ" },
  purchases: { en: "Purchases", my: "အဝယ်စာရင်း" },
  expenses: { en: "Expenses", my: "စရိတ်စကများ" },
  staff: { en: "Staff Directory", my: "ဝန်ထမ်းရေးရာ" },
  reports: { en: "Reports", my: "အစီရင်ခံစာများ" },
  setup: { en: "Setup & Settings", my: "ပြင်ဆင်သတ်မှတ်ချက်များ" },
};

/**
 * Default Permissions for OWNER Role.
 * OWNER has full read & write access across all modules.
 */
export const DEFAULT_OWNER_PERMISSIONS: StaffPermissions = {
  dashboard: { read: true, write: true },
  pos: { read: true, write: true },
  inventory: { read: true, write: true },
  salesOrders: { read: true, write: true },
  outstanding: { read: true, write: true },
  delivery: { read: true, write: true },
  purchases: { read: true, write: true },
  expenses: { read: true, write: true },
  staff: { read: true, write: true },
  reports: { read: true, write: true },
  setup: { read: true, write: true },
};

/**
 * Default Permissions for MANAGER Role.
 * MANAGER has full read & write access across all 9 modules by default,
 * but individual manager staff permissions can be edited by an Owner.
 */
export const DEFAULT_MANAGER_PERMISSIONS: StaffPermissions = {
  dashboard: { read: true, write: true },
  pos: { read: true, write: true },
  inventory: { read: true, write: true },
  salesOrders: { read: true, write: true },
  outstanding: { read: true, write: true },
  delivery: { read: true, write: true },
  purchases: { read: true, write: true },
  expenses: { read: true, write: true },
  staff: { read: true, write: true },
  reports: { read: true, write: true },
  setup: { read: true, write: true },
};

/**
 * Default Permissions for CASHIER Role.
 * CASHIER has read & write access to POS and Outstanding debt collection.
 */
export const DEFAULT_CASHIER_PERMISSIONS: StaffPermissions = {
  dashboard: { read: false, write: false },
  pos: { read: true, write: true },
  inventory: { read: false, write: false },
  salesOrders: { read: true, write: false },
  outstanding: { read: true, write: true },
  delivery: { read: true, write: true },
  purchases: { read: false, write: false },
  expenses: { read: false, write: false },
  staff: { read: false, write: false },
  reports: { read: false, write: false },
  setup: { read: false, write: false },
};

/**
 * Get default permissions matrix based on Staff Role.
 */
export function getDefaultPermissionsForRole(role?: string | null): StaffPermissions {
  if (role === "OWNER") {
    return JSON.parse(JSON.stringify(DEFAULT_OWNER_PERMISSIONS));
  }
  if (role === "MANAGER") {
    return JSON.parse(JSON.stringify(DEFAULT_MANAGER_PERMISSIONS));
  }
  // Default for CASHIER or any unknown role
  return JSON.parse(JSON.stringify(DEFAULT_CASHIER_PERMISSIONS));
}

/**
 * Loose interface for user objects containing role and permissions payload.
 */
export interface UserLike {
  role?: string | null;
  permissions?: unknown;
}

/**
 * Sanitizes and fills missing keys in a staff permissions object/payload.
 *
 * Invariants:
 * 1. OWNER role ALWAYS returns full read/write access for all modules.
 * 2. Missing or invalid inputs fall back to role default.
 * 3. Gracefully parses stringified JSON.
 * 4. Interlocking constraint: write: true forces read: true.
 */
export function sanitizePermissions(
  permissions: unknown,
  role?: string | null
): StaffPermissions {
  if (role === "OWNER") {
    return JSON.parse(JSON.stringify(DEFAULT_OWNER_PERMISSIONS));
  }

  const defaultPerms = getDefaultPermissionsForRole(role);

  if (!permissions) {
    return defaultPerms;
  }

  let parsed: unknown = permissions;
  if (typeof permissions === "string") {
    try {
      parsed = JSON.parse(permissions);
    } catch {
      return defaultPerms;
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return defaultPerms;
  }

  const parsedObj = parsed as Record<string, unknown>;
  const result: Partial<StaffPermissions> = {};

  for (const key of ALL_MODULE_KEYS) {
    const rawMod = parsedObj[key];
    const defaultMod = defaultPerms[key];

    if (rawMod && typeof rawMod === "object" && !Array.isArray(rawMod)) {
      const modObj = rawMod as Record<string, unknown>;
      const write = Boolean(modObj.write);
      const read = Boolean(modObj.read) || write;

      result[key] = { read, write };
    } else {
      result[key] = { ...defaultMod };
    }
  }

  return result as StaffPermissions;
}

/**
 * Evaluates whether user has READ access to a specific module.
 */
export function hasModuleReadPermission(
  user: UserLike | null | undefined,
  moduleKey: ModuleKey
): boolean {
  if (!user) return false;
  if (user.role === "OWNER") return true;

  const perms = sanitizePermissions(user.permissions, user.role);
  return Boolean(perms[moduleKey]?.read);
}

/**
 * Evaluates whether user has WRITE access to a specific module.
 */
export function hasModuleWritePermission(
  user: UserLike | null | undefined,
  moduleKey: ModuleKey
): boolean {
  if (!user) return false;
  if (user.role === "OWNER") return true;

  const perms = sanitizePermissions(user.permissions, user.role);
  return Boolean(perms[moduleKey]?.write);
}

/**
 * Resolves pathname to corresponding ModuleKey for navigation/route guards.
 */
export function getModuleKeyForPath(pathname: string): ModuleKey | null {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/pos")) return "pos";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/sales-orders") || pathname.startsWith("/customers")) return "salesOrders";
  if (pathname.startsWith("/outstanding")) return "outstanding";
  if (pathname.startsWith("/delivery")) return "delivery";
  if (pathname.startsWith("/purchases") || pathname.startsWith("/purchase-orders") || pathname.startsWith("/suppliers")) return "purchases";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/staff")) return "staff";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/setup") || pathname.startsWith("/settings") || pathname.startsWith("/branches")) return "setup";
  return null;
}
