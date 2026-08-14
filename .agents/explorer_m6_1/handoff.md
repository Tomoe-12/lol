# Handoff Report — Cashier Assigned Branch Display & Scoping (R1)

## 1. Observation
- `src/lib/auth-helper.ts` (lines 17–97) fetches staff sessions via `prisma.staff.findFirst({ include: { branch: true } })`, correctly loading `staff.branchId` and `staff.branch.name`.
- `src/app/api/auth/me/route.ts` (lines 4–26) exposes `branchId` and `branchName` in `/api/auth/me` JSON response.
- `src/providers/auth-provider.tsx` (lines 42–87) provides `user.branchId` and `user.branchName` to client components via `useUser()`.
- `src/app/(dashboard)/pos/page.tsx` (lines 9–24) passes `dbStaff` details as `initialStaff` to `<POSContainer />`.
- `src/components/pos/pos-container.tsx` (lines 60–64):
  ```tsx
  React.useEffect(() => {
    if (!activeBranchId && initialBranches.length > 0) {
      setBranch(initialBranches[0].id, initialBranches[0].name)
    }
  }, [activeBranchId, initialBranches, setBranch])
  ```
  `POSContainer` defaults `activeBranchId` to `initialBranches[0]` ("Hledin branch"), ignoring `initialStaff.branchId`.
- In `src/components/pos/payment-dialog.tsx` (lines 180–205), checkout submits `branchId: activeBranchId` to `/api/pos/checkout`.
- In `src/app/api/pos/checkout/route.ts` (lines 27, 58), `let branchId = body.branchId || staff.branchId` uses the client-provided `branchId`. When `body.branchId` ("Hledin branch") does not match `staff.branchId`, `checkStaffPermission` returns HTTP 403 Forbidden, blocking cashiers from checking out.
- Across multiple pages (`sales-orders/page.tsx` line 468, `expenses/page.tsx` line 138, `staff/page.tsx` lines 442 & 627, `schedule/page.tsx` line 132), `branches[0]` ("Hledin branch") is hardcoded as default state or display text instead of using `user?.branchId`.

## 2. Logic Chain
1. `getAuthStaff()` correctly retrieves the logged-in staff profile with their assigned `branchId` and `branch.name`.
2. However, front-end state management in `POSContainer` reads `activeBranchId` from `useCartStore` (which is persisted in `localStorage`). If `activeBranchId` is empty or stale, `POSContainer` sets `activeBranchId` to `initialBranches[0]` ("Hledin branch").
3. Because `POSContainer` does not automatically sync `activeBranchId` with `initialStaff.branchId` upon load, Cashiers logged into Branch 2 end up with `activeBranchId = "Hledin branch"` in UI and cart state.
4. During POS checkout, `PaymentDialog` sends `body.branchId = "Hledin branch"`. `checkStaffPermission` in `auth-helper.ts` (lines 119–127) compares `staff.branchId` ("Branch 2") with `targetBranchId` ("Hledin branch") and returns a 403 Forbidden error.
5. Furthermore, other dashboard views (`sales-orders`, `expenses`, `staff`, `schedule`) hardcode `branches[0]` fallbacks.
6. Remediation requires:
   - Forcing `POSContainer` to bind `activeBranchId` to `activeStaff.branchId` on mount.
   - Restricting branch selector UI in POS for non-OWNER roles.
   - Forcing `POST /api/pos/checkout` to override `branchId = staff.branchId` for non-OWNER staff.
   - Replacing `branches[0]` fallbacks across dashboard pages with `user?.branchId`.

## 3. Caveats
- No source code modifications were performed during this read-only investigation.
- Verification was conducted by static code tracing and analysis.
- Tests will require running against a seeded database with multiple staff profiles (OWNER, MANAGER, CASHIER) assigned to distinct branches.

## 4. Conclusion
The root cause of Requirement R1 issues is front-end fallback state in `POSContainer` (`setBranch(initialBranches[0].id)`) combined with `localStorage` persistence in `useCartStore`, as well as client-dependent `branchId` handling in `/api/pos/checkout`.
Fixing `POSContainer` initialization, locking checkout API `branchId` to `staff.branchId` for non-owners, and replacing `branches[0]` defaults will resolve all cashier branch display and transaction scoping issues.

## 5. Verification Method
1. Inspect `src/components/pos/pos-container.tsx` to verify `activeBranchId` is initialized from `activeStaff.branchId`.
2. Inspect `src/app/api/pos/checkout/route.ts` to confirm `branchId` is overridden to `staff.branchId` for non-OWNER roles.
3. Perform end-to-end authentication test:
   - Log in as a Cashier assigned to Branch 2 (e.g. Kantharyar branch).
   - Navigate to `/pos`. Verify POS header displays "Kantharyar branch" instead of "Hledin branch".
   - Complete a POS transaction. Verify the created `Transaction` in database has `branchId` matching Branch 2.
