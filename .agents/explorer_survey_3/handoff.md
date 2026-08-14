# Survey Report: REST API Endpoints & Server-Side Authorization Enforcement

**Role**: Explorer 3  
**Working Directory**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_survey_3`  
**Project Root**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`  
**Date**: 2026-08-08  

---

## 1. Observation

### A. Current Server-Side Session & Authentication Retrieval
- **Auth Helper (`src/lib/auth-helper.ts`, lines 10–84)**:
  - Function `getAuthStaff(req?: Request)` retrieves session data from:
    1. Next.js `cookies()` store (key: `pos_session`).
    2. Fallback: `Cookie` header from `req.headers`.
    3. Fallback: `x-staff-id` header from `req.headers`.
  - Resolves `staff` via `prisma.staff.findFirst(...)` including `branch`.
  - Returns `{ staff: AuthenticatedStaff | null, errorResponse: NextResponse | null }`.
  - Status codes returned:
    - Missing session: `401 Unauthorized` (`NextResponse.json({ error: "Unauthorized..." }, { status: 401 })`).
    - Staff not found in DB: `403 Forbidden` (`NextResponse.json({ error: "Access Denied..." }, { status: 403 })`).
- **Middleware (`src/middleware.ts`, lines 4–38)**:
  - Intercepts requests, checking `pos_session` cookie presence. Public paths (`/sign-in`, `/sign-up`, `/access-denied`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`) bypass check. Unauthenticated web page requests are redirected to `/sign-in`.

### B. Complete Inventory of REST API Endpoints & Security Status

| Endpoint Route | HTTP Methods | Target Module | Current Auth Check (`getAuthStaff`) | Current Authorization & Role Enforcement | Security Vulnerability / Identified Gap |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | Auth | None (Public) | Authenticates credentials & sets `pos_session` cookie | None (Public login route) |
| `/api/auth/logout` | POST | Auth | None (Public) | Deletes `pos_session` cookie | None |
| `/api/auth/me` | GET | Auth | `getAuthStaff` | Returns current staff details & branch | None |
| `/api/staff` | GET | `staff` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> filter `branchId = staff.branchId` | Hardcoded `CASHIER` check instead of `staff:read` permission |
| `/api/staff` | POST, PUT, DELETE | `staff` | `getAuthStaff` | `role !== OWNER` -> 403 | **Blocks Managers completely!** R2 requires Manager with `staff:write` to manage staff in their branch |
| `/api/staff/[id]/permissions` | GET, PUT | `staff` | **Does NOT exist** | **Missing endpoint** | Must be created for reading and updating granular staff permissions |
| `/api/pos/checkout` | POST | `pos` | **NONE** | Reads `staffId` and `branchId` directly from body | **CRITICAL: Unauthenticated checkout!** No session verification or `pos:write` check |
| `/api/pos/auth-pin` | POST | `pos` | `getAuthStaff` | Verifies PIN belongs to authenticated user | Secure |
| `/api/pos/exchange-rate` | POST | `pos`/`setup` | **NONE** | Accepts `setByStaffId` and `branchId` from body | **CRITICAL: Unauthenticated exchange rate modification!** |
| `/api/inventory` | GET | `inventory` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> locks branch | Hardcoded role check instead of `inventory:read` permission |
| `/api/inventory/adjust` | POST | `inventory` | **NONE** | Upserts stock & logs adjustment directly | **CRITICAL: Unauthenticated stock adjustment!** No permission or branch check |
| `/api/inventory/transfer` | POST | `inventory` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> `fromBranchId === staff.branchId` | Hardcoded role check instead of `inventory:write` permission |
| `/api/sales-orders` | GET | `sales-orders` | `getAuthStaff` | `MANAGER` -> `branchId === staff.branchId` | Cashiers are NOT blocked! Missing `sales-orders:read` permission check |
| `/api/sales-orders` | POST | `sales-orders` | `getAuthStaff` | `role === CASHIER` -> 403 | Hardcoded role check instead of `sales-orders:write` permission check |
| `/api/sales-orders/[id]` | PATCH, DELETE | `sales-orders` | `getAuthStaff` | `role === CASHIER` -> 403 | Hardcoded role check; missing branch check for Manager vs order `branchId` |
| `/api/purchase-orders` | GET | `purchases` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> locks branch | Hardcoded role check instead of `purchases:read` permission |
| `/api/purchase-orders` | POST, PATCH | `purchases` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> locks branch | Hardcoded role check instead of `purchases:write` permission |
| `/api/expenses` | GET, POST | `expenses` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> locks branch | Hardcoded role check instead of `expenses:read` / `expenses:write` |
| `/api/expenses` | DELETE | `expenses` | `getAuthStaff` | `role !== OWNER` -> 403 | Hardcoded OWNER check; ignores Manager with `expenses:write` permission |
| `/api/reports` | GET | `reports` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> locks branch | Hardcoded role check instead of `reports:read` permission |
| `/api/dashboard/stats` | GET | `dashboard` | `getAuthStaff` | `role === CASHIER` -> 403. `MANAGER` -> locks branch | Hardcoded role check instead of `dashboard:read` permission |
| `/api/dashboard/export` | GET | `dashboard`/`reports` | **NONE** | Exports transactions / stock levels to CSV | **CRITICAL: Unauthenticated data export!** |
| `/api/branches` | GET | `setup` | `getAuthStaff` | Checks authenticated | Needs `setup:read` permission check |
| `/api/branches` | POST, PUT, DELETE | `setup` | `getAuthStaff` | `role !== OWNER` -> 403 | Restricted to OWNER (aligned with requirements) |
| `/api/categories` | GET, POST, PUT, DELETE | `setup` | **NONE** | Performs CRUD without auth | **CRITICAL: Unauthenticated Categories CRUD!** |
| `/api/products` | GET, POST, PUT, DELETE | `setup` | **NONE** | Performs CRUD without auth | **CRITICAL: Unauthenticated Products CRUD!** |
| `/api/customers` | GET, POST | `sales-orders` | `getAuthStaff` | POST `role === CASHIER` -> 403 | Needs `sales-orders:read` / `sales-orders:write` check |
| `/api/suppliers` | GET, POST, PUT, DELETE | `purchases` | `getAuthStaff` | GET `CASHIER` -> 403. POST/PUT/DELETE `OWNER` only | Hardcoded checks instead of `purchases:read` / `purchases:write` |
| `/api/notifications` | GET | System | **NONE** | Returns low stock / audit alerts | Needs `getAuthStaff` & branch filter for Managers |
| `/api/audit-logs` | GET | `reports`/`staff` | `getAuthStaff` | `MANAGER` -> filter `branchId = staff.branchId` | Cashiers NOT blocked! Needs `reports:read` / `staff:read` check |
| `/api/admin/seed` | POST | Admin | None | Dev seed script | Should be protected in non-dev environments |

---

## 2. Logic Chain

1. **Premise 1 — Authentication Identification**: `getAuthStaff(req)` cleanly extracts staff identity, role, and branch context from session cookies or request headers.
2. **Premise 2 — Granular Permission System Requirement (R1/R3)**:
   - Primary app modules (9 total): `dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`.
   - Each module requires `read` (boolean) and `write` (boolean) permissions stored on the `Staff` record.
   - Role Defaults:
     - `OWNER`: `read: true, write: true` across ALL modules. Unrestricted branch boundary (ALL branches).
     - `MANAGER`: Default read/write to `dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `reports`. Read-only or editable for `staff` and `setup`. **Restricted strictly to `staff.branchId`**.
     - `CASHIER`: Read/write for `pos` ONLY. **Completely blocked (`403 Forbidden`)** from all other modules (`dashboard`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`). Restricted strictly to `staff.branchId`.
3. **Premise 3 — Gap Analysis**:
   - 7 REST endpoints currently lack `getAuthStaff` entirely (`pos/checkout`, `pos/exchange-rate`, `inventory/adjust`, `categories`, `products`, `dashboard/export`, `notifications`).
   - Rest of endpoints use ad-hoc checks like `if (staff.role === 'CASHIER') return 403;` or `if (staff.role !== 'OWNER') return 403;`.
   - `staff/route.ts` currently blocks `MANAGER` from creating/editing staff entirely (`role !== OWNER` check), violating R2 which allows Managers with `staff:write` to manage staff members in their own branch.
   - `/api/staff/[id]/permissions` route is currently missing.
4. **Conclusion — Standardized Server Authorization Enforcement**:
   - Create a central helper `hasPermission(staff, module, action, targetBranchId)` in `src/lib/permissions.ts` (or `src/lib/auth-helper.ts`).
   - Evaluation algorithm:
     - `OWNER`: Always returns `true` (allow all, no branch restriction).
     - `CASHIER`: Returns `false` (403 Forbidden) if requesting any module other than `pos` (unless explicitly granted).
     - Module Check: Evaluates `staff.permissions[module][action]`. If `false`, returns `403 Forbidden`.
     - Branch Check: If `staff.role === 'MANAGER'` or `'CASHIER'`, and `targetBranchId` is passed, asserts `targetBranchId === staff.branchId`. If mismatch, returns `403 Forbidden`.
     - Staff Permissions Check: If `staff.role === 'MANAGER'` editing another staff member via `/api/staff/[id]/permissions` or `/api/staff`, asserts `targetStaff.branchId === manager.branchId`. If mismatch, returns `403 Forbidden`.

---

## 3. Caveats

- **Impersonation Risk in Request Body**: Several existing routes (e.g. `pos/checkout`, `pos/exchange-rate`) currently trust `staffId` or `branchId` passed in the JSON request body. Server-side handlers MUST override or validate these against `staff.id` and `staff.branchId` from the authenticated session.
- **Cache Invalidation**: When a staff member's permissions are updated via `/api/staff/[id]/permissions`, cached staff data in Redis (`CACHE_KEYS.staff()`) must be invalidated immediately so the new permissions take effect on subsequent API calls.
- **Owner Immutability**: Owner account permissions must never be modified or demoted via API endpoints.

---

## 4. Conclusion

To complete server-side authorization enforcement across all REST API endpoints:
1. **Schema Extension**: Ensure `Staff` model includes a `permissions` JSON field or relation.
2. **Permission Verification Utility**: Implement `checkStaffPermission(staff, module, action, targetBranchId)` returning standardized `403 Forbidden` JSON responses when access is denied.
3. **Dedicated Permission API Route**: Implement `src/app/api/staff/[id]/permissions/route.ts` supporting `GET` (fetch permissions) and `PUT` (update permissions with branch isolation check for Managers).
4. **Controller Integration**: Update all 29 REST API routes in `src/app/api/...` to invoke `getAuthStaff` and `checkStaffPermission`, plugging security gaps on unauthenticated routes and converting hardcoded role checks into granular permission enforcement.

---

## 5. Verification Method

To independently verify the server-side authorization enforcement:

1. **Inspection of Controller Code**:
   - Inspect `src/app/api/...` route files using `view_file` to confirm `getAuthStaff` and `checkStaffPermission` are called at the top of every handler.

2. **Automated API Security Assertions**:
   - Run integration tests simulating requests from different role contexts:
     - `CASHIER` attempt to `GET /api/reports` or `GET /api/dashboard/stats` -> asserts HTTP `403 Forbidden`.
     - `MANAGER` attempt to `POST /api/inventory/adjust` with `branchId` of another branch -> asserts HTTP `403 Forbidden`.
     - `MANAGER` with `staff:write` attempting to edit permissions of staff in another branch -> asserts HTTP `403 Forbidden`.
     - `OWNER` attempt to perform any operation across any branch -> asserts HTTP `200/201 Success`.
     - Request without `pos_session` cookie or `x-staff-id` header -> asserts HTTP `401 Unauthorized`.

3. **Build & Type Checking**:
   - Execute `npx tsc --noEmit` to verify type compliance across all updated API route signatures.
