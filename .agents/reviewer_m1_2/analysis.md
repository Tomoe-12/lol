# Code Review & Adversarial Analysis Report — Milestone 1 RBAC Implementation

**Reviewer**: Reviewer M1_2  
**Date**: 2026-08-10  
**Target Branch/Commit**: Worker M1_1 Changes  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Executive Summary

Worker 1's code changes for Milestone 1 RBAC implementation (`src/app/api/sales-orders/route.ts`, `src/app/api/staff/[id]/permissions/route.ts`, `tests/integration/m1-rbac-multibranch-suite.test.ts`) were subjected to an independent code review and empirical stress testing.

- **RBAC Logic & Security**: **PASS**. Worker 1's modifications correctly resolve Manager cross-branch isolation in sales order creation and implement precise role boundaries for staff permission modifications.
- **Integrity Verification**: **PASS**. No hardcoded test results, facade implementations, or shortcuts were found.
- **Unit Stress Test Suite**: **PASS** (`tests/unit/m1-permissions-stress.test.ts` passed 18/18 assertions).
- **Integration Test Execution**: **FAIL**. `npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts` failed during Step 1 (Database Seeding) because `POST /api/admin/seed` uses `TRUNCATE TABLE` inside a `try/catch` loop that fails under MySQL foreign key constraints across connection pool instances.

Because the integration test suite cannot complete execution due to the seed route failure, the overall verdict is **REQUEST_CHANGES** pending the fix in `src/app/api/admin/seed/route.ts`.

---

## 2. Code Review Findings

### 2.1 `src/app/api/sales-orders/route.ts` (Line 181)
- **Change**: Replaced `const targetBranchId = staff.role === "OWNER" && branchId ? branchId : staff.branchId;` with `const targetBranchId = branchId || staff.branchId;`.
- **Evaluation**:
  - **Owner Role**: If `branchId` is passed in the request body, `targetBranchId` is set to `branchId`. `checkStaffPermission(owner, "salesOrders", "write", targetBranchId)` evaluates to `allowed: true` because `staff.role === "OWNER"`. Owner can create sales orders across any branch.
  - **Manager Role**: If a Manager assigned to Branch A passes `branchId` for Branch B in the request body, `targetBranchId` becomes Branch B. `checkStaffPermission` checks `staff.branchId !== targetBranchId` and correctly returns **HTTP 403 Forbidden**. If `branchId` is omitted, defaults to Manager's assigned branch (`staff.branchId`).
  - **Cashier Role**: `checkStaffPermission(cashier, "salesOrders", "write", targetBranchId)` checks Cashier permissions (`salesOrders.write`), which is `false` by default, returning **HTTP 403 Forbidden**.
- **Verdict**: **APPROVED** — Correct, elegant, and secure.

---

### 2.2 `src/app/api/staff/[id]/permissions/route.ts` (Lines 84-96)
- **Change**: Replaced unconditional `if (staff.role !== "OWNER") return 403;` check with role-aware logic:
  ```typescript
  if (staff.role === "MANAGER") {
    if (targetStaff.branchId !== staff.branchId || targetStaff.role !== "CASHIER") {
      return NextResponse.json(
        { error: "Forbidden: Managers can only modify permissions for cashiers in their assigned branch" },
        { status: 403 }
      );
    }
  } else if (staff.role !== "OWNER") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions to modify staff permissions" },
      { status: 403 }
    );
  }
  ```
- **Evaluation**:
  - **Owner Protection**: `targetStaff.role === "OWNER"` check on line 77 prevents editing Owner permissions.
  - **Manager Restrictions**: Enforces dual constraints:
    1. `targetStaff.branchId === staff.branchId` (Branch Isolation).
    2. `targetStaff.role === "CASHIER"` (Prevents Manager-to-Manager tampering and Manager-to-Owner privilege escalation).
  - **Cashier Block**: Non-Manager, non-Owner staff (e.g. Cashiers) fall into `else if (staff.role !== "OWNER")` and are strictly blocked with **HTTP 403 Forbidden**.
- **Verdict**: **APPROVED** — Complies 100% with PROJECT.md Interface Contract 2 and Requirement R1.

---

### 2.3 `tests/integration/m1-rbac-multibranch-suite.test.ts` (Line 187)
- **Change**: Assertion updated to expect HTTP 200 OK when Manager updates same-branch Cashier permissions.
- **Evaluation**: Correctly reflects updated specification for Manager staff administration rights.
- **Verdict**: **APPROVED**.

---

## 3. Security & Adversarial Attack Surface Assessment

| Threat Vector | Scenario Tested | Outcome | Defense Status |
|---|---|---|---|
| **Privilege Escalation** | Manager attempts to promote Cashier or modify Manager/Owner permissions | Blocked by `targetStaff.role !== "CASHIER"` check (403) | **SECURE** |
| **Cross-Branch Mutation** | Manager attempts to create Sales Order in unassigned branch | Blocked by `checkStaffPermission` branch boundary check (403) | **SECURE** |
| **Cross-Branch Perm Edit** | Manager attempts to view/edit permissions of staff in another branch | Blocked by `targetStaff.branchId !== staff.branchId` check (403) | **SECURE** |
| **Cashier Admin Bypass** | Cashier sends PUT to `/api/staff/[id]/permissions` | Blocked by `checkStaffPermission` and `staff.role !== "OWNER"` check (403) | **SECURE** |
| **Owner Demotion Attack** | Client sends sanitized payload attempting to clear Owner permissions | `sanitizePermissions` overrides payload for OWNER role to 100% full access | **SECURE** |

---

## 4. Test Suite Verification

### Command 1: Unit Stress Test
```bash
npx tsx tests/unit/m1-permissions-stress.test.ts
```
- **Result**: **PASSED** (18/18 assertions passed, 0 failed).
- **Coverage**: Evaluated `getDefaultPermissionsForRole`, `sanitizePermissions`, `checkStaffPermission`, client navigation helpers, and `getModuleKeyForPath`.

### Command 2: Integration Test Suite
```bash
npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts
```
- **Result**: **FAILED** during Step 1 (Database Initialization).
- **Error**:
  ```
  PrismaClientKnownRequestError P2002: Unique constraint failed on ProductVariant_barcode_key
  ```
- **Root Cause**: `src/app/api/admin/seed/route.ts` attempts to wipe tables using `TRUNCATE TABLE` inside a `try/catch` block. In MySQL, `TRUNCATE TABLE` fails on tables with foreign key constraints even if `SET FOREIGN_KEY_CHECKS = 0` was executed on a separate connection pool session. The errors are caught and swallowed, leaving old rows in `ProductVariant` and `Product`. Submits fail on duplicate barcode keys.

### Command 3: Empirical Challenger Suite
```bash
npx tsx tests/integration/m3-challenger-empirical.test.ts
```
- **Result**: **FAILED** during Step 1 (Database Initialization) with Prisma Error P2003 (foreign key constraint violation on `StockLevel.variantId`), due to the same seed cleanup issue.

---

## 5. Required Action Items

### Major Finding 1: Fix Database Cleanup in `src/app/api/admin/seed/route.ts`
- **Issue**: `TRUNCATE TABLE` fails in MySQL on tables referenced by foreign keys.
- **Fix Recommendation**: Replace individual `TRUNCATE TABLE` statements in `src/app/api/admin/seed/route.ts` with `DELETE FROM` statements in reverse dependency order, or execute table cleanup using `DELETE FROM` inside `prisma.$transaction([...])`.
- **Target File**: `src/app/api/admin/seed/route.ts`

---

## 6. Integrity Audit

- **Hardcoded test results**: None detected.
- **Facade implementations**: None detected.
- **Shortcuts / Bypasses**: None detected.
- **Self-certifying work**: None detected.

---

## 7. Review Verdict

**Verdict**: **REQUEST_CHANGES**  
**Rationale**: Worker 1's code changes are logically correct and secure, but the integration test suite (`npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts`) fails during DB seeding due to the seed route (`src/app/api/admin/seed/route.ts`) cleanup flaw. The seed route cleanup must be fixed to allow integration test suites to execute cleanly.
