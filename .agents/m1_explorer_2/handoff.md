# Handoff Report — M1 Explorer 2: Permission System Core Architecture & Helper Specification

## 1. Observation

- **Prisma Schema (`prisma/schema.prisma:15-19, 95-111`)**:
  - `Role` enum contains `OWNER`, `MANAGER`, `CASHIER`.
  - `Staff` model holds `role` (default `CASHIER`) and relation to `Branch`.
- **Project Requirements (`.agents/orchestrator/PROJECT.md:48-71, 72-82`)**:
  - Requires 9 granular module keys: `dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`.
  - Permission structure: `ModulePermission` is `{ read: boolean; write: boolean }`.
  - `StaffPermissions` is `Record<ModuleKey, ModulePermission>`.
  - Default permissions:
    - `OWNER`: All 9 modules `{ read: true, write: true }` (cannot be restricted).
    - `MANAGER`: All 9 modules `{ read: true, write: true }` (default, but editable by Owner).
    - `CASHIER`: `pos` has `{ read: true, write: true }`, all other 8 modules `{ read: false, write: false }`.
  - Required helpers: `hasModuleReadPermission(user, moduleKey)`, `hasModuleWritePermission(user, moduleKey)`, `sanitizePermissions(permissions, role)`.

---

## 2. Logic Chain

1. **Type Safety & Module Definition**:
   - Defining `ModuleKey` as an explicit union of the 9 string literals (`"dashboard" | "pos" | "inventory" | "salesOrders" | "purchases" | "expenses" | "staff" | "reports" | "setup"`) prevents typos and ensures compile-time checks across both frontend and backend.
   - Defining `ModulePermission` (`{ read: boolean, write: boolean }`) and `StaffPermissions` (`Record<ModuleKey, ModulePermission>`) provides a consistent schema for JSON serialization/deserialization.

2. **Default Role Permission Matrices**:
   - `DEFAULT_OWNER_PERMISSIONS` grants `{ read: true, write: true }` to all 9 modules.
   - `DEFAULT_MANAGER_PERMISSIONS` grants `{ read: true, write: true }` to all 9 modules by default.
   - `DEFAULT_CASHIER_PERMISSIONS` grants `{ read: true, write: true }` to `pos` and `{ read: false, write: false }` to the remaining 8 modules.
   - `getDefaultPermissionsForRole(role)` maps roles to their respective default matrix, defaulting to `DEFAULT_CASHIER_PERMISSIONS` for unknown or CASHIER roles.

3. **Sanitizing & Invariant Enforcement (`sanitizePermissions`)**:
   - **Owner Rule**: If `role === "OWNER"`, return `DEFAULT_OWNER_PERMISSIONS` unconditionally. Owner permissions can never be demoted or disabled.
   - **Input Parsing**: Handles `null`, `undefined`, raw JSON strings (`JSON.parse`), or corrupted objects gracefully by falling back to `getDefaultPermissionsForRole(role)`.
   - **Interlocking Invariant**: Having write access without read access leads to broken UI states (e.g. user can submit forms but cannot see the page/data). Therefore, `sanitizePermissions` enforces `read = Boolean(raw.read) || Boolean(raw.write)`.
   - **Schema Coverage**: Iterates over all 9 keys in `ALL_MODULE_KEYS`. Any missing module key is filled with the role's default value for that key.

4. **Access Evaluation Helpers (`hasModuleReadPermission` & `hasModuleWritePermission`)**:
   - Standardized `UserLike` interface accepts any user/staff object with optional `role` and `permissions` fields (such as client `LocalUser` or server `AuthenticatedStaff`).
   - If `user` is missing/null/undefined, both helpers return `false` (fail-safe closed).
   - If `user.role === "OWNER"`, both helpers return `true` immediately (O(1) short-circuit).
   - Otherwise, `user.permissions` is sanitized via `sanitizePermissions(user.permissions, user.role)` and evaluated for the target `moduleKey`.

5. **Navigation & Route Protection Helper (`getModuleKeyForPath`)**:
   - Maps URL route paths (`/dashboard`, `/pos`, `/inventory`, `/sales-orders`, `/customers`, `/purchases`, `/purchase-orders`, `/suppliers`, `/expenses`, `/staff`, `/reports`, `/setup`, `/settings`, `/branches`) to their governing `ModuleKey`.

---

## 3. Caveats

- **Prisma JSON Type**: Prisma returns `permissions` as `JsonValue` (or `any` in TypeScript depending on generation). `sanitizePermissions` is explicitly built to accept `any` to prevent type casting friction at database call sites.
- **Role Invariant**: `OWNER` permissions ignore whatever is stored in the database `permissions` column and always evaluate to full access.

---

## 4. Conclusion & Proposed Code Specification

The exact code implementation for `src/lib/permissions.ts` is fully formulated and ready to be created by implementers:

```typescript
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
  purchases: { en: "Purchases", my: "အဝယ်စာရင်း" },
  expenses: { en: "Expenses", my: "စရိတ်စကများ" },
  staff: { en: "Staff Directory", my: "ဝန်ထမ်းရေးရာ" },
  reports: { en: "Reports", my: "အစီရင်ခံစာများ" },
  setup: { en: "Setup & Settings", my: "ပြင်ဆင်သတ်မှတ်ချက်များ" },
};

/**
 * Default Permissions for OWNER Role.
 * OWNER has full read & write access across all 9 modules.
 */
export const DEFAULT_OWNER_PERMISSIONS: StaffPermissions = {
  dashboard: { read: true, write: true },
  pos: { read: true, write: true },
  inventory: { read: true, write: true },
  salesOrders: { read: true, write: true },
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
  purchases: { read: true, write: true },
  expenses: { read: true, write: true },
  staff: { read: true, write: true },
  reports: { read: true, write: true },
  setup: { read: true, write: true },
};

/**
 * Default Permissions for CASHIER Role.
 * CASHIER has full read & write access ONLY to POS.
 * All other 8 modules are strictly blocked (read: false, write: false).
 */
export const DEFAULT_CASHIER_PERMISSIONS: StaffPermissions = {
  dashboard: { read: false, write: false },
  pos: { read: true, write: true },
  inventory: { read: false, write: false },
  salesOrders: { read: false, write: false },
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
    return { ...DEFAULT_OWNER_PERMISSIONS };
  }
  if (role === "MANAGER") {
    return { ...DEFAULT_MANAGER_PERMISSIONS };
  }
  // Default for CASHIER or any unknown role
  return { ...DEFAULT_CASHIER_PERMISSIONS };
}

/**
 * Loose interface for user objects containing role and permissions payload.
 */
export interface UserLike {
  role?: string | null;
  permissions?: any;
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
  permissions: any,
  role?: string | null
): StaffPermissions {
  if (role === "OWNER") {
    return { ...DEFAULT_OWNER_PERMISSIONS };
  }

  const defaultPerms = getDefaultPermissionsForRole(role);

  if (!permissions) {
    return defaultPerms;
  }

  let parsed: any = permissions;
  if (typeof permissions === "string") {
    try {
      parsed = JSON.parse(permissions);
    } catch {
      return defaultPerms;
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return defaultPerms;
  }

  const result: Partial<StaffPermissions> = {};

  for (const key of ALL_MODULE_KEYS) {
    const rawMod = parsed[key];
    const defaultMod = defaultPerms[key];

    if (rawMod && typeof rawMod === "object") {
      const write = Boolean(rawMod.write);
      const read = Boolean(rawMod.read) || write;

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
  if (pathname.startsWith("/purchases") || pathname.startsWith("/purchase-orders") || pathname.startsWith("/suppliers")) return "purchases";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/staff")) return "staff";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/setup") || pathname.startsWith("/settings") || pathname.startsWith("/branches")) return "setup";
  return null;
}
```

---

## 5. Verification Method

To verify the implementation once written to `src/lib/permissions.ts`:

1. **TypeScript Type Check**:
   - Run `npx tsc --noEmit` or `npm run build` to verify there are zero TypeScript compilation errors.
2. **Unit / Logic Assertions**:
   - `hasModuleReadPermission({ role: 'CASHIER', permissions: null }, 'pos')` === `true`
   - `hasModuleReadPermission({ role: 'CASHIER', permissions: null }, 'dashboard')` === `false`
   - `hasModuleReadPermission({ role: 'OWNER', permissions: { dashboard: { read: false, write: false } } }, 'dashboard')` === `true` (Owner bypass)
   - `hasModuleReadPermission({ role: 'MANAGER', permissions: { inventory: { read: false, write: true } } }, 'inventory')` === `true` (Write forces read invariant)
   - `hasModuleWritePermission({ role: 'CASHIER', permissions: null }, 'staff')` === `false`
