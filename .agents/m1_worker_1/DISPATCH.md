## 2026-08-08T03:36:02Z
You are Worker 1 assigned to implement Milestone M1 (Schema & Permission Core Data Model) for the kind-shannon project.

Working directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_worker_1
Project root directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Mandatory files to read:
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\orchestrator\PROJECT.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_1\handoff.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2\handoff.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks for Milestone M1:
1. Modify `prisma/schema.prisma` to add `permissions Json?` to the `Staff` model (line 103 right after `role Role @default(CASHIER)`).
2. Execute `npx prisma generate` and `npx prisma db push` (or `npx prisma migrate dev --name add_staff_permissions`) to update Prisma client and database schema.
3. Create `src/lib/permissions.ts` per the exact specification in `m1_explorer_2/handoff.md`:
   - Export `ModuleKey`, `ModulePermission`, `StaffPermissions`, `ALL_MODULE_KEYS`, `MODULE_LABELS`.
   - Export `DEFAULT_OWNER_PERMISSIONS`, `DEFAULT_MANAGER_PERMISSIONS`, `DEFAULT_CASHIER_PERMISSIONS`.
   - Export `getDefaultPermissionsForRole(role)`.
   - Export `sanitizePermissions(permissions, role)`.
   - Export `hasModuleReadPermission(user, moduleKey)` and `hasModuleWritePermission(user, moduleKey)`.
   - Export `getModuleKeyForPath(pathname)`.
4. Update `src/lib/auth-helper.ts` per `m1_explorer_3/handoff.md`:
   - Update `AuthenticatedStaff` to include `permissions: StaffPermissions`.
   - In `getAuthStaff`, resolve staff permissions via `sanitizePermissions(staff.permissions, staff.role)`.
   - Implement and export `checkStaffPermission(staff, module, action, targetBranchId): PermissionCheckResult`.
5. Update `src/app/api/auth/me/route.ts` to return `permissions: staff!.permissions` in `user` and `user.publicMetadata`.
6. Update `src/providers/auth-provider.tsx` to include `permissions?: StaffPermissions` on `LocalUser` interface and in `fetchUser` callback.
7. Run `npm run build` and ensure 0 lint or TypeScript compilation errors.

Write your handoff report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_worker_1\handoff.md` with full details of changes, build output, and verification results. Then send a message back to parent orchestrator.
