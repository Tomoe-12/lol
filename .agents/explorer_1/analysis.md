# Comprehensive System Architecture Analysis Report

**Agent**: Explorer 1 (`teamwork_preview_explorer`)  
**Target Repository**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`  
**Date**: 2026-08-10  

---

## 1. Executive Summary & Architectural Overview

`kind-shannon` is a modern, full-stack Multi-Branch Retail Point of Sale (POS) and Enterprise Resource Planning (ERP) application built with Next.js 15 (App Router), React 19, TypeScript, Prisma ORM, and Tailwind CSS v4.

The system is designed for multi-location retail stores, supporting:
- Multi-role staff access control (`OWNER`, `MANAGER`, `CASHIER`)
- Branch-level data and inventory isolation across 4 physical branches
- Bilingual localization (English `en` and Myanmar `my` / မြန်မာ)
- Financial tracking, POS checkout, Sales Order delivery lifecycles, purchase orders, Moving Average Costing (MAC), and outstanding debt collection

---

## 2. Framework Setup & Route Topology

### 2.1 Technology Stack

| Layer | Technology | Key Dependencies / Config |
|---|---|---|
| **Framework** | Next.js 15.5.19 (App Router) | React 19.2.4, TypeScript 5, ESLint 9 |
| **Styling & UI** | Tailwind CSS v4, Radix UI primitives | Lucide React icons, Class Variance Authority, Next Themes |
| **State Management** | Zustand v5, React Context | `useCartStore`, `AuthProvider`, `LanguageProvider` |
| **Database & ORM** | Prisma v6.19.3 | MySQL / SQLite database driver, `@prisma/client` |
| **Form & Validation** | React Hook Form v7, Zod v4 | `@hookform/resolvers` |

### 2.2 Application Route Topology & 18-Route Permission Matrix (`src/app`)

The application contains **18 core routes** across public access and the dashboard route group (`src/app/(dashboard)/...`). All dashboard routes are guarded client-side by `src/app/(dashboard)/layout.tsx` and server-side by `getAuthStaff` / `checkStaffPermission` in API handlers.

#### The 18 Enumerated Routes:

| # | Route Path | File Location | Module Key | Allowed Roles | Cashier Behavior | Forbidden API Behavior |
|---|---|---|---|---|---|---|
| 1 | `/dashboard` | `(dashboard)/dashboard/page.tsx` | `dashboard` | OWNER, MANAGER | Redirected to `/pos` | `GET /api/dashboard/stats` -> 403 |
| 2 | `/pos` | `(dashboard)/pos/page.tsx` | `pos` | OWNER, MANAGER, CASHIER | Allowed (Full Access) | Allowed for assigned branch |
| 3 | `/sales-orders` | `(dashboard)/sales-orders/page.tsx` | `salesOrders` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/sales-orders` -> 403 |
| 4 | `/delivery` | `(dashboard)/delivery/page.tsx` | `delivery` | OWNER, MANAGER, CASHIER | Allowed (Branch Isolated)| Cross-branch PATCH -> 403 |
| 5 | `/outstanding` | `(dashboard)/outstanding/page.tsx` | `outstanding` | OWNER, MANAGER, CASHIER | Allowed (Branch Isolated)| Repayment exceeding balance -> 400; Cross-branch -> 403 |
| 6 | `/inventory` | `(dashboard)/inventory/page.tsx` | `inventory` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/inventory/*` -> 403 |
| 7 | `/purchase-orders` | `(dashboard)/purchase-orders/page.tsx` | `purchases` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST/PATCH /api/purchase-orders` -> 403 |
| 8 | `/purchases` | `(dashboard)/purchases/page.tsx` | `purchases` | OWNER, MANAGER | Redirected to `/pos` | `GET /api/purchases` -> 403 |
| 9 | `/suppliers` | `(dashboard)/suppliers/page.tsx` | `purchases` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/suppliers` -> 403 |
| 10 | `/customers` | `(dashboard)/customers/page.tsx` | `salesOrders` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/customers` -> 403 |
| 11 | `/expenses` | `(dashboard)/expenses/page.tsx` | `expenses` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST/DELETE /api/expenses` -> 403 |
| 12 | `/reports` | `(dashboard)/reports/page.tsx` | `reports` | OWNER, MANAGER | Redirected to `/pos` | `GET /api/reports` -> 403 |
| 13 | `/staff` | `(dashboard)/staff/page.tsx` | `staff` | OWNER, MANAGER (Branch Isolated) | Redirected to `/pos` | `PUT /api/staff/[id]/permissions` by Manager -> 403; Cross-branch -> 403 |
| 14 | `/schedule` | `(dashboard)/schedule/page.tsx` | `staff` / default | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/schedule` -> 403 |
| 15 | `/branches` | `(dashboard)/branches/page.tsx` | `setup` | OWNER | Redirected to `/pos` | `POST/PUT/DELETE /api/branches` by non-Owner -> 403 |
| 16 | `/settings` | `(dashboard)/settings/page.tsx` | `setup` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/settings` -> 403 |
| 17 | `/setup` | `(dashboard)/setup/page.tsx` | `setup` | OWNER, MANAGER | Redirected to `/pos` | `GET/POST /api/setup` -> 403 |
| 18 | `/access-denied` | `access-denied/page.tsx` | N/A (Public/Shared) | All Authenticated | Renders Access Denied notice | N/A |

*(Note: `/sign-in` at `app/sign-in/[[...sign-in]]/page.tsx` handles public login authentication before session establishment.)*

### 2.3 API Route Handlers (`src/app/api/...`)

The application defines **35 serverless API handlers**:

| Category | Endpoint Path | Supported HTTP Methods | Function & Purpose |
|---|---|---|---|
| **Auth** | `/api/auth/login` | `POST` | Authenticate email/password/PIN, set `pos_session` cookie |
| **Auth** | `/api/auth/logout` | `POST` | Destroy `pos_session` session cookie |
| **Auth** | `/api/auth/me` | `GET` | Return current logged-in staff profile & permissions |
| **POS** | `/api/pos/checkout` | `POST` | Create Transaction, update StockLevel, log InventoryLog |
| **POS** | `/api/pos/auth-pin` | `POST` | Validate manager/owner PIN for supervisor overrides |
| **POS** | `/api/pos/exchange-rate` | `GET`, `POST` | Fetch and update MMK/USD exchange rates |
| **Sales** | `/api/sales-orders` | `GET`, `POST` | Fetch combined SalesOrder/Transaction list & create SalesOrder |
| **Sales** | `/api/sales-orders/[id]` | `GET`, `PATCH`, `DELETE` | Order details, cancellation/refund, and status updates |
| **Delivery** | `/api/delivery` | `GET` | Fetch orders marked for delivery |
| **Delivery** | `/api/delivery/status` | `PATCH` | Advance delivery status & trigger automatic stock deduction |
| **Debt** | `/api/outstanding` | `GET` | Fetch sales orders with outstanding debt balances |
| **Debt** | `/api/outstanding/pay` | `POST` | Collect debt repayment, create OrderPayment, cap repayment |
| **Stock** | `/api/inventory` | `GET` | Fetch stock levels per branch |
| **Stock** | `/api/inventory/adjust` | `POST` | Perform manual stock adjustments with inventory audit log |
| **Stock** | `/api/inventory/transfer` | `POST` | Execute branch-to-branch inventory stock transfers |
| **Purchases**| `/api/purchase-orders` | `GET`, `POST`, `PATCH` | Manage PO draft, receiving goods, and MAC cost updates |
| **Purchases**| `/api/purchases` | `GET` | List received purchase transactions |
| **Purchases**| `/api/suppliers` | `GET`, `POST` | Manage vendor/supplier records |
| **Catalog** | `/api/products` | `GET`, `POST`, `PUT`, `DELETE` | Manage products and variant barcoding |
| **Catalog** | `/api/categories` | `GET`, `POST` | Manage product categories |
| **Staff** | `/api/staff` | `GET`, `POST`, `PUT`, `DELETE` | Manage staff accounts and branch assignment |
| **Staff** | `/api/staff/[id]/permissions`| `GET`, `PUT` | Fetch and update granular module read/write permissions |
| **Staff** | `/api/staff/sync` | `POST` | Sync external authentication data |
| **Admin** | `/api/branches` | `GET`, `POST` | Manage physical store branches |
| **Admin** | `/api/admin/seed` | `POST` | Seed demo data across all 4 branches |
| **Admin** | `/api/audit-logs` | `GET` | Retrieve system action audit logs |
| **Expenses** | `/api/expenses` | `GET`, `POST`, `DELETE` | Record and query store operational expenses |
| **Reports** | `/api/reports` | `GET` | Financial reports, revenue, COGS, and profit calculations |
| **Dashboard**| `/api/dashboard/stats` | `GET` | Real-time dashboard analytics metrics |
| **Dashboard**| `/api/dashboard/export` | `GET` | Export report data to CSV |
| **Misc** | `/api/customers` | `GET`, `POST` | Customer directory & credit line management |
| **Misc** | `/api/notifications` | `GET` | Low-stock and system alerts |
| **Misc** | `/api/schedule` | `GET`, `POST` | Staff scheduling |
| **Misc** | `/api/shifts/clock` & `logs`| `GET`, `POST` | Shift clock-in/clock-out tracking |
| **Misc** | `/api/upload` | `POST` | Image/file attachment upload endpoint |

---

## 3. Database Models & Prisma Schema Analysis

The database schema (`prisma/schema.prisma`) comprises **16 models** and **8 enums**:

### 3.1 Enumeration Types
1. `Role`: `OWNER`, `MANAGER`, `CASHIER`
2. `PaymentMethod`: `CASH`, `CARD`, `QR`, `SPLIT`, `DEBT`
3. `TransactionStatus`: `COMPLETED`, `VOIDED`, `REFUNDED`, `HELD`
4. `StockChangeReason`: `SALE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `PURCHASE_RECEIVED`, `SALES_ORDER_DELIVERED`
5. `PurchaseOrderStatus`: `DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED`
6. `ExpenseCategory`: `RENT`, `ELECTRICITY`, `WATER`, `SALARIES`, `SUPPLIES`, `OTHER`
7. `SalesOrderStatus`: `DRAFT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`
8. `PaymentStatus`: `PARTIAL`, `PAID`
9. `DeliveryStatus`: `PENDING`, `DELIVERED`

### 3.2 Data Models & Relationships

```
Branch 1 ───< Staff
  │    1 ───< StockLevel >─── 1 ProductVariant >─── 1 Product >─── 1 Category
  │    1 ───< InventoryLog
  │    1 ───< Transaction ───< TransactionItem
  │    1 ───< SalesOrder ───< SalesOrderItem
  │    │                   └──< OrderPayment
  │    1 ───< PurchaseOrder ───< PurchaseItem
  │    1 ───< Expense
  └────1 ───< ExchangeRate
```

#### Key Financial & Stock Data Invariants:
- **`StockLevel`**: Contains `branchId`, `variantId`, `quantity`. Key constraint: `@@unique([branchId, variantId])`. Enables atomic stock decrement/increment per branch.
- **`ProductVariant`**: Contains `costPrice` (used for Moving Average Costing - MAC calculation and cost price floor enforcement during sale checkout) and `barcode`.
- **`SalesOrder`**: Contains `subtotal`, `discount`, `total`, `amountPaid`, `paymentStatus`, `isDelivery`, `deliveryStatus`. Tracks deposit payments via `OrderPayment` ledger records.
- **`Transaction`**: POS fast-checkout sales record containing `totalInMMK`, `exchangeRate`, `items` (with `unitCost` snapshot at transaction time).

---

## 4. Authentication & Role-Based Access Control (RBAC) Architecture

### 4.1 Session & Token Handling
- Session data is stored in the **`pos_session`** `httpOnly` cookie.
- The cookie contains a serialized JSON string:
  ```json
  {
    "id": "staff_id_cuid",
    "email": "manager@store.com",
    "name": "Branch Manager",
    "role": "MANAGER",
    "branchId": "branch_id_cuid",
    "branchName": "Downtown Branch"
  }
  ```
- Client-side auth state is managed via `AuthProvider` (`src/providers/auth-provider.tsx`), which calls `/api/auth/me` on mount and exposes `useAuth()` and `useUser()` hooks.

### 4.2 Route Middleware (`src/middleware.ts`)
The edge middleware checks every incoming HTTP request:
- Public paths (`/sign-in`, `/access-denied`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, static assets) bypass verification.
- For all protected routes, if `pos_session` cookie is missing, request is redirected immediately to `/sign-in`.

### 4.3 UI Component & Navigation Guards
- **Dashboard Layout Guard (`src/app/(dashboard)/layout.tsx`)**: Executes client-side checks using `getModuleKeyForPath(pathname)` and `hasModuleReadPermission(user, moduleKey)`.
  - If a `CASHIER` attempts to navigate to restricted pages like `/reports` or `/staff`, they are automatically redirected to `/pos`.
  - Non-cashier users attempting unauthorized access are redirected to `/access-denied`.
- **Sidebar Rendering (`src/components/sidebar.tsx`)**: Nav items are dynamically filtered via `hasModuleReadPermission(user, item.moduleKey)`. Cashiers only see `POS`, `Outstanding`, and `Delivery` in their navigation sidebar.

### 4.4 Granular Module Permission Matrix (`src/lib/permissions.ts`)
System permissions cover **11 granular modules**: `dashboard`, `pos`, `inventory`, `salesOrders`, `outstanding`, `delivery`, `purchases`, `expenses`, `staff`, `reports`, `setup`.

| Module | OWNER Access | MANAGER Default | CASHIER Default |
|---|---|---|---|
| **`dashboard`** | Read + Write | Read + Write | **No Access** |
| **`pos`** | Read + Write | Read + Write | Read + Write |
| **`inventory`** | Read + Write | Read + Write | **No Access** |
| **`salesOrders`**| Read + Write | Read + Write | **No Access** |
| **`outstanding`**| Read + Write | Read + Write | Read + Write |
| **`delivery`** | Read + Write | Read + Write | Read + Write |
| **`purchases`** | Read + Write | Read + Write | **No Access** |
| **`expenses`** | Read + Write | Read + Write | **No Access** |
| **`staff`** | Read + Write | Read + Write (Branch isolated)| **No Access** |
| **`reports`** | Read + Write | Read + Write | **No Access** |
| **`setup`** | Read + Write | Read + Write | **No Access** |

#### Permission Invariants:
1. `OWNER` role **always** bypasses permission checks and has full read/write access across all modules and branches. Owner permissions cannot be modified.
2. `sanitizePermissions()` enforces that granting `write: true` automatically implies `read: true`.
3. `checkStaffPermission(staff, module, action, targetBranchId)` performs a 3-step check:
   - Step 1: `OWNER` bypass -> `allowed: true`.
   - Step 2: Branch boundary check -> If `targetBranchId` is set and `staff.branchId !== targetBranchId`, returns HTTP 403.
   - Step 3: Granular matrix check -> Evaluates `staff.permissions[module][action]`. Returns HTTP 403 if false.

---

## 5. Multi-Branch Data Isolation Mechanism

### 5.1 Branch Assignment & Schema Links
- Every `Staff` record is bound to a single `branchId`.
- Every operational data record (`StockLevel`, `InventoryLog`, `Transaction`, `SalesOrder`, `PurchaseOrder`, `Expense`, `ExchangeRate`) explicitly includes a `branchId` foreign key.

### 5.2 Server-Side Query & Mutation Scoping
In server-side API route handlers:
1. **Authenticated Staff Identification (`getAuthStaff(req)`)**: Resolves the user's role and `branchId`.
2. **Branch Restriction Enforcement**:
   - For `MANAGER` and `CASHIER`, queries are forcibly scoped:
     `where: { branchId: staff.branchId }`.
   - If a request explicitly supplies a query parameter or body payload with a different `branchId`, `checkStaffPermission` or explicit validation rejects the request with HTTP 403 (`Forbidden: Access is restricted to your assigned branch`).
3. **Cross-Branch Mutation Block**:
   - `PUT /api/staff/[id]/permissions`: Managers cannot view or edit staff outside their assigned branch.
   - `PATCH /api/delivery/status`: Managers/Cashiers cannot modify delivery status for orders belonging to another branch.
   - `POST /api/outstanding/pay`: Repayments can only be processed if the order belongs to the user's branch (or user is OWNER).
   - Stock movements (`StockLevel` upserts and `InventoryLog` creation) are strictly executed within the target branch context.

---

## 6. i18n Translation & Localization Architecture

### 6.1 Supported Languages & Provider
- Languages: English (`en`) and Myanmar (`my` / မြန်မာ).
- Implementation: Client-side React context provider (`src/providers/language-provider.tsx`).
- Helper function `t(en, my)`:
  ```typescript
  const t = (en: string, my: string) => (language === "my" ? my : en);
  ```

### 6.2 Hydration & Error Resilience
- **Hydration Safety**: The state defaults to `"en"` before mounting (`isMounted = false`). This guarantees that initial Server-Side Rendering (SSR) HTML matches the client's initial hydration pass, eliminating React hydration mismatch warnings.
- **Persistence**: Preference is stored in `localStorage.setItem("app-language", lang)`.
- **Fault Tolerance**:
  - Unrecognized values in `localStorage` fall back cleanly to `"en"`.
  - QuotaExceededError or SecurityError on `localStorage` access are caught in `try...catch` blocks without breaking UI rendering.
- **Unit Testing**: Verified by comprehensive unit test suite in `tests/unit/language-switcher.test.ts`.

### 6.3 Dual-Language Error Messaging & Raw Slash Prevention
- Backend API error responses concatenate English and Myanmar translations with a slash separator:
  - Example: `Forbidden: Access is restricted to your assigned branch / ဆိုင်ခွဲသီးသန့် ကန့်သတ်ထားပါသည်`
  - Example: `Incorrect PIN / ပင်နံပါတ်မှားယွင်းနေပါသည်`
- UI component strings pass explicit dual arguments to `t("English", "မြန်မာ")`. Because no external dictionary file lookup key is used, missing key errors or unrendered slash placeholders do not occur in UI components.

---
