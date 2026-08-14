## 2026-08-08T03:51:06Z
You are Worker 1 assigned to implement Milestone M2 (Frontend Navigation, Route Protection & Permissions UI) for the kind-shannon project.

Working directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m2_worker_1
Project root directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Mandatory files to read:
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\orchestrator\PROJECT.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\explorer_survey_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks for Milestone M2:
1. Update `src/components/sidebar.tsx`:
   - Import `hasModuleReadPermission`, `ModuleKey` from `@/lib/permissions`.
   - Add `moduleKey?: ModuleKey` property to `NavItem` interface and every item in `navItems`.
   - Update navigation filtering: Replace static role filtering (`item.roles.includes(role)`) with dynamic permission check `hasModuleReadPermission(user, item.moduleKey)`. Ensure fallback for items without `moduleKey`.
2. Update `src/app/(dashboard)/layout.tsx`:
   - Import `getModuleKeyForPath`, `hasModuleReadPermission` from `@/lib/permissions`.
   - Update client route guard: Resolve `moduleKey = getModuleKeyForPath(pathname)`. If `moduleKey` exists and `user` is loaded and `!hasModuleReadPermission(user, moduleKey)` and `pathname !== "/access-denied"`, redirect to `/access-denied` (or `/pos` if Cashier).
3. Update `src/app/(dashboard)/staff/page.tsx`:
   - Import `hasModuleWritePermission`, `hasModuleReadPermission`, `ALL_MODULE_KEYS`, `MODULE_LABELS`, `StaffPermissions`, `sanitizePermissions` from `@/lib/permissions`, and `ShieldCheck` or `KeyRound` icon from `lucide-react`.
   - Update action column in Staff table:
     - Render "Permissions" button (`ShieldCheck` icon) on staff rows.
     - Restrict visibility & editability: Only show/enable for logged-in user with `staff.write` permission (`hasModuleWritePermission(user, "staff")`).
     - Branch boundary rule: Logged-in `OWNER` can view/edit permissions for any staff member in any branch. Logged-in `MANAGER` with `staff.write` can view/edit permissions ONLY for staff in their same branch (`member.branchId === user.branchId`). If `member.role === "OWNER"`, disable editing with notice. Completely hide/block for `CASHIER`.
   - Create Permission Management Modal dialog:
     - Header: Staff Name, Role, Branch.
     - Notice for `OWNER` target: "Owner permissions are unrestricted and cannot be modified / ပိုင်ရှင် အခွင့်အရေးကို ပြင်ဆင်၍မရပါ".
     - 9-Module Checkbox Grid: Module label (EN / MY), Read checkbox, Write checkbox.
     - Interlocking Checkbox Logic:
       - Checking `Write` automatically checks `Read`.
       - Unchecking `Read` automatically unchecks `Write`.
     - Submitting sends updated permissions payload via `PUT /api/staff/[id]/permissions` (or `/api/staff` update payload), calls `user.reload()`, displays success toast, and closes modal.
4. Execute `npm run build` and ensure 0 lint or TypeScript compilation errors.

Write your handoff report to `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m2_worker_1\handoff.md` with full details of changes and build verification. Then send a message back to parent orchestrator.

## 2026-08-08T03:52:54Z
Context: Milestone M2 execution + permission helper hardening.
Content: While implementing M2, please also apply these 2 minor hardening fixes in `src/lib/permissions.ts`:
1. In `getDefaultPermissionsForRole`, return a deep copy (e.g. `JSON.parse(JSON.stringify(...))`) instead of shallow copy to prevent state mutation contamination.
2. In `sanitizePermissions`, check `!Array.isArray(rawMod)` when evaluating `typeof rawMod === "object"` so arrays passed as module values fail safe to role defaults.
Action: Implement these 2 hardening tweaks in `src/lib/permissions.ts` along with your assigned M2 tasks and run `npm run build`.

