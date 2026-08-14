# Explorer 2 Handoff Report: Financial & Inventory Lifecycle Mechanics Analysis

## 1. Observation

### 1.1 Schema Observations (`prisma/schema.prisma`)
- **Product & Stock Models**:
  - `Product` (lines 122–135): `id`, `name`, `price` (Float, default 0), `categoryId`, `isActive`.
  - `ProductVariant` (lines 137–152): `id`, `productId`, `name`, `barcode`, `lowStockThreshold` (default 10), `costPrice` (Float, default 0).
  - `StockLevel` (lines 156–165): `id`, `branchId`, `variantId`, `quantity` (Int, default 0), with compound unique key `@@unique([branchId, variantId])`.
  - `InventoryLog` (lines 167–177): `id`, `branchId`, `variantId`, `change` (Int), `reason` (`StockChangeReason`), `note`, `createdAt`. Enums: `SALE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `PURCHASE_RECEIVED`, `SALES_ORDER_DELIVERED`.
- **Purchase Order Models**:
  - `PurchaseOrder` (lines 235–248): `id`, `supplierId`, `branchId`, `status` (`DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED`), `totalCost` (Float), `note`, timestamps.
  - `PurchaseItem` (lines 250–260): `id`, `purchaseOrderId`, `variantId`, `quantity` (Int), `unitCost` (Float), `sellingPrice` (Float), `total` (Float).
- **POS Transactions & Sales Orders**:
  - `Transaction` (lines 181–203): `id`, `branchId`, `staffId`, `subtotal`, `discountAmount`, `total`, `currency`, `exchangeRate`, `totalInMMK`, `paymentMethod`, `cashReceived`, `changeGiven`, `status` (`COMPLETED`, `VOIDED`, `REFUNDED`, `HELD`), `receiptEmail`, timestamps.
  - `TransactionItem` (lines 205–219): `id`, `transactionId`, `productId`, `variantId`, `quantity`, `unitPrice`, `unitCost`, `discount`, `total`.
  - `SalesOrder` (lines 313–336): `id`, `branchId`, `customerId`, `status` (`CONFIRMED`, `COMPLETED`, `CANCELLED`), `paymentStatus` (`PARTIAL`, `PAID`), `subtotal`, `discount`, `total`, `amountPaid`, `paymentMethod`, `deliveryDate`, timestamps.
  - `SalesOrderItem` (lines 338–349): `id`, `salesOrderId`, `variantId`, `quantity`, `unitPrice`, `unitCost`, `discount`, `total`.
  - `OrderPayment` (lines 351–359): `id`, `salesOrderId`, `amount`, `method`, `note`, `createdAt`.
- **Expenses & Exchange Rates**:
  - `Expense` (lines 264–275): `id`, `branchId`, `category` (`RENT`, `ELECTRICITY`, `WATER`, `SALARIES`, `SUPPLIES`, `OTHER`), `amount`, `currency`, `note`, `date`, `createdAt`.
  - `ExchangeRate` (lines 278–286): `id`, `mmkPerUsd`, `setByStaffId`, `branchId`, `createdAt`.

---

### 1.2 API Route Code Inspections

#### Scenario 1: PO & Moving Average Cost (MAC)
- `src/app/api/purchase-orders/route.ts`:
  - `POST` (lines 53–114): Creates PO in `DRAFT` status with items. Sums `item.quantity * item.unitCost` to compute `totalCost`.
  - `PATCH` (lines 116–256): When `status === PurchaseOrderStatus.RECEIVED`:
    - Wrapped in `prisma.$transaction(async (tx) => { ... })`.
    - Computes franchise-wide total stock before addition:
      ```ts
      const allStock = await tx.stockLevel.findMany({ where: { variantId: variant.id } });
      const totalStock = allStock.reduce((sum, sl) => sum + sl.quantity, 0);
      ```
    - Computes new Moving Average Cost (MAC):
      ```ts
      let newCostPrice = item.unitCost;
      if (totalStock > 0) {
        const currentTotalValue = totalStock * (variant.costPrice || 0);
        const incomingValue = item.quantity * item.unitCost;
        newCostPrice = (currentTotalValue + incomingValue) / (totalStock + item.quantity);
      }
      ```
    - Updates `ProductVariant.costPrice = newCostPrice` (line 202).
    - If `item.sellingPrice > 0`, updates `Product.price = item.sellingPrice` (line 208).
    - Upserts `StockLevel` quantity by incrementing `item.quantity` (line 214).
    - Creates `InventoryLog` with `change = item.quantity`, `reason = StockChangeReason.PURCHASE_RECEIVED` (line 224).

#### Scenario 2: POS Voucher Checkout & Revenue Ledger
- `src/app/api/pos/checkout/route.ts`:
  - `POST` (lines 5–183):
    - Discount check: `0 <= discountAmount <= subtotal` (lines 33–38).
    - Price floor check (R2): `effectiveSellingPrice = (unitPrice * quantity - discount) / quantity >= variant.costPrice` (lines 56–65).
    - Transaction execution:
      - `totalInMMK = currency === "USD" ? total * exchangeRate : total` (line 72).
      - Creates `Transaction` with status `COMPLETED` and `TransactionItem`s storing `unitCost = variant.costPrice` (lines 74–120).
      - Decrements `StockLevel.quantity` by `item.quantity` via `upsert` (lines 131–148).
      - Logs inventory reduction: `change = -item.quantity`, `reason = StockChangeReason.SALE` (lines 151–159).
      - Logs audit activity: `action = "CHECKOUT_COMPLETED"` (lines 163–169).

#### Scenario 3: Sales Order Creation, Customer Balance & Stock Allocation
- `src/app/api/sales-orders/route.ts`:
  - `POST` (lines 148–346):
    - Price floor check (R1): `unitPrice - (discount / quantity) >= variant.costPrice` (lines 197–202).
    - Strict Stock Check: Checks `StockLevel.quantity >= quantity`. Throws `400` if insufficient stock (lines 206–217).
    - Partial Payment Rule (R2): For `PARTIAL`, `0.10 * total <= amountPaid < total` (lines 229–237). For `PAID`, `amountPaid = total`.
    - Creates `SalesOrder` + `SalesOrderItem`s (`unitCost = dbCostPrice`) + initial `OrderPayment` record if `amountPaid > 0` (lines 248–302).
    - If `status === "COMPLETED"` upon creation: decrements `StockLevel` and creates `InventoryLog` with `reason = SALES_ORDER_DELIVERED` (lines 304–333).
- `src/app/api/sales-orders/[id]/route.ts`:
  - `PATCH` (lines 6–206): Updates status / payment.
    - Status `COMPLETED`: decrements stock by `quantity`, logs `SALES_ORDER_DELIVERED`.
    - Status changed from `COMPLETED` to non-`COMPLETED`: increments stock by `quantity`, logs `ADJUSTMENT`.
    - Additional payment / refund: creates `OrderPayment` record for `paymentDifference`.

#### Scenario 4: Expense Logging & Financial Summary Reports
- `src/app/api/expenses/route.ts`:
  - `POST` (lines 96–145): Creates `Expense` entry with `branchId`, `category`, `amount`, `currency`, `date`.
  - `GET` (lines 9–93): Fetches expenses and sums revenue per branch from `Transaction.totalInMMK`. Computes branch summary: `netProfit = revenue - totalExpenses`.
- `src/app/api/reports/route.ts`:
  - `GET` (lines 5–95): Returns aggregated `transactions` (POS sales), `orderPayments` (SO payments), `expenses`, `categories`, and `salesOrders` for period reports.
- `src/app/api/dashboard/stats/route.ts`:
  - `GET` (lines 158–166): Aggregates total revenue:
    ```ts
    const totalPosRevenueMMK = todayTransactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalOrderPaymentMMK = todayOrderPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalRevenueMMK = totalPosRevenueMMK + totalOrderPaymentMMK;
    const pendingReceivables = (pendingReceivablesAgg._sum.total ?? 0) - (pendingReceivablesAgg._sum.amountPaid ?? 0);
    ```

---

## 2. Logic Chain

1. **Scenario 1 (PO -> Receipt -> Stock & MAC)**:
   - *Observation*: PO fulfillment updates variant cost price using `(totalStock * oldCost + incomingQty * unitCost) / (totalStock + incomingQty)`.
   - *Logic*: Because `totalStock` is queried across all branches before adding incoming stock, the cost price is weighted uniformly across the entire business network. Stock increments atomically in the destination branch via `StockLevel.upsert`, and an `InventoryLog` with positive `change` and `PURCHASE_RECEIVED` reason establishes auditability.

2. **Scenario 2 (POS Checkout -> Stock & Ledger)**:
   - *Observation*: POS checkout creates a `Transaction` and `TransactionItem`s, decrements `StockLevel`, and logs `InventoryLog` (`SALE`).
   - *Logic*: Minimum selling price validation prevents negative gross margin sales at checkout. Revenue is tracked via `totalInMMK`, while COGS for the transaction is represented by `sum(item.quantity * item.unitCost)` stored in `TransactionItem.unitCost`.

3. **Scenario 3 (Sales Order -> Customer Balance & Stock Allocation)**:
   - *Observation*: Sales orders enforce available stock validation before creation. Partial payments require $\ge 10\%$ deposit.
   - *Logic*: Customer balance (unpaid receivables) is the delta between `total` and `amountPaid`. Cash inflow is recorded in `OrderPayment`. Stock deduction happens when the order is marked `COMPLETED` (or created with `COMPLETED` status). Reversals/cancellations restore stock and record adjustment logs.

4. **Scenario 4 (Expense Logging -> Financial Summaries)**:
   - *Observation*: Expenses are recorded per branch with category tags. Reports aggregate `Transaction.totalInMMK` + `OrderPayment.amount` for gross revenue, subtract COGS, and deduct expenses for net profit.
   - *Logic*: Financial dashboard stats and reports rely on real-time DB queries joining `Transaction`, `OrderPayment`, and `Expense` records, ensuring immediate updates upon logging new expenses or completing sales.

---

## 3. Caveats

1. **MAC Denominator Edge Case**: If `totalStock` across all branches is $\le 0$ (e.g. unseeded or zero stock), `newCostPrice` simply defaults to `item.unitCost`.
2. **Simplified Net Profit in `/api/expenses`**: `GET /api/expenses` calculates `netProfit` as `revenue - totalExpenses` (omitting COGS), whereas `GET /api/reports` and dashboard analytics provide full financial breakdown (Gross Revenue, COGS, Gross Profit, Operating Expenses, Net Profit).
3. **Multi-Currency Exchange Rate**: Transactions and Expenses support currency conversion (`totalInMMK = total * exchangeRate` for USD). E2E test assertions should explicitly state currency denomination (MMK vs USD).

---

## 4. Conclusion & Mathematical Assertions

### Scenario 1 Mathematical Assertions (PO Receipt & MAC)
Given initial branch stock $S_{branch, 0}$, total network stock $S_{total, 0} = \sum_{b} S_{b, 0}$, old cost price $C_{0}$, incoming quantity $Q_{in}$, unit cost $C_{in}$, selling price $P_{in}$:
1. **New Branch Stock**: $S_{branch, 1} = S_{branch, 0} + Q_{in}$
2. **Moving Average Cost (MAC)**:
   $$C_{1} = \begin{cases} \frac{(S_{total, 0} \times C_{0}) + (Q_{in} \times C_{in})}{S_{total, 0} + Q_{in}} & \text{if } S_{total, 0} > 0 \\ C_{in} & \text{if } S_{total, 0} \le 0 \end{cases}$$
3. **Product Price**: $P_{product, 1} = P_{in}$ (if $P_{in} > 0$)
4. **Inventory Log**: $\Delta S = +Q_{in}$, `reason` = `PURCHASE_RECEIVED`

### Scenario 2 Mathematical Assertions (POS Voucher Checkout)
Given basket items $i = 1 \dots n$ with $Q_i$, $P_i$, $D_i$, $C_i$:
1. **Selling Price Floor**: $\forall i, \, \frac{(P_i \times Q_i) - D_i}{Q_i} \ge C_i$
2. **Subtotal**: $T_{sub} = \sum_{i} (P_i \times Q_i)$
3. **Transaction Total**: $T_{total} = T_{sub} - D_{global}$
4. **Total in MMK**: $T_{MMK} = T_{total} \times (\text{currency} == \text{"USD"} ? \text{exchangeRate} : 1)$
5. **New Branch Stock**: $S_{b, v_i, 1} = S_{b, v_i, 0} - Q_i$
6. **Inventory Log**: $\Delta S = -Q_i$, `reason` = `SALE`

### Scenario 3 Mathematical Assertions (Sales Order & Customer Balance)
Given order items $i$ with $Q_i, P_i, D_i, C_i$, customer $c$:
1. **Stock Check**: $S_{b, v_i, 0} \ge Q_i$
2. **Order Total**: $T_{order} = \sum_{i} (P_i \times Q_i - D_i)$
3. **Partial Payment Range**: $0.10 \times T_{order} \le A_{paid} < T_{order}$
4. **Customer Outstanding Balance**:
   $$\text{Balance}(c) = \sum_{so \in SO(c)} (T_{so} - A_{paid, so})$$
5. **Stock Deduction upon Completion**: $S_{b, v_i, 1} = S_{b, v_i, 0} - Q_i$, `reason` = `SALES_ORDER_DELIVERED`

### Scenario 4 Mathematical Assertions (Expense & Financial Summary)
For date range $[t_1, t_2]$ and branch $b$:
1. **Gross Revenue**:
   $$R_{gross}(b) = \sum_{tx \in POS} tx.totalInMMK + \sum_{op \in OrderPayments} op.amount$$
2. **COGS**:
   $$\text{COGS}(b) = \sum_{tx} \sum_{i \in tx} (Q_{i} \times C_{i}) + \sum_{so} \sum_{j \in so} (Q_{j} \times C_{j})$$
3. **Total Operating Expenses**: $E(b) = \sum_{exp \in Expenses} exp.amount$
4. **Net Profit**: $\text{NetProfit}(b) = R_{gross}(b) - \text{COGS}(b) - E(b)$

---

## 5. Verification Method

To verify these assertions independently:

1. **Code & Schema Inspection**:
   - Inspect `prisma/schema.prisma` lines 122–359.
   - Inspect `src/app/api/purchase-orders/route.ts` lines 161–236 for MAC & Stock calculation.
   - Inspect `src/app/api/pos/checkout/route.ts` lines 55–160 for price floor, stock deduction & inventory logs.
   - Inspect `src/app/api/sales-orders/route.ts` lines 180–333 for stock check, partial payment & delivery allocation.
   - Inspect `src/app/api/expenses/route.ts` lines 53–85 & `src/app/api/dashboard/stats/route.ts` lines 158–166 for financial summary formulas.

2. **Automated / Programmatic Test Execution**:
   - Run seed script to set up predictable baseline data:
     ```bash
     npx prisma db seed
     ```
   - Execute API unit/integration tests or test endpoints using HTTP clients / Jest / Playwright to assert exact formula outputs against test databases.
