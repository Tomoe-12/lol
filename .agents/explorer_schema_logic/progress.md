# Progress — Explorer 1 (Schema, Database Models, and Business Logic Formulas)

Last visited: 2026-08-29T02:51:00Z

## Status
- [x] Initial setup & briefing
- [x] Inspect `prisma/schema.prisma` (all 19 models, 12 enums, fields, constraints, relations, indexes)
- [x] Inspect Moving Average Cost (MAC) formula in services/lib/routes (`src/app/api/purchase-orders/route.ts`)
- [x] Inspect Remaining Debt calculation & capping rules for customer repayments (`src/app/api/outstanding/route.ts`, `src/app/api/outstanding/pay/route.ts`)
- [x] Inspect POS minimum selling price / cost floor protection (`src/app/api/pos/checkout/route.ts`, `src/components/pos/payment-dialog.tsx`)
- [x] Inspect Split payment calculation, rounding, exchange rate conversions (`src/components/pos/payment-dialog.tsx`, `src/app/api/pos/exchange-rate/route.ts`)
- [x] Inspect Sales order deposit calculation (10% deposit rules, refund prompts) (`src/app/api/sales-orders/route.ts`, `src/app/api/sales-orders/[id]/route.ts`)
- [x] Inspect Delivery state machine stock deduction logic (`src/app/api/pos/fulfill-sales-order/route.ts`, `src/app/api/delivery/status/route.ts`)
- [x] Compile comprehensive `report.md`
- [x] Compile 5-component `handoff.md`
- [x] Send message to orchestrator parent
