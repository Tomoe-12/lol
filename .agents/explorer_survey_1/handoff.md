# Staff Entity & Permission Data Model Survey Report

## 1. Observation

Direct observations from examining the codebase at commit state (2026-08-08):

1. **Prisma Schema (`prisma/schema.prisma`)**:
   - `Role` enum (lines 15–19):
     ```prisma
     enum Role {
       OWNER
       MANAGER
       CASHIER
     }
     ```
   - `Staff` model (lines 95–111):
     ```prisma
     model Staff {
       id        String   @id @default(cuid())
       clerkId   String?  @unique
       password  String   @default("123456")
       name      String
       email     String   @unique
       pin       String?
       role      Role     @default(CASHIER)
       branchId  String
       branch    Branch   @relation(fields: [branchId], references: [id])
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt

       transactions  Transaction[]
       auditLogs     AuditLog[]
       exchangeRates ExchangeRate[]
     }
     ```
   - *Observation*: There are currently **no permission fields**, permission tables, or permission relations in `prisma/schema.prisma`.

2. **Staff Authentication & Session Context**:
   - In `src/lib/auth-helper.ts` (lines 10–75), `getAuthStaff(req?: Request)` reads the session from the `pos_session` cookie (or `x-staff-id` header), resolves `prisma.staff.findFirst({ where: { OR: [{ id }, { email }] }, include: { branch: true } })`, and returns `AuthenticatedStaff`.
   - In `src/app/api/auth/login/route.ts` (lines 43–50), successful authentication writes `sessionData` to the `pos_session` cookie containing `{ id, email, name, role, branchId, branchName }`.
   - In `src/app/api/auth/me/route.ts` (lines 10–23), GET returns `{ user: { id, name, email, role, branchId, branchName, publicMetadata: { role, branchId } } }`.
   - In `src/providers/auth-provider.tsx` (lines 39–74), `AuthProvider` calls `/api/auth/me` and exposes `user` context and `useUser()` hook to client components.

3. **Current Access Control Mechanism**:
   - **Frontend**: `src/components/sidebar.tsx` (lines 29–130) defines `navItems` with static arrays of allowed roles (e.g. `roles: ["OWNER", "MANAGER"]` or `roles: ["OWNER", "MANAGER", "CASHIER"]`). `Sidebar` filters items using `navItems.filter(item => item.roles.includes(role))`.
   - **Server APIs**: Controllers use hardcoded role checks. For example, in `src/app/api/staff/route.ts`:
     - GET (line 17): `if (staff.role === Role.CASHIER) return NextResponse.json({ error: "Access Denied..." }, { status: 403 });`
     - GET (line 21): `const effectiveBranchId = staff.role === Role.MANAGER ? staff.branchId : undefined;`
     - POST (line 56), PUT (line 124), DELETE (line 205): `if (currentStaff.role !== Role.OWNER) return NextResponse.json({ error: "Access Denied: Only the Owner can..." }, { status: 403 });`

4. **Seed Data (`src/app/api/admin/seed/route.ts`)**:
   - Lines 58–75 seed 1 Owner (`Owner Han`), 4 Managers (`Kyaw Kyaw`, `Thida Maung`, `Myo Min Aung`, `Aye Aye Khin`), and 10 Cashiers across 4 branches (`Hledan Branch`, `Tamwe Branch`, `Sanchaung Branch`, `Mandalay Branch`).

---

## 2. Logic Chain

1. **Requirement Mapping**:
   - Requirement R1 asks for granular `read` and `write` permissions stored for 9 primary app modules: **Dashboard**, **POS**, **Inventory**, **Sales Orders**, **Purchases**, **Expenses**, **Staff**, **Reports**, and **Setup**.
   - Default permissions must be enforced:
     - `OWNER`: Unrestricted full access (`read: true, write: true`) across all modules and all branches; permissions cannot be edited or restricted.
     - `MANAGER`: Default has full/broad access, but permissions are editable by Owner or Manager (within the same branch if caller has staff write access). Branch isolation (`branchId`) boundaries must be strictly enforced.
     - `CASHIER`: Default `pos: { read: true, write: true }`, all other modules `read: false, write: false`. CASHIERs are completely blocked from viewing or editing staff permissions.

2. **Schema & Model Design Proposal**:
   - **Recommended Approach**: Add a `permissions Json?` field to the `Staff` model in `prisma/schema.prisma`:
     ```prisma
     model Staff {
       // ... existing fields
       permissions Json?
     }
     ```
   - **TypeScript Interface Structure**:
     ```ts
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
     ```

3. **Default Permission Constants**:
   - `DEFAULT_OWNER_PERMISSIONS`: All 9 modules set to `{ read: true, write: true }`.
   - `DEFAULT_MANAGER_PERMISSIONS`: All 9 modules set to `{ read: true, write: true }` (or `staff` write optional based on assignment).
   - `DEFAULT_CASHIER_PERMISSIONS`: `pos` set to `{ read: true, write: true }`, all other 8 modules set to `{ read: false, write: false }`.

4. **Integration Points**:
   - `src/lib/auth-helper.ts`: Update `AuthenticatedStaff` to include `permissions`. Provide helper functions:
     - `hasModulePermission(staff: AuthenticatedStaff, module: ModuleKey, action: "read" | "write"): boolean`
     - For `OWNER`, always return `true`.
   - `src/app/api/auth/me/route.ts`: Include `permissions` in the returned `user` payload.
   - `src/providers/auth-provider.tsx`: Include `permissions` in `LocalUser` interface and state.
   - `src/components/sidebar.tsx`: Map each sidebar navigation item to its corresponding `ModuleKey`, filtering items based on `hasModulePermission(user, module, "read")`.
   - API Controllers (`src/app/api/...`): Enforce server-side permission checks using `hasModulePermission()` before executing DB operations.

---

## 3. Caveats

1. **Existing DB Data & Null Handling**:
   - Existing staff records in the database will have `permissions = null`. The `hasModulePermission()` helper and getter routines MUST fall back to `DEFAULT_PERMISSIONS[staff.role]` when `staff.permissions` is `null` or missing keys.
2. **Clerk vs Local Auth**:
   - The app uses a hybrid auth model where local sessions use `pos_session` cookie and `getAuthStaff()`. `user.reload()` in `sidebar.tsx` was written for Clerk compatibility, but primary local auth relies on `/api/auth/me` re-fetching.
3. **Module Grouping in UI**:
   - The sidebar has 14 items, while the prompt defines 9 primary permission modules:
     - `dashboard` -> `/dashboard`
     - `pos` -> `/pos`
     - `inventory` -> `/inventory`
     - `salesOrders` -> `/sales-orders`
     - `purchases` -> `/purchases`, `/purchase-orders`
     - `expenses` -> `/expenses`
     - `staff` -> `/staff`
     - `reports` -> `/reports`
     - `setup` -> `/setup`, `/branches`, `/suppliers`, `/customers`, `/settings`

---

## 4. Conclusion

- The existing schema and auth infrastructure cleanly support extending `Staff` with a `permissions Json?` field in Prisma.
- `OWNER`, `MANAGER`, and `CASHIER` roles currently lack granular tab/module permissions; adding the `permissions Json?` field alongside a permission-checking helper function in `src/lib/auth-helper.ts` will satisfy all requirements without breaking existing functionality.
- Branch isolation rules for Managers are already partially established in `src/app/api/staff/route.ts` via `staff.branchId` checks and can be extended to permission management endpoints.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect `prisma/schema.prisma` lines 95–111 to confirm `Staff` model structure.
2. Inspect `src/lib/auth-helper.ts` lines 10–75 to verify how staff session data is retrieved.
3. Inspect `src/components/sidebar.tsx` lines 29–156 to observe existing static role-based nav filtering.
4. Run `npx prisma validate` to confirm schema validity before and after schema modifications.
