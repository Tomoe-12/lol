# Handoff Report — Explorer M1 (RBAC Remediation)

## 1. Observation

### Observation 1.1: `POST /api/sales-orders` Branch Override
In `src/app/api/sales-orders/route.ts` line 181:
```typescript
const targetBranchId = staff.role === "OWNER" && branchId ? branchId : staff.branchId;
```
When `staff.role` is `"MANAGER"`, `staff.role === "OWNER"` evaluates to `false`. `targetBranchId` is set to `staff.branchId`. When `checkStaffPermission(staff, "salesOrders", "write", targetBranchId)` is called on line 183, `targetBranchId` matches `staff.branchId`, preventing `checkStaffPermission` from returning a `403 Forbidden` response for cross-branch requests.

### Observation 1.2: `PUT /api/staff/[id]/permissions` Unconditional 403
In `src/app/api/staff/[id]/permissions/route.ts` lines 84-89:
```typescript
if (staff.role !== "OWNER") {
  return NextResponse.json(
    { error: "Forbidden: Only Owners can modify staff permissions / ဝန်ထမ်း အခွင့်အရေးများကို ပိုင်ရှင်သာ ပြင်ဆင်နိုင်ပါသည်" },
    { status: 403 }
  );
}
```
This block unconditionally returns `403 Forbidden` for any non-Owner, blocking Managers from editing permissions for Cashiers in their assigned branch.

### Observation 1.3: Empirical Stress Test Requirement
In `tests/integration/m3-challenger-empirical.test.ts` lines 286-295:
```typescript
const mgrPutPermRes = await putStaffPermissions(makeReq(`http://localhost/api/staff/${cashierHledan.id}/permissions`, "PUT", {
  permissions: { ... }
}, managerHledan.id), { params: Promise.resolve({ id: cashierHledan.id }) });
```
This test asserts that a Manager editing permissions for a same-branch Cashier must return HTTP 200 OK.

---

## 2. Logic Chain

1. **Defect 2a Logic Chain**:
   - Observation 1.1 shows that `targetBranchId` is forced to `staff.branchId` when `staff.role !== "OWNER"`.
   - Therefore, passing an unassigned `branchId` in `POST /api/sales-orders` by a Manager is overridden to `staff.branchId` before checking permissions.
   - Calling `checkStaffPermission(staff, "salesOrders", "write", staff.branchId)` checks `staff.branchId !== staff.branchId` (false), allowing the creation without returning `403`.
   - Replacing line 181 with `const targetBranchId = branchId || staff.branchId;` ensures that when `branchId` is supplied, `targetBranchId` holds the target branch. For non-Owners targeting a different branch, `checkStaffPermission` compares `staff.branchId !== targetBranchId` (true) and returns `403 Forbidden`.

2. **Defect 2b Logic Chain**:
   - Observation 1.2 shows lines 84-89 in `PUT /api/staff/[id]/permissions` block all non-Owners with 403.
   - M1 requirement Feature 3 and Observation 1.3 specify that Managers MUST be allowed to edit permissions for Cashiers in their assigned branch (`targetStaff.branchId === manager.branchId && targetStaff.role === "CASHIER"`).
   - Replacing lines 84-89 with a branch check (`targetStaff.branchId !== staff.branchId`) and a role check (`targetStaff.role !== "CASHIER"`) allows Managers to edit same-branch Cashier permissions while preserving 403 blocks for cross-branch targets, non-Cashier targets, and Cashier requesters.

---

## 3. Caveats

No caveats. All relevant routes, permission helpers, and test suites have been inspected and verified against the M1 specification.

---

## 4. Conclusion

Both authorization defects in Milestone 1 have been precisely located and diagnosed:
1. `src/app/api/sales-orders/route.ts` requires changing line 181 to `const targetBranchId = branchId || staff.branchId;`.
2. `src/app/api/staff/[id]/permissions/route.ts` requires replacing lines 84-89 with branch and role authorization checks for Manager requesters.
3. `tests/integration/m1-rbac-multibranch-suite.test.ts` requires updating line 187 to assert HTTP 200 for same-branch Cashier permission updates.

Full analysis is available in `.agents/explorer_m1_1/analysis.md`. Worker 1 can now implement the proposed changes safely.

---

## 5. Verification Method

1. Run unit permissions test:
   `npx tsx tests/unit/m1-permissions-stress.test.ts`
2. Run M1 integration suite:
   `npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts`
3. Run empirical stress test:
   `npx tsx tests/integration/m3-challenger-empirical.test.ts`

**Invalidation conditions**:
- If `POST /api/sales-orders` returns 200/201 when a Manager specifies an unassigned branch ID.
- If `PUT /api/staff/[id]/permissions` returns 403 when a Manager updates a Cashier in their own branch.
- If `PUT /api/staff/[id]/permissions` returns 200 when a Manager updates a Cashier in a different branch or another Manager.
