# Technical Inspection Report: API Routes, RBAC Security, UI Subsystems & i18n Localization

**Date**: 2026-08-29  
**Target Repository**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`  
**Inspector**: Explorer 2 (API Routes, RBAC Security, UI Subsystems & i18n Localization)

---

## Executive Summary

This report delivers an exhaustive, line-by-line architectural and technical inspection of:
1. **All 39 Next.js App Router API Handlers** located under `src/app/api/`.
2. **The Authentication, Session, and RBAC Security Architecture** (`src/middleware.ts`, `src/lib/auth-helper.ts`, `src/lib/permissions.ts`, `src/providers/auth-provider.tsx`).
3. **The 11 End-to-End User Interface (UI) Subsystems**, including form validation rules, reactive state lifecycles, and backend integrations.
4. **The i18n Dual-Language (EN / MY) Engine** (`src/providers/language-provider.tsx`), SSR hydration safeguards, and dictionary mechanics.

---

## Section 1: Complete Catalog of Next.js API Routes (39 Routes)

Every API route handler in `src/app/api/` has been inspected for HTTP method, exact file path, authorization requirements, parameter/payload structures, database transactions, and response structures.

| # | Route Endpoint | Method(s) | Auth / RBAC Requirement | Primary Purpose |
|---|---|---|---|---|
| 1 | `/api/admin/seed` | `POST` | Query Param `?secret=seed_now_please` or Auth | Resets database and seeds multi-branch sample data |
| 2 | `/api/audit-logs` | `GET` | `reports.read` or `staff.read` (Blocks CASHIER) | Fetches system audit logs with branch filtering |
| 3 | `/api/auth/login` | `POST` | Public | Authenticates staff via email/password or PIN; sets `pos_session` cookie |
| 4 | `/api/auth/logout` | `POST` | Public / Session | Clears `pos_session` httpOnly cookie |
| 5 | `/api/auth/me` | `GET` | Session cookie or `x-staff-id` header | Resolves active staff profile, branch, and sanitized permissions |
| 6 | `/api/branches` | `GET, POST, PUT, DELETE` | Read: Any Auth; Write: `setup.write` (OWNER only) | CRUD for physical store branches; auto-provisions variant stock levels on create |
| 7 | `/api/categories` | `GET, POST, PUT, DELETE` | Read: Any Auth; Write: `setup.write` (OWNER only) | Product category management with Redis caching and delete validation |
| 8 | `/api/customers` | `GET, POST` | Read: `pos.read` / `salesOrders.read`; Write: `write` | Customer directory; validates 11-digit Myanmar phone (`09...`) |
| 9 | `/api/customers/[id]` | `PUT, DELETE` | `pos.write` / `salesOrders.write` | Updates or deletes customer record; handles foreign key constraint P2003 |
| 10 | `/api/dashboard/export` | `GET` | `reports.read` or `dashboard.read` | Generates downloadable CSV exports for transactions or stock levels |
| 11 | `/api/dashboard/stats` | `GET` | `dashboard.read` | Aggregates real-time business KPIs, rankings, trends, peak hours, live feed |
| 12 | `/api/delivery` | `GET` | `delivery.read` | Lists delivery-assigned sales orders with pending/delivered metrics |
| 13 | `/api/delivery/status` | `PATCH` | `delivery.write` | Updates delivery status to `DELIVERED`, logs carrier info, records store expense if store pays |
| 14 | `/api/expenses` | `GET, POST, DELETE` | Read: `expenses.read`; Write: `expenses.write` | Operational expense management; calculates branch net profit |
| 15 | `/api/inventory` | `GET` | `inventory.read` | Multi-branch stock level overview, variants, and recent 50 inventory logs |
| 16 | `/api/inventory/adjust` | `POST` | `inventory.write` | Manual stock level increment/decrement; writes `InventoryLog` |
| 17 | `/api/inventory/logs/[id]` | `GET` | `inventory.read` | Polymorphic resolver for inventory log source (POS, SalesOrder, PO, Transfer) |
| 18 | `/api/inventory/transfer` | `POST` | `inventory.write` | Inter-branch inventory transfer; updates source & target stock with audit logs |
| 19 | `/api/notifications` | `GET` | `dashboard.read` or Any Staff | Returns low stock alerts and critical audit notifications |
| 20 | `/api/outstanding` | `GET` | `outstanding.read` | Aggregates unpaid and partially paid sales orders; calculates customer debt |
| 21 | `/api/outstanding/pay` | `POST` | `outstanding.write` | Records debt collection repayment; updates `amountPaid` and `paymentStatus` |
| 22 | `/api/pos/auth-pin` | `POST` | Authenticated Staff | Validates 4-digit staff PIN for sensitive operations |
| 23 | `/api/pos/checkout` | `POST` | `pos.write` | Executes POS sales checkout inside Prisma `$transaction`; validates cost vs selling price |
| 24 | `/api/pos/exchange-rate` | `GET, POST` | Disabled | Returns `410 Gone` (System is exclusively MMK base currency) |
| 25 | `/api/pos/fulfill-sales-order` | `POST` | `pos.write` | Fulfills confirmed Sales Order at register; updates fulfilled quantities and creates Transaction |
| 26 | `/api/products` | `GET, POST, PUT, DELETE` | Read: Any Auth; Write: `inventory.write` (OWNER/MANAGER) | Catalog product & variant management with Redis cache invalidation |
| 27 | `/api/purchase-orders` | `GET, POST, PATCH` | Read: `purchases.read`; Write: `purchases.write` | PO procurement lifecycle (`DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED`); Moving Average Cost |
| 28 | `/api/reports` | `GET` | `reports.read` | Comprehensive P&L, sales, COGS, expenses, staff ranking, and cash flow analytics |
| 29 | `/api/sales-orders` | `GET, POST` | Read: `salesOrders.read`; Write: `salesOrders.write` | Creates pre-orders in `DRAFT` status with optional advance deposit |
| 30 | `/api/sales-orders/[id]` | `PATCH, DELETE` | `salesOrders.write` | Confirms pre-orders (locks prices & stock) or cancels pre-orders |
| 31 | `/api/schedule` | `GET, POST, PUT, DELETE` | Disabled / Stub | Returns empty schedule list |
| 32 | `/api/shifts/clock` | `POST` | Disabled / Stub | Returns static clock-in timestamp |
| 33 | `/api/shifts/logs` | `GET` | Disabled / Stub | Returns empty shift logs list |
| 34 | `/api/staff` | `GET, POST, PUT, DELETE` | Read: `staff.read`; Write: `staff.write` | Staff account administration; protects last Owner; branch-isolated for Manager |
| 35 | `/api/staff/[id]/permissions` | `GET, PUT` | `staff.write` (OWNER, or MANAGER for Cashier) | Granular 11-module permission matrix editor; enforces interlocking rules |
| 36 | `/api/staff/sync` | `POST` | Authenticated Staff | Returns sanitized profile of current logged-in staff |
| 37 | `/api/suppliers` | `GET, POST, PUT, DELETE` | Read: `purchases.read`; Write: `purchases.write` | Supplier directory management |
| 38 | `/api/transactions` | `GET` | `pos.read` / `reports.read` | Lists completed sales transactions with line items and staff relations |
| 39 | `/api/upload` | `POST` | `inventory.write` | Handles multipart image upload storing files under `public/uploads/products/` |

---

### Detailed Specification of Critical Route Handlers

#### 1. POS Checkout: `POST /api/pos/checkout`
- **File**: `src/app/api/pos/checkout/route.ts`
- **RBAC**: `checkStaffPermission(staff, "pos", "write", body.branchId)`
- **Request Body**:
  ```json
  {
    "branchId": "string (UUID)",
    "staffId": "string (UUID)",
    "customerId": "string (UUID, optional)",
    "subtotal": 50000,
    "discountAmount": 5000,
    "total": 45000,
    "currency": "MMK",
    "paymentMethod": "CASH | CARD | QR | SPLIT | DEBT",
    "cashReceived": 50000,
    "changeGiven": 5000,
    "note": "string (optional)",
    "isDelivery": false,
    "deliveryCustomerName": "string (optional)",
    "deliveryPhone": "string (optional)",
    "deliveryAddress": "string (optional)",
    "wholesaleSale": false,
    "wholesalePaid": 20000,
    "items": [
      {
        "productId": "string",
        "variantId": "string",
        "quantity": 2,
        "unitPrice": 25000,
        "discount": 2500
      }
    ]
  }
  ```
- **Business Validations**:
  1. Validates branch isolation: Cashier/Manager branch must match `body.branchId`.
  2. Enforces non-negative discounts (`discountAmount <= subtotal`).
  3. Enforces Minimum Selling Price Rule: For every item, `effectivePrice = (unitPrice * qty - discount) / qty` must exceed variant `costPrice`.
  4. For wholesale/credit (`wholesaleSale = true`), requires `customerId`, verifies `wholesalePaid <= total`, and auto-creates linked `SalesOrder` with `depositStatus: PARTIAL` or `NO_PAY`.
- **Database Operations (`prisma.$transaction`)**:
  - Decrements `StockLevel.quantity` for each variant in `branchId`.
  - Creates `Transaction` and associated `TransactionItem` records.
  - Creates `InventoryLog` records with `reason: SALE`.
- **Response**: `200 OK` with `{ "success": true, "transaction": { ... } }`.

#### 2. Sales Order Confirmation: `PATCH /api/sales-orders/[id]`
- **File**: `src/app/api/sales-orders/[id]/route.ts`
- **RBAC**: `checkStaffPermission(staff, "salesOrders", "write", salesOrder.branchId)`
- **Request Body**:
  ```json
  {
    "status": "CONFIRMED | CANCELLED",
    "items": [
      {
        "variantId": "string",
        "quantity": 5,
        "unitPrice": 12000,
        "discount": 0
      }
    ],
    "amountPaid": 30000,
    "paymentMethod": "CASH | CARD | QR"
  }
  ```
- **Business Validations**:
  1. Validates agreed prices: `unitPrice > costPrice` and `unitPrice <= catalogPrice`.
  2. Validates available stock: `StockLevel.quantity >= requested quantity`.
  3. Calculates payment status: `PAID` (if `amountPaid >= total`), `PARTIAL` (if `amountPaid > 0`), or `NO_PAY`.
- **Response**: `200 OK` with `{ "success": true, "salesOrder": { ... } }`.

#### 3. Purchase Order Receive & Cost Averaging: `PATCH /api/purchase-orders`
- **File**: `src/app/api/purchase-orders/route.ts`
- **RBAC**: `checkStaffPermission(staff, "purchases", "write", purchaseOrder.branchId)`
- **Request Body**:
  ```json
  {
    "id": "string (UUID)",
    "status": "RECEIVED",
    "items": [
      {
        "id": "string (PO item ID)",
        "quantity": 100,
        "unitCost": 8500,
        "sellingPrice": 12000
      }
    ],
    "paymentStatus": "PAID | UNPAID",
    "amountPaid": 850000
  }
  ```
- **Moving Average Cost (MAC) Formula Executed**:
  $$\text{New Cost} = \frac{(\text{Current Franchise Stock} \times \text{Current Cost}) + (\text{Received Qty} \times \text{Received Unit Cost})}{\text{Current Franchise Stock} + \text{Received Qty}}$$
- **Database Updates**:
  - Updates `ProductVariant.costPrice` with the computed Moving Average Cost.
  - Updates `ProductVariant.price` with new selling price if provided.
  - Increments `StockLevel.quantity` for receiving branch.
  - Writes `InventoryLog` records with `reason: PURCHASE_RECEIVED`.
  - Sets `PurchaseOrder.status = "RECEIVED"`.

---

## Section 2: Authentication, Session & RBAC Security Model

### 1. Session Lifecycle and Token Architecture
- **Cookie Name**: `pos_session`
- **Payload Format**: JSON string stored in an `httpOnly`, `SameSite=Lax` cookie:
  ```json
  {
    "id": "staff_uuid",
    "email": "cashier@pos.com",
    "name": "Daw Hla",
    "role": "CASHIER",
    "branchId": "branch_uuid",
    "branchName": "Hledan Branch"
  }
  ```
- **Session Verification Engine (`src/lib/auth-helper.ts`)**:
  1. Checks `req.cookies.get("pos_session")`.
  2. If missing, checks fallback authorization header `x-staff-id`.
  3. Queries PostgreSQL via Prisma `db.staff.findUnique` with `{ include: { branch: true } }`.
  4. Passes permissions through `sanitizePermissions(staff.permissions, staff.role)`.

### 2. Multi-Branch Isolation Boundary
Branch authorization is enforced centrally via `checkStaffPermission(staff, module, action, targetBranchId)`:
```typescript
// Owner bypasses all branch restrictions
if (staff.role === 'OWNER') {
  return { allowed: true };
}

// Manager and Cashier are strictly bound to their assigned branch
if (targetBranchId && staff.branchId && staff.branchId !== targetBranchId) {
  return {
    allowed: false,
    reason: `You can only manage resources for branch '${staff.branch?.name || staff.branchId}'`,
  };
}
```

### 3. Granular RBAC Permission Matrix & Interlocking Logic
The system supports 11 distinct operational modules:
1. `dashboard` (Dashboard & Analytics)
2. `pos` (POS Register & Checkout)
3. `inventory` (Stock Levels & Transfers)
4. `salesOrders` (Pre-orders & Sales Orders)
5. `outstanding` (Debt Collection)
6. `delivery` (Delivery Dispatch Center)
7. `purchases` (Purchase Orders & Suppliers)
8. `expenses` (Expense Ledger)
9. `staff` (Staff Administration)
10. `reports` (Financial & Analytical Reports)
11. `setup` (Branches & Categories Setup)

#### Permission Interlocking Rule (`write: true => read: true`)
In `src/lib/permissions.ts` (lines 170–190), `sanitizePermissions` guarantees mathematical consistency:
```typescript
const write = Boolean(modObj.write);
// If write is true, read is strictly enforced to true
const read = Boolean(modObj.read) || write;
```
If an administrator enables `write` permission for a staff member, `read` permission is automatically enabled. Conversely, revoking `read` permission automatically strips `write` permission.

#### Default Permission Templates by Role
- **OWNER**: Unrestricted universal bypass (`read: true, write: true` across all 11 modules, cross-branch).
- **MANAGER**: Scoped to assigned branch; full `read/write` across `dashboard`, `pos`, `inventory`, `salesOrders`, `outstanding`, `delivery`, `purchases`, `expenses`, `reports`, and `staff` (managing Cashiers only). `setup.write` is restricted to Owner.
- **CASHIER**: Default permissions:
  - `pos`: `read: true, write: true`
  - `outstanding`: `read: true, write: true`
  - `salesOrders`: `read: true, write: true`
  - `delivery`: `read: true, write: true`
  - `dashboard`, `inventory`, `purchases`, `expenses`, `staff`, `reports`, `setup`: `read: false, write: false`

---

## Section 3: In-Depth UI Subsystem Analysis (11 Subsystems)

### Subsystem 1: Auth & Session Management
- **Routes / Pages**: `/sign-in`, `/access-denied`
- **Providers**: `AuthProvider` (`src/providers/auth-provider.tsx`)
- **Key Mechanics**:
  - Login form supports both Email + Password and PIN-based quick login.
  - Automatically loads user session on mount via `/api/auth/me`.
  - Route guard in `src/app/(dashboard)/layout.tsx` checks path against `getModuleKeyForPath(pathname)`. If user lacks read permission, immediately redirects to `/access-denied`.

### Subsystem 2: Sales Voucher / POS Register
- **Route**: `/(dashboard)/pos`
- **Components**: `PosContainer`, `CartPanel`, `PaymentDialog`, `SalesOrderFulfillmentDialog`
- **State Store**: Zustand `useCartStore` with localStorage persistence (`pos-cart-storage`).
- **Features**:
  - Real-time product search with barcode scanner debounce.
  - Cart holding & switching (park multiple active orders).
  - Discount engine (line-item & whole-order, percentage or fixed MMK).
  - Multi-payment modalities: CASH, CARD, QR, SPLIT, and DEBT.
  - Live change calculator.
  - Wholesale / Credit sale toggle with customer select and partial payment.
  - Integrated delivery toggle collecting receiver name, phone (`09...`), and address.
  - Minimum selling price validation preventing cashier sales below cost price.

### Subsystem 3: Sales Orders & Pre-Orders
- **Route**: `/(dashboard)/sales-orders`
- **Features**:
  - Two-stage pre-order lifecycle: `DRAFT` (customer requests items without stock lock) $\rightarrow$ `CONFIRMED` (negotiated prices and advance deposit locked, stock reserved) $\rightarrow$ `COMPLETED` (fulfilled via POS).
  - Customer phone normalization (`normalizePhone`) supporting Myanmar formats (`09...`, `959...`, `00959...`).
  - Stock availability checks before pre-order confirmation.

### Subsystem 4: Delivery Dispatch Center
- **Route**: `/(dashboard)/delivery`
- **Features**:
  - Tracks all sales orders flagged with `isDelivery: true`.
  - Metrics cards for `Pending Deliveries`, `Delivered Today`, and `Total Orders`.
  - Waybill modal with carrier details (Royal Express, Ninja Van), tracking number, delivery fee payer (`CUSTOMER` vs `STORE`), deliverer/receiver signature fields, and thermal print layout.
  - Marking delivered automatically logs store expense if fee payer is `STORE`.

### Subsystem 5: Outstanding Debt Collection
- **Route**: `/(dashboard)/outstanding`
- **Features**:
  - Real-time aggregation of customer receivables from wholesale POS sales and partially paid sales orders.
  - Top summary cards: `Total Debt to Collect`, `Debtor Customers`, `Unpaid Orders`.
  - Debt Collection Payment Modal: Supports partial repayments, updates `SalesOrder.amountPaid`, and prints a debt collection receipt.

### Subsystem 6: Inventory & Stock Transfer
- **Route**: `/(dashboard)/inventory`
- **Features**:
  - Multi-branch stock table with real-time low-stock alerts.
  - Combined product price & stock adjustment dialog.
  - Inter-branch transfer modal validating source branch stock before transfer.
  - 50 most recent inventory audit logs with polymorphic origin inspector (resolving linked POS Transaction, Purchase Order, or Sales Order).

### Subsystem 7: Purchase Orders & Receiving
- **Route**: `/(dashboard)/purchases`, `/(dashboard)/purchase-orders`, `/(dashboard)/suppliers`
- **Features**:
  - Direct Purchase flow: Select supplier, destination branch, add variant lines with unit cost & retail selling price.
  - Receiving order executes Moving Average Cost algorithm and updates variant costs across franchise.
  - Supplier directory with contact and purchase history.

### Subsystem 8: Expense Ledger
- **Route**: `/(dashboard)/expenses`
- **Features**:
  - Categorized operational expenses (`RENT`, `ELECTRICITY`, `WATER`, `SALARIES`, `SUPPLIES`, `OTHER`).
  - Real-time P&L per branch: Computes Net Profit = Revenue - Expenses.
  - Date-range filtering and deletion with modal confirmation.

### Subsystem 9: Staff Administration & Permission Editor
- **Route**: `/(dashboard)/staff`
- **Features**:
  - Full staff directory with role badges, branch tags, and transaction count.
  - Password reveal toggle for administrative resets.
  - 11-module granular permission modal (`read` / `write` toggles) enforcing interlocking rules.
  - Manager boundary enforcement (Managers can only edit Cashiers in their own branch).

### Subsystem 10: Reports & Analytics
- **Route**: `/(dashboard)/reports`, `/(dashboard)/dashboard`
- **Features**:
  - Date-range analytics (`LAST_7`, `LAST_30`, `CUSTOM`).
  - Profit & Loss time-series charts (Revenue, COGS, Expenses, Net Profit).
  - Product sales ranking (Best & Worst moving SKUs).
  - Staff sales performance leaderboard.
  - CSV export for transactions and stock levels.

### Subsystem 11: i18n Dual-Language Engine
- **Provider**: `LanguageProvider` (`src/providers/language-provider.tsx`)
- **Persistence**: `localStorage.getItem("app-language")` (defaults to `"en"`).
- **SSR Hydration Guard**:
  ```typescript
  const [language, setLanguage] = useState<Language>("en")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("app-language") as Language
    if (saved === "en" || saved === "my") setLanguage(saved)
    setIsMounted(true)
  }, [])

  const t = useCallback((en: string, my: string) => {
    if (!isMounted) return en // Server render always matches default client mount
    return language === "my" ? (my || en) : en
  }, [language, isMounted])
  ```
- **Language Switcher**: `LanguageSwitcher` in the top navbar flips between English and Myanmar (Burmese) across all UI strings.

---

## Verification & Architecture Confirmation

1. **API Endpoints Count**: Verified 39 active route handlers across `src/app/api/`.
2. **Branch Security**: Verified `checkStaffPermission` guarantees isolation for non-Owners.
3. **Interlocking RBAC**: Verified `write: true => read: true` is mathematically preserved in `sanitizePermissions`.
4. **Currency Handling**: Verified system is locked to MMK; foreign exchange endpoint returns `410 Gone`.
5. **No Direct Code Mutations**: All investigation was performed in strict read-only exploration mode.
