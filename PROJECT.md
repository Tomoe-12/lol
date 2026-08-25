# Project: SMARTOS POS & Inventory Verification and Remediation

## Architecture
- Next.js 15 App Router (`src/app`), React 19, Prisma ORM 6.19 (`prisma/schema.prisma`), Tailwind CSS 4.
- Authentication via session cookie (`pos_session`) & `getAuthStaff(req)` helper.
- Role-Based Access Control (RBAC) enforced via `checkStaffPermission(staff, module, action, targetBranchId)` across 18 routes and 35 API handlers.
- Multi-tenant multi-branch model isolated by `branchId` foreign key and unique compound index `@@unique([branchId, variantId])` on `StockLevel`.
- Atomic database transactions via Prisma `$transaction` for stock deductions and `InventoryLog` audit logging.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Owner Full System Access | 100% full access across all 18 routes, pages, setup, reports, and staff permissions | M1 | R1 |
| 2 | Manager Branch Isolation | Strict branch isolation and blocking cross-branch operations | M1 | R1 / Survey Defect 1 |
| 3 | Manager Staff Permission Admin | Manager permission updates for same-branch Cashiers | M1 | R1 / Survey Defect 2 |
| 4 | Cashier Restricted Boundaries | Blocking Cashier from /staff, /reports, /inventory, /purchase-orders, /expenses, /setup, /dashboard (403) | M1 | R1 |
| 5 | POS Checkout & Split Payment | MMK cash + non-cash split payment calculation | M2 | R2 |
| 6 | Cost Price Protection | Effective selling price protection (selling price >= variant cost price) | M2 | R2 |
| 7 | MMK-Only Currency | All POS, order, expense, and delivery amounts are recorded in MMK | M2 | R2 |
| 8 | Sales Order Pre-Orders & Deposit | 10% minimum advance deposit validation for partial payment orders | M2 | R2 |
| 9 | Sales Order Confirmation & Refund | Confirmation stock check, cancellation refund capping, duplicate cancellation guard | M2 | R2 |
| 10 | Delivery Management | Order DELIVERED status transition to COMPLETED, physical stock deduction, zero double-deduction | M3 | R2 |
| 11 | Debt Collection Repayment Capping | Outstanding debt payment capped at remainingDebt (total - amountPaid) | M3 | R2 |
| 12 | Customer Ledger Updating | Updating customer balance ledgers on debt payment and sales orders | M3 | R2 |
| 13 | i18n Dual-Language Switcher | Dual-language switcher, SSR safety, localStorage persistence, localized string rendering | M3 | Survey Defect 3 & 4 |
| 14 | Atomic Stock & InventoryLog | StockLevel quantity updates paired atomically with InventoryLog entries | M4 | R2 |
| 15 | High-Concurrency Zero-Drift Audit | 100% mathematical zero-drift balance invariant under concurrent checkout load | M4 | R2 / Survey Defect 5 |
| 16 | Purchase Orders & MAC | Purchase Order receiving and Moving Average Cost (MAC) calculation | M4 | R2 |
| 17 | Cashier Assigned Branch Display & Scope | Cashier UI displays assigned branch instead of hardcoded 'Hledin branch'; sales transactions strictly scoped to assigned branch | M6 | R1 |
| 18 | Sales Voucher Product Card Details | Product cards in sales voucher view display price, stock level, variants matching catalog presentation with dynamic updates | M6 | R2 |
| 19 | Strict Language Toggle (EN / MY) | Remove all dual-slash strings across Sales Voucher, Branches, Suppliers, Sales Orders, Purchases, Expenses, Staff, Reports | M6 | R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | RBAC Access Boundaries & Security | Verify Owner/Manager/Cashier access boundaries across 18 routes & fix Manager cross-branch SO check & staff permission edit HTTP 403 bug | None | DONE |
| M2 | POS Checkout & Sales Order Lifecycle | Verify POS split payments, cost price bounds, MMK-only amounts, 10% min deposit, order confirmation & refund logic | M1 | DONE |
| M3 | Delivery, Debt Collection & i18n | Verify Delivery DELIVERED status stock deduction, debt repayment capping (`remainingDebt`), customer ledgers & fix i18n slashes | M1 | DONE |
| M4 | Zero-Drift Audit & Concurrency | Fix concurrency stock drift in POS checkout, verify Moving Average Cost, and 100% StockLevel vs InventoryLog balance | M2, M3 | DONE |
| M5 | Final E2E Suite & Adversarial Hardening | Execute full 13-suite test regression pass, pass E2E system suite, verify 0 defects, publish TEST_READY.md | M4 | DONE |
| M6 | Cashier Branch, Product Cards & Strict i18n | Cashier branch display & scoping, sales voucher product details, 100% strict English vs Burmese toggle across 8 core modules | M5 | IN_PROGRESS |


## Interface Contracts

### 1. Authorization Helper (`src/lib/auth-helper.ts`)
- `checkStaffPermission(staff: Staff, module: ModuleKey, action: "read" | "write", targetBranchId?: string)`
  - Returns `{ allowed: true }` if `staff.role === "OWNER"`.
  - Returns `{ allowed: false, errorResponse: NextResponse.json({ error: "Access denied..." }, { status: 403 }) }` if `targetBranchId` differs from `staff.branchId` or module action is unpermitted.

### 2. Staff Permission API (`src/app/api/staff/[id]/permissions/route.ts`)
- `PUT /api/staff/[id]/permissions`
  - Body: `{ permissions: Record<string, { read: boolean, write: boolean }> }`
  - Response 200: `{ staff: Staff }`
  - Response 403: If requester is `MANAGER` targeting staff in another branch OR targeting non-Cashier role. If requester is `CASHIER`, response 403.

### 3. POS Checkout API (`src/app/api/pos/checkout/route.ts`)
- `POST /api/pos/checkout`
  - Response 200: `{ transactionId, salesOrderId? }`
  - Response 400: Discount > subtotal or effective price < cost price.
  - Response 403: Cashier/Manager requesting unauthorized branch checkout.

### 4. Sales Orders API (`src/app/api/sales-orders/route.ts`)
- `POST /api/sales-orders`
  - Response 200: `{ id, status, amountPaid, ... }`
  - Response 403: Manager targeting `branchId !== staff.branchId`.

### 5. Outstanding Debt Payment API (`src/app/api/outstanding/pay/route.ts`)
- `POST /api/outstanding/pay`
  - Body: `{ orderId, amount, paymentMethod }`
  - Response 400: If `amount > remainingDebt`.

### 6. Delivery Status API (`src/app/api/delivery/status/route.ts`)
- `PATCH /api/delivery/status`
  - Body: `{ orderId, deliveryStatus }`
  - If `deliveryStatus === "DELIVERED"` and `existing.status !== "COMPLETED"`, atomic stock decrement + `InventoryLog` creation (`SALES_ORDER_DELIVERED`).

## Code Layout
- `src/app/(dashboard)/`: Page routes (`/dashboard`, `/pos`, `/sales-orders`, `/delivery`, `/outstanding`, `/inventory`, `/purchase-orders`, `/expenses`, `/reports`, `/staff`, `/setup`, etc.)
- `src/app/api/`: API route handlers (`auth/`, `pos/`, `sales-orders/`, `delivery/`, `outstanding/`, `staff/`, `inventory/`, `purchase-orders/`, `branches/`)
- `src/lib/`: Core helpers (`auth-helper.ts`, `permissions.ts`, `prisma.ts`)
- `src/providers/`: Context providers (`language-provider.tsx`)
- `prisma/`: Schema (`schema.prisma`) and Seeder (`seed.ts`)
- `tests/`: Integration & Unit test suites (`m1-rbac-multibranch-suite.test.ts`, `e2e-system-suite.test.ts`, `financial-inventory-integrity.test.ts`, `challenger-2-stress.test.ts`, `m3-challenger-empirical.test.ts`, etc.)
