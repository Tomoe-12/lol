# Changes Summary — Milestone 2 (End-to-End Business Flow Integrity Verification Suite)

## 1. Overview
Created a dedicated, comprehensive end-to-end integration test suite `tests/integration/m2-business-lifecycles-suite.test.ts` that programmatically simulates, verifies, and asserts zero money/stock leaks across all 5 complex multi-step transaction lifecycles in the system.

## 2. Test Suite Implementation (`tests/integration/m2-business-lifecycles-suite.test.ts`)

The test suite directly invokes the Next.js API handlers via `NextRequest` with authentic database fixtures and validates mathematical correctness across all 5 business lifecycles:

### Lifecycle A: POS Voucher Checkout Lifecycle
- **Discount Upper Bound Enforcement**: Rejects checkout requests where `discountAmount > subtotal` with HTTP 400.
- **Selling Price Floor Check**: Enforces `effectiveSellingPrice >= costPrice` (rejecting below-cost sales with HTTP 400).
- **Split Payment & Currency Exchange**: Simulates multi-currency USD transactions, verifying exact exchange rate multiplication (`$10 * 3500 = 35,000 MMK`).
- **Delivery Toggle (`isDelivery: true`)**: Verifies automatic creation of linked `SalesOrder` with `status: "COMPLETED"` and `deliveryStatus: "PENDING"`.
- **Immediate Stock Reduction**: Asserts physical `StockLevel` is decremented by exact item quantity and `InventoryLog` is recorded with `reason: StockChangeReason.SALE`.
- **Ledger Entries**: Asserts creation of `Transaction`, `TransactionItem`, and `AuditLog` records (`CHECKOUT_COMPLETED`).

### Lifecycle B: Sales Orders & Delivery Lifecycle
- **10% Minimum Deposit Check**: Verifies that partial advance payments `< 10%` of order total (`calculatedTotal * 0.1`) are rejected with HTTP 400.
- **Delivery & Stock Reduction**: Calls `PATCH /api/delivery/status` with `deliveryStatus: "DELIVERED"` for a `CONFIRMED` order, verifying automatic physical stock deduction and `InventoryLog` entry (`SALES_ORDER_DELIVERED`).
- **Zero Double-Deduction Assertion**: Delivers a POS order (already set to `status: "COMPLETED"` at checkout) and asserts 0 double stock deduction occurs.
- **Debt Ledger Visibility**: Verifies that `/api/outstanding` lists the remaining debt (`total - amountPaid`).

### Lifecycle C: Debt Collection & Repayment Capping
- **Repayment Capping Enforcement**: Verifies that repayment amounts exceeding remaining debt (`amount > remainingDebt`) are rejected with HTTP 400.
- **Zero/Negative Repayment Guard**: Rejects payments `<= 0` with HTTP 400.
- **Partial & Final Debt Repayments**: Executes partial repayment followed by final repayment to settle debt in full.
- **Ledger & Status Updates**: Asserts `SalesOrder.amountPaid` updated, `paymentStatus` set to `PAID`, `OrderPayment` ledger records written, and order automatically removed from `/api/outstanding`.

### Lifecycle D: Purchase Orders & Moving Average Cost (MAC)
- **PO Intake & Receiving**: Creates PO (`POST /api/purchase-orders`) and receives goods (`PATCH /api/purchase-orders` with status `RECEIVED`).
- **Stock Increment**: Verifies physical stock level in target branch is incremented by received quantity and `InventoryLog` is recorded with `PURCHASE_RECEIVED`.
- **Franchise-Wide MAC Formula Recalculation**: Asserts `ProductVariant.costPrice` is updated to the exact weighted moving average cost across all 4 branches:
  $$\text{newCostPrice} = \frac{(\text{totalStockAllBranches} \times \text{currentCost}) + (\text{incomingQty} \times \text{unitCost})}{\text{totalStockAllBranches} + \text{incomingQty}}$$
- **Parent Product Price Integrity**: Asserts parent `Product.price` is not corrupted when receiving PO items with default `0` selling price.

### Lifecycle E: Order Cancellation & Refund
- **Refund Capping Enforcement**: Rejects refund requests where `refundAmount > amountPaid` with HTTP 400.
- **Cancellation & Refund Ledger**: Executes valid order cancellation, creating a negative payment ledger record in `OrderPayment` (`-refundAmount`), resetting `amountPaid` to `0`, and setting status to `CANCELLED`.
- **Physical Stock Restoration**: Asserts that cancelling a `COMPLETED` order restores physical stock levels and records `InventoryLog` with `reason: StockChangeReason.ADJUSTMENT`.
- **Duplicate Cancellation Guard**: Asserts that attempting to cancel an already cancelled order returns HTTP 400.

## 3. Files Created / Modified
- `tests/integration/m2-business-lifecycles-suite.test.ts` — Created dedicated Milestone 2 End-to-End Business Flow Integration Test Suite.
