## 2026-08-08T03:33:22Z
You are Explorer 2 for Milestone M1 (Schema & Permission Core Data Model).

Working directory for your metadata: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2
Project root directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Mandatory files to read:
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\orchestrator\PROJECT.md

Your Task:
1. Formulate the exact code structure for `src/lib/permissions.ts`.
2. Define `ModuleKey` (`dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`), `ModulePermission` (`{ read: boolean, write: boolean }`), `StaffPermissions`.
3. Define default permission objects for `OWNER` (all read/write true), `MANAGER` (all read/write true default), and `CASHIER` (`pos` read/write true, all 8 others read/write false).
4. Define helper functions: `hasModuleReadPermission(user, moduleKey)`, `hasModuleWritePermission(user, moduleKey)`, `sanitizePermissions(permissions, role)`.
5. Document exact instructions and code specification in `C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2\handoff.md`.

When complete, write your handoff report to C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2\handoff.md and send a message back to parent orchestrator.
