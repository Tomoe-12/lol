# File Changes Summary - Worker M1_2

## Modified Files

### `src/app/api/admin/seed/route.ts`
- **Location**: `src/app/api/admin/seed/route.ts` (lines 32-65)
- **Change**: Replaced fragile individual `TRUNCATE TABLE \`${table}\`` loop queries with a single atomic `prisma.$transaction([ ... ])` block executing model deletion in exact reverse dependency order across all 19 Prisma schema models:
  - `OrderPayment`, `SalesOrderItem`, `SalesOrder`, `AuditLog`, `InventoryLog`, `TransactionItem`, `Transaction`, `StockLevel`, `PurchaseItem`, `PurchaseOrder`, `Expense`, `ExchangeRate`, `ProductVariant`, `Product`, `Category`, `Staff`, `Supplier`, `Customer`, `Branch`.
- **FK Checks**: Safely wrapped with `SET FOREIGN_KEY_CHECKS = 0;` and `SET FOREIGN_KEY_CHECKS = 1;` in try-catch blocks to prevent foreign key issues on MySQL connection pools while maintaining cross-database compatibility (e.g. SQLite/PostgreSQL).
- **Rationale**: Individual `TRUNCATE TABLE` calls execute on separate connections pulled from Prisma's connection pool, causing connection-scoped `SET FOREIGN_KEY_CHECKS = 0` to be lost on subsequent calls and throwing foreign key constraint errors (`#1701`). Deleting in reverse dependency order inside `prisma.$transaction` guarantees single-connection execution with zero foreign key constraint conflicts.
