# Database Schema, Models & Business Logic Formulas Inspection Report

**Project**: Kind-Shannon Retail POS  
**Investigator**: Explorer 1 (Schema, Database Models, and Business Logic Formulas)  
**Date**: 2026-08-29  
**Target Codebase**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`

---

## 1. Executive Summary

This report delivers an exhaustive technical audit of the database schema (`prisma/schema.prisma`) and core mathematical business logic algorithms implemented across `src/app/api/`, `src/lib/`, and related dashboard modules.

### Key Highlights
- **19 Database Models**: Fully cataloged with data types, nullability, defaults, primary/foreign keys, relational actions (`onDelete`, `onUpdate`), and indexes (including compound unique constraints like `@@unique([branchId, variantId])`).
- **12 Prisma Enums**: All enum values documented.
- **Moving Average Cost (MAC)**: Verified franchise-wide inventory valuation formula on Purchase Order receipt that propagates cost price to `ProductVariant` and `Product`.
- **Customer Outstanding & Debt Capping**: Exact arithmetic rules for debt accrual (`total + (deliveryFee if CUSTOMER) - amountPaid`) and repayment capping.
- **Cost Floor Protection**: Strict validation preventing sales below Moving Average Cost / Cost Price across POS, wholesale, and Sales Orders.
- **Currency & Split Payment Rules**: MMK single-currency model with split cash/non-cash validation and 1-Ks tolerance.
- **Advance Deposit & Cancellation Refunds**: 100% auditable deposit tracking via `OrderPayment` ledger, non-destructive status transitions, and bounded refund mechanics.
- **Delivery State Machine**: Zero-double-deduction stock lifecycle where inventory is decremented once during POS fulfillment, leaving delivery status changes purely logistics-state updates.

---

## 2. Complete Database Schema Specification (19 Prisma Models)

### Model 1: `Branch`
- **Table**: `Branch`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `name` | `String` | No | None | Branch store name |
  | `address` | `String` | Yes (`String?`) | None | Physical address |
  | `receiptHeader` | `String` | Yes (`String?`) | None | Custom print header text |
  | `isActive` | `Boolean` | No | `true` | Active status flag |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Relations**:
  - `staff`: `Staff[]` (1-to-many)
  - `stockLevels`: `StockLevel[]` (1-to-many)
  - `transactions`: `Transaction[]` (1-to-many)
  - `expenses`: `Expense[]` (1-to-many)
  - `purchaseOrders`: `PurchaseOrder[]` (1-to-many)
  - `inventoryLogs`: `InventoryLog[]` (1-to-many)
  - `exchangeRates`: `ExchangeRate[]` (1-to-many)
  - `salesOrders`: `SalesOrder[]` (1-to-many)

---

### Model 2: `Staff`
- **Table**: `Staff`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `clerkId` | `String` | Yes (`String?`) | None | `@unique` Clerk authentication ID |
  | `password` | `String` | No | `"123456"` | Hashed or default password |
  | `name` | `String` | No | None | Staff display name |
  | `email` | `String` | No | None | `@unique` Staff email |
  | `pin` | `String` | Yes (`String?`) | None | Authorization PIN for overrides |
  | `role` | `Role` (Enum) | No | `CASHIER` | `OWNER`, `MANAGER`, or `CASHIER` |
  | `permissions` | `Json` | Yes (`Json?`) | None | Granular module permission override matrix |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Foreign Keys & Constraints**:
  - `branch`: `Branch` references `Branch.id`
- **Relations**:
  - `transactions`: `Transaction[]`
  - `auditLogs`: `AuditLog[]`
  - `exchangeRates`: `ExchangeRate[]`
  - `createdPurchaseOrders`: `PurchaseOrder[]` (`@relation("POCreatedBy")`)
  - `receivedPurchaseOrders`: `PurchaseOrder[]` (`@relation("POReceivedBy")`)
  - `collectedOrderPayments`: `OrderPayment[]` (`@relation("OrderPaymentCollector")`)
  - `createdSalesOrders`: `SalesOrder[]` (`@relation("SalesOrderCreator")`)
  - `inventoryLogsCreated`: `InventoryLog[]` (`@relation("InventoryLogPerformer")`)

---

### Model 3: `Category`
- **Table**: `Category`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `name` | `String` | No | None | Category name |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Relations**:
  - `products`: `Product[]` (1-to-many)

---

### Model 4: `Product`
- **Table**: `Product`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `name` | `String` | No | None | Product title |
  | `price` | `Float` | No | `0` | Standard selling price |
  | `costPrice` | `Float` | No | `0` | Base / Moving Average Cost (MAC) |
  | `imageUrl` | `String` | Yes (`String?`) | None | Public image asset URL |
  | `isActive` | `Boolean` | No | `true` | Product active visibility flag |
  | `categoryId` | `String` | No | None | Foreign Key referencing `Category.id` |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Foreign Keys & Constraints**:
  - `category`: `Category` references `Category.id`
- **Relations**:
  - `variants`: `ProductVariant[]`
  - `transactionItems`: `TransactionItem[]`

---

### Model 5: `ProductVariant`
- **Table**: `ProductVariant`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `productId` | `String` | No | None | Foreign Key referencing `Product.id` |
  | `name` | `String` | No | None | Variant name (e.g. "Standard", "Large", "Red") |
  | `barcode` | `String` | No | None | `@unique` Barcode / SKU identifier |
  | `lowStockThreshold` | `Int` | No | `10` | Low inventory alert threshold |
  | `costPrice` | `Float` | No | `0` | Synchronized MAC from product/PO receipts |
  | `price` | `Float` | No | `0` | Synchronized catalog selling price |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Foreign Keys & Constraints**:
  - `product`: `Product` references `Product.id` with `onDelete: Cascade`
- **Relations**:
  - `transactionItems`: `TransactionItem[]`
  - `purchaseItems`: `PurchaseItem[]`
  - `stockLevels`: `StockLevel[]`
  - `inventoryLogs`: `InventoryLog[]`
  - `salesOrderItems`: `SalesOrderItem[]`

---

### Model 6: `StockLevel`
- **Table**: `StockLevel`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `variantId` | `String` | No | None | Foreign Key referencing `ProductVariant.id` |
  | `quantity` | `Int` | No | `0` | Current on-hand quantity for branch |
- **Foreign Keys & Constraints**:
  - `branch`: `Branch` references `Branch.id`
  - `variant`: `ProductVariant` references `ProductVariant.id` with `onDelete: Cascade`
- **Compound Indexes / Constraints**:
  - `@@unique([branchId, variantId])` — Guarantees unique stock record per variant per branch.

---

### Model 7: `InventoryLog`
- **Table**: `InventoryLog`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `variantId` | `String` | No | None | Foreign Key referencing `ProductVariant.id` |
  | `change` | `Int` | No | None | Quantity delta (+/-) |
  | `reason` | `StockChangeReason` (Enum) | No | None | Reason enum |
  | `note` | `String` | Yes (`String?`) | None | Audit narrative |
  | `performedByStaffId` | `String` | Yes (`String?`) | None | Foreign Key referencing `Staff.id` |
  | `transactionId` | `String` | Yes (`String?`) | None | Foreign Key referencing `Transaction.id` |
  | `salesOrderId` | `String` | Yes (`String?`) | None | Foreign Key referencing `SalesOrder.id` |
  | `purchaseOrderId` | `String` | Yes (`String?`) | None | Foreign Key referencing `PurchaseOrder.id` |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Foreign Keys & Constraints**:
  - `branch`: `Branch` references `Branch.id`
  - `variant`: `ProductVariant` references `ProductVariant.id` with `onDelete: Cascade`
  - `performedBy`: `Staff?` (`@relation("InventoryLogPerformer")`) references `Staff.id`
  - `transaction`: `Transaction?` (`@relation("InventoryLogTransaction")`) references `Transaction.id`
  - `salesOrder`: `SalesOrder?` (`@relation("InventoryLogSalesOrder")`) references `SalesOrder.id`
  - `purchaseOrder`: `PurchaseOrder?` (`@relation("InventoryLogPurchaseOrder")`) references `PurchaseOrder.id`

---

### Model 8: `Transaction`
- **Table**: `Transaction`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `staffId` | `String` | No | None | Foreign Key referencing `Staff.id` |
  | `customerId` | `String` | Yes (`String?`) | None | Foreign Key referencing `Customer.id` |
  | `salesOrderId` | `String` | Yes (`String?`) | None | Foreign Key referencing `SalesOrder.id` |
  | `subtotal` | `Float` | No | None | Gross item total before discount |
  | `discountAmount` | `Float` | No | `0` | Total discount applied |
  | `total` | `Float` | No | None | Net payable amount in transaction currency |
  | `currency` | `String` | No | `"MMK"` | Base currency code |
  | `exchangeRate` | `Float` | No | `1` | Conversion rate (fixed at 1) |
  | `totalInMMK` | `Float` | No | None | Net total in MMK |
  | `paymentMethod` | `PaymentMethod` (Enum) | No | None | `CASH`, `CARD`, `QR`, `SPLIT`, `DEBT` |
  | `cashReceived` | `Float` | Yes (`Float?`) | None | Cash tendered by customer |
  | `changeGiven` | `Float` | Yes (`Float?`) | None | Change returned |
  | `status` | `TransactionStatus` (Enum) | No | `COMPLETED` | `COMPLETED`, `VOIDED`, `REFUNDED`, `HELD` |
  | `note` | `String` | Yes (`String?`) | None | Transaction remarks |
  | `receiptEmail` | `String` | Yes (`String?`) | None | Email for digital receipt |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Foreign Keys & Constraints**:
  - `branch`: `Branch` references `Branch.id`
  - `staff`: `Staff` references `Staff.id`
  - `customer`: `Customer?` (`@relation("TransactionCustomer")`) references `Customer.id`
  - `salesOrder`: `SalesOrder?` (`@relation("SalesOrderFulfillment")`) references `SalesOrder.id`
- **Relations**:
  - `items`: `TransactionItem[]`
  - `inventoryLogs`: `InventoryLog[]` (`@relation("InventoryLogTransaction")`)

---

### Model 9: `TransactionItem`
- **Table**: `TransactionItem`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `transactionId` | `String` | No | None | Foreign Key referencing `Transaction.id` |
  | `productId` | `String` | No | None | Foreign Key referencing `Product.id` |
  | `variantId` | `String` | Yes (`String?`) | None | Foreign Key referencing `ProductVariant.id` |
  | `quantity` | `Int` | No | None | Number of units sold |
  | `unitPrice` | `Float` | No | None | Sold unit price |
  | `unitCost` | `Float` | No | `0` | COGS / MAC at transaction time |
  | `discount` | `Float` | No | `0` | Line item discount amount |
  | `total` | `Float` | No | None | `(unitPrice * quantity) - discount` |
  | `note` | `String` | Yes (`String?`) | None | Line item note |
- **Foreign Keys & Constraints**:
  - `transaction`: `Transaction` references `Transaction.id` with `onDelete: Cascade`
  - `product`: `Product` references `Product.id`
  - `variant`: `ProductVariant?` references `ProductVariant.id`

---

### Model 10: `Supplier`
- **Table**: `Supplier`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `name` | `String` | No | None | Vendor / Supplier company name |
  | `contact` | `String` | Yes (`String?`) | None | Contact phone number |
  | `email` | `String` | Yes (`String?`) | None | Contact email |
  | `address` | `String` | Yes (`String?`) | None | Physical / billing address |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Relations**:
  - `purchaseOrders`: `PurchaseOrder[]` (1-to-many)

---

### Model 11: `PurchaseOrder`
- **Table**: `PurchaseOrder`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `supplierId` | `String` | No | None | Foreign Key referencing `Supplier.id` |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `createdById` | `String` | Yes (`String?`) | None | Foreign Key referencing `Staff.id` |
  | `receivedById` | `String` | Yes (`String?`) | None | Foreign Key referencing `Staff.id` |
  | `status` | `PurchaseOrderStatus` (Enum) | No | `DRAFT` | `DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED` |
  | `totalCost` | `Float` | No | `0` | Total order cost sum |
  | `paymentStatus` | `PurchasePaymentStatus` (Enum) | No | `NO_PAY` | `NO_PAY`, `PARTIAL`, `PAID` |
  | `amountPaid` | `Float` | No | `0` | Cumulative cash paid to supplier |
  | `cashFlowAmount` | `Float` | No | `0` | Net cash outflow recorded |
  | `refundAmount` | `Float` | No | `0` | Refunded amount from supplier |
  | `supplierCredit` | `Float` | No | `0` | Available credit with supplier |
  | `cashFlowDate` | `DateTime` | Yes (`DateTime?`) | None | Date payment/refund occurred |
  | `arrivalDate` | `DateTime` | Yes (`DateTime?`) | None | Expected / actual goods arrival date |
  | `voucherDate` | `DateTime` | Yes (`DateTime?`) | None | Supplier voucher date |
  | `voucherNumber` | `String` | Yes (`String?`) | None | Supplier invoice / voucher number |
  | `note` | `String` | Yes (`String?`) | None | Purchase order remarks |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Foreign Keys & Constraints**:
  - `supplier`: `Supplier` references `Supplier.id`
  - `branch`: `Branch` references `Branch.id`
  - `createdBy`: `Staff?` (`@relation("POCreatedBy")`) references `Staff.id`
  - `receivedBy`: `Staff?` (`@relation("POReceivedBy")`) references `Staff.id`
- **Relations**:
  - `items`: `PurchaseItem[]`
  - `inventoryLogs`: `InventoryLog[]` (`@relation("InventoryLogPurchaseOrder")`)

---

### Model 12: `PurchaseItem`
- **Table**: `PurchaseItem`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `purchaseOrderId` | `String` | No | None | Foreign Key referencing `PurchaseOrder.id` |
  | `variantId` | `String` | No | None | Foreign Key referencing `ProductVariant.id` |
  | `quantity` | `Int` | No | None | Ordered unit count |
  | `unitCost` | `Float` | No | None | Agreed purchase cost per unit |
  | `sellingPrice` | `Float` | No | `0` | Retail price set upon receiving goods |
  | `total` | `Float` | No | None | `quantity * unitCost` |
- **Foreign Keys & Constraints**:
  - `purchaseOrder`: `PurchaseOrder` references `PurchaseOrder.id` with `onDelete: Cascade`
  - `variant`: `ProductVariant` references `ProductVariant.id`

---

### Model 13: `Expense`
- **Table**: `Expense`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `category` | `ExpenseCategory` (Enum) | No | None | `RENT`, `ELECTRICITY`, `WATER`, `SALARIES`, `SUPPLIES`, `OTHER` |
  | `amount` | `Float` | No | None | Expense amount in MMK |
  | `currency` | `String` | No | `"MMK"` | Currency identifier |
  | `note` | `String` | Yes (`String?`) | None | Expense explanation / receipt reference |
  | `date` | `DateTime` | No | `now()` | Incurred expense date |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Foreign Keys & Constraints**:
  - `branch`: `Branch` references `Branch.id`

---

### Model 14: `ExchangeRate`
- **Table**: `ExchangeRate`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `mmkPerUsd` | `Float` | No | None | Historical rate (MMK per 1 USD) |
  | `setByStaffId` | `String` | No | None | Foreign Key referencing `Staff.id` |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Foreign Keys & Constraints**:
  - `setByStaff`: `Staff` references `Staff.id`
  - `branch`: `Branch` references `Branch.id`

---

### Model 15: `AuditLog`
- **Table**: `AuditLog`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `staffId` | `String` | No | None | Foreign Key referencing `Staff.id` |
  | `action` | `String` | No | None | Action name (e.g. `CHECKOUT_COMPLETED`, `DEBT_COLLECTION_PAYMENT`) |
  | `details` | `String` | Yes (`String?`) | None | Structured or narrative audit text |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Foreign Keys & Constraints**:
  - `staff`: `Staff` references `Staff.id`

---

### Model 16: `Customer`
- **Table**: `Customer`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `name` | `String` | No | None | Customer full name |
  | `phone` | `String` | Yes (`String?`) | None | Primary 11-digit normalized phone (`09...`) |
  | `phones` | `Json` | Yes (`Json?`) | None | Array of alternative normalized phone strings |
  | `email` | `String` | Yes (`String?`) | None | Email address |
  | `address` | `String` | Yes (`String?`) | None | Default delivery address |
  | `creditLimit` | `Float` | No | `500000` | Maximum allowable credit balance (default: 500,000 MMK) |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Relations**:
  - `salesOrders`: `SalesOrder[]`
  - `transactions`: `Transaction[]` (`@relation("TransactionCustomer")`)

---

### Model 17: `SalesOrder`
- **Table**: `SalesOrder`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `branchId` | `String` | No | None | Foreign Key referencing `Branch.id` |
  | `customerId` | `String` | Yes (`String?`) | None | Foreign Key referencing `Customer.id` |
  | `createdByStaffId` | `String` | Yes (`String?`) | None | Foreign Key referencing `Staff.id` |
  | `status` | `SalesOrderStatus` (Enum) | No | `CONFIRMED` | `DRAFT`, `CONFIRMED`, `DELIVERING`, `COMPLETED`, `CANCELLED` |
  | `paymentStatus` | `PaymentStatus` (Enum) | No | `PARTIAL` | `PARTIAL`, `PAID` |
  | `depositStatus` | `DepositStatus` (Enum) | No | `NO_PAY` | `NO_PAY`, `PARTIAL`, `PAID` |
  | `subtotal` | `Float` | No | `0` | Order subtotal before discount |
  | `discount` | `Float` | No | `0` | Discount amount |
  | `total` | `Float` | No | `0` | Agreed net total |
  | `amountPaid` | `Float` | No | `0` | Cumulative amount paid / deposit |
  | `paymentMethod` | `PaymentMethod` (Enum) | Yes (`PaymentMethod?`) | None | Initial or primary payment method |
  | `note` | `String` | Yes (`String?`) | None | Order notes |
  | `deliveryDate` | `DateTime` | Yes (`DateTime?`) | None | Requested delivery schedule date |
  | `isDelivery` | `Boolean` | No | `false` | Delivery dispatch flag |
  | `deliveryStatus` | `DeliveryStatus` (Enum) | No | `PENDING` | `PENDING`, `DELIVERED` |
  | `deliveryCustomerName` | `String` | Yes (`String?`) | None | Recipient contact name |
  | `deliveryPhone` | `String` | Yes (`String?`) | None | 11-digit normalized phone (`09...`) |
  | `deliveryAddress` | `String` | Yes (`String?`) | None | Shipping address destination |
  | `deliveryFee` | `Float` | No | `0` | Delivery service fee |
  | `deliveryFeePayer` | `DeliveryFeePayer` (Enum) | Yes (`DeliveryFeePayer?`) | None | `STORE` or `CUSTOMER` |
  | `deliveryDelivererName` | `String` | Yes (`String?`) | None | Driver / rider name |
  | `deliveryDelivererPhone`| `String` | Yes (`String?`) | None | Deliverer phone |
  | `deliveryReceiverName` | `String` | Yes (`String?`) | None | Person receiving goods |
  | `deliveryReceiverPhone`| `String` | Yes (`String?`) | None | Receiver contact phone |
  | `deliveryServiceName`  | `String` | Yes (`String?`) | None | Courier / logistics service provider name |
  | `deliveryServicePhone` | `String` | Yes (`String?`) | None | Service contact number |
  | `deliveryReceiptNumber`| `String` | Yes (`String?`) | None | External tracking / waybill number |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
  | `updatedAt` | `DateTime` | No | Auto `@updatedAt` | Timestamp |
- **Foreign Keys & Constraints**:
  - `branch`: `Branch` references `Branch.id`
  - `customer`: `Customer?` references `Customer.id`
  - `createdByStaff`: `Staff?` (`@relation("SalesOrderCreator")`) references `Staff.id`
- **Relations**:
  - `items`: `SalesOrderItem[]`
  - `payments`: `OrderPayment[]`
  - `fulfillmentTransactions`: `Transaction[]` (`@relation("SalesOrderFulfillment")`)
  - `inventoryLogs`: `InventoryLog[]` (`@relation("InventoryLogSalesOrder")`)

---

### Model 18: `SalesOrderItem`
- **Table**: `SalesOrderItem`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `salesOrderId` | `String` | No | None | Foreign Key referencing `SalesOrder.id` |
  | `variantId` | `String` | No | None | Foreign Key referencing `ProductVariant.id` |
  | `requestedQuantity` | `Int` | No | `1` | Original customer requested quantity |
  | `quantity` | `Int` | No | None | Confirmed order quantity |
  | `fulfilledQuantity` | `Int` | No | `0` | Dispatched / sold quantity count |
  | `unitPrice` | `Float` | Yes (`Float?`) | None | Agreed selling price (set upon confirmation) |
  | `unitCost` | `Float` | Yes (`Float?`) | None | MAC / cost price at confirmation |
  | `discount` | `Float` | No | `0` | Item level discount |
  | `total` | `Float` | Yes (`Float?`) | None | Line item total `(unitPrice * quantity) - discount` |
- **Foreign Keys & Constraints**:
  - `salesOrder`: `SalesOrder` references `SalesOrder.id` with `onDelete: Cascade`
  - `variant`: `ProductVariant` references `ProductVariant.id`

---

### Model 19: `OrderPayment`
- **Table**: `OrderPayment`
- **Primary Key**: `id` (String `@id @default(cuid())`)
- **Fields**:
  | Field Name | Type | Optional / Nullable | Default | Description / Constraints |
  |---|---|---|---|---|
  | `id` | `String` | No | `cuid()` | Primary Key |
  | `salesOrderId` | `String` | No | None | Foreign Key referencing `SalesOrder.id` |
  | `amount` | `Float` | No | None | Payment amount (+ for collection, - for refund) |
  | `method` | `PaymentMethod` (Enum) | No | None | `CASH`, `CARD`, `QR`, `SPLIT`, `DEBT` |
  | `note` | `String` | Yes (`String?`) | None | Payment ledger note |
  | `collectedByStaffId` | `String` | Yes (`String?`) | None | Foreign Key referencing `Staff.id` |
  | `createdAt` | `DateTime` | No | `now()` | Timestamp |
- **Foreign Keys & Constraints**:
  - `salesOrder`: `SalesOrder` references `SalesOrder.id` with `onDelete: Cascade`
  - `collectedByStaff`: `Staff?` (`@relation("OrderPaymentCollector")`) references `Staff.id`

---

## 3. Complete Database Enums Specification (12 Enums)

```prisma
enum Role {
  OWNER
  MANAGER
  CASHIER
}

enum PaymentMethod {
  CASH
  CARD
  QR
  SPLIT
  DEBT
}

enum TransactionStatus {
  COMPLETED
  VOIDED
  REFUNDED
  HELD
}

enum StockChangeReason {
  SALE
  ADJUSTMENT
  TRANSFER_IN
  TRANSFER_OUT
  PURCHASE_RECEIVED
  SALES_ORDER_DELIVERED
}

enum PurchaseOrderStatus {
  DRAFT
  ORDERED
  RECEIVED
  CANCELLED
}

enum PurchasePaymentStatus {
  NO_PAY
  PARTIAL
  PAID
}

enum ExpenseCategory {
  RENT
  ELECTRICITY
  WATER
  SALARIES
  SUPPLIES
  OTHER
}

enum SalesOrderStatus {
  DRAFT
  CONFIRMED
  DELIVERING
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PARTIAL
  PAID
}

enum DepositStatus {
  NO_PAY
  PARTIAL
  PAID
}

enum DeliveryStatus {
  PENDING
  DELIVERED
}

enum DeliveryFeePayer {
  STORE
  CUSTOMER
}
```

---

## 4. Exact Mathematical Formulas & Algorithm Implementations

### 4.1 Moving Average Cost (MAC) Formula
- **Location**: `src/app/api/purchase-orders/route.ts` (Lines 397–425)
- **Trigger**: When a Purchase Order status is transitioned to `RECEIVED`.
- **Scope**: Evaluates stock across the entire franchise for that variant to maintain uniform inventory valuation.

#### Exact Formula:
$$\text{Total Stock} = \sum_{\text{branch}} \text{StockLevel}(\text{variantId}).\text{quantity}$$

$$\text{New Cost Price} = \begin{cases} \text{incomingUnitCost}, & \text{if } \text{Total Stock} \le 0 \\ \dfrac{(\text{Total Stock} \times \text{currentCostPrice}) + (\text{incomingQuantity} \times \text{incomingUnitCost})}{\text{Total Stock} + \text{incomingQuantity}}, & \text{if } \text{Total Stock} > 0 \end{cases}$$

#### Franchise Synchronization:
1. `ProductVariant.update({ where: { id: variant.id }, data: { costPrice: newCostPrice } })`
2. `Product.update({ where: { id: variant.productId }, data: { costPrice: newCostPrice } })`
3. `ProductVariant.updateMany({ where: { productId: variant.productId }, data: { costPrice: newCostPrice } })`
4. If a non-zero `sellingPrice` is set in the purchase item, `Product.price` and all child `ProductVariant.price` records are updated identically.
5. Branch inventory is incremented via `StockLevel.upsert`: `quantity: { increment: item.quantity }`.
6. An `InventoryLog` is recorded with `reason: StockChangeReason.PURCHASE_RECEIVED` and `change: +item.quantity`.

---

### 4.2 Customer Remaining Debt Calculation & Repayment Capping Rules
- **Locations**:
  - `src/app/api/outstanding/route.ts` (Lines 28–68)
  - `src/app/api/outstanding/pay/route.ts` (Lines 50–90)
  - `src/app/(dashboard)/outstanding/page.tsx` (Lines 184–248, 517–555)

#### Debt Computation Formula:
$$\text{Delivery Fee Due} = \begin{cases} \text{SalesOrder.deliveryFee}, & \text{if } \text{SalesOrder.deliveryFeePayer} = \text{"CUSTOMER"} \\ 0, & \text{otherwise} \end{cases}$$

$$\text{Total Order Due} = \text{SalesOrder.total} + \text{Delivery Fee Due}$$

$$\text{Remaining Debt} = \max(0, \text{Total Order Due} - \text{SalesOrder.amountPaid})$$

#### Capping & Validation Rules:
1. **Eligible Order Statuses**: Orders must have `status \in {"CONFIRMED", "DELIVERING", "COMPLETED"}` and `paymentStatus \ne "PAID"`. Draft orders (`DRAFT`) cannot be settled via debt collection; they must advance deposit first.
2. **Repayment Bounds**:
   $$0 < \text{paymentAmount} \le \text{Remaining Debt}$$
   - Any payment where $\text{paymentAmount} > \text{Remaining Debt}$ is rejected with HTTP 400:
     `"Payment amount ({amount} Ks) cannot exceed remaining debt ({currentRemaining} Ks)."`
3. **Ledger & Status Update**:
   - `newAmountPaid = SalesOrder.amountPaid + paymentAmount`
   - `newPaymentStatus = (newAmountPaid >= Total Order Due) ? "PAID" : "PARTIAL"`
   - Inserts `OrderPayment` ledger row with staff attribution.
   - Logs `AuditLog` entry with action `"DEBT_COLLECTION_PAYMENT"`.

---

### 4.3 POS Minimum Selling Price / Cost Floor Protection
- **Locations**:
  - `src/app/api/pos/checkout/route.ts` (Lines 200–220)
  - `src/app/api/pos/fulfill-sales-order/route.ts` (Lines 50–57)
  - `src/app/api/sales-orders/[id]/route.ts` (Lines 48–56)
  - `src/components/pos/payment-dialog.tsx` (Lines 97–106, 249–260)

#### Cost Floor Formula:
For any line item with unit selling price $P$, line discount $D_{\text{item}}$, quantity $Q$, and moving average cost $C$:

$$\text{Effective Selling Price} = \frac{P \times Q - D_{\text{item}}}{Q} = P - \frac{D_{\text{item}}}{Q}$$

$$\text{Constraint (Cost Floor)}: \quad \text{Effective Selling Price} \ge C \quad (\text{Strictly enforced when } C > 0)$$

#### Enforcement Mechanisms:
- **POS Direct Checkout** (`/api/pos/checkout`): If $\text{Effective Selling Price} < C$, rejects transaction with HTTP 400:  
  `"Selling price for {productName} ({effective} Ks) cannot be lower than cost price ({cost} Ks)"`.
- **Wholesale Price Cap**: Wholesale prices cannot exceed catalog price ($P \le P_{\text{catalog}}$) and cannot be below cost floor ($P \ge C$).
- **Sales Order Confirmation**: In `/api/sales-orders/[id]`, confirmed prices must satisfy $C < P_{\text{agreed}} \le P_{\text{catalog}}$.

---

### 4.4 Split Payment Calculation, Rounding & Currency Conversions
- **Locations**:
  - `src/components/pos/payment-dialog.tsx` (Lines 120–133, 168–194, 275–298)
  - `src/app/api/pos/checkout/route.ts` (Lines 66–68, 225–239)
  - `src/app/api/pos/exchange-rate/route.ts` (Lines 1–9)

#### Single-Currency Model:
- The entire system operates in **Myanmar Kyat (MMK)** base currency.
- `GET/POST /api/pos/exchange-rate` returns HTTP 410 Gone: `"Currency conversion is disabled. The system uses MMK only."`
- `Transaction.currency = "MMK"`, `Transaction.exchangeRate = 1`, `Transaction.totalInMMK = Transaction.total`.

#### Split Payment Arithmetic:
1. Total payable:
   $$\text{Total Payable (MMK)} = \max(0, \text{Subtotal} - \text{Discount}_{\text{items}} - \text{Discount}_{\text{order}})$$
2. Split components:
   $$\text{Split Cash (MMK)} + \text{Split Non-Cash (MMK [Card or QR])} = \text{Total Split}$$
3. Auto-balancing on UI:
   $$\text{Split Non-Cash} = \max(0, \text{Total Payable} - \text{Split Cash})$$
4. Strict Tolerance Rule:
   $$\text{Split Cash} \ge 0 \quad \land \quad \text{Split Non-Cash} \ge 0$$
   $$\lvert \text{Total Split} - \text{Total Payable} \rvert \le 1 \quad (\text{Tolerance of } 1\text{ Ks for integer precision})$$
   Any discrepancy $> 1\text{ Ks}$ blocks checkout.

---

### 4.5 Sales Order Advance Deposit & Refund Mechanics
- **Locations**:
  - `src/app/api/sales-orders/route.ts` (Lines 45–74)
  - `src/app/api/sales-orders/[id]/route.ts` (Lines 35–115)
  - `src/app/(dashboard)/sales-orders/page.tsx` (Lines 442–519, 1498–1572)

#### Deposit Rules:
1. **Creation (`status: DRAFT`)**:
   - Customer requests items. No stock is deducted yet.
   - Advance deposit $A \ge 0$ is recorded.
   - If $A = 0 \implies \text{DepositStatus} = \text{"NO\_PAY"}$.
   - If $A > 0 \implies \text{DepositStatus} = \text{"PARTIAL"}$, and an initial `OrderPayment` record is created.
2. **Review & Confirmation (`status: CONFIRMED`)**:
   - Quantities and final selling prices are locked.
   - Stock sufficiency is verified across branches.
   - Total calculated: $\text{Total} = \sum (Q_i \times P_i) - \text{Discount}$.
   - Additional payment $\Delta A \ge 0$ can be added.
   - Constraint: $\text{Final Paid} = A + \Delta A \le \text{Total}$.
   - If $\text{Final Paid} \ge \text{Total} \implies \text{PaymentStatus} = \text{"PAID"}$, $\text{DepositStatus} = \text{"PAID"}$. Otherwise $\text{"PARTIAL"}$.
3. **Cancellation & Refund Prompt (`status: CANCELLED`)**:
   - Bounded Refund: $0 \le \text{Refund Amount} \le \text{Recorded Deposit} (A)$.
   - $\text{Final Stored Deposit} = A - \text{Refund Amount}$.
   - A negative payment record (`OrderPayment`) with `amount: -Refund Amount` is created with note `"Sales Order deposit refund"`.

---

### 4.6 Delivery State Machine & Stock Deduction Lifecycle
- **Locations**:
  - `src/app/api/pos/checkout/route.ts` (Lines 269–346)
  - `src/app/api/pos/fulfill-sales-order/route.ts` (Lines 75–116)
  - `src/app/api/delivery/status/route.ts` (Lines 23–52)

#### State Machine Flow:
```
[DRAFT Sales Order] (Stock untouched)
       │
       ▼ (Review prices & stock)
[CONFIRMED Sales Order] (Stock reserved/checked, but NOT deducted)
       │
       ▼ (Sales Voucher Fulfillment / POS Checkout)
┌─────────────────────────────────────────────────────────────┐
│  STOCK DEDUCTION STEP (Happens Exactly ONCE):               │
│  - StockLevel.quantity: decrement by quantity               │
│  - InventoryLog: reason = StockChangeReason.SALE            │
│  - SalesOrderItem.fulfilledQuantity: increment by quantity  │
└─────────────────────────────────────────────────────────────┘
       │
       ├─────────────────────────────────┐
       ▼ (In-Store Pickup)               ▼ (Dispatch to Courier)
[COMPLETED]                       [DELIVERING / deliveryStatus: PENDING]
                                         │
                                         ▼ (PATCH /api/delivery/status -> DELIVERED)
                                  [COMPLETED / deliveryStatus: DELIVERED]
                                  (NO stock deduction occurs here!)
```

#### Prevention of Double-Deduction:
1. **Single Point of Deduction**: Inventory is decremented ONLY during POS fulfillment transaction (`/api/pos/fulfill-sales-order` or immediate delivery checkout in `/api/pos/checkout`).
2. **Idempotent Delivery Status Update**: In `/api/delivery/status`, the endpoint only modifies `deliveryStatus = "DELIVERED"`, `status = "COMPLETED"`, driver/tracking numbers, and expense allocations. It executes **zero** stock adjustments.
3. **Delivery Expense Routing**:
   - If `deliveryFeePayer === "STORE"` and `deliveryFee > 0`, an `Expense` record is created under `category: ExpenseCategory.OTHER`.
   - If `deliveryFeePayer === "CUSTOMER"`, the fee is added to the customer's outstanding balance without creating a store expense.

---

## 5. Code Location Reference Table

| Feature / Logic | Primary File Path | Line Range | Key Functions / Entities |
|---|---|---|---|
| Prisma Models & Enums | `prisma/schema.prisma` | 1–448 | All 19 models & 12 enums |
| Moving Average Cost (MAC) | `src/app/api/purchase-orders/route.ts` | 397–425 | `newCostPrice = (totalStock * cost + incVal) / (totalStock + incQty)` |
| Purchase Order Status & Validation | `src/app/api/purchase-orders/route.ts` | 30–58, 174–213 | `validatePayment()`, `PATCH` handler |
| POS Checkout & Cost Floor Enforcement | `src/app/api/pos/checkout/route.ts` | 200–220, 269–346 | `effectiveSellingPrice < item.costPrice` check, stock decrement |
| Single Currency (MMK) Override | `src/app/api/pos/exchange-rate/route.ts` | 1–9 | HTTP 410 Gone response |
| Outstanding Debt Computation | `src/app/api/outstanding/route.ts` | 64–107 | `remainingDebt = total + deliveryFeeDue - amountPaid` |
| Debt Repayment Capping | `src/app/api/outstanding/pay/route.ts` | 50–99 | `amount > currentRemaining` check, `OrderPayment` creation |
| Sales Order Draft & Deposit Creation | `src/app/api/sales-orders/route.ts` | 45–75 | Draft creation, advance deposit tracking |
| Sales Order Confirmation & Refund | `src/app/api/sales-orders/[id]/route.ts` | 35–115 | `targetStatus === "CONFIRMED"`, `targetStatus === "CANCELLED"` |
| Sales Voucher Fulfillment (1x Stock Deduction) | `src/app/api/pos/fulfill-sales-order/route.ts` | 75–116 | Atomic stock decrement, `fulfilledQuantity` increment |
| Delivery Status Transition & Store Expense | `src/app/api/delivery/status/route.ts` | 23–52 | Transition to `DELIVERED`, store fee expense creation |
| Granular Permissions & Role Matrix | `src/lib/permissions.ts` | 55–187 | `DEFAULT_OWNER_PERMISSIONS`, `sanitizePermissions()` |
| Phone Number Normalization | `src/lib/phone.ts` | 1–8 | `normalizePhone()`, `isValidMyanmarPhone()` |
