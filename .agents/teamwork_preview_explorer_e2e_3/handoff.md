# E2E Test Suite Exploration & Technical Blueprint Handoff Report

## 1. Observation

Direct code and test execution observations across the codebase (`src/`, `tests/`, `prisma/`, `package.json`):

### 1.1 i18n & Display Assertions (`src/providers/language-provider.tsx`, `src/components/language-switcher.tsx`)
- **Language Provider (`src/providers/language-provider.tsx`)**:
  - Defines `Language` as `"en" | "my"`.
  - Manages `language` state (default `"en"`) and hydration guard state `isMounted` (default `false`).
  - Reads preference from `localStorage.getItem("app-language")` on client mount (line 29).
  - Persists updates via `localStorage.setItem("app-language", lang)` inside `setLanguage` (line 45) and `toggleLanguage` (line 57).
  - Provides reactive translation helper `t(en: string, my: string)` which returns `language === "my" ? my : en` (lines 66–71).
  - Provides backward compatibility aliases: `locale`, `setLocale`, `isInitialized` (lines 80–82).
  - Throws explicit runtime error if `useLanguage()` is called outside `LanguageProvider`: `"useLanguage must be used within a LanguageProvider"` (line 97).
- **Language Switcher UI (`src/components/language-switcher.tsx`)**:
  - Consumes `useLanguage()`, uses `isMounted` guard to render `"EN"` prior to hydration (line 10).
  - Switches between `EN` and `မြန်မာ` with single-language display attributes (`aria-label`, `title`).
- **Existing Language Unit Test (`tests/unit/language-switcher.test.ts`)**:
  - Execution command: `npm run test:language` (`npx tsx tests/unit/language-switcher.test.ts`).
  - **Verbatim Error Output**:
    ```text
    TEST 4: Context Methods (setLocale & toggleLanguage) Execution
      ❌ ASSERT FAIL: context.setLocale('my') actually invoked LanguageProvider setLocale and wrote 'my' to localStorage
         Expected: "my", Got: "en"
    Test Suite Failed: AssertionError [ERR_ASSERTION]: context.setLocale('my') actually invoked LanguageProvider setLocale and wrote 'my' to localStorage
    ```
  - **Root Cause**: `LanguageProvider` reads/writes key `"app-language"` (`src/providers/language-provider.tsx:29,45`), but `tests/unit/language-switcher.test.ts` lines 99, 228, 245, 253, 260, 267 assert against mock key `"language"`.

### 1.2 Multi-Branch Data Isolation & Access Governance (`prisma/schema.prisma`, `src/app/api/`)
- **Data Model Architecture (`prisma/schema.prisma`)**:
  - Entities with direct `branchId` relation: `Staff` (line 101), `StockLevel` (line 158), `SalesOrder` (line 315), `PurchaseOrder` (line 239), `Transaction` (line 183), `Expense` (line 266), `InventoryLog` (line 169), `ExchangeRate` (line 283).
  - Composite constraint on stock: `@@unique([branchId, variantId])` (line 164), enforcing strict branch-level inventory separation.
  - Role Enums (line 15–19): `OWNER`, `MANAGER`, `CASHIER`.
  - Sales Order Status Enum (line 60–64): `enum SalesOrderStatus { CONFIRMED, COMPLETED, CANCELLED }`. Note: Statuses `"DELIVERED"`, `"DRAFT"`, or `"SHIPPED"` do NOT exist in the database schema.
- **Route Authorization Enforcement**:
  - `src/app/api/inventory/route.ts` line 70: `if (staff.role === "CASHIER")` returns `403 Access Denied`.
  - `src/app/api/inventory/route.ts` line 79: `staff.role === "MANAGER"` restricts query strictly to `staff.branchId`. `OWNER` can supply any `branchId`.
  - `src/app/api/sales-orders/route.ts` line 16: Manager attempting to access another branch's orders returns `403 Access Denied`. Cashier attempting POST returns `403 Access Denied` (line 152).
  - `src/app/api/expenses/route.ts` & `src/app/api/purchase-orders/route.ts`: Similar Cashier 403 block and Manager branch locking.

### 1.3 Existing Integration Test Setup (`tests/integration/`)
- **Package Scripts (`package.json`)**:
  - `"test:integrity"`: `npx tsx tests/integration/financial-inventory-integrity.test.ts`
  - `"test:challenger"`: `npx tsx tests/integration/challenger-stress-test.test.ts`
  - `"test:language"`: `npx tsx tests/unit/language-switcher.test.ts`
- **Execution Result: `npm run test:integrity`**:
  - **Verbatim Error Output**:
    ```text
    prisma:error 
    Invalid `tx.salesOrder.create()` invocation in C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\src\app\api\sales-orders\route.ts:248:48
      status: "DELIVERED",
              ~~~~~~~~~~~
    Invalid value for argument `status`. Expected SalesOrderStatus.
      ❌ ASSERT FAIL: Direct DELIVERED Sales Order creation should return 200
         Expected: 200, Got: 500
    ```
  - **Root Cause**: `tests/integration/financial-inventory-integrity.test.ts:134` sends `status: "DELIVERED"`. `SalesOrderStatus` enum in `prisma/schema.prisma` only accepts `CONFIRMED`, `COMPLETED`, `CANCELLED`.
- **Execution Result: `npm run test:challenger`**:
  - **Verbatim Error Output**:
    ```text
    SECTION 1: Boundary & Invalid Input Attacks
      ✅ ASSERT PASS: SO creation with unitPrice < costPrice must be rejected with 400 (Value: 400)
      ...
    SECTION 2: Rapid State Change & Edge-Case Transitions
    Unhandled error in challenger stress suite: TypeError: Cannot read properties of undefined (reading 'id')
        at runChallengerStressTestSuite (C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\tests\integration\challenger-stress-test.test.ts:230:39)
    ```
  - **Root Cause**: `tests/integration/challenger-stress-test.test.ts:223` passes `status: "DRAFT"` to `postSO`. Prisma fails with validation error, `postSO` returns status 500 without an `order` property, causing `flurrySOData.order.id` on line 230 to throw `TypeError`.

---

## 2. Logic Chain

1. **i18n Logic Chain**:
   - Observation: `LanguageProvider` writes to `localStorage` key `"app-language"` (line 45 of `src/providers/language-provider.tsx`).
   - Observation: `tests/unit/language-switcher.test.ts` tests mock storage against key `"language"` (lines 99, 245).
   - Inference: The test failure in `test:language` is a test script mock key mismatch. The application code correctly persists `"app-language"` and provides single-language display via `t(en, my)` and `isMounted` hydration protection.

2. **Multi-Branch Data Isolation Logic Chain**:
   - Observation: Schema models `StockLevel` with composite key `[branchId, variantId]`, and foreign keys `branchId` on `SalesOrder`, `PurchaseOrder`, `Expense`, and `Transaction`.
   - Observation: Route handlers (`/api/inventory`, `/api/sales-orders`, `/api/expenses`) check `staff.role`. Cashiers get `403 Access Denied`. Managers are forced to `effectiveBranchId = staff.branchId`. Owners can override `branchId`.
   - Inference: Multi-branch isolation is enforced at both data model (foreign keys & constraints) and route handler authorization layers.

3. **Existing Integration Test Failure Logic Chain**:
   - Observation: `prisma/schema.prisma` lines 60–64 define `enum SalesOrderStatus { CONFIRMED, COMPLETED, CANCELLED }`.
   - Observation: `tests/integration/financial-inventory-integrity.test.ts` sends `status: "DELIVERED"`. `tests/integration/challenger-stress-test.test.ts` sends `status: "DRAFT"`.
   - Observation: Prisma client throws runtime validation errors on both enum mismatches, causing API status 500 responses and unhandled test exceptions.
   - Inference: Existing test scripts rely on obsolete/invalid enum values. Updating tests to pass valid `SalesOrderStatus` enum values (`CONFIRMED`, `COMPLETED`, `CANCELLED`) or updating schema/routes will allow full test execution.

---

## 3. Caveats

- **Test Runner Dependency**: Currently, tests are run via `npx tsx` standalone Node scripts using `node:assert`. Vitest is not installed in `package.json`. The proposed blueprint can run via `npx tsx` or via `vitest` once added.
- **Database Mutability**: Integration test scripts execute directly against the active SQLite/MySQL database (configured in `DATABASE_URL`). Clean test fixtures or transaction rollbacks are recommended to prevent state pollution across runs.

---

## 4. Conclusion

1. **i18n Implementation**: Fully functional in `src/providers/language-provider.tsx` with `t(en, my)` helper, `"app-language"` `localStorage` key, and hydration safety. The `npm run test:language` failure is caused by a key mismatch in the test mock (`"language"` vs `"app-language"`).
2. **Multi-Branch Isolation**: Strict data isolation enforced via `branchId` foreign keys and composite unique indexes in `schema.prisma`. Permission matrix correctly denies Cashiers (403), locks Managers to `staff.branchId`, and grants Owners multi-branch visibility.
3. **Integration Test Suite**: `financial-inventory-integrity.test.ts` and `challenger-stress-test.test.ts` fail due to invalid `SalesOrderStatus` enum values (`"DELIVERED"`, `"DRAFT"`) submitted to `postSO`.
4. **Blueprint for E2E Integration Test Suite (`tests/integration/e2e-system-suite.test.ts`)**: Structured into 6 automated phases as detailed below.

---

## 5. Technical Blueprint for E2E System Suite (`tests/integration/e2e-system-suite.test.ts`)

### Suite Architecture & Structure

File Location: `tests/integration/e2e-system-suite.test.ts`
Execution Command: `npm run test:e2e` (`npx tsx tests/integration/e2e-system-suite.test.ts`)

```text
tests/integration/e2e-system-suite.test.ts
├── Phase 1: i18n & Display Assertion Validation
├── Phase 2: Multi-Branch & Role-Based Access Control Governance
├── Phase 3: PO Intake -> Inventory Restock -> Sales Order Fulfillment
├── Phase 4: Payment Gateway, Partial Payments & Refund Ledger Balance
├── Phase 5: High-Frequency POS Checkout Concurrency & Stress Attack
└── Phase 6: System-Wide Forensic Balance & Zero-Drift Audit
```

### Detailed Phase Specifications

#### Phase 1: i18n & Display Assertion Validation
- Validate `LanguageProvider` state transitions between `"en"` and `"my"`.
- Assert `localStorage.getItem("app-language")` persistence.
- Test exception resilience against blocked storage (`SecurityError` on `getItem`) and quota overflow (`QuotaExceededError` on `setItem`).
- Assert `t(en, my)` reactive output for UI component strings.

#### Phase 2: Multi-Branch Data Isolation & Access Governance
- **Role Permissions Matrix**:
  - Cashier session (`role: "CASHIER"`): Assert `403 Access Denied` on GET/POST `/api/inventory`, GET/POST `/api/sales-orders`, GET/POST `/api/purchase-orders`, GET/POST `/api/expenses`.
  - Manager session (`role: "MANAGER"`, `branchId: "branch-1"`): Assert successful access to `branch-1`. Assert `403 Access Denied` when requesting `branch-2` data.
  - Owner session (`role: "OWNER"`): Assert full multi-branch query capability across all branches.
- **Data Isolation**: Verify `StockLevel` quantity for `variant-X` is tracked independently across `branch-1` and `branch-2`.

#### Phase 3: PO Intake -> Inventory Restock -> Sales Order Fulfillment
- Create PO with `status: "DRAFT"` via `/api/purchase-orders`.
- Update PO to `status: "RECEIVED"`: Assert `StockLevel` quantity increments by PO item quantity and `InventoryLog` entry (`reason: "PURCHASE_RECEIVED"`) is created.
- Verify parent `Product.price` is protected and NOT mutated by PO line item cost/selling price.
- Create Sales Order with valid `status: "CONFIRMED"` via `/api/sales-orders`.
- Update Sales Order to `status: "COMPLETED"`: Assert physical stock decrements by order quantity and `InventoryLog` (`reason: "SALES_ORDER_DELIVERED"`) is created.
- Assert selling price vs cost price rule: Reject SO creation with `400 Bad Request` if unit price < cost price.
- Assert insufficient stock rule: Reject SO creation with `400 Bad Request` if requested quantity > available stock.

#### Phase 4: Payment Gateway, Partial Payments & Refund Ledger Balance
- Create Sales Order with `paymentStatus: "PARTIAL"` and `amountPaid >= 10% total`: Assert order created successfully and `OrderPayment` ledger entry created.
- Update Sales Order to `paymentStatus: "PAID"`: Assert `amountPaid` locks to full order total.
- Cancel Sales Order with `status: "CANCELLED"` and `refundAmount`:
  - Assert `amountPaid` returns to 0.
  - Assert physical stock is restored to pre-order baseline.
  - Assert `OrderPayment` ledger sum equals 0.
  - Assert duplicate cancellation returns `400 Bad Request`.
  - Assert refund amount > `amountPaid` returns `400 Bad Request`.

#### Phase 5: High-Frequency POS Checkout Concurrency & Stress Attack
- Execute 10+ concurrent POS checkout POST requests (`/api/pos/checkout`) using `Promise.all`.
- Assert all requests return status 200.
- Assert total physical stock deduction matches exact aggregate quantity sold without race conditions or stock leaks.

#### Phase 6: System-Wide Forensic Balance & Zero-Drift Audit
- **Stock Audit Formula**:
  $$\text{StockLevel.quantity} = \text{Initial Stock} + \sum \text{PO Received} - \sum \text{POS Completed} - \sum \text{SO Completed} + \sum \text{SO Cancelled}$$
- **Financial Ledger Formula**:
  $$\text{SalesOrder.amountPaid} = \sum \text{OrderPayment.amount} \quad \text{for 100\% of sales orders}$$

---

## 6. Verification Method

1. **Language Unit Test Verification**:
   ```bash
   npm run test:language
   ```
   *Expected result after fix*: All assertions pass.

2. **Integrity Test Verification**:
   ```bash
   npm run test:integrity
   ```
   *Expected result*: Status enum alignment resolves 500 error.

3. **Challenger Stress Test Verification**:
   ```bash
   npm run test:challenger
   ```
   *Expected result*: Status enum alignment resolves TypeError.

4. **E2E System Suite Verification**:
   ```bash
   npx tsx tests/integration/e2e-system-suite.test.ts
   ```
   *Expected result*: All 6 blueprint phases execute and pass.
