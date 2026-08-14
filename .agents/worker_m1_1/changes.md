# Changes Implemented by Worker M1

## 1. `src/app/api/sales-orders/route.ts`
- **Line 181**: Changed `const targetBranchId = staff.role === "OWNER" && branchId ? branchId : staff.branchId;` to `const targetBranchId = branchId || staff.branchId;`.
- **Rationale**: Allows `targetBranchId` to default to `branchId` (if provided in request body) or `staff.branchId`, allowing `checkStaffPermission` to perform standard permission and branch isolation checks without pre-filtering out non-owner target branch selections.

## 2. `src/app/api/staff/[id]/permissions/route.ts`
- **Lines 84-89**: Replaced unconditional `if (staff.role !== "OWNER") { return 403 }` check in the `PUT` handler with proper role-based authorization check:
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
- **Rationale**:
  - **OWNER**: Allowed to update permissions for any non-owner staff member across all branches.
  - **MANAGER**: Allowed to update permissions ONLY IF target staff belongs to the Manager's assigned branch (`targetStaff.branchId === staff.branchId`) AND target staff has role `"CASHIER"`. Otherwise returns HTTP 403 Forbidden.
  - **CASHIER**: Strictly blocked from updating permissions (returns HTTP 403 Forbidden).

## 3. `tests/integration/m1-rbac-multibranch-suite.test.ts`
- **Line 187**: Updated assertion for Manager updating same-branch Cashier permissions from HTTP 403 to HTTP 200 OK:
  ```typescript
  assertEqual(mgrPutPermRes.status, 200, "MANAGER modifying same-branch cashier permissions returns 200 OK");
  ```
- **Rationale**: Aligns integration test assertions with the corrected RBAC specification for Manager permissions management.
