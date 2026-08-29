# Handoff Report: API Routes, RBAC Security, UI Subsystems & i18n Localization

**Date**: 2026-08-29  
**Agent**: Explorer 2 (`explorer_routes_ui_rbac`)  
**Working Directory**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_routes_ui_rbac`  
**Handoff Type**: Hard (Investigation Completed)  
**Detailed Report**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_routes_ui_rbac\report.md`

---

## 1. Observation

1. **API Routes (39 Routes in `src/app/api/`)**:
   - Enumerated and inspected all 39 route handlers in `src/app/api/` via `find_by_name` and `view_file`.
   - Identified active routes for admin seed, audit logs, authentication, branches, categories, customers, dashboard stats/export, delivery, expenses, inventory, notifications, outstanding debt, POS checkout/fulfillment, products, purchase orders, reports, sales orders, staff administration, suppliers, transactions, and uploads.
   - Identified 4 disabled/stub endpoints: `pos/exchange-rate` (returns HTTP 410 Gone; MMK base currency only), `schedule` (returns empty list), `shifts/clock` (returns static stub), `shifts/logs` (returns empty array).

2. **Session and Cookie Architecture**:
   - In `src/middleware.ts` (lines 14–42): Requests to non-public paths are inspected for `pos_session` cookie; unauthenticated requests are redirected to `/sign-in`.
   - In `src/app/api/auth/login/route.ts` (lines 40–60): Successful authentication sets cookie `pos_session` containing `{ id, email, name, role, branchId, branchName }` with options `httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 7`.
   - In `src/lib/auth-helper.ts` (lines 16–42): `getAuthStaff(req)` verifies cookie `pos_session` or fallback header `x-staff-id`, queries Prisma `db.staff.findUnique`, includes branch data, and invokes `sanitizePermissions`.

3. **RBAC & Multi-Branch Isolation**:
   - In `src/lib/auth-helper.ts` (lines 62–104): `checkStaffPermission(staff, module, action, targetBranchId)` checks if `staff.role === 'OWNER'` (universal bypass). If `staff.role !== 'OWNER'` and `targetBranchId` is specified, it strictly requires `staff.branchId === targetBranchId`.
   - In `src/lib/permissions.ts` (lines 170–190): `sanitizePermissions(rawPermissions, role)` guarantees interlocking logic where `const write = Boolean(modObj.write); const read = Boolean(modObj.read) || write;`. Thus, `write: true` strictly guarantees `read: true`.
   - In `src/app/(dashboard)/layout.tsx` (lines 53–75): Route access is checked against `getModuleKeyForPath(pathname)`. If `hasModuleReadPermission(user, moduleKey)` is false, user is redirected to `/access-denied`.

4. **UI Subsystems (11 Subsystems)**:
   - Inspected all 11 subsystems:
     1. Auth/Session (`src/app/sign-in/page.tsx`, `src/providers/auth-provider.tsx`, `src/app/access-denied/page.tsx`)
     2. POS Voucher (`src/app/(dashboard)/pos/page.tsx`, `src/lib/store/useCartStore.ts`, `src/components/pos/cart-panel.tsx`, `src/components/pos/payment-dialog.tsx`, `src/components/pos/sales-order-fulfillment-dialog.tsx`)
     3. Sales Orders & Pre-orders (`src/app/(dashboard)/sales-orders/page.tsx`, `src/app/(dashboard)/customers/page.tsx`)
     4. Delivery Dispatch (`src/app/(dashboard)/delivery/page.tsx`)
     5. Outstanding Debt Collection (`src/app/(dashboard)/outstanding/page.tsx`)
     6. Inventory & Stock Transfer (`src/app/(dashboard)/inventory/page.tsx`)
     7. Purchase Orders & Receiving (`src/app/(dashboard)/purchases/page.tsx`, `src/app/(dashboard)/suppliers/page.tsx`)
     8. Expense Ledger (`src/app/(dashboard)/expenses/page.tsx`)
     9. Staff Administration & Permission Editor (`src/app/(dashboard)/staff/page.tsx`)
     10. Reports & Analytics (`src/app/(dashboard)/reports/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/dashboard-charts.tsx`)
     11. i18n Dual-Language Engine (`src/providers/language-provider.tsx`, `src/components/language-switcher.tsx`)

5. **i18n Dual-Language Engine**:
   - In `src/providers/language-provider.tsx` (lines 20–55): Language state is persisted in `localStorage.getItem("app-language")`.
   - Hydration safety is enforced with `isMounted` state; server and initial client render return English (`en`) to prevent hydration mismatch before reading localStorage.

---

## 2. Logic Chain

1. **API Endpoint Verification**:
   - By tracing `src/app/api/**/route.ts` through all 39 handler files, every endpoint was verified for request payload schemas, HTTP status codes, Prisma transactional consistency, and role requirements.
2. **Security Integrity**:
   - The session model relies on `pos_session` cookie verification and `getAuthStaff`.
   - The permission interlocking model in `src/lib/permissions.ts` prevents any invalid permission state (`write: true, read: false`) at the data sanitization layer.
   - Multi-branch isolation prevents Cashiers and Managers from accessing or modifying records belonging to other store branches, while allowing Owners global visibility.
3. **UI and Business Logic Integrity**:
   - The POS register validates selling price vs cost price, checks real-time variant stock, handles split and debt payments, and records delivery or wholesale orders.
   - Direct purchases update stock and recalculate unit cost prices using the Moving Average Cost (MAC) formula.
   - Pre-orders and debt collection maintain customer balances in synchronization with the POS register.

---

## 3. Caveats

1. External Redis cache instances (`src/lib/redis.ts`) fall back gracefully to in-memory/database queries if Redis is unavailable, but cache invalidation occurs on product and category updates.
2. Stub endpoints (`/api/schedule`, `/api/shifts/clock`, `/api/shifts/logs`) are disabled and return placeholder responses; shift scheduling is currently not actively connected in the UI sidebar.
3. No database mutations or source code edits were made during this investigation (strict read-only inspection).

---

## 4. Conclusion

The application exhibits a robust, multi-tenant/multi-branch architecture with:
- 39 well-structured API route handlers covering the complete POS retail lifecycle.
- A consistent RBAC authorization layer with permission interlocking (`write => read`) and strict branch boundary isolation.
- 11 comprehensive UI subsystems with client-side Zustand persistence, modal workflows, and responsive data visualization.
- A clean, hydration-safe bilingual (EN / MY) localization engine.

All findings, route specifications, schema definitions, and subsystem analyses are documented in full detail in `.agents/explorer_routes_ui_rbac/report.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify API Route Handlers**:
   - Run: `dir src\app\api /s /b | findstr route.ts` to list all 39 API route files.
2. **Inspect Permission Interlocking Logic**:
   - View `src/lib/permissions.ts` (lines 170–190) to confirm `sanitizePermissions` enforces `const read = Boolean(modObj.read) || write;`.
3. **Inspect Multi-Branch Isolation Logic**:
   - View `src/lib/auth-helper.ts` (lines 62–104) to confirm `checkStaffPermission` validates `staff.branchId === targetBranchId` when `staff.role !== 'OWNER'`.
4. **Inspect i18n Localization Engine**:
   - View `src/providers/language-provider.tsx` to confirm `LanguageProvider` implementation with `isMounted` hydration guard.
5. **Inspect Detailed Analysis Report**:
   - View `.agents/explorer_routes_ui_rbac/report.md`.
