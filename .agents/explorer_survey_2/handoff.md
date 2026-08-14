# Handoff Report — Frontend UI Navigation, Staff Directory & Permission Management Survey

## 1. Observation

### 1.1 Navigation & Router Layout (`src/app/(dashboard)/layout.tsx` & `src/components/sidebar.tsx`)
- **`src/app/(dashboard)/layout.tsx`**:
  - **Lines 18-39**: `DashboardLayout` accesses `user` via `useUser()` from `@/providers/auth-provider`.
  - **Lines 29-37**: Current route guard logic checks:
    ```tsx
    const role = (user.publicMetadata?.role as string) ?? "CASHIER"
    if (role === "CASHIER" && pathname !== "/pos" && pathname !== "/access-denied") {
      router.replace("/pos")
    }
    ```
  - **Observation**: Hardcoded role check only protects `/pos` for CASHIER. Does not check granular read/write permissions for OWNER or MANAGER or custom CASHIER permissions across all 9 modules.
- **`src/components/sidebar.tsx`**:
  - **Lines 29-130**: `navItems` array defines 14 links with `titleEn`, `titleMy`, `href`, `icon`, `roles`.
  - **Line 148**: `const role = (user?.publicMetadata?.role as string) ?? "CASHIER"`
  - **Line 155**: `const filteredNav = navItems.filter((item) => item.roles.includes(role))`
  - **Observation**: Navigation link filtering currently relies solely on static role arrays (`roles: ["OWNER", "MANAGER"]`). Needs to filter dynamically based on granular permissions per module (`read` permission).

### 1.2 Staff Directory (`src/app/(dashboard)/staff/page.tsx` & `src/app/api/staff/route.ts`)
- **`src/app/(dashboard)/staff/page.tsx`**:
  - **Lines 67-68**: Gets `user` from `useUser()` and role from `user?.publicMetadata?.role`.
  - **Lines 106-131**: `fetchData()` calls `GET /api/staff` and `GET /api/inventory`.
  - **Lines 387-406**: Directory table action column renders Edit (`Edit2`) and Delete (`Trash2`) buttons.
  - **Observation**: There is currently no "Permissions" action button in the staff directory table rows. Action buttons are not currently filtered by granular `staff.write` permission or Manager branch boundaries on the client side.
- **`src/app/api/staff/route.ts`**:
  - **Lines 17-19**: `GET` blocks Cashiers with `403 Forbidden`. Manager sees staff filtered by `staff.branchId`.
  - **Lines 56-58, 124-126, 205-207**: `POST`, `PUT`, and `DELETE` strictly restrict modifications to `OWNER` only.
  - **Observation**: `PUT /api/staff` needs to support updating permissions, allowing Managers with `staff.write` access to update permissions for staff in their same branch.

### 1.3 Client Auth Context (`src/providers/auth-provider.tsx` & `src/app/api/auth/me/route.ts`)
- **`src/providers/auth-provider.tsx`**:
  - **Lines 6-20**: `LocalUser` interface defines `id`, `name`, `fullName`, `email`, `role`, `branchId`, `branchName`, `publicMetadata`, `reload()`.
  - **Lines 39-74**: `fetchUser()` calls `GET /api/auth/me`.
  - **Observation**: `LocalUser` currently lacks `permissions` field. `fetchUser()` and `useUser()` need `permissions` object to provide permission state client-side.
- **`src/app/api/auth/me/route.ts`**:
  - **Lines 10-23**: Returns `id`, `name`, `email`, `role`, `branchId`, `branchName`, `publicMetadata`.
  - **Observation**: Needs to return `permissions` in JSON payload so `AuthProvider` receives it.

### 1.4 Route Guard & Access Denied Page (`src/app/access-denied/page.tsx`)
- **`src/app/access-denied/page.tsx`**:
  - **Lines 8-63**: Existing React client page displaying bilingual "Access Denied / ဝင်ရောက်ခွင့်မရှိပါ" message with `SignOutButton` and `Back to Login` button.
  - **Observation**: Full UI for `/access-denied` is already implemented and ready for route guard redirects.

---

## 2. Logic Chain

1. **User Context & Schema Extension**:
   - `Staff` backend model (or schema) stores granular module permissions as JSON or default map for 9 modules: `dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`.
   - `GET /api/auth/me` includes `permissions` in the user response object.
   - `AuthProvider` populates `user.permissions` in client state and exposes `reloadUser()` / `user.reload()`.

2. **Permission Helper & Module Mapping (`src/lib/permissions.ts`)**:
   - Map routes to 9 primary modules:
     - `/dashboard` -> `dashboard`
     - `/pos` -> `pos`
     - `/inventory` -> `inventory`
     - `/sales-orders`, `/customers` -> `salesOrders`
     - `/purchases`, `/purchase-orders`, `/suppliers` -> `purchases`
     - `/expenses` -> `expenses`
     - `/staff` -> `staff`
     - `/reports` -> `reports`
     - `/setup`, `/settings`, `/branches` -> `setup`
   - Default permissions by role:
     - `OWNER`: Full read/write for all 9 modules (unrestricted).
     - `MANAGER`: Full read/write for operational modules, editable by Owner/Manager.
     - `CASHIER`: Read/write for `pos`, read=false/write=false for all others.
   - Helpers: `hasModuleReadPermission(user, moduleKey)`, `hasModuleWritePermission(user, moduleKey)`.

3. **Dynamic Sidebar Filtering (`src/components/sidebar.tsx`)**:
   - Add `moduleKey` to each `navItem` in `sidebar.tsx`.
   - Filter `navItems` using `hasModuleReadPermission(user, item.moduleKey)`.
   - When permissions are changed and `user.reload()` is called, `AuthProvider` updates `user`, reactively re-rendering the sidebar immediately.

4. **Client-Side Route Protection (`src/app/(dashboard)/layout.tsx`)**:
   - In `layout.tsx`, determine `moduleKey` from `pathname`.
   - If `!hasModuleReadPermission(user, moduleKey)`, redirect to `/access-denied` (or `/pos` if Cashier).
   - This blocks direct URL navigation to unauthorized routes.

5. **Staff Directory & Permission Management UI (`src/app/(dashboard)/staff/page.tsx`)**:
   - Check `hasModuleWritePermission(user, "staff")`.
   - If user is `CASHIER` or lacks `staff.read`, redirect to `/access-denied`.
   - Action Buttons in Staff Table:
     - Add `Permissions` button (`ShieldCheck` or `KeyRound` icon) alongside `Edit` and `Delete`.
     - Button visibility / editability rule:
       - Logged-in `OWNER`: Can view/edit permissions for any staff member in any branch.
       - Logged-in `MANAGER` with `staff.write`: Can view/edit permissions ONLY for staff members belonging to their same branch (`member.branchId === user.branchId`). Cannot edit `OWNER` permissions.
       - `CASHIER`: Cannot view Staff directory or access modal.
   - **Permissions Modal Dialog**:
     - Header: Staff Name, Role, Branch.
     - Notice for `OWNER` target: "Owner permissions are unrestricted and cannot be modified."
     - 9-Module Checkbox Grid: Module Name (EN/MY), Read Checkbox, Write Checkbox.
     - Interlocking Checkbox Logic:
       - Checking `Write` automatically checks `Read`.
       - Unchecking `Read` automatically unchecks `Write`.
     - Submitting sends updated permissions payload via `PUT /api/staff`.

---

## 3. Caveats

- **No Code Modifications Made**: As an Explorer, no source code was modified. All analysis is read-only.
- **Redis Cache Invalidation**: When staff permissions are updated via `PUT /api/staff`, Redis cache for staff (`CACHE_KEYS.staff()`) must be invalidated so subsequent `GET /api/staff` and `/api/auth/me` calls return updated permission data.
- **Default Permissions Strategy**: Existing database staff records without explicit permissions stored must fall back gracefully to `DEFAULT_PERMISSIONS[role]` without throwing null pointer errors.

---

## 4. Conclusion

The frontend permission management architecture can be implemented seamlessly by:
1. Extending `LocalUser` in `src/providers/auth-provider.tsx` and returning `permissions` from `/api/auth/me`.
2. Creating a centralized permission helper (`src/lib/permissions.ts`) mapping route paths to the 9 modules.
3. Dynamically filtering `navItems` in `src/components/sidebar.tsx` and enforcing route guards in `src/app/(dashboard)/layout.tsx` (redirecting to `/access-denied`).
4. Adding the "Permissions" action button and 9-module checkbox grid modal in `src/app/(dashboard)/staff/page.tsx`, enforcing manager branch boundaries (`member.branchId === user.branchId`).

---

## 5. Verification Method

To independently verify the implementation once completed:
1. **TypeScript Build Verification**:
   - Run `npm run build` in project root (`C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`).
   - Confirm 0 TypeScript compilation errors or missing property errors on `LocalUser`.
2. **Sidebar & Route Guard Verification**:
   - Log in as CASHIER -> verify Sidebar shows ONLY Sales Voucher (/pos), direct navigation to `/dashboard` or `/staff` redirects to `/access-denied`.
   - Log in as MANAGER -> verify Sidebar shows authorized tabs.
   - Log in as OWNER -> verify all tabs are visible.
3. **Staff Permission Modal Verification**:
   - Open Staff Directory as OWNER -> click "Permissions" button on any staff row -> verify 9-module checkbox grid opens and saves changes.
   - Open Staff Directory as MANAGER -> verify "Permissions" button is visible ONLY for staff in the same branch.
