# BRIEFING — 2026-08-08T03:35:00Z

## Mission
Formulate exact code structure and type-safe implementation specifications for `src/lib/permissions.ts` (module keys, permissions types, defaults per role, helper functions) for Milestone M1.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigator and architect for permission system
- Working directory: C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2
- Original parent: b9357db0-7257-4d6a-9c5b-e9c947f2bece
- Milestone: M1 (Schema & Permission Core Data Model)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement src files directly, write specification/code proposals in handoff.md
- Adhere strictly to the requested module keys, permission rules, and helper functions.

## Current Parent
- Conversation ID: b9357db0-7257-4d6a-9c5b-e9c947f2bece
- Updated: 2026-08-08T03:35:00Z

## Investigation State
- **Explored paths**:
  - `src/lib/auth-helper.ts` (user authentication context, `Staff & { branch: Branch }`)
  - `prisma/schema.prisma` (`Staff` model, `Role` enum with OWNER, MANAGER, CASHIER)
  - `PROJECT.md` (Milestone M1 scope, route mapping, interface contracts)
- **Key findings**:
  - Defined 9 module keys: `dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`.
  - Formulated full TypeScript implementations for `ModuleKey`, `ModulePermission`, `StaffPermissions`, default role permissions (`DEFAULT_OWNER_PERMISSIONS`, `DEFAULT_MANAGER_PERMISSIONS`, `DEFAULT_CASHIER_PERMISSIONS`), `sanitizePermissions`, `hasModuleReadPermission`, `hasModuleWritePermission`, and route-mapping helpers.
- **Unexplored areas**: None for M1 Explorer 2 scope.

## Key Decisions Made
- `sanitizePermissions` forces `read: true` whenever `write: true` is set (interlocking permission invariant).
- `sanitizePermissions` guarantees OWNER role always returns full access regardless of DB/JSON payload.
- `hasModuleReadPermission` and `hasModuleWritePermission` handle null/undefined users gracefully (returning false).

## Artifact Index
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2\DISPATCH.md — Dispatch log
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2\BRIEFING.md — Context and briefing tracking
- C:\Users\Khun Thi Han\Documents\antigravity\kind-shannon\.agents\m1_explorer_2\handoff.md — Final handoff report containing code specification for `src/lib/permissions.ts`
