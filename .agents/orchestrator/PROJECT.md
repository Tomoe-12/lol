# Project: kind-shannon — Granular Staff Permission System

## Architecture
The application is a Next.js (App Router) multi-tenant / multi-branch Retail & POS system built with Prisma, PostgreSQL/SQLite, Tailwind CSS, and custom Auth context (`pos_session` cookie + AuthProvider).

Granular access control is added across 3 architectural tiers:
1. **Database Schema & Permission Helper Layer**:
   - `Staff.permissions` JSON field in Prisma storing 9-module Read/Write matrix.
   - Central permission helpers (`src/lib/permissions.ts` and `src/lib/auth-helper.ts`) for default fallback permissions and evaluation rules.
2. **Frontend UI Navigation & Permission Management Layer**:
   - `AuthProvider` client context exposing user permissions & `user.reload()`.
   - Dynamic `Sidebar` filtering based on `hasModuleReadPermission`.
   - Client route guard in `(dashboard)/layout.tsx` enforcing module read permissions and redirecting unauthorized visits to `/access-denied`.
   - Staff directory table "Permissions" action button and 9-module Read/Write checkbox grid modal in `(dashboard)/staff/page.tsx` with Manager branch isolation boundaries.
3. **Backend REST API Authorization Enforcement Layer**:
   - `GET /api/auth/me` returning staff permissions payload.
   - `GET / PUT /api/staff/[id]/permissions` endpoint for reading & updating staff permissions.
   - Comprehensive server-side authorization enforcement across all 29 REST API controllers (`src/app/api/...`), validating module read/write permissions and branch boundaries (`403 Forbidden`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Prisma Schema & Permissions Helper | Add `permissions` JSON field to `Staff` model, create `src/lib/permissions.ts` with 9 module keys, default role permissions (`OWNER`, `MANAGER`, `CASHIER`), and helper evaluation functions. | M1 | R1 |
| 2 | Auth Provider & API Permission Payload | Extend `LocalUser` interface, return `permissions` in `/api/auth/me`, and integrate `user.reload()` in auth provider context. | M1 | R1, R3 |
| 3 | Dynamic Sidebar Navigation Filtering | Add `moduleKey` to all `navItems` in `src/components/sidebar.tsx` and filter dynamically based on `hasModuleReadPermission(user, moduleKey)`. | M2 | R3 |
| 4 | Client-Side Route Protection & Redirects | Map dashboard routes to module keys in `src/app/(dashboard)/layout.tsx` and redirect unauthorized routes to `/access-denied`. | M2 | R3 |
| 5 | Staff Table Permissions Button & Modal UI | Add "Permissions" action button in `src/app/(dashboard)/staff/page.tsx` for staff write users. Build 9-module Read/Write checkbox grid modal with interlocking logic. | M2 | R2 |
| 6 | Manager Branch Isolation Boundaries in UI | Enforce that `MANAGER` can only view and edit permissions of staff members in their same branch (`member.branchId === user.branchId`). | M2 | R2 |
| 7 | Dedicated Staff Permissions REST API | Implement `GET` and `PUT` `/api/staff/[id]/permissions` route with authorization checks, branch boundary verification, Redis cache invalidation, and Owner protection. | M3 | R1, R2, R3 |
| 8 | Server-Side REST API Authorization Enforcement | Protect all REST API controllers (`src/app/api/...`), securing unauthenticated routes and enforcing module read/write checks and branch isolation with 403 Forbidden responses. | M3 | R3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Schema & Permission Core Data Model | Prisma schema migration/update, `src/lib/permissions.ts` helper module, default role permissions, and `/api/auth/me` payload updates. | none | DONE |
| M2 | Frontend Navigation, Route Protection & Permissions UI | Dynamic `Sidebar` filtering, `(dashboard)/layout.tsx` route guards, `Staff` table "Permissions" button, 9-module checkbox modal, and Manager branch boundary checks. | M1 | DONE |
| M3 | Server REST API Authorization Enforcements & Permissions Controller | `/api/staff/[id]/permissions` endpoint creation, update `/api/staff` controller, and comprehensive server authorization checks across all REST routes returning 403 Forbidden. | M1 | IN_PROGRESS |
| M4 | Final Integration & E2E Testing Verification | Pass 100% of end-to-end integration tests verifying Owner, Manager, and Cashier access controls, UI navigation reactivity, branch isolation, and API 403 Forbidden responses. | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### 9 Module Keys
`dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`

### `StaffPermissions` Interface
```ts
export type ModuleKey =
  | "dashboard"
  | "pos"
  | "inventory"
  | "salesOrders"
  | "purchases"
  | "expenses"
  | "staff"
  | "reports"
  | "setup";

export interface ModulePermission {
  read: boolean;
  write: boolean;
}

export type StaffPermissions = Record<ModuleKey, ModulePermission>;
```

### Route to Module Key Mapping
- `/dashboard` -> `dashboard`
- `/pos` -> `pos`
- `/inventory` -> `inventory`
- `/sales-orders`, `/customers` -> `salesOrders`
- `/purchases`, `/purchase-orders`, `/suppliers` -> `purchases`
- `/expenses` -> `expenses`
- `/staff` -> `staff`
- `/reports` -> `reports`
- `/setup`, `/settings`, `/branches` -> `setup`

---

## Code Layout
- `prisma/schema.prisma` — Backend data model for `Staff`
- `src/lib/permissions.ts` — Granular permission definitions, default role matrices, evaluation helpers
- `src/lib/auth-helper.ts` — Server auth session resolution & server-side authorization check helpers
- `src/providers/auth-provider.tsx` — Client auth context exposing `LocalUser` permissions
- `src/app/api/auth/me/route.ts` — Auth user endpoint returning permissions payload
- `src/components/sidebar.tsx` — Responsive navigation component with dynamic permission filtering
- `src/app/(dashboard)/layout.tsx` — Dashboard layout & client route guard
- `src/app/(dashboard)/staff/page.tsx` — Staff directory page with Permissions action button & modal grid
- `src/app/api/staff/[id]/permissions/route.ts` — Granular permission management REST API endpoint
- `src/app/api/...` — All system REST API route controllers
