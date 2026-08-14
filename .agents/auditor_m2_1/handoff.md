# Forensic Audit Report: POS Checkout & Sales Order Integrity (M2)

**Work Product**: `src/app/api/pos/checkout/route.ts`, `src/app/api/sales-orders/route.ts`, `src/app/api/sales-orders/[id]/route.ts`
**Profile**: General Project / Integrity Forensics
**Integrity Mode**: Development Mode (per `ORIGINAL_REQUEST.md`)
**Verdict**: CLEAN

---

## 1. Observation

1. **POS Checkout Handler (`src/app/api/pos/checkout/route.ts`)**:
   - **Discount Validation** (Lines 72-76):
     ```typescript
     if (typeof discountAmount !== "number" || discountAmount < 0 || discountAmount > subtotal) {
       return NextResponse.json(
         { error: "Invalid discount amount. Discount must be between 0 and subtotal." },
         { status: 400 }
       );
     }
     ```
   - **Cost Price Protection** (Lines 95-103):
     ```typescript
     const effectiveSellingPrice = (item.unitPrice * item.quantity - (item.discount || 0)) / item.quantity;
     if (effectiveSellingPrice < variant.costPrice) {
       return NextResponse.json(
         {
           error: `Selling price for ${variant.product.name} (${effectiveSellingPrice} Ks) cannot be lower than cost price (${variant.costPrice} Ks)`,
         },
         { status: 400 }
       );
     }
     ```
   - **Exchange Rate & Multi-Currency Split Payments** (Lines 111-126): `totalInMMK = currency === "USD" ? total * exchangeRate : total;` stored in `Transaction` entity.
   - **Transaction Atomicity & Stock Logging** (Lines 109-262): Wrapped inside `prisma.$transaction(async (tx) => ...)` block:
     - `tx.transaction.create` (Lines 113-159)
     - `tx.stockLevel.upsert` with `{ quantity: { decrement: quantity } }` (Lines 170-187)
     - `tx.inventoryLog.create` with `reason: StockChangeReason.SALE` and `change: 0 - quantity` (Lines 190-198)
     - `tx.salesOrder.create` when `isDelivery`, `customerId`, or debt/partial payment occurs (Lines 206-250)
     - `tx.auditLog.create` (Lines 253-259)

2. **Sales Orders Handler (`src/app/api/sales-orders/route.ts`)**:
   - **Draft Pre-Orders & Editing Bypass** (Lines 193, 211): Bypasses stock check and cost price check when `status === "DRAFT"`.
   - **Order Confirmation Checks** (Lines 212-228): Validates `effectiveSellingPrice >= dbCostPrice` and `qty <= avail` for non-draft orders.
   - **10% Minimum Deposit for Partial Payments** (Lines 245-253):
     ```typescript
     const minRequired = calculatedTotal * 0.1;
     if (numericAmountPaid < minRequired || numericAmountPaid >= calculatedTotal) {
       return NextResponse.json(
         { error: `Partial payment amount (${numericAmountPaid}) must be at least 10% (${minRequired}) and less than total order price (${calculatedTotal}).` },
         { status: 400 }
       );
     }
     ```
   - **Atomic Creation & Delivery Link** (Lines 274-368): Wrapped in `prisma.$transaction` creating `salesOrder`, `salesOrderItem`, `orderPayment`, and conditionally decrementing `stockLevel` + creating `inventoryLog` (`SALES_ORDER_DELIVERED`) if status is `COMPLETED`.

3. **Sales Order Instance Handler (`src/app/api/sales-orders/[id]/route.ts`)**:
   - **Duplicate Cancellation Guard** (Lines 39-46):
     ```typescript
     if (existingOrder.status === "CANCELLED") {
       if (status === "CANCELLED" || refundAmount !== undefined) {
         return NextResponse.json(
           { error: "Sales Order is already cancelled" },
           { status: 400 }
         );
       }
     }
     ```
   - **Cancellation Refund Capping** (Lines 121-127):
     ```typescript
     if (refund > existingOrder.amountPaid) {
       return NextResponse.json(
         { error: `Refund amount (${refund}) cannot exceed amount paid (${existingOrder.amountPaid}).` },
         { status: 400 }
       );
     }
     ```
   - **Stock Deductions & Restorations inside Transaction** (Lines 212-354 & Lines 387-421): Status changes to `COMPLETED` trigger atomic stock decrements and `SALES_ORDER_DELIVERED` inventory logs. Status changes away from `COMPLETED` or order deletions trigger atomic stock increments and `ADJUSTMENT` inventory logs.

4. **Prohibited Patterns Inspection**:
   - Hardcoded test results / magic values: None found.
   - Facade implementations / dummy logic: None found.
   - Fabricated logs / result artifacts: Checked workspace via `find_by_name`, 0 `.log`, `*result*`, or `*output*` files exist prior to test runs.
   - Self-certifying mock shortcuts: None found.

---

## 2. Logic Chain

1. **Codebase Inspection**:
   - `src/app/api/pos/checkout/route.ts` evaluates real incoming JSON payloads, performs actual Prisma database queries for product variants and branches, enforces business constraints (discount bound, cost price minimum), and executes all state changes within a single Prisma transaction (`prisma.$transaction`).
   - `src/app/api/sales-orders/route.ts` and `src/app/api/sales-orders/[id]/route.ts` perform dynamic price and stock checks against live database records, enforce the 10% minimum partial deposit requirement, restrict item edits to `DRAFT` status, block duplicate cancellations/over-refunding, and maintain inventory logs atomically.
2. **Transaction Integrity**:
   - In POS checkout, stock level update (`tx.stockLevel.upsert`) and audit log (`tx.inventoryLog.create`) are executed inside the same transaction scope as transaction creation (`tx.transaction.create`). Any failure during inventory logging triggers a full database rollback.
   - In Sales Order lifecycle, stock decrements/increments and `inventoryLog` entries are co-located in `prisma.$transaction` calls during state transitions (`COMPLETED`, cancellation, deletion).
3. **Prohibited Pattern Verification**:
   - No conditional branches exist that bypass real computations for specific test strings or static mock identifiers.
   - No pre-populated attestation or result files exist in the project repository.
4. **Integrity Verdict**:
   - The implementation satisfies Development Mode constraints and all M2 functional requirements cleanly.

---

## 3. Caveats

- Command execution (`run_command`) timed out waiting for user confirmation in this execution environment. Verification was performed via line-by-line static forensic audit of all route handlers and test suite files.

---

## 4. Conclusion

**Verdict**: **CLEAN**

The M2 work products (`src/app/api/pos/checkout/route.ts`, `src/app/api/sales-orders/route.ts`, `src/app/api/sales-orders/[id]/route.ts`) implement genuine business logic, enforce all price, deposit, and stock constraints, and execute stock deductions and inventory logs inside atomic database transactions. No hardcoded test responses, facade implementations, or fake mocks were detected.

---

## 5. Verification Method

To independently verify this audit:
1. Inspect `src/app/api/pos/checkout/route.ts` (lines 72-106 and 109-199) to verify discount bounds, selling price vs cost price check, and `prisma.$transaction` stock decrement + `InventoryLog` creation.
2. Inspect `src/app/api/sales-orders/route.ts` (lines 212-253 and 274-368) to verify minimum selling price protection, 10% partial deposit validation, and atomic `SalesOrder` + `InventoryLog` creation.
3. Inspect `src/app/api/sales-orders/[id]/route.ts` (lines 39-46, 121-127, and 263-327) to verify duplicate cancellation prevention, refund capping (`refund <= amountPaid`), and atomic stock adjustment on status changes.
4. Run test suites:
   - `npx tsx tests/unit/m2-challenger-stress.test.ts`
   - `npx tsx tests/integration/e2e-system-suite.test.ts`
