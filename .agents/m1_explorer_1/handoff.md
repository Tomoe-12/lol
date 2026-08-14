# Handoff Report — Explorer 1 (Milestone M1: Schema & Permission Core Data Model)

## 1. Observation

### Current `Staff` Model in `prisma/schema.prisma` (lines 95-111)
```prisma
model Staff {
  id        String   @id @default(cuid())
  clerkId   String?  @unique
  password  String   @default("123456")
  name      String
  email     String   @unique
  pin       String?
  role      Role     @default(CASHIER)
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions  Transaction[]
  auditLogs     AuditLog[]
  exchangeRates ExchangeRate[]
}
```

### Validation & CLI Tool Behavior
- `npx prisma validate`: Output:
  ```
  Environment variables loaded from .env
  Prisma schema loaded from prisma\schema.prisma
  The schema at prisma\schema.prisma is valid 🚀
  ```
- `npx prisma generate`: When executed while Node/Next.js dev processes hold locks on Prisma binary files, Windows reports:
  ```
  Error: EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp' -> '...query_engine-windows.dll.node'
  ```

---

## 2. Logic Chain

1. **Requirement Mapping**: Requirement R1 requires storing granular read and write permissions per staff member for 9 primary app modules (`dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`).
2. **Schema Field Addition**: Adding an optional `permissions Json?` field to the `Staff` model allows storing arbitrary JSON structures (such as a 9-module `StaffPermissions` map) per staff member while allowing `null` for legacy or uncustomized staff records.
3. **Placement**: Placing `permissions Json?` right after `role Role @default(CASHIER)` (line 103) maintains a logical layout for authentication and authorization fields.
4. **Client Code Generation**: Running `npx prisma generate` updates `@prisma/client` TypeScript declarations so that `Staff.permissions` is typed as `Prisma.JsonValue | null`.
5. **Database Migration / Push**: Executing `npx prisma db push` (or `npx prisma migrate dev`) synchronizes the target database table with the updated schema.
6. **Windows EPERM Resolution**: If `npx prisma generate` fails with `EPERM` due to `query_engine-windows.dll.node` locking, stopping active dev servers or retrying generation resolves the lock issue.

---

## 3. Caveats

- **Null Safety**: Existing database staff rows will have `permissions = null`. Helper functions in `src/lib/permissions.ts` and `src/lib/auth-helper.ts` MUST fall back to `DEFAULT_PERMISSIONS[staff.role]` when `staff.permissions` is `null` or missing keys.
- **Provider Compatibility**: `prisma/schema.prisma` declares `provider = "mysql"`. In Prisma, `Json?` is fully supported across MySQL, PostgreSQL, and SQLite.
- **Process Locks on Windows**: Next.js background workers may lock `query_engine-windows.dll.node`, producing `EPERM` during `npx prisma generate`. Ensure background dev servers are paused or restarted if `EPERM` occurs.

---

## 4. Conclusion

### Precise Formulated Change for `prisma/schema.prisma`
Replace lines 95-106 of `prisma/schema.prisma`:

**Before**:
```prisma
model Staff {
  id        String   @id @default(cuid())
  clerkId   String?  @unique
  password  String   @default("123456")
  name      String
  email     String   @unique
  pin       String?
  role      Role     @default(CASHIER)
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
```

**After**:
```prisma
model Staff {
  id          String   @id @default(cuid())
  clerkId     String?  @unique
  password    String   @default("123456")
  name        String
  email       String   @unique
  pin         String?
  role        Role     @default(CASHIER)
  permissions Json?
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
```

### Actionable Implementation Sequence
1. Modify `prisma/schema.prisma` with the formulated `permissions Json?` field.
2. Run `npx prisma generate` (ensure no active processes lock `query_engine-windows.dll.node`).
3. Run `npx prisma db push` (or `npx prisma migrate dev`).
4. Run `npm run build` to verify type checking.

---

## 5. Verification Method

To independently verify the schema modification and client generation:

1. **Schema Validation**:
   ```bash
   npx prisma validate
   ```
   *Expected result*: "The schema at prisma\schema.prisma is valid 🚀".

2. **Prisma Client Generation**:
   ```bash
   npx prisma generate
   ```
   *Expected result*: Generated Prisma Client in `node_modules/@prisma/client`.

3. **Database Schema Synchronization**:
   ```bash
   npx prisma db push
   ```
   *Expected result*: Database updated, `Staff` table includes `permissions` JSON column.

4. **TypeScript Verification**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: No compilation errors related to `Staff.permissions`.
