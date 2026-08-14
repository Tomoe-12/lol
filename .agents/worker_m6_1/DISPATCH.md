## 2026-08-12T20:51:12Z

You are Worker M6 1 (teamwork_preview_worker). Your task is to execute the complete implementation and remediation for Milestone M6 (R1, R2, R3) across the SMARTOS POS codebase.

Working Directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m6_1
Project Root: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon

MANDATORY READS:
- Original User Request: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\ORIGINAL_REQUEST.md
- Master Specification: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md
- Explorer M6 1 Analysis (R1 Blueprint): C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_m6_1\analysis.md
- Explorer M6 2 Analysis (R2 Blueprint): C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_m6_2\analysis.md
- Explorer M6 3 Analysis (R3 Blueprint): C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_m6_3\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

SCOPE OF WORK:

--- REQUIREMENT R1: Cashier Assigned Branch Display & Scoping ---
1. `src/components/pos/pos-container.tsx`:
   - In mount `useEffect` (lines 60-64), if `activeStaff?.branchId` exists (or if `activeStaff?.role !== "OWNER"`), initialize cart store active branch directly to `activeStaff.branchId` and `activeStaff.branchName`. Do not default to `initialBranches[0]` (Hledin branch) or leave stale localStorage values when a cashier/manager is logged in.
   - Restrict/disable branch selector UI in POS header when `activeStaff?.role !== "OWNER"`.
2. `src/app/api/pos/checkout/route.ts`:
   - In `POST /api/pos/checkout`, explicitly force `branchId = staff.branchId` when `staff.role !== "OWNER"`, overriding any client-provided payload.
3. `src/app/(dashboard)/sales-orders/page.tsx`:
   - In `openCreate()`, default `newBranchId` to `user?.branchId || branches[0]?.id || ""`.
4. `src/app/(dashboard)/expenses/page.tsx`, `src/app/(dashboard)/schedule/page.tsx`, `src/app/(dashboard)/staff/page.tsx`:
   - Replace hardcoded `branches[0]` fallbacks with `user?.branchId` / `branches.find(b => b.id === user?.branchId)?.name`.

--- REQUIREMENT R2: Sales Voucher Product Card Details ---
1. `src/components/pos/product-card.tsx`:
   - Render relevant variant badges directly on the card (`<Badge variant="secondary">{v.name}</Badge>`), matching catalog presentation in `/setup`.
   - Remove cross-branch stock calculation fallback (if no `StockLevel` record for `activeBranchId`, available stock for that branch is `0`).
   - Subtract real-time active cart items (`useCartStore((state) => state.items)`) from available stock on the card badge.
2. `src/components/pos/pos-container.tsx`:
   - Implement `refreshProducts` refetch handler called inside `handleCheckoutSuccess` after checkout completion to update database stock level in real-time.
3. `src/app/(dashboard)/pos/page.tsx`:
   - Remove `price: { gt: 0 }` restriction in `findMany` to include all active products.

--- REQUIREMENT R3: Strict i18n Language Toggle (English vs. Burmese) ---
1. Refactor all 8 target modules to ensure strict language toggling (100% English when locale is 'en', 100% Burmese when locale is 'my', ZERO dual-slash strings like `"Text / မြန်မာ"` or `"Name (မြန်မာ)"`):
   - Sales Voucher (`src/components/pos/receipt-view.tsx`, `addon-variant-selector.tsx`, `cart-panel.tsx`, `payment-dialog.tsx`, `hold-list-dialog.tsx`, `pin-switch-dialog.tsx`, `pos-container.tsx`, `product-card.tsx`, `product-grid.tsx`)
   - Branches Table (`src/app/(dashboard)/branches/page.tsx`)
   - Supplier Table (`src/app/(dashboard)/suppliers/page.tsx`)
   - Sales Order Table (`src/app/(dashboard)/sales-orders/page.tsx`)
   - Purchases & Purchase Orders Tables (`src/app/(dashboard)/purchases/page.tsx` & `src/app/(dashboard)/purchase-orders/page.tsx`)
   - Expenses Table (`src/app/(dashboard)/expenses/page.tsx`)
   - Staff Table (`src/app/(dashboard)/staff/page.tsx`)
   - Reports (`src/app/(dashboard)/reports/page.tsx`)
2. Make sure `useLanguage` is imported in `receipt-view.tsx` and `reports/page.tsx` and all text strings are wrapped in `t("English", "Burmese")`.

VERIFICATION:
- Run `npm run build` to verify clean compilation.
- Run test commands (e.g. `npx tsx tests/m1-rbac-multibranch-suite.test.ts`, `npx tsx tests/e2e-system-suite.test.ts`, `npx tsx tests/financial-inventory-integrity.test.ts`) to ensure zero regressions.
- Write your complete handoff report to C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m6_1\handoff.md detailing all changed files, build results, and test suite outcomes.
