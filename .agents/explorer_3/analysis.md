# Comprehensive Testing Setup, Environment & RBAC Architecture Analysis Report

**Explorer**: Explorer 3 (`teamwork_preview_explorer`)  
**Date**: 2026-08-10  
**Workspace**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`  
**Working Directory**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_3`  

---

## 1. Executive Summary

This report presents a thorough investigation of the testing infrastructure, dependencies, database seeding mechanisms, authentication session models, and production build system for the POS multi-branch application.

The project is built on **Next.js 15.5.19** (App Router), **React 19.2.4**, **Prisma ORM 6.19.3**, and **TypeScript 5**. Testing is executed via **`npx tsx`** executing native TypeScript test files in Node.js without requiring pre-compilation or heavy external test frameworks.

---

## 2. Dependencies, Test Scripts & `tsx` Execution Harness

### 2.1 Package Dependencies (`package.json`)
- **Core Framework**: `next` (^15.5.19), `react` (19.2.4), `react-dom` (19.2.4)
- **Database & ORM**: `@prisma/client` (^6.19.3), `prisma` (^6.19.3)
- **Authentication & Auth Libraries**: `@clerk/nextjs` (^7.5.3) - *Note: The core POS system uses a lightweight custom header/cookie session mechanism via `@/lib/auth-helper.ts` backed by Prisma Staff records*.
- **State Management & Validation**: `zustand` (^5.0.14), `zod` (^4.4.3), `react-hook-form` (^7.79.0)
- **UI & Visualization**: Radix UI components, Tailwind CSS v4, Lucide icons, `recharts` (^3.8.1)
- **Execution & Linting**: `typescript` (^5), `eslint` (^9), `eslint-config-next` (^15.5.19)

### 2.2 Pre-Existing Test Scripts
`package.json` defines four npm test scripts:
```json
"scripts": {
  "test:integrity": "npx tsx tests/integration/financial-inventory-integrity.test.ts",
  "test:challenger": "npx tsx tests/integration/challenger-stress-test.test.ts",
  "test:language": "npx tsx tests/unit/language-switcher.test.ts",
  "test:e2e": "npx tsx tests/integration/e2e-system-suite.test.ts"
}
```

### 2.3 `npx tsx` Execution Mechanism
`tsx` (TypeScript Execute) provides direct TypeScript execution in Node.js. In this repository:
- **Direct Route Handler Imports**: Test files directly import App Router Next.js API route handlers (e.g. `import { POST as posCheckout } from "../../src/app/api/pos/checkout/route"`).
- **Component Traversal Verification**: Page components can be imported and rendered server-side using `react-dom/server` (`renderToString`) to verify compilation and rendering without runtime exceptions.
- **Node Native Assertions**: Standard `node:assert` library (`assert.strictEqual`, `assert.ok`) is used for assertion checks with explicit pass/fail output counters.
- **Browser/Environment Polyfills**: For testing client-side code (e.g. `LanguageProvider`), test scripts polyfill `global.window` and `global.localStorage` with mock classes capable of simulating storage errors and security exceptions.

---

## 3. Programmatic API & Next.js Route Testing Harness

### 3.1 Direct API Route Handler Invocation Pattern
In Next.js 15 App Router, API routes export standard HTTP handler functions taking a `Request` or `NextRequest` and returning a `Response` or `NextResponse`.

Test scripts create requests using `NextRequest` from `next/server`:
```typescript
import { NextRequest } from "next/server";

function makeReq(url: string, method: string, body?: unknown, staffId?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (staffId) {
    headers["cookie"] = `pos_session=${encodeURIComponent(JSON.stringify({ id: staffId }))}`;
    headers["x-staff-id"] = staffId;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
```

### 3.2 Invoking API Endpoints Programmatically
Instead of launching an HTTP server and making network requests via `fetch`, tests directly await handler execution:
```typescript
import { POST as postCheckout } from "@/app/api/pos/checkout/route";

const req = makeReq("http://localhost:3000/api/pos/checkout", "POST", payload, staffId);
const res = await postCheckout(req);
const data = await res.json();

assert.strictEqual(res.status, 200);
assert.strictEqual(data.success, true);
```

### 3.3 Tested Endpoint Coverage
The repository routes available for test automation include:
- **Auth**: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/pos/auth-pin`
- **POS Operations**: `/api/pos/checkout`, `/api/pos/exchange-rate`
- **Sales Orders & Delivery**: `/api/sales-orders`, `/api/sales-orders/[id]`, `/api/delivery`, `/api/delivery/status`
- **Debt & Outstanding**: `/api/outstanding`, `/api/outstanding/pay`
- **Inventory & Stock**: `/api/inventory`, `/api/inventory/adjust`, `/api/inventory/transfer`
- **Purchases & Suppliers**: `/api/purchase-orders`, `/api/suppliers`, `/api/products`, `/api/categories`
- **Expenses & Shifts**: `/api/expenses`, `/api/shifts/clock`, `/api/shifts/logs`
- **Staff & RBAC**: `/api/staff`, `/api/staff/[id]/permissions`, `/api/staff/sync`
- **Reports & Dashboard**: `/api/reports`, `/api/dashboard/stats`, `/api/dashboard/export`, `/api/audit-logs`
- **Database Admin Seed**: `/api/admin/seed`

---

## 4. DB Seeding, Mock Data & Test Database Isolation

### 4.1 Database Configuration & Driver
- **Database Provider**: MySQL (`prisma/schema.prisma`: `provider = "mysql"`)
- **Connection String**: `DATABASE_URL="mysql://root:root@localhost:3306/buyshopos"` in `.env`.
- **Prisma Client**: Initialized via `@/lib/prisma` (singleton instance with global caching for development/testing).

### 4.2 Database Seed Architecture
Seeding can be executed in two ways:
1. **CLI Script**: `npx tsx prisma/seed.ts`
2. **API Route Handler**: `POST /api/admin/seed?secret=seed_now_please` (`src/app/api/admin/seed/route.ts`)

#### Seed Data Content Overview:
- **Foreign Key Safe Cleaning**: Executes raw SQL `SET FOREIGN_KEY_CHECKS = 0;` and truncates 19 core tables (`AuditLog`, `InventoryLog`, `TransactionItem`, `Transaction`, `StockLevel`, `ProductVariant`, `Product`, `Category`, `ExchangeRate`, `Expense`, `PurchaseItem`, `PurchaseOrder`, `Supplier`, `Staff`, `Branch`, `Customer`, `SalesOrderItem`, `OrderPayment`, `SalesOrder`).
- **4 Branches**:
  - `Hledan Branch`
  - `Tamwe Branch`
  - `Sanchaung Branch`
  - `Mandalay Branch`
- **15 Staff Accounts**:
  - **OWNER**: 1 account (`owner@buyshopos.com` / `owner@smartos.com`, PIN `9999`, assigned to Hledan)
  - **MANAGERS**: 4 accounts (1 per branch: Hledan `2201`, Tamwe `2202`, Sanchaung `2203`, Mandalay `2204`)
  - **CASHIERS**: 10 accounts distributed across all 4 branches (Hledan `1101`-`1103`, Tamwe `1201`-`1202`, Sanchaung `1301`-`1302`, Mandalay `1401`-`1403`)
- **Products & Variants**: 12 product categories, 74 products, and associated product variants with barcodes and cost prices.
- **Stock Levels**: Multi-branch stock quantity initialization across all product variants.
- **Transactions & Orders**: 600+ historical POS transactions, 6 Purchase Orders, 4 Customers, 4 Sales Orders (with partial payments & delivery statuses), 26 Expense records, Exchange rate histories, and Audit logs.

### 4.3 Test Database Isolation & State Reset Strategy
To maintain test isolation across test runs, test suites can invoke the seed handler prior to execution:
```typescript
import { POST as seedDB } from "@/app/api/admin/seed/route";

const seedReq = new NextRequest("http://localhost/api/admin/seed?secret=seed_now_please", { method: "POST" });
await seedDB(seedReq);
```
Alternatively, test suites can run transactions against specific isolated entities created dynamically during the test lifecycle.

---

## 5. Authentication Sessions & Role Instantiation (OWNER, MANAGER, CASHIER)

### 5.1 Authentication Mechanism Analysis (`src/lib/auth-helper.ts`)
The application resolves authenticated staff requests via `getAuthStaff(req)`:
1. **Cookie Parsing**: Reads `pos_session` cookie from request headers or Next.js `cookies()`.
   - Cookie format: `pos_session=${encodeURIComponent(JSON.stringify({ id: staffId }))}`
2. **Fallback Header**: Reads `x-staff-id` header directly from request.
3. **DB Verification**: Searches Prisma DB:
   ```typescript
   await prisma.staff.findFirst({
     where: { OR: [{ id: staffIdentifier }, { email: staffIdentifier }] },
     include: { branch: true },
   });
   ```
4. **Permissions Sanitization**: Calls `sanitizePermissions(staff.permissions, staff.role)`.

### 5.2 RBAC Rules (`checkStaffPermission`)
- **OWNER**: Full access to **all modules** and **all 4 branches** (`targetBranchId` check bypassed).
- **MANAGER**: Full read/write access **strictly within their assigned branch** (`staff.branchId === targetBranchId`). Granular module permissions checked. Blocked from managing staff permissions.
- **CASHIER**: Restrictive access (POS checkout/exchange rates only). Blocked from staff management, expenses, reports, setup, inventory adjustments, and unassigned branches (returns `403 Forbidden`).

### 5.3 Instantiating Roles in Test Scripts

To instantiate authenticated sessions for tests across roles and branches:

```typescript
// Query staff records from seeded database
const owner = await prisma.staff.findFirst({ where: { role: "OWNER" } });
const mgrBranchA = await prisma.staff.findFirst({ where: { role: "MANAGER", branch: { name: "Hledan Branch" } } });
const mgrBranchB = await prisma.staff.findFirst({ where: { role: "MANAGER", branch: { name: "Tamwe Branch" } } });
const cashierBranchA = await prisma.staff.findFirst({ where: { role: "CASHIER", branch: { name: "Hledan Branch" } } });
const cashierBranchB = await prisma.staff.findFirst({ where: { role: "CASHIER", branch: { name: "Tamwe Branch" } } });

// Helper to make authenticated requests as any staff member
function makeAuthReq(url: string, method: string, body?: unknown, staffId?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (staffId) {
    headers["cookie"] = `pos_session=${encodeURIComponent(JSON.stringify({ id: staffId }))}`;
    headers["x-staff-id"] = staffId;
  }
  return new NextRequest(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
```

---

## 6. Production Build Verification (`npm run build`)

Executing `npm run build` verifies:
1. **TypeScript Type Safety**: Transpiling all `.ts` and `.tsx` files without compiler errors.
2. **ESLint Static Analysis**: Ensuring syntax and linting compliance.
3. **Next.js Page & Route Generation**: Verifying App Router dynamic/static server routes.

---

## 7. Recommendations for Master Integration Test Suite Structure

For downstream Implementer agents writing the final comprehensive test suite (`e2e-system-suite.test.ts`):
1. **Always re-seed database at test suite initialization** using `seedDB` route handler.
2. **Retrieve role-specific staff fixtures** dynamically (`OWNER`, `MANAGER` Hledan, `MANAGER` Tamwe, `CASHIER` Hledan, `CASHIER` Tamwe).
3. **Always pass `staff.id` into `makeAuthReq`** to ensure valid session resolution.
4. **Assert RBAC boundaries explicitly**: Test that CASHIER attempting `POST /api/expenses` or `GET /api/staff` receives status 403, while MANAGER attempting cross-branch operations receives status 403.
5. **Verify exact financial & stock invariants**:
   - `StockLevel.quantity` changes match physical additions/reductions.
   - `SalesOrder.amountPaid` equals sum of `OrderPayment` entries.
   - Delivery transition (`PENDING` -> `DELIVERED`) deducts stock once without double-deduction.
   - Repayment collection capping prevents `amountPaid > total`.
