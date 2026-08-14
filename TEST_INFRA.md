# E2E Test Infra: SMARTOS POS & Inventory Verification

## Test Philosophy
- Requirement-driven & Opaque-box verification across R1 (Access Boundaries) and R2 (Business Lifecycle).
- Integrated unit, integration, and empirical stress testing using `tsx` test runners against local Prisma SQLite/MySQL DB.

## Feature Inventory & Test Coverage Matrix
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (E2E Workloads) |
|---|---------|--------|:-----------------:|:-------------------:|:----------------------:|:----------------------:|
| 1 | Owner System Access | R1 §13 | 18 routes check | Branch bypass check | Setup & staff permissions | E2E System Suite |
| 2 | Manager Branch Isolation | R1 §14 | Branch query filter | Cross-branch 403 API | Cross-branch SO & Staff | Stress Suite 2 & Empirical M3 |
| 3 | Manager Staff Admin | R1 §14 | List branch staff | Non-owner permission PUT | Same-branch Cashier PUT | Stress Suite M3 |
| 4 | Cashier Boundaries | R1 §15 | POS/Delivery/Debt | Forbidden routes 403 | API route guards 403 | E2E System Suite |
| 5 | POS Checkout & Split Pay | R2 §18 | POS checkout 200 | Split payment MMK/USD | Multi-currency cash/card | Financial Integrity Suite |
| 6 | Cost Price Protection | R2 §18 | Price validation | Price < cost 400 error | Discount > subtotal 400 | E2E System Suite |
| 7 | Sales Order Deposit | R2 §19 | SO Draft & Confirm | <10% deposit 400 error | Deposit tracking & link | E2E System Suite |
| 8 | Order Refund Logic | R2 §19 | Refund calculation | Refund > amountPaid 400 | Duplicate cancellation 400 | Financial Integrity Suite |
| 9 | Delivery Management | R2 §20 | Delivery status PATCH | Non-owner branch 403 | DELIVERED status stock dec | E2E System Suite |
| 10| Debt Repayment Capping | R2 §21 | Debt pay 200 | Pay > remainingDebt 400 | Customer balance update | E2E System Suite |
| 11| Zero-Drift Stock Audit | R2 §22 | InventoryLog check | StockLevel atomic dec | High-concurrency 50 POS | Financial Integrity & Stress 2 |
| 12| i18n Language Switcher | General | Dual language t() | Fallback / localStorage | Bilingual slash clean | Unit Language Suite |

## Test Suite Execution Commands
- **M1 Access Boundaries & RBAC**: `npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts`
- **M1 Stress & Deep Challenger**: `npx tsx tests/unit/m1-permissions-stress.test.ts` && `npx tsx tests/unit/m1-challenger-deep-stress.test.ts`
- **M2 Stress Suite**: `npx tsx tests/unit/m2-challenger-stress.test.ts`
- **M3 Debt, Delivery & Manager Empirical**: `npx tsx tests/integration/m3-challenger-empirical.test.ts`
- **M4 Financial & Zero-Drift Integrity**: `npx tsx tests/integration/financial-inventory-integrity.test.ts`
- **M4 High-Concurrency Stress Suite**: `npx tsx tests/integration/challenger-2-stress.test.ts`
- **E2E Full System Suite**: `npx tsx tests/integration/e2e-system-suite.test.ts`
- **i18n Unit Suite**: `npx tsx tests/unit/language-switcher.test.ts`

## Pass / Fail Criteria
- 100% assertions must pass across all suites.
- Zero defects reported in `challenger-2-stress.test.ts` and `m3-challenger-empirical.test.ts`.
- Forensic Audit verdict must be CLEAN for every milestone.
