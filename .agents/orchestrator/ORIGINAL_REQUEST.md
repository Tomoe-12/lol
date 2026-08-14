# Original User Request

## 2026-08-02T10:47:44Z

<USER_REQUEST>
# Teamwork Project Prompt — Full Application E2E Test Suite

Perform a comprehensive end-to-end integration test suite across all 14 pages and API endpoints in the system.

Working directory: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`
Integrity mode: development

Requirements:
R1. Full End-to-End System Integration Test Suite:
- Traverses every main page route: `/dashboard`, `/pos`, `/inventory`, `/setup`, `/suppliers`, `/customers`, `/sales-orders`, `/purchases`, `/purchase-orders`, `/expenses`, `/staff`, `/reports`, `/settings`.
- Verify every route loads smoothly without HTTP 500 errors, broken React states, or missing data.

R2. Financial & Inventory Lifecycle Traceability:
- Simulate complex business transaction lifecycle scenarios:
  1. Supplier Purchase Order -> Purchase Receipt -> Stock Increase & Moving Average Cost (MAC) update.
  2. POS Sales Voucher Checkout -> Stock Decrease & Revenue Ledger entry.
  3. Sales Order creation -> Customer Balance & Stock Allocation.
  4. Expense logging -> Financial Summary reports update.

R3. Burmese & English i18n & Multi-Branch Verification:
- Assert language switching between English (`en`) and Burmese (`my`) maintains single-language display without raw slashes or unhandled text strings.
- Verify multi-branch data isolation and permissions across all ledger views.

Acceptance Criteria:
- Automated integration test script runs against all 14 pages and API endpoints.
- All 14 page routes return status 200 and render without runtime crashes.
- Programmatic assertions verify Stock Levels, Cost Prices, Revenue, and Expenses balance 100% accurately across the lifecycle test.
- Burmese and English language toggle states render valid strings across all tested modals and ledger views.
- Application builds 100% cleanly (`npm run build`) with zero linting or compilation errors.
</USER_REQUEST>
