# Original User Request

## Initial Request — 2026-08-10T00:57:25Z

Perform a comprehensive system audit and end-to-end test suite validation to verify that every workflow (POS, Sales Orders, Delivery, Outstanding Debt, Inventory, Purchases, Expenses, Staff Permissions, and Reports) operates with 100% financial and inventory mathematical correctness across all 4 branches.

Working directory: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`
Integrity mode: development

## Requirements

### R1. Comprehensive Multi-Workflow Automated Integration Test Suite
- Write an automated integration test suite (using `npx tsx`) that programmatically simulates full business lifecycles:
  1. **POS Flow**: Add to cart, cash/card/QR/split payments, discount validations, cost price checks, stock deduction, exchange rate conversion.
  2. **Sales Orders Flow**: Draft order creation, partial deposit payment, order confirmation, cancellation & refund calculation.
  3. **Delivery Flow**: Marking order as delivered, verifying automatic stock deduction upon delivery, customer info linking.
  4. **Outstanding Debt Flow**: Repayment collection capping, debt balance updates, customer ledger tracking.
  5. **Inventory & Stock Flow**: Purchase Order receiving, Moving Average Cost (MAC) calculations, stock adjustments, branch transfers.
  6. **Expenses & Staff Permissions**: Expense logging, role-based tab access control, branch isolation checks.

### R2. Financial & Inventory Leak Prevention
- Programmatically verify that no money is duplicated, lost, or miscalculated.
- Programmatically verify that physical stock balances match expected initial stock minus sales plus purchases across all 4 branches.

### R3. Zero-Failure System Verification
- Ensure all API endpoints and Next.js page components compile without runtime errors (`npm run build` exits with code 0).

## Acceptance Criteria

### Integration & System Health
- [ ] Automated integration test suite executes across all 6 core business flows.
- [ ] Programmatic assertions confirm 100% mathematical accuracy for total cost, revenue, debt remaining, and stock levels.
- [ ] No double-deduction or missing stock logs occur when transitioning Sales Orders to Delivery status.
- [ ] Repayment inputs in `/outstanding` cannot exceed remaining debt.
- [ ] Full production build (`npm run build`) compiles cleanly with exit code 0.

## Follow-up — 2026-08-09T18:28:50Z

# Teamwork Project Prompt — Full System Multi-Role Validation & Testing Suite

Perform a comprehensive system audit and automated integration test suite validating every business flow across OWNER, MANAGER, and CASHIER roles.

Working directory: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`
Integrity mode: development

## Requirements

### R1. Comprehensive Multi-Role Integration & RBAC Test Suite
- Write and execute an automated test runner script that programmatically tests all system pages and API endpoints.
- Validate role boundaries:
  - OWNER: Full read/write access across all branches and modules (Staff permissions, Reports, Setup, POS, Inventory, Purchases, Delivery, Expenses).
  - MANAGER: Read/write access within their assigned branch, unable to modify staff permissions or access unassigned branches.
  - CASHIER: POS access only, strictly blocked (HTTP 403 / UI redirected) from accessing Staff, Reports, Setup, or editing permissions.

### R2. End-to-End Business Flow Integrity Verification
- Simulate complex multi-step transaction lifecycles and verify zero money/stock leaks:
  1. POS Voucher Checkout: Verify price calculations, discounts, split payments, delivery checkbox toggle, stock reduction, and immediate transaction ledger visibility.
  2. Sales Orders & Delivery Lifecycle: Create Sales Order -> Partial Advance Payment -> Mark as Delivered in /delivery -> Verify automatic stock reduction and debt ledger update in /outstanding.
  3. Debt Collection: Record debt repayment in /outstanding -> Ensure input capping preventing overpayment -> Verify customer balance update.
  4. Purchase Orders & Inventory: Create PO -> Receive Goods -> Verify automatic Stock Increase and Moving Average Cost (MAC) update.
  5. Order Cancellation & Refund: Initiate Sales Order Cancellation with partial deposit -> Verify mandatory refund prompt and stock return.

### R3. Multi-Branch Isolation & i18n Verification
- Assert multi-branch data isolation: Managers and Cashiers cannot read or mutate data belonging to other branches.
- Verify language toggle (EN / မြန်မာ): Ensure single-language display without raw slashes or unhandled translation keys.

## Acceptance Criteria

### Verification & Test Suite Execution
- [ ] Automated integration test runner completes 100% successfully without any failing tests or unhandled exceptions.
- [ ] Role-Based Access Control (RBAC) tests confirm OWNER has full access, MANAGER is isolated to their branch, and CASHIER is blocked from restricted modules.
- [ ] Financial and Stock calculations balance 100% accurately across all simulated lifecycles (POS Sale, Sales Order Delivery, Debt Repayment, Purchase Order Receipt).
- [ ] Application compiles cleanly with npm run build (Exit Code 0).

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


