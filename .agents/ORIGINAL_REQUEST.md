# Original User Request

## Initial Request — 2026-08-10T10:57:32Z

Execute an exhaustive multi-role and end-to-end business flow verification across the SMARTOS Point of Sale & Inventory application, validating all actions for Owner, Manager, and Cashier roles across all branches.

Working directory: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`
Integrity mode: development

## Requirements

### R1. Role & Permission Access Boundaries (Owner, Manager, Cashier)
- Validate that **Owner** has 100% full access across all branches, pages, reports, setup, and staff permission settings.
- Validate that **Manager** is strictly branch-isolated to their assigned branch, and blocked with HTTP 403 Forbidden from editing staff permissions for staff outside their branch.
- Validate that **Cashier** is strictly restricted to POS, Delivery, and Outstanding, and blocked with HTTP 403 Forbidden from accessing staff administration, reports, inventory adjustments, purchase orders, expenses, branch settings, and dashboard stats.

### R2. Complete Business Lifecycle Verification
- Validate end-to-end POS checkout, split payment calculations, minimum selling price protection against cost prices, exchange rate conversions, and immediate stock deductions.
- Validate Sales Orders lifecycle: Draft pre-orders, confirmation, partial payments, initial advance deposit tracking, cancellation refund prompts, and delivery link.
- Validate Delivery Management: Marking orders as DELIVERED in `/delivery` updates status to COMPLETED and triggers immediate physical stock deduction with `InventoryLog` audit entries.
- Validate Debt Collection: Capping repayment input to remaining balance and updating customer balance ledgers.
- Validate Inventory & Financial Zero-Drift Audit across all StockLevels vs InventoryLog ledgers.

## Acceptance Criteria

### Role & Access Control Criteria
- [ ] Logged-in OWNER accesses all 18 routes, manages all branches, and updates staff permissions without error.
- [ ] Logged-in MANAGER attempting cross-branch mutations or unassigned staff permission edits receives HTTP 403 Forbidden.
- [ ] Logged-in CASHIER attempting to load `/staff`, `/reports`, `/inventory`, `/purchase-orders`, `/expenses`, or `/setup` is blocked with HTTP 403 Forbidden.

### Business & Inventory Flow Criteria
- [ ] Completing a POS checkout immediately decrements variant stock levels and logs a `SALE` entry.
- [ ] Confirming a Sales Order with delivery attaches customer details and lists the order under `/delivery`.
- [ ] Marking a Sales Order as `DELIVERED` transitions status to `COMPLETED` and decrements physical stock levels with `SALES_ORDER_DELIVERED` inventory log.
- [ ] Repayment amount in `/outstanding` cannot exceed `remainingDebt`.
- [ ] Zero-Drift Audit verifies 100% mathematical balance between StockLevels and InventoryLogs.

## Follow-up — 2026-08-12T14:13:00Z

Fix cashier branch assignment, sales voucher product card details, and clean up English/Burmese language toggle across all major tables and reports.

Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Integrity mode: development

## Requirements

### R1. Cashier Assigned Branch Display
When a user logs in as a cashier, the branch filter/display must reflect the specific branch assigned to that cashier user profile rather than hardcoding or defaulting to "Hledin branch".

### R2. Sales Voucher Product Card Details
In the sales voucher view, enrich the product cards to display essential product details directly on the card (e.g., current stock level, price, and relevant variants), matching the visual presentation used in the product catalog.

### R3. Strict Language Toggle (English vs. Burmese i18n)
Remove dual slash text (e.g. "English / Burmese" or "Name (မြန်မာ)") and strictly render ONLY English OR Burmese based on the active language toggle state across:
- Sales Voucher
- Branches Table
- Supplier Table
- Sales Order Table
- Purchases & Purchase Orders Tables
- Expenses Table
- Staff Table
- Reports

## Acceptance Criteria

### Cashier Branch Routing & Filtering
- Logging in as a cashier assigned to Branch X displays Branch X in the UI header/dashboard context instead of "Hledin branch".
- Sales transactions recorded by the cashier are strictly scoped to their assigned branch.

### Sales Voucher Product UI
- Product cards in the Sales Voucher grid visually display price and current available stock count.
- Product details update dynamically when stock or price changes.

### i18n Language Toggle Behavior
- Toggling language switch to "English" displays 100% English text across Sales Voucher, Branches, Suppliers, Sales Orders, Purchases, Expenses, Staff, and Reports.
- Toggling language switch to "Burmese" (Myanmar) displays 100% Burmese text across all specified modules without un-translated combined strings.
- No UI elements retain fallback dual labels like "Text / မြန်မာ".

