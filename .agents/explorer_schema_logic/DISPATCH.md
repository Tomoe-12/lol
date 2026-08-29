## 2026-08-29T02:48:14Z
Task:
Perform a deep, exhaustive technical inspection of the database schema and business logic in the codebase (C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon).

Investigate:
1. Inspect prisma/schema.prisma thoroughly:
   - Identify and document all 19 Prisma database tables/models: Branch, Staff, Product, ProductVariant, StockLevel, InventoryLog, Transaction, TransactionItem, Customer, SalesOrder, SalesOrderItem, OrderPayment, Supplier, PurchaseOrder, PurchaseItem, Expense, AuditLog, ExchangeRate, and any 19th table/enum.
   - For every table, extract: Field name, Prisma Data Type, Nullability/Optionality, Default values, Primary Keys, Foreign Keys, Relational constraints (onDelete, onUpdate), and compound indexes (e.g. @@unique([branchId, variantId]), @@index, etc.).
   - Extract all Enums (Role, OrderStatus, PaymentMethod, TransactionType, InventoryAction, etc.).

2. Inspect src/lib/ and src/services/ and business logic implementations:
   - Extract exact mathematical formulas and algorithm logic:
     - Moving Average Cost (MAC) formula when receiving Purchase Orders.
     - Remaining Debt calculation & capping rules for customer outstanding repayments.
     - POS minimum selling price / cost floor protection against cost price / MAC.
     - Split payment calculation, rounding, exchange rate conversions (MMK, USD, etc.).
     - Sales order deposit calculation (10% advance deposit rules, refund prompts on cancellation).
     - Delivery state machine stock deduction logic (when stock is decremented, prevention of double-deduction).

Output Requirements:
Write your comprehensive findings to C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_schema_logic\report.md and write a handoff report to C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_schema_logic\handoff.md.
Send a completion message back to parent when finished with your key findings and file paths.
