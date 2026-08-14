# Project Plan — Full System & RBAC Multi-Role Verification across SMARTOS POS & Inventory

## Objectives & Scope
Verify 100% of functional & security requirements specified in `ORIGINAL_REQUEST.md`:
- **R1: Role & Permission Access Boundaries**
  - Owner role access across all 18 routes, branch management, and staff permissions setup.
  - Manager role branch isolation and blocking (403 Forbidden) on cross-branch mutations & unassigned staff permissions.
  - Cashier role restriction to POS, Delivery, Outstanding, and blocking (403 Forbidden) on `/staff`, `/reports`, `/inventory`, `/purchase-orders`, `/expenses`, `/setup`, and dashboard stats.
- **R2: Complete Business Lifecycle Verification**
  - POS checkout, split payment, min selling price protection, exchange rates, stock deductions.
  - Sales Orders lifecycle: Draft, confirmation, partial payments, advance deposit, cancellation refund prompt, delivery link.
  - Delivery Management: Marking order DELIVERED updates status to COMPLETED and decrements stock with `InventoryLog` (`SALES_ORDER_DELIVERED`).
  - Debt Collection: Repayment capping (`remainingDebt`) and customer balance ledgers updating.
  - Zero-Drift Audit: 100% mathematical balance verification between `StockLevels` and `InventoryLogs`.

## Phased Approach

### Phase 0: System & Specification Survey
- Spawn 3 Explorers / Spec Miners to map:
  1. Authoritative routes, API endpoints, RBAC middleware/rules, DB models (`StockLevel`, `InventoryLog`, etc.).
  2. Test infrastructure, build/test scripts, seed data scripts, test runners.
  3. Feature inventory and potential requirement gaps across R1 and R2.

### Phase 1: PROJECT.md & Milestone Architecture
- Aggregate Phase 0 survey findings into `PROJECT.md` at root.
- Define Milestones:
  - Milestone 1 (M1): RBAC Access Boundaries & Branch Isolation (R1 requirements)
  - Milestone 2 (M2): POS Checkout & Sales Order Lifecycle Verification (R2 requirements part 1)
  - Milestone 3 (M3): Delivery Management & Debt Collection Verification (R2 requirements part 2)
  - Milestone 4 (M4): Zero-Drift Audit & Ledger Integrity Verification (R2 requirements part 3)
  - Milestone 5 (M5): Final E2E Test Suite & Adversarial Hardening

### Phase 2: Milestone Execution Loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate)
- Execute M1 - M5 sequentially or in parallel as dependencies allow.
- Each milestone goes through full verification gate check.

### Phase 3: Final Audit & Sentinel Completion Handoff
- Verify all acceptance criteria are checked and passed.
- Deliver final completion report to Sentinel parent.
