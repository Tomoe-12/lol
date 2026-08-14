## 2026-08-10T17:50:14Z
You are Worker M2 (POS & Sales Order Verification Worker).
Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m2_1
Project root: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Original request file: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
Scope document: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
1. Verify POS Checkout & Sales Order Lifecycle logic across R2 requirements:
   - POS checkout: subtotals, item/order discounts (0 <= discount <= subtotal), multi-currency split payments (MMK/USD exchange rate conversion), minimum selling price enforcement (selling price >= variant cost price), and immediate stock level decrements + `InventoryLog` creation (`SALE`).
   - Sales Orders: Draft pre-orders, confirmation, 10% minimum deposit validation for partial payments, advance deposit tracking, cancellation refund prompts (refund <= amountPaid), duplicate cancellation protection, and delivery link.
2. Run test suites:
   - `npx tsx tests/unit/m2-challenger-stress.test.ts`
   - `npx tsx tests/integration/e2e-system-suite.test.ts`
   - `npm run build`
3. Document verification output in C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m2_1\changes.md and deliver handoff report in C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m2_1\handoff.md.
