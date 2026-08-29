# BRIEFING — 2026-08-29T02:50:30Z

## Mission
Deep, exhaustive technical inspection of database schema (Prisma models, fields, relations, enums, indexes) and business logic formulas/algorithms (MAC, debt capping, floor price, currency/split payment, deposit, delivery state machine) in the codebase.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_schema_logic
- Original parent: 96ca4120-3c66-41a3-9ddd-914ea8c0df98
- Milestone: Database Schema & Business Logic Analysis

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify project source code
- Document exhaustive schema (all models, enums, relations, onDelete/onUpdate, indexes)
- Document exact mathematical formulas and algorithm logic with line numbers and file paths

## Current Parent
- Conversation ID: 96ca4120-3c66-41a3-9ddd-914ea8c0df98
- Updated: 2026-08-29T02:50:30Z

## Investigation State
- **Explored paths**: `prisma/schema.prisma`, `src/lib/auth-helper.ts`, `src/lib/permissions.ts`, `src/lib/phone.ts`, `src/lib/store/useCartStore.ts`, `src/components/pos/payment-dialog.tsx`, `src/app/api/purchase-orders/route.ts`, `src/app/api/pos/checkout/route.ts`, `src/app/api/outstanding/route.ts`, `src/app/api/outstanding/pay/route.ts`, `src/app/api/sales-orders/route.ts`, `src/app/api/sales-orders/[id]/route.ts`, `src/app/api/pos/fulfill-sales-order/route.ts`, `src/app/api/delivery/route.ts`, `src/app/api/delivery/status/route.ts`, `src/app/api/pos/exchange-rate/route.ts`
- **Key findings**:
  - All 19 Prisma models & 12 enums cataloged.
  - Moving Average Cost (MAC) formula verified with franchise-wide total stock weighting.
  - Outstanding debt calculation (`total + (deliveryFee if CUSTOMER) - amountPaid`) & capping rules verified.
  - Cost floor / minimum price protection enforced across POS checkout, wholesale, and sales orders.
  - Single MMK currency model with split payment balance tolerance (1 Ks).
  - Advance deposit tracking with refund ledger accounting.
  - Delivery stock decrement happens strictly once at POS fulfillment; zero double-deduction.
- **Unexplored areas**: None.

## Key Decisions Made
- Fully documented all 19 models with every field, type, optionality, default, relation, cascade rule, and unique index.
- Comprehensive technical report written to `report.md`.
- Handoff report written to `handoff.md`.

## Artifact Index
- `.agents/explorer_schema_logic/DISPATCH.md` — Initial dispatch message
- `.agents/explorer_schema_logic/BRIEFING.md` — Agent briefing & working memory
- `.agents/explorer_schema_logic/progress.md` — Progress tracker
- `.agents/explorer_schema_logic/report.md` — Comprehensive inspection report
- `.agents/explorer_schema_logic/handoff.md` — 5-component handoff report
