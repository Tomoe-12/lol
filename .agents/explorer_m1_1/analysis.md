# RBAC Remediation & Authorization Analysis Report (Milestone M1)

**Author**: Explorer M1 (RBAC Remediation Explorer)  
**Target Project**: SMARTOS POS & Inventory (`C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon`)  
**Date**: 2026-08-10  

---

## Executive Summary

This report presents a thorough analysis of the Milestone 1 (M1) Role-Based Access Control (RBAC) requirements and the two authorization defects identified during stress testing. 

1. **Defect 2a (`POST /api/sales-orders`)**: Line 181 forced `targetBranchId` to `staff.branchId` for non-Owner roles prior to calling `checkStaffPermission`. This allowed a Manager to pass an unassigned `branchId` in the request body without triggering a `403 Forbidden` response.
2. **Defect 2b (`PUT /api/staff/[id]/permissions`)**: Lines 84-89 unconditionally returned `403 Forbidden` for any requester with `staff.role !== "OWNER"`. This prevented Managers from editing permissions for Cashiers within their own branch, violating M1 RBAC requirements.

Specific, verified code replacements and step-by-step remediation instructions have been prepared for Worker 1 to implement.

---

## 1. M1 RBAC Requirements & Role Matrix

The SMARTOS application enforces role access boundaries across 18 dashboard/system routes and 35 API endpoints:

| Feature / Capability | OWNER | MANAGER | CASHIER |
|---|---|---|---|
| **System Access** | Full 100% access across all 18 routes & setup | Branch-isolated to assigned branch | Restricted to POS, Delivery, Outstanding |
| **Cross-Branch Access** | Full access to all branches | Blocked (HTTP 403) from cross-branch operations | Blocked (HTTP 403) from cross-branch operations |
| **Staff Permission Admin** | Full access to modify any staff permissions | Allowed ONLY for Cashiers in same branch (`targetStaff.branchId === manager.branchId && targetStaff.role === "CASHIER"`) | Blocked (HTTP 403) |
| **Restricted Modules** | None | Setup/Branch creation restricted | Blocked from `/staff`, `/reports`, `/inventory`, `/purchase-orders`, `/expenses`, `/setup`, `/dashboard` |

---

## 2. Investigation of Authorization Defects

### Defect 2a: Missing Branch Isolation Check in `POST /api/sales-orders`

- **File**: `src/app/api/sales-orders/route.ts`
- **Line Number**: Line 181
- **Existing Code**:
  ```typescript
  const targetBranchId = staff.role === "OWNER" && branchId ? branchId : staff.branchId;
  ```
- **Analysis**:
  - When a `MANAGER` calls `POST /api/sales-orders` with `{ branchId: "other-branch-id" }`, `staff.role === "OWNER"` evaluates to `false`.
  - Line 181 assigns `targetBranchId = staff.branchId` (manager's own branch).
  - Next, line 183 calls `checkStaffPermission(staff, "salesOrders", "write", targetBranchId)`.
  - Inside `checkStaffPermission` (`src/lib/auth-helper.ts`), `targetBranchId` matches `staff.branchId`, so the branch mismatch check (`staff.branchId !== targetBranchId`) does not trigger.
  - The API does not return HTTP 403 Forbidden. Instead, it proceeds and creates a sales order under `staff.branchId`.
- **Corrected Code**:
  ```typescript
  const targetBranchId = branchId || staff.branchId;
  ```
- **Behavior After Fix**:
  - If a `MANAGER` (in `branch-1`) sends `branchId: "branch-2"`, `targetBranchId` becomes `"branch-2"`.
  - `checkStaffPermission(staff, "salesOrders", "write", "branch-2")` checks `staff.branchId ("branch-1") !== targetBranchId ("branch-2")` and returns `403 Forbidden` (`{ error: "Forbidden: Access is restricted to your assigned branch..." }`).
  - If `branchId` is omitted, `targetBranchId` defaults to `staff.branchId`, which passes the branch check for Manager's own branch.
  - An `OWNER` passing `branchId: "branch-2"` bypasses the branch check in `checkStaffPermission` and creates the order for `branch-2` as expected.

---

### Defect 2b: Manager Blocked from Editing Same-Branch Cashier Permissions in `PUT /api/staff/[id]/permissions`

- **File**: `src/app/api/staff/[id]/permissions/route.ts`
- **Line Numbers**: Lines 84-89
- **Existing Code**:
  ```typescript
  if (staff.role !== "OWNER") {
    return NextResponse.json(
      { error: "Forbidden: Only Owners can modify staff permissions / ဝန်ထမ်း အခွင့်အရေးများကို ပိုင်ရှင်သာ ပြင်ဆင်နိုင်ပါသည်" },
      { status: 403 }
    );
  }
  ```
- **Analysis**:
  - The endpoint unconditionally blocked non-Owners, returning HTTP 403 even when a Manager attempted to update permissions for a Cashier in their own branch.
  - Requirement M1 Feature 3 specifies that Managers MUST be permitted to modify permissions for Cashiers assigned to their own branch (`targetStaff.branchId === manager.branchId && targetStaff.role === "CASHIER"`).
  - Non-Cashier targets (e.g., other Managers or Owners) or cross-branch targets must still return HTTP 403 Forbidden.
- **Corrected Code**:
  ```typescript
    if (staff.role === "MANAGER") {
      if (targetStaff.branchId !== staff.branchId) {
        return NextResponse.json(
          { error: "Forbidden: Access is restricted to your assigned branch / ဆိုင်ခွဲသီးသန့် ကန့်သတ်ထားပါသည်" },
          { status: 403 }
        );
      }
      if (targetStaff.role !== "CASHIER") {
        return NextResponse.json(
          { error: "Forbidden: Managers can only edit permissions for Cashiers in their own branch / မန်နေဂျာများသည် မိမိဆိုင်ခွဲမှ စာရင်းကိုင် (Cashier) များ၏ အခွင့်အရေးများကိုသာ ပြင်ဆင်နိုင်ပါသည်" },
          { status: 403 }
        );
      }
    } else if (staff.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to modify staff permissions / ဝန်ထမ်း အခွင့်အရေးများကို ပြင်ဆင်ရန် အခွင့်အရေးမရှိပါ" },
        { status: 403 }
      );
    }
  ```
- **Behavior After Fix**:
  - **OWNER**: Can edit permissions for any non-Owner staff across any branch.
  - **MANAGER editing same-branch CASHIER**: `targetStaff.branchId === staff.branchId` and `targetStaff.role === "CASHIER"` -> Allowed! Returns HTTP 200 OK with updated permissions.
  - **MANAGER editing cross-branch CASHIER**: `targetStaff.branchId !== staff.branchId` -> Returns HTTP 403 Forbidden.
  - **MANAGER editing any MANAGER or OWNER**: `targetStaff.role !== "CASHIER"` -> Returns HTTP 403 Forbidden.
  - **CASHIER editing permissions**: Returns HTTP 403 Forbidden.

---

## 3. Precise Instructions for Worker 1

### Edit 1: Fix `POST /api/sales-orders` Branch Check
- **Target File**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\src\app\api\sales-orders\route.ts`
- **Tool**: `replace_file_content`
- **StartLine**: 175
- **EndLine**: 185
- **Target Content**:
  ```typescript
      const targetBranchId = staff.role === "OWNER" && branchId ? branchId : staff.branchId;
  ```
- **Replacement Content**:
  ```typescript
      const targetBranchId = branchId || staff.branchId;
  ```

### Edit 2: Fix `PUT /api/staff/[id]/permissions` Role Authorization
- **Target File**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\src\app\api\staff\[id]\permissions\route.ts`
- **Tool**: `replace_file_content`
- **StartLine**: 80
- **EndLine**: 93
- **Target Content**:
  ```typescript
      if (staff.role !== "OWNER") {
        return NextResponse.json(
          { error: "Forbidden: Only Owners can modify staff permissions / ဝန်ထမ်း အခွင့်အရေးများကို ပိုင်ရှင်သာ ပြင်ဆင်နိုင်ပါသည်" },
          { status: 403 }
        );
      }
  ```
- **Replacement Content**:
  ```typescript
      if (staff.role === "MANAGER") {
        if (targetStaff.branchId !== staff.branchId) {
          return NextResponse.json(
            { error: "Forbidden: Access is restricted to your assigned branch / ဆိုင်ခွဲသီးသန့် ကန့်သတ်ထားပါသည်" },
            { status: 403 }
          );
        }
        if (targetStaff.role !== "CASHIER") {
          return NextResponse.json(
            { error: "Forbidden: Managers can only edit permissions for Cashiers in their own branch / မန်နေဂျာများသည် မိမိဆိုင်ခွဲမှ စာရင်းကိုင် (Cashier) များ၏ အခွင့်အရေးများကိုသာ ပြင်ဆင်နိုင်ပါသည်" },
            { status: 403 }
          );
        }
      } else if (staff.role !== "OWNER") {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to modify staff permissions / ဝန်ထမ်း အခွင့်အရေးများကို ပြင်ဆင်ရန် အခွင့်အရေးမရှိပါ" },
          { status: 403 }
        );
      }
  ```

### Edit 3: Update Test Suite Assertion in `m1-rbac-multibranch-suite.test.ts`
- **Target File**: `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\tests\integration\m1-rbac-multibranch-suite.test.ts`
- **Tool**: `replace_file_content`
- **StartLine**: 182
- **EndLine": 189
- **Target Content**:
  ```typescript
    // Manager attempting to modify staff permissions -> HTTP 403 Forbidden
    const mgrPutPermReq = makeReq(`http://localhost/api/staff/${cashierStaff.id}/permissions`, "PUT", {
      permissions: DEFAULT_CASHIER_PERMISSIONS,
    }, hledanManager.id);
    const mgrPutPermRes = await putStaffPermissions(mgrPutPermReq, { params: Promise.resolve({ id: cashierStaff.id }) });
    assertEqual(mgrPutPermRes.status, 403, "MANAGER modifying staff permissions returns HTTP 403 Forbidden");
  ```
- **Replacement Content**:
  ```typescript
    // Manager updating same-branch Cashier staff permissions -> HTTP 200 OK
    const mgrPutPermReq = makeReq(`http://localhost/api/staff/${cashierStaff.id}/permissions`, "PUT", {
      permissions: DEFAULT_CASHIER_PERMISSIONS,
    }, hledanManager.id);
    const mgrPutPermRes = await putStaffPermissions(mgrPutPermReq, { params: Promise.resolve({ id: cashierStaff.id }) });
    assertEqual(mgrPutPermRes.status, 200, "MANAGER updating same-branch Cashier permissions returns HTTP 200 OK");
  ```

---

## 4. Verification Method

To verify the fixes after Worker 1 executes the edits:

1. **Run Unit Permissions Stress Test**:
   ```bash
   npx tsx tests/unit/m1-permissions-stress.test.ts
   ```
   Expect: All 18 assertions pass with 0 errors.

2. **Run M1 Integration Test Suite**:
   ```bash
   npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts
   ```
   Expect: All assertions pass cleanly.

3. **Run M3 Challenger Empirical Test Suite**:
   ```bash
   npx tsx tests/integration/m3-challenger-empirical.test.ts
   ```
   Expect: `Manager GET & PUT permissions for Cashier in their own branch` test group 4.3 returns HTTP 200 OK and passes.
