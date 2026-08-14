## 2026-08-02T10:52:10Z
<USER_REQUEST>
You are Worker 1 for Milestone 2 of the E2E Test Suite project in C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon.
Your working directory is C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\teamwork_preview_worker_e2e_1.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task Scope & Deliverables:
1. Implement the comprehensive automated E2E integration test suite in `tests/integration/e2e-system-suite.test.ts`:
   - Phase 1: i18n & Display Assertions — assert language switching between English (`en`) and Burmese (`my`) maintains single-language display without raw slashes (`/`) or unhandled text, asserts `"app-language"` key persistence in `localStorage`, and tests exception resilience.
   - Phase 2: Multi-Branch & Role-Based Access Control Governance — assert multi-branch data isolation (independent branch `StockLevel`s) and RBAC permissions (Cashier 403 on non-POS routes, Manager locked to assigned branch, Owner multi-branch access).
   - Phase 3: Route & Endpoint Traversal — programmatically seed DB via `POST /api/admin/seed?secret=seed_now_please`, authenticate as OWNER (`owner@buyshopos.com`), and traverse all 14 core page routes (`/dashboard`, `/pos`, `/inventory`, `/setup`, `/suppliers`, `/customers`, `/sales-orders`, `/purchases`, `/purchase-orders`, `/expenses`, `/staff`, `/reports`, `/settings`, `/schedule`) plus public routes (`/`, `/sign-in`, `/sign-up`, `/access-denied`) and all 29 API endpoints. Assert all 14 dashboard page routes return status 200 OK without HTTP 500 errors or runtime crashes.
   - Phase 4: Financial & Inventory Lifecycle Traceability — programmatically execute and assert all 4 lifecycle scenarios:
     1. Supplier Purchase Order -> Purchase Receipt -> Stock Increase & Moving Average Cost (MAC) update.
     2. POS Sales Voucher Checkout -> Stock Decrease & Revenue Ledger entry.
     3. Sales Order creation -> Customer Balance & Stock Allocation.
     4. Expense logging -> Financial Summary reports update.
     Assert 100% mathematical precision on Stock Levels, Cost Prices, Revenue, Expenses, and Customer Balances.
   - Phase 5: POS Checkout Concurrency & Stress Attack — test concurrent POS checkouts and assert zero stock leaks or race conditions.
   - Phase 6: System-Wide Forensic Zero-Drift Balance Audit — assert stock equation `StockLevel.quantity == Initial + PO - POS - SO_Completed + SO_Cancelled` and order payment ledger balance across 100% of orders.

2. Fix key and enum mismatches in existing test scripts:
   - Fix `tests/unit/language-switcher.test.ts`: change mock storage key from `"language"` to `"app-language"`.
   - Fix `tests/integration/financial-inventory-integrity.test.ts`: replace invalid `SalesOrderStatus` enum strings (`"DELIVERED"`) with valid schema enum values (`CONFIRMED`, `COMPLETED`, `CANCELLED`).
   - Fix `tests/integration/challenger-stress-test.test.ts`: replace invalid `SalesOrderStatus` enum strings (`"DRAFT"`) with valid schema enum values (`CONFIRMED`, `COMPLETED`, `CANCELLED`).

3. Package Scripts & Execution:
   - Add `"test:e2e": "npx tsx tests/integration/e2e-system-suite.test.ts"` to `package.json`.
   - Run `npm run test:e2e`, `npm run test:integrity`, `npm run test:challenger`, `npm run test:language`, and `npm run build`.
   - Ensure all 4 test commands pass 100% and `npm run build` completes with 0 errors across all routes.

Document all completed changes, test outputs, build output, and verification results in `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\teamwork_preview_worker_e2e_1\handoff.md` and send a message back to parent (ID: 623d5a15-cd27-421c-addb-9972fe797fc9).
</USER_REQUEST>
