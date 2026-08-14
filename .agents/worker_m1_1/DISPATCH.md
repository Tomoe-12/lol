## 2026-08-10T11:11:17Z
<USER_REQUEST>
You are Worker M1 (RBAC Implementer & Verification Worker).
Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m1_1
Project root: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon
Original request file: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\ORIGINAL_REQUEST.md
Scope document: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
1. Implement the RBAC fixes identified by Explorer M1:
   a. In `src/app/api/sales-orders/route.ts` (around line 181):
      Change `const targetBranchId = staff.role === "OWNER" && branchId ? branchId : staff.branchId;`
      To: `const targetBranchId = branchId || staff.branchId;`
   b. In `src/app/api/staff/[id]/permissions/route.ts` (around lines 84-89):
      Replace the unconditional `if (staff.role !== "OWNER") { return 403 }` check with proper authorization:
      - OWNER: allowed to update permissions for any staff.
      - MANAGER: allowed to update permissions ONLY IF target staff belongs to the Manager's assigned branch (`targetStaff.branchId === staff.branchId`) AND target staff has role `"CASHIER"`. Otherwise, return 403 Forbidden.
      - CASHIER: return 403 Forbidden.
   c. In `tests/integration/m1-rbac-multibranch-suite.test.ts` (around line 187): Update line 187 if needed so it asserts HTTP 200 (not 403) when Manager updates permissions for a same-branch Cashier.

2. Run tests to verify the changes:
   - `npx tsx tests/unit/m1-permissions-stress.test.ts`
   - `npx tsx tests/integration/m1-rbac-multibranch-suite.test.ts`
   - `npx tsx tests/integration/m3-challenger-empirical.test.ts`
   - `npm run build`

3. Document all file changes in C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m1_1\changes.md and deliver handoff report with exact test command outputs in C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\worker_m1_1\handoff.md.
</USER_REQUEST>
