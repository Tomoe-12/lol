# File Changes Log — Worker M1_3 (Seeder Fail-Proofing)

## Summary of Changes

### Modified Files:
- `src/app/api/admin/seed/route.ts`

### Detailed Changes in `src/app/api/admin/seed/route.ts`:
- Refactored database cleanup logic in `POST /api/admin/seed` (lines 33–66).
- Wrapped table deletion statements inside a single Prisma `$transaction` array containing `$executeRawUnsafe` calls:
  1. `SET FOREIGN_KEY_CHECKS = 0;`
  2. `DELETE FROM \`OrderPayment\`;`
  3. `DELETE FROM \`SalesOrderItem\`;`
  4. `DELETE FROM \`SalesOrder\`;`
  5. `DELETE FROM \`AuditLog\`;`
  6. `DELETE FROM \`InventoryLog\`;`
  7. `DELETE FROM \`TransactionItem\`;`
  8. `DELETE FROM \`Transaction\`;`
  9. `DELETE FROM \`StockLevel\`;`
  10. `DELETE FROM \`PurchaseItem\`;`
  11. `DELETE FROM \`PurchaseOrder\`;`
  12. `DELETE FROM \`Expense\`;`
  13. `DELETE FROM \`ExchangeRate\`;`
  14. `DELETE FROM \`ProductVariant\`;`
  15. `DELETE FROM \`Product\`;`
  16. `DELETE FROM \`Category\`;`
  17. `DELETE FROM \`Staff\`;`
  18. `DELETE FROM \`Supplier\`;`
  19. `DELETE FROM \`Customer\`;`
  20. `DELETE FROM \`Branch\`;`
  21. `SET FOREIGN_KEY_CHECKS = 1;`
- Wrapped the `$executeRawUnsafe` `$transaction` in a `try / catch` block with fallback to `prisma.$transaction([ ...deleteMany() ])` for non-MySQL environments or DB drivers that do not support raw foreign key check configuration.
- Ensured all raw SQL statements run on the EXACT same database connection session within Prisma's transaction, preventing foreign key constraint failures during repeated sequential database seeding calls.
