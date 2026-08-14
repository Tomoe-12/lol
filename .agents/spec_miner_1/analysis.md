# SMARTOS Specification Mining & Test Infrastructure Analysis

## 1. System Overview & Architecture
- **Framework**: Next.js 15.5.19 App Router with React 19 and Tailwind CSS 4.
- **Database Engine & ORM**: Prisma 6.19.3 connected to SQLite (`prisma/dev.db`) / MySQL database, containing 19 data models and 9 enums (`Role`, `PaymentMethod`, `TransactionStatus`, `StockChangeReason`, `PurchaseOrderStatus`, `ExpenseCategory`, `SalesOrderStatus`, `PaymentStatus`, `DeliveryStatus`).
- **Authentication & RBAC**:
  - Authentication via `pos_session` session cookie or `x-staff-id` request header resolved by `getAuthStaff(req)` in `src/lib/auth-helper.ts`.
  - Granular RBAC matrix with 11 module keys (`dashboard`, `pos`, `inventory`, `salesOrders`, `outstanding`, `delivery`, `purchases`, `expenses`, `staff`, `reports`, `setup`) evaluated via `checkStaffPermission()` and `sanitizePermissions()`.
- **Multi-Branch Architecture**: Data isolated by `branchId` across 4 seeded branches:
  1. Hledan Branch
  2. Tamwe Branch
  3. Sanchaung Branch
  4. Mandalay Branch
- **Test Runner & Execution Runtime**: `npx tsx` executing custom TypeScript integration and unit test runners under `tests/integration/` and `tests/unit/`.

---

## 2. Test Infrastructure & Database Procedures

### Database Seed & Reset Procedures
- **CLI Seed Command**:
  ```bash
  npx tsx prisma/seed.ts
  ```
  - **Procedure**: Toggles foreign key checks off (`SET FOREIGN_KEY_CHECKS = 0;`), truncates all 19 database tables, and seeds fresh reference data.
  - **Seeded Entities**: 4 branches, 15 staff members (1 Owner, 4 Managers, 10 Cashiers), 12 product categories, 74 products with variants, branch stock levels across all variants, 600+ historical sales transactions across 30 days, 4 suppliers, 6 purchase orders, 4 customers, 4 sales orders, 26 expenses, 31 audit logs, and exchange rate histories.
- **Programmatic HTTP Seed API**:
  ```http
  POST /api/admin/seed?secret=seed_now_please
  ```
  - Resets all 19 tables in memory and recreates identical initial state programmatically.
- **Database Utility Scripts**:
  - `npx tsx scripts/db-ping.ts`: Connectivity health check.
  - `npx tsx scripts/db-debug.ts`: Table record count auditor.
  - `npx tsx scripts/set-owner.ts`: Role promotion helper script.
  - `node scripts/sync-clerk-role.mjs`: External auth role sync script.
  - `node migrate_stock.js`: Legacy stock migration helper.

### Test Execution Commands (npm Scripts)
| Command Script | Shell Command | Scope & File Path | Purpose |
|----------------|---------------|-------------------|---------|
| `npm run test:m1` | `npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts` | Integration Suite | Verifies M1 RBAC, 18 application routes traversal, Cashier 403 blocks, Manager branch isolation. |
| `npm run test:e2e` | `npx tsx tests/integration/e2e-system-suite.test.ts` | Full System E2E | Verifies all 6 system lifecycle phases including POS checkout, SO delivery, debt capping, zero-drift audit (432 assertions). |
| `npm run test:integrity` | `npx tsx tests/integration/financial-inventory-integrity.test.ts` | Integration Suite | Verifies financial and inventory mathematical integrity across PO, SO, POS checkout, cancellation, and deletion. |
| `npm run test:language` | `npx tsx tests/unit/language-switcher.test.ts` | Unit Suite | Tests i18n `LanguageProvider`, context locale switching, localStorage persistence, and exception handling (37 assertions). |
| `npm run test:challenger` | `npx tsx tests/integration/challenger-stress-test.test.ts` | Integration Suite | Adversarial stress test for boundary inputs and pricing validation rules. |
| Custom Execution | `npx tsx tests/integration/challenger-2-stress.test.ts` | Stress & Concurrency | Tests concurrent POS checkouts, multi-branch isolation leaks, and raw bilingual slash rendering. |
| Custom Execution | `npx tsx tests/integration/challenger-m2-edge-cases.test.ts` | Edge Cases | Validates split payment rounding, multi-currency USD conversion, and debt capping. |
| Custom Execution | `npx tsx tests/integration/m3-challenger-empirical.test.ts` | Empirical API Suite | Tests direct HTTP endpoints for 401 Unauthorized, 403 Forbidden, and 200 Authorized access. |
| Custom Execution | `npx tsx tests/unit/header-responsiveness.test.ts` | Layout Unit | Validates single-line header stability and Tailwind layout classes across 9 viewport widths (320px–1280px). |
| Custom Execution | `npx tsx tests/unit/m1-permissions-stress.test.ts` | Helpers Unit | Unit tests for `sanitizePermissions`, `checkStaffPermission`, and `getModuleKeyForPath`. |
| Custom Execution | `npx tsx tests/unit/m1-challenger-deep-stress.test.ts` | Interlocking Unit | Tests permission deep copies, invalid module types, and route mapping stability. |
| Custom Execution | `npx tsx tests/unit/m2-challenger-stress.test.ts` | UI Logic Unit | Tests sidebar filtering, client route guards, modal state logic, and deep copy isolation. |

---

## 3. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | RBAC & Security | Owner Full Access Boundary | Owner role bypassing all branch and module restrictions across all 18 routes and 35 API endpoints. | Request with Owner session / `x-staff-id` | HTTP 200 / Full JSON Data | None | `src/lib/auth-helper.ts:114` & `tests/integration/m1-rbac-multibranch-suite.test.ts` |
| 2 | RBAC & Security | Manager Branch Isolation | Restricts Manager read/write operations strictly to their assigned `branchId`. | Request with Manager session and `targetBranchId` | HTTP 200 for matching branch | HTTP 403 Forbidden for unassigned `targetBranchId` | `src/lib/auth-helper.ts:119` & `tests/integration/m1-rbac-multibranch-suite.test.ts` |
| 3 | RBAC & Security | Cashier Module Restricted Boundary | Strict blockage of Cashier role from accessing administration, financial reports, inventory adjustment, purchase orders, expenses, setup, and dashboard stats. | Request with Cashier session to restricted endpoints | HTTP 200 for POS, Delivery, Outstanding | HTTP 403 Forbidden for `/staff`, `/reports`, `/inventory`, `/purchase-orders`, `/expenses`, `/setup`, `/dashboard/stats` | `src/lib/permissions.ts:96` & `src/app/api/staff/route.ts` |
| 4 | RBAC & Security | Interlocking Permission Constraint | Grants read access automatically when write permission is set to true for any module (`write: true` forces `read: true`). | `permissions` JSON payload with `write: true, read: false` | Sanitized `permissions` with `read: true, write: true` | None | `src/lib/permissions.ts:178` & `tests/unit/m1-permissions-stress.test.ts` |
| 5 | POS & Sales | POS Voucher Checkout | Immediate sale execution, decrementing physical variant `StockLevel` and logging `InventoryLog` with `SALE` reason. | Branch ID, Variant ID, Quantity, Payment Method (CASH, CARD, QR, SPLIT, DEBT), Discount | HTTP 200 with Transaction JSON payload | HTTP 400 Bad Request for discount > subtotal or selling price < cost price | `src/app/api/pos/checkout/route.ts` & `tests/integration/e2e-system-suite.test.ts` |
| 6 | POS & Sales | Minimum Selling Price Protection | Enforces effective selling price (price minus discount per unit) to be greater than or equal to `costPrice`. | Selling Price < Variant Cost Price | Rejection payload | HTTP 400 Bad Request (`Selling price cannot be below cost price`) | `src/app/api/pos/checkout/route.ts:75` |
| 7 | POS & Sales | Split Payment Calculation | Validates cash and non-cash split payment totals equal `totalInMMK`. | `paymentMethod: "SPLIT"`, `splitCash`, `splitNonCash` | Transaction recorded | HTTP 400 Bad Request if sum does not match total | `src/app/api/pos/checkout/route.ts:90` |
| 8 | POS & Sales | Exchange Rate Conversion | Converts multi-currency transactions using active branch USD to MMK exchange rate. | Currency ("USD"), `exchangeRate` | Transaction with `totalInMMK = total * exchangeRate` | HTTP 400 Bad Request if invalid exchange rate | `src/app/api/pos/exchange-rate/route.ts` |
| 9 | Sales Orders | Sales Order Lifecycle & Advance Deposit | Creates sales order with optional delivery details; enforces minimum 10% advance deposit for partial payment status. | Customer ID, Items, `isDelivery`, `amountPaid` | SalesOrder JSON object | HTTP 400 Bad Request if advance deposit < 10% of order total | `src/app/api/sales-orders/route.ts` & `PROJECT.md:41` |
| 10 | Delivery | Delivery Confirmation Stock Deduction | Transitioning Sales Order `deliveryStatus` to `DELIVERED` sets `status` to `COMPLETED` and decrements stock with `SALES_ORDER_DELIVERED` audit log. | `salesOrderId`, `status: "DELIVERED"` | Updated SalesOrder | Prevents double deduction if already `COMPLETED` | `src/app/api/delivery/status/route.ts` & `tests/integration/e2e-system-suite.test.ts` |
| 11 | Debt Collection | Debt Repayment & Ledger Capping | Records customer debt repayment under `/outstanding/pay`, updating customer balance ledger and capping repayment to remaining balance. | Customer ID, `amount`, Payment Method | Payment receipt JSON | HTTP 400 Bad Request if `amount > remainingDebt` | `src/app/api/outstanding/pay/route.ts` & `tests/integration/e2e-system-suite.test.ts` |
| 12 | Purchasing | Purchase Order Intake & Moving Average Cost | Completing PO (`status: "RECEIVED"`) increments physical stock and recalculates variant `costPrice` using Moving Average Cost (MAC) formula. | PO ID, `status: "RECEIVED"` | Updated PurchaseOrder | Prevents duplicate stock increase if already RECEIVED | `src/app/api/purchase-orders/route.ts` & `PROJECT.md:42` |
| 13 | Sales Orders | Sales Order Cancellation & Deposit Refund | Cancelling a partial-pay Sales Order refunds amount paid (writes negative payment ledger entry) and restores physical stock levels. | SO ID, `status: "CANCELLED"` | Updated SalesOrder | HTTP 400 Bad Request if already CANCELLED | `src/app/api/sales-orders/[id]/route.ts` & `tests/integration/financial-inventory-integrity.test.ts` |
| 14 | Sales Orders | Completed Order Deletion Stock Reversion | Deleting a COMPLETED Sales Order restores physical stock levels and writes an `ADJUSTMENT` inventory log. | `DELETE /api/sales-orders/[id]` | HTTP 200 OK | HTTP 404 / 500 error if order not found | `src/app/api/sales-orders/[id]/route.ts:120` |
| 15 | Inventory | Zero-Drift Audit Verification | Mathematical audit comparing `StockLevel.quantity` with the sum of all historical `InventoryLog.change` entries per branch variant. | Branch ID, Variant ID | Audit result matching 100% | Zero-drift mismatch flag | `tests/integration/financial-inventory-integrity.test.ts` & `tests/integration/e2e-system-suite.test.ts` |
| 16 | i18n | Single-Language UI Rendering | Language switcher supporting English (`en`) and Burmese (`my`) without leaking raw bilingual slashes (` / `). | Locale state ("en" or "my") | Clean localized string | Raw slash leakage in UI | `src/providers/language-provider.tsx` & `tests/unit/language-switcher.test.ts` |

---

## 4. Edge Cases Table

| # | Feature | Input / Test Case | Observed Behavior | Status / Defect |
|---|---------|-------------------|-------------------|-----------------|
| 1 | POS Checkout | `unitPrice < costPrice` unauthenticated call | Endpoint returns HTTP 401 Unauthorized before validating price policy (returns 401 instead of 400). | Observed in `challenger-stress-test.test.ts` |
| 2 | POS Checkout | High-concurrency checkout (50 parallel requests) | Stock levels and InventoryLogs drifted due to lack of strict transaction locking or race conditions in batch handling. | Defect: Zero-Drift Invariant Violation in `challenger-2-stress.test.ts` |
| 3 | RBAC | Manager creating Sales Order for another branch | Manager from Hledan branch was allowed to create a Sales Order targeting Tamwe branch (returns HTTP 200 OK). | Defect: Multi-Branch Security Bypass in `challenger-2-stress.test.ts` |
| 4 | RBAC | Manager updating permissions for Cashier in same branch | Manager calling `PUT /api/staff/[id]/permissions` for cashier in their assigned branch returned HTTP 403 Forbidden. | Defect: Manager Authorization Defect in `m3-challenger-empirical.test.ts` |
| 5 | i18n UI | Page rendering in Setup and Suppliers pages | SetupPage and SuppliersPage render raw bilingual slashes (` / `) in both English and Burmese toggle states. | Defect: i18n Bilingual Slash Leak in `challenger-2-stress.test.ts` |
| 6 | POS Checkout | Fractional USD checkout rounding | POS checkout with fractional USD amount failed assertion with HTTP 400. | Observed in `challenger-m2-edge-cases.test.ts` |
| 7 | Sales Orders | Duplicate cancellation attempt | Second call to cancel an already CANCELLED Sales Order is correctly rejected with HTTP 400. | Verified in `financial-inventory-integrity.test.ts` |
| 8 | Debt Collection | Repayment amount > `remainingDebt` | Repayment request exceeding remaining debt is strictly rejected with HTTP 400. | Verified in `e2e-system-suite.test.ts` |

---

## 5. Comprehensive API Interface Specifications

| API Endpoint | HTTP Method | RBAC Module | Target Action | Authentication & Permission Contract | Success Output | Error Output / Behavior |
|--------------|-------------|-------------|---------------|---------------------------------------|----------------|-------------------------|
| `/api/admin/seed` | POST | None | Seed | Secret URL parameter `?secret=seed_now_please` | 200 OK `{ success: true, summary: {...} }` | 403 Forbidden if secret missing/invalid |
| `/api/auth/login` | POST | Auth | Login | Credentials (email, password) | 200 OK + `pos_session` cookie | 401 Unauthorized for invalid credentials |
| `/api/auth/logout` | POST | Auth | Logout | Active session | 200 OK (clears cookie) | 200 OK |
| `/api/auth/me` | GET | Auth | Me | Active session cookie / `x-staff-id` header | 200 OK `{ staff: {...} }` | 401 Unauthorized if unauthenticated |
| `/api/branches` | GET | setup | read | Authenticated staff | 200 OK `[ { branch... } ]` | 401 Unauthorized |
| `/api/branches` | POST | setup | write | OWNER role or Manager with `setup.write` | 200 OK `{ branch... }` | 403 Forbidden for Cashier |
| `/api/staff` | GET | staff | read | OWNER (all branches), MANAGER (own branch) | 200 OK `[ { staff... } ]` | 403 Forbidden for Cashier |
| `/api/staff` | POST | staff | write | OWNER (all branches), MANAGER (own branch) | 200 OK `{ staff... }` | 403 Forbidden for Cashier |
| `/api/staff/[id]/permissions` | GET | staff | read | OWNER (all staff), MANAGER (same branch staff) | 200 OK `{ permissions: {...} }` | 403 Forbidden for Cashier or cross-branch Manager |
| `/api/staff/[id]/permissions` | PUT | staff | write | OWNER (all staff), MANAGER (same branch staff) | 200 OK `{ staff... }` | 403 Forbidden for Cashier or cross-branch Manager |
| `/api/categories` | GET | inventory | read | Authenticated staff | 200 OK `[ { category... } ]` | 401 Unauthorized |
| `/api/categories` | POST | inventory | write | OWNER, MANAGER with `inventory.write` | 200 OK `{ category... }` | 403 Forbidden for Cashier |
| `/api/products` | GET | inventory | read | Authenticated staff | 200 OK `[ { product... } ]` | 401 Unauthorized |
| `/api/products` | POST | inventory | write | OWNER, MANAGER with `inventory.write` | 200 OK `{ product... }` | 403 Forbidden for Cashier |
| `/api/inventory` | GET | inventory | read | OWNER, MANAGER, or staff with `inventory.read` | 200 OK `[ { stockLevel... } ]` | 403 Forbidden for Cashier |
| `/api/inventory/adjust` | POST | inventory | write | OWNER, MANAGER with `inventory.write` | 200 OK `{ stockLevel... }` | 403 Forbidden for Cashier |
| `/api/inventory/transfer` | POST | inventory | write | OWNER, MANAGER with `inventory.write` | 200 OK `{ transfer: true }` | 403 Forbidden for Cashier |
| `/api/pos/checkout` | POST | pos | write | Authenticated staff with `pos.write` | 200 OK `{ transaction... }` | 400 Bad Request for discount > subtotal or price < cost |
| `/api/pos/auth-pin` | POST | pos | read | Validates staff PIN for overrides | 200 OK `{ valid: true }` | 400 / 401 for invalid PIN |
| `/api/pos/exchange-rate` | GET/POST | pos | read/write | Gets or sets USD exchange rate | 200 OK `{ exchangeRate... }` | 403 Forbidden for Cashier writing rate |
| `/api/sales-orders` | GET | salesOrders | read | OWNER, MANAGER, or staff with `salesOrders.read` | 200 OK `[ { salesOrder... } ]` | 403 Forbidden for Cashier |
| `/api/sales-orders` | POST | salesOrders | write | Authenticated staff with `salesOrders.write` | 200 OK `{ salesOrder... }` | 400 Bad Request if deposit < 10% |
| `/api/sales-orders/[id]` | GET/PATCH/DELETE | salesOrders | read/write | OWNER, MANAGER (same branch) | 200 OK `{ salesOrder... }` | 403 Forbidden for cross-branch or unauthorized role |
| `/api/delivery` | GET | delivery | read | CASHIER, MANAGER, OWNER | 200 OK `[ { deliveryOrder... } ]` | 401 Unauthorized |
| `/api/delivery/status` | POST | delivery | write | CASHIER, MANAGER, OWNER | 200 OK `{ salesOrder... }` | Prevents duplicate stock deduction if completed |
| `/api/outstanding` | GET | outstanding | read | CASHIER, MANAGER, OWNER | 200 OK `[ { debt... } ]` | 401 Unauthorized |
| `/api/outstanding/pay` | POST | outstanding | write | CASHIER, MANAGER, OWNER | 200 OK `{ payment... }` | 400 Bad Request if `amount > remainingDebt` |
| `/api/purchase-orders` | GET | purchases | read | OWNER, MANAGER | 200 OK `[ { purchaseOrder... } ]` | 403 Forbidden for Cashier |
| `/api/purchase-orders` | POST/PATCH | purchases | write | OWNER, MANAGER (own branch) | 200 OK `{ purchaseOrder... }` | 403 Forbidden for Cashier |
| `/api/expenses` | GET/POST | expenses | read/write | OWNER, MANAGER | 200 OK `{ expense... }` | 403 Forbidden for Cashier |
| `/api/reports` | GET | reports | read | OWNER, MANAGER | 200 OK `{ report... }` | 403 Forbidden for Cashier |
| `/api/dashboard/stats` | GET | dashboard | read | OWNER, MANAGER | 200 OK `{ stats... }` | 403 Forbidden for Cashier |
| `/api/audit-logs` | GET | staff | read | OWNER, MANAGER | 200 OK `[ { auditLog... } ]` | 403 Forbidden for Cashier |

---

## 6. Existing Coverage & Missing Coverage Gaps

### Existing Coverage Status
- **R1 (Role & Access Control)**: Verified extensively by `tests/integration/m1-rbac-multibranch-suite.test.ts` (84 assertions passed) and `tests/integration/e2e-system-suite.test.ts` (432 assertions passed).
- **R2 (Business & Inventory Lifecycles)**: Verified by `tests/integration/financial-inventory-integrity.test.ts` (46 assertions passed) and `tests/integration/e2e-system-suite.test.ts`.

### Identified Gaps & Defect Audit Summary
1. **Manager Cross-Branch Sales Order Mutation**:
   - *Gap*: `POST /api/sales-orders` does not enforce strict `targetBranchId` matching for Manager roles.
   - *Impact*: Manager can create sales orders targeting other branches.
2. **Manager Same-Branch Permission Editing**:
   - *Gap*: `PUT /api/staff/[id]/permissions` returns 403 when Manager attempts to edit staff permissions of a cashier in their assigned branch.
3. **High-Concurrency POS Stock Ledger Drift**:
   - *Gap*: Under 50 parallel checkouts, physical `StockLevel` and `InventoryLog` ledger mismatch occurs due to missing transactional locks.
4. **i18n Bilingual Slash Leakage**:
   - *Gap*: SetupPage (`/setup`) and SuppliersPage (`/suppliers`) display unparsed bilingual slashes (` / `) in localized rendering.
5. **Pricing Policy Error Code Inconsistency**:
   - *Gap*: POS checkout with selling price < cost price returns 401 if unauthenticated, whereas boundary tests expect 400 Bad Request error response first.

---

*End of Analysis Report.*
