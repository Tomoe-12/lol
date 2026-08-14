## 2026-08-08T10:30:00Z

<USER_REQUEST>
You are Worker 1 assigned to implement Milestone M3 (Server REST API Authorization Enforcements & Permissions Controller) for the kind-shannon project.

Working directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m3_worker_1
Project root directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Mandatory files to read:
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\orchestrator\PROJECT.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_survey_3\handoff.md

Tasks for Milestone M3:
1. Create `src/app/api/staff/[id]/permissions/route.ts`:
   - `GET`: Authenticate via `getAuthStaff`. Check `checkStaffPermission(staff, "staff", "read")`. If requesting staff is `MANAGER`, assert target staff `branchId === staff.branchId` (403 if mismatch). Return JSON `{ permissions: targetStaff.permissions }`.
   - `PUT`: Authenticate via `getAuthStaff`. Check `checkStaffPermission(staff, "staff", "write")`. If target staff `role === "OWNER"`, return 403 Forbidden ("Owner permissions are unrestricted and cannot be modified"). If requesting staff is `MANAGER`, assert target staff `branchId === staff.branchId` (403 if mismatch). Sanitize payload via `sanitizePermissions(body.permissions, targetStaff.role)`. Update DB `prisma.staff.update({ where: { id }, data: { permissions: sanitized } })`. Return JSON `{ success: true, permissions: sanitized }`.
2. Update `src/app/api/staff/route.ts`:
   - Update `GET`, `POST`, `PUT`, `DELETE` handlers to allow `MANAGER` with `staff.read` / `staff.write` permission to manage staff members in their same branch (`branchId === staff.branchId`). Keep `CASHIER` blocked (403 Forbidden). Keep `OWNER` unrestricted.
3. Protect all REST API routes in `src/app/api/...`:
   - Add `getAuthStaff` authentication and `checkStaffPermission` calls to all unauthenticated routes: `pos/checkout`, `pos/exchange-rate`, `inventory/adjust`, `categories`, `products`, `dashboard/export`, `notifications`.
   - Update all other API routes (`pos/auth-pin`, `inventory`, `inventory/transfer`, `sales-orders`, `sales-orders/[id]`, `purchase-orders`, `expenses`, `reports`, `dashboard/stats`, `branches`, `customers`, `suppliers`, `audit-logs`) to use `checkStaffPermission(staff, moduleKey, action, targetBranchId)` and return HTTP `403 Forbidden` responses when unauthorized.
4. Execute `npm run build` and ensure 0 lint or TypeScript compilation errors.

Write your handoff report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m3_worker_1\handoff.md` with full details of changes and build verification. Then send a message back to parent orchestrator.
</USER_REQUEST>
