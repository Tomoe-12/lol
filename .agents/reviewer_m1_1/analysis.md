# Review & Adversarial Stress Analysis — Milestone 1 (Worker M1_1)

**Reviewer**: Reviewer M1_1 (Roles: reviewer, critic)  
**Date**: 2026-08-10  
**Target Handoff / Changes**: `src/app/api/sales-orders/route.ts`, `src/app/api/staff/[id]/permissions/route.ts`, `tests/integration/m1-rbac-multibranch-suite.test.ts`  
**Verdict**: **APPROVE**

---

## 1. Executive Verdict & Rationale

**Verdict**: **APPROVE**

Worker 1 (`worker_m1_1`) has successfully addressed all Milestone 1 (R1) requirements and resolved the targeted authorization defects without introducing regressions or side effects.

### Rationale:
1. **Sales Orders Cross-Branch Isolation (`src/app/api/sales-orders/route.ts`)**:
   - Fixed `const targetBranchId` calculation on Line 181 from forcing `staff.branchId` for non-owners to `const targetBranchId = branchId || staff.branchId;`.
   - Delegates cross-branch enforcement to `checkStaffPermission(staff, "salesOrders", "write", targetBranchId)`. When a MANAGER passes `branchId !== staff.branchId`, `checkStaffPermission` validates branch alignment and rejects the request with HTTP 403 Forbidden.

2. **Manager Staff Permission Admin Boundaries (`src/app/api/staff/[id]/permissions/route.ts`)**:
   - Replaced the hardcoded non-Owner block in `PUT` handler with precise role-based boundaries:
     - **OWNER**: Can modify permissions for any non-owner staff across any branch.
     - **MANAGER**: Can modify permissions **only** for `CASHIER` staff belonging to the manager's assigned branch (`targetStaff.branchId === staff.branchId`). Cross-branch attempts or attempts to modify non-cashier staff (e.g. other managers or owner) return HTTP 403 Forbidden.
     - **CASHIER**: Strictly blocked with HTTP 403 Forbidden.

3. **Integrity Violation Analysis**:
   - **No Hardcoded Outputs**: Code contains no fake responses or hardcoded test values.
   - **No Facade Implementations**: Permission checks execute real database lookups and evaluate authentic user attributes and roles.
   - **No Self-Certifying Bypass**: Verification executed via independent, multi-role test suites.

---

## 2. Test Execution & Independent Verification

All three required test suites were executed independently and passed with 100% pass rates:

| Test Suite | Command | Result | Pass/Fail |
|------------|---------|--------|-----------|
| **Unit Permissions Stress Suite** | `npx tsx tests/unit/m1-permissions-stress.test.ts` | 18 / 18 Assertions Passed | **PASS** |
| **M1 RBAC Multibranch Integration Suite** | `npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts` | 84 / 84 Assertions Passed | **PASS** |
| **M3 Challenger Empirical Suite** | `npx tsx tests/integration/m3-challenger-empirical.test.ts` | 32 / 32 Assertions Passed | **PASS** |

### Verification Evidence:

1. `tests/unit/m1-permissions-stress.test.ts`:
   - Verified `getDefaultPermissionsForRole`, `sanitizePermissions` demotion prevention, malformed JSON fallback, interlocking constraint (`write: true` forces `read: true`), and `checkStaffPermission` bypass/isolation rules.

2. `tests/integration/m1-rbac-multibranch-suite.test.ts`:
   - Verified Owner 100% access across 18 routes and 11 modules.
   - Verified Manager cross-branch PO and Sales Order isolation.
   - Verified Manager updating same-branch Cashier permissions (returns 200 OK).
   - Verified Manager cross-branch staff permission view attempt (returns 403 Forbidden).
   - Verified Cashier strict HTTP 403 blocking on 9 restricted API endpoints.
   - Verified multi-branch data isolation (Hledan stock adjustment did not affect Tamwe stock level).

3. `tests/integration/m3-challenger-empirical.test.ts`:
   - Verified 401 Unauthorized for unauthenticated requests.
   - Verified 403 Forbidden for Cashiers accessing restricted endpoints.
   - Verified 403 Forbidden for Managers attempting cross-branch mutations across 7 endpoints.
   - Verified 200/201 Success for authorized Owner and Manager same-branch actions.

---

## 3. Adversarial Criticism & Stress-Testing

As an adversarial critic, the implementation was stress-tested against potential failure modes:

| Attack Scenario / Edge Case | Expected Behavior | Actual Behavior | Result |
|-----------------------------|-------------------|-----------------|--------|
| **Manager attempts to edit another Manager's permissions in the same branch** | HTTP 403 Forbidden | `targetStaff.role !== "CASHIER"` check triggers HTTP 403 | **PASS** |
| **Manager attempts to edit Owner permissions** | HTTP 403 Forbidden | Handled by `targetStaff.role === "OWNER"` check (returns 403) | **PASS** |
| **Cashier attempts `PUT` to modify any permissions** | HTTP 403 Forbidden | Falls into `else if (staff.role !== "OWNER")` block (returns 403) | **PASS** |
| **Manager sends Sales Order creation payload targeting another branch** | HTTP 403 Forbidden | `checkStaffPermission` detects `staff.branchId !== targetBranchId` and returns HTTP 403 | **PASS** |
| **Manager sends Sales Order creation payload without `branchId`** | Order created in Manager's assigned branch | `targetBranchId` defaults to `staff.branchId`, permission check passes for assigned branch | **PASS** |
| **Demoted Owner permission input submitted to `sanitizePermissions`** | Ignore demotion, maintain 100% full access | `sanitizePermissions` forces all permissions to `true` for `OWNER` role | **PASS** |

---

## 4. Layout & Side-Effect Assessment

- **Layout Compliance**: All modifications are contained within `src/app/api/` and `tests/integration/`. The `.agents/` directory is used exclusively for metadata.
- **Side Effects**: None. Changes are tightly scoped to permission validation and branch assignment logic.

---

## 5. Verified Claims Summary

- [x] Owner has full access across all modules and branches — *Verified via Unit and Integration tests*
- [x] Manager is blocked with 403 from cross-branch Sales Orders creation — *Verified via M1 suite and empirical tests*
- [x] Manager can modify permissions for same-branch Cashiers — *Verified via `PUT /api/staff/[id]/permissions` test (200 OK)*
- [x] Manager is blocked with 403 from modifying cross-branch or non-Cashier permissions — *Verified via empirical suite*
- [x] Cashier is restricted to POS/Delivery/Outstanding and blocked with 403 elsewhere — *Verified via 9 blocked endpoints test*
