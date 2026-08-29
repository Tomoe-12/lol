# Handoff Report — Explorer 1 (Schema, Database Models, and Business Logic Formulas)

**Date**: 2026-08-29  
**Agent ID / Name**: `explorer_schema_logic`  
**Parent Agent ID**: `96ca4120-3c66-41a3-9ddd-914ea8c0df98`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

Direct code observations from inspecting the codebase:

1. **Prisma Schema (`prisma/schema.prisma`)**:
   - Exactly 19 models are declared: `Branch` (line 98), `Staff` (line 119), `Category` (line 145), `Product` (line 154), `ProductVariant` (line 170), `StockLevel` (line 190), `InventoryLog` (line 201), `Transaction` (line 223), `TransactionItem` (line 252), `Supplier` (line 270), `PurchaseOrder` (line 282), `PurchaseItem` (line 311), `Expense` (line 325), `ExchangeRate` (line 339), `AuditLog` (line 351), `Customer` (line 362), `SalesOrder` (line 377), `SalesOrderItem` (line 422), `OrderPayment` (line 437).
   - Exactly 12 enums are declared: `Role` (line 15), `PaymentMethod` (line 21), `TransactionStatus` (line 29), `StockChangeReason` (line 36), `PurchaseOrderStatus` (line 45), `PurchasePaymentStatus` (line 52), `ExpenseCategory` (line 58), `SalesOrderStatus` (line 67), `PaymentStatus` (line 75), `DepositStatus` (line 80), `DeliveryStatus` (line 86), `DeliveryFeePayer` (line 91).
   - Compound unique index observed: `@@unique([branchId, variantId])` on `StockLevel` (line 198).
   - Cascade delete observed: `ProductVariant` deletes cascade to `StockLevel`, `InventoryLog`, etc. when product is removed; `TransactionItem` cascades on `Transaction` deletion; `SalesOrderItem` and `OrderPayment` cascade on `SalesOrder` deletion.

2. **Moving Average Cost (`src/app/api/purchase-orders/route.ts:397-425`)**:
   - Code snippet observed:
     ```ts
     const allStock = await tx.stockLevel.findMany({ where: { variantId: variant.id } });
     const totalStock = allStock.reduce((sum, sl) => sum + sl.quantity, 0);
     let newCostPrice = item.unitCost;
     if (totalStock > 0) {
       const currentTotalValue = totalStock * (variant.costPrice || 0);
       const incomingValue = item.quantity * item.unitCost;
       newCostPrice = (currentTotalValue + incomingValue) / (totalStock + item.quantity);
     }
     ```
   - Propagates to `tx.productVariant.update`, `tx.product.update`, and `tx.productVariant.updateMany`.

3. **Customer Debt & Repayment (`src/app/api/outstanding/route.ts:65-67` & `src/app/api/outstanding/pay/route.ts:51-58`)**:
   - `deliveryFeeDue = o.deliveryFeePayer === "CUSTOMER" ? o.deliveryFee : 0`
   - `remainingDebt = Math.max(0, o.total + deliveryFeeDue - o.amountPaid)`
   - Capping check in `pay/route.ts`:
     ```ts
     if (amount > currentRemaining) {
       return NextResponse.json({ error: `Payment amount (${amount.toLocaleString()} Ks) cannot exceed remaining debt (${currentRemaining.toLocaleString()} Ks).` }, { status: 400 });
     }
     ```

4. **Minimum Selling Price / Cost Floor Protection (`src/app/api/pos/checkout/route.ts:209-218`)**:
   - Code snippet observed:
     ```ts
     if (item.costPrice > 0) {
       const effectiveSellingPrice = (item.unitPrice * item.quantity - (item.discount || 0)) / item.quantity;
       if (effectiveSellingPrice < item.costPrice) {
         return NextResponse.json({
           error: `Selling price for ${item.productName} (${effectiveSellingPrice.toLocaleString()} Ks) cannot be lower than cost price (${item.costPrice.toLocaleString()} Ks)`,
         }, { status: 400 });
       }
     }
     ```

5. **Split Payment & Currency (`src/components/pos/payment-dialog.tsx:161,282-297` & `src/app/api/pos/exchange-rate/route.ts:4,7`)**:
   - `exchange-rate/route.ts` returns HTTP 410 with message `"Currency conversion is disabled. The system uses MMK only."`.
   - UI validates split cash + non-cash tolerance `Math.abs(totalSplitEntered - totalMMK) <= 1`.

6. **Delivery State Machine & Double-Deduction Prevention (`src/app/api/pos/fulfill-sales-order/route.ts:104-108` & `src/app/api/delivery/status/route.ts:46-52`)**:
   - In `/api/pos/fulfill-sales-order`, `StockLevel.quantity` is decremented by item quantity, `fulfilledQuantity` is incremented, and `InventoryLog` is recorded with `reason: StockChangeReason.SALE`.
   - In `/api/delivery/status`, transitioning to `deliveryStatus: "DELIVERED"` updates `SalesOrder.deliveryStatus` and `SalesOrder.status: "COMPLETED"`, but does NOT execute any inventory decrement or change logs.

---

## 2. Logic Chain

1. **Schema Completeness**:
   - Based on observation 1, `prisma/schema.prisma` contains 19 models and 12 enums without missing foreign key bindings. Cascade deletion constraints are set on child items (`TransactionItem`, `SalesOrderItem`, `OrderPayment`, `PurchaseItem`), preventing orphan rows upon parent entity removal.
2. **MAC Valuation Reliability**:
   - Based on observation 2, calculating total stock across all branches (`allStock.reduce(...)`) before weighting ensures that transferring stock between branches does not warp cost pricing, and all variants under the parent product maintain a unified moving average cost.
3. **Debt Integrity**:
   - Based on observation 3, customer debt includes delivery fees when assigned to `CUSTOMER`, but excludes store-paid delivery fees. The capping logic prevents negative remaining debts and double-payments.
4. **Profit Margin / Cost Floor Enforcement**:
   - Based on observation 4, discounts cannot reduce the effective unit price below the stored cost price (`unitCost` / MAC), ensuring that cashier discounting does not result in negative gross margins.
5. **Single-Currency Stability**:
   - Based on observation 5, currency conversions are deactivated in favor of pure MMK integer accounting with a 1 Ks split-rounding threshold, avoiding floating-point currency divergence.
6. **Stock Consistency & Double-Deduction Prevention**:
   - Based on observation 6, stock deduction is strictly isolated to POS transaction creation (`/api/pos/checkout` and `/api/pos/fulfill-sales-order`). Courier dispatch status updates in `/api/delivery/status` are decoupled from inventory mutations, eliminating double deduction risks.

---

## 3. Caveats

1. **ExchangeRate Model**: The `ExchangeRate` model remains present in `prisma/schema.prisma` (lines 339–347) for database backward-compatibility, but the API endpoint `/api/pos/exchange-rate` explicitly returns HTTP 410 because multi-currency conversion has been standardized to MMK.
2. **Database Engine**: The schema specifies `provider = "mysql"`. MySQL supports foreign key constraints and `onDelete: Cascade`.

---

## 4. Conclusion

The database schema and business logic formulas have been exhaustively inspected and documented. All 19 Prisma models, 12 enums, relational rules, indexing constraints, and mathematical algorithms (MAC calculation, debt capping, floor price validation, split payment validation, advance deposit tracking, and delivery inventory lifecycle) are fully cataloged in `report.md`.

---

## 5. Verification Method

To independently verify the observations:
1. **Schema Validation**:
   - Inspect `prisma/schema.prisma` directly:
     `view_file` on `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\prisma\schema.prisma`
   - Run Prisma validation:
     `npx prisma validate`
2. **MAC Logic Inspection**:
   - Inspect `src/app/api/purchase-orders/route.ts` lines 397–425.
3. **Debt & Capping Logic**:
   - Inspect `src/app/api/outstanding/route.ts` lines 64–107 and `src/app/api/outstanding/pay/route.ts` lines 50–99.
4. **Cost Floor & Minimum Price**:
   - Inspect `src/app/api/pos/checkout/route.ts` lines 200–220.
5. **Delivery Stock Single-Deduction**:
   - Compare `src/app/api/pos/fulfill-sales-order/route.ts` lines 104–108 with `src/app/api/delivery/status/route.ts` lines 46–52.
