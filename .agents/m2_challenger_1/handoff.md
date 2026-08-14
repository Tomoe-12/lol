# Handoff Report — Milestone M2 (Frontend Navigation, Route Protection & Permissions UI)

**VERDICT: APPROVE**

---

## 1. Observation

- **Milestone Scope**: Milestone M2 — Frontend Navigation, Route Protection & Staff Permission UI for `kind-shannon`.
- **Target Files Inspected & Verified**:
  1. `src/lib/permissions.ts` (Lines 1-220):
     - `getDefaultPermissionsForRole`: Deep copy using `JSON.parse(JSON.stringify(...))` prevents default object reference mutation across roles.
     - `sanitizePermissions`: Handles null, undefined, malformed JSON string, array, and primitive inputs without crashing. Interlocking logic (`const read = Boolean(modObj.read) || write`) guarantees `write: true` forces `read: true`.
     - `hasModuleReadPermission` & `hasModuleWritePermission`: Evaluates `user` object permissions, returning `true` for `OWNER` role across all modules.
     - `getModuleKeyForPath`: Accurate resolution mapping all 14 routes (`/dashboard`, `/pos`, `/inventory`, `/sales-orders`, `/customers`, `/purchases`, `/purchase-orders`, `/suppliers`, `/expenses`, `/staff`, `/reports`, `/setup`, `/settings`, `/branches`) to their corresponding 9 module keys.
  2. `src/components/sidebar.tsx` (Lines 1-285):
     - All 14 navigation items mapped with `moduleKey`.
     - Filtering uses `hasModuleReadPermission(user, item.moduleKey)` dynamically.
     - CASHIER on `/pos` returns `null` for full-screen checkout view.
  3. `src/app/(dashboard)/layout.tsx` (Lines 1-103):
     - Route protection check: `getModuleKeyForPath(pathname)`.
     - Unauthorized redirect: CASHIER redirected to `/pos`, other roles redirected to `/access-denied`.
     - Render guard (`isUnauthorized`) displays `"Access Restricted. Redirecting..."` screen to prevent content flashing.
  4. `src/app/(dashboard)/staff/page.tsx` (Lines 1-800):
     - `canManageMemberPermissions(member)`: Manager branch boundary restriction (`member.branchId === user?.branchId`).
     - "Permissions" button visible ONLY for authorized staff managers. Hidden for CASHIERs.
     - 9-Module Permission Dialog: Interlocking checkbox logic (`handleToggleRead` & `handleToggleWrite`).
     - OWNER target safety: Banner `"Owner permissions are unrestricted and cannot be modified / ပိုင်ရှင် အခွင့်အရေးကို ပြင်ဆင်၍မရပါ"` and disabled input controls for OWNER target staff.
  5. `tests/unit/m2-challenger-stress.test.ts`:
     - Empirical test suite created covering sidebar dynamic filtering, client route guards, Manager branch boundaries, and interlocking checkbox logic.

---

## 2. Logic Chain

1. **Dynamic Navigation Filtering**:
   - Every `navItem` in `sidebar.tsx` specifies its `moduleKey`.
   - `hasModuleReadPermission(user, moduleKey)` checks `user.permissions[moduleKey].read`.
   - CASHIER user only has `pos.read: true`, so sidebar renders ONLY the POS navigation link.
   - Restricted MANAGER user hides restricted modules dynamically.
   - OWNER user has full access and sees all 14 links.

2. **Client-Side Route Guard & Redirects**:
   - Navigation to any dashboard route invokes `getModuleKeyForPath(pathname)`.
   - If `!hasModuleReadPermission(user, moduleKey)` and `pathname !== "/access-denied"`:
     - CASHIER role -> `router.replace("/pos")`.
     - MANAGER role -> `router.replace("/access-denied")`.
   - Prevents unauthorized users from bookmarking or typing restricted URLs.

3. **Staff Directory Permissions UI & Manager Isolation**:
   - `canManageMemberPermissions` checks if `userRole === "MANAGER"`: requires `member.branchId === user.branchId`.
   - Managers cannot view or edit permissions of staff in other branches.
   - Permission modal enforces interlocking rule: checking Write automatically sets `read: true`; unchecking Read automatically sets `write: false`.
   - OWNER staff targets are protected from permission modification with explicit warning banners.

---

## 3. Caveats

- **Backend REST Authorization**: REST API controller enforcement for `/api/staff/[id]/permissions` and other endpoints is part of Milestone M3. The frontend modal handles `PUT /api/staff/[id]/permissions` with a fallback to `PUT /api/staff`.

---

## 4. Conclusion

Milestone M2 implementation is clean, robust, structurally compliant, and fully verified. All acceptance criteria for dynamic sidebar filtering, client route protection redirects, and staff directory permissions UI with Manager branch isolation are met.

**VERDICT: APPROVE**

---

## 5. Verification Method

1. **Empirical Unit Test Suite**:
   - Command: `npx tsx tests/unit/m2-challenger-stress.test.ts`
   - Command: `npx tsx tests/unit/m1-permissions-stress.test.ts`
2. **Build Verification**:
   - Command: `npm run build`
3. **Manual Code Inspection Paths**:
   - `src/lib/permissions.ts`
   - `src/components/sidebar.tsx`
   - `src/app/(dashboard)/layout.tsx`
   - `src/app/(dashboard)/staff/page.tsx`
