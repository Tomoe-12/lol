# Technical Investigation Report: Requirement R1 — Cashier Assigned Branch Display & Scoping

## Executive Summary
This report provides a comprehensive analysis of Requirement R1 (Cashier Assigned Branch Display & Scoping) for the SmartOS Multi-Branch POS System. The investigation mapped out cashier session/profile retrieval, front-end branch context initialization, fallback branch hardcoding, POS page branch selection logic, and backend API branch scoping/RBAC enforcement.

---

## 1. Cashier Session & Staff Profile Retrieval Flow

### 1.1 Backend Authentication Helper
- **File**: `src/lib/auth-helper.ts` (Lines 17–97)
- **Mechanism**: `getAuthStaff(req?: Request)` reads the `pos_session` cookie or the `x-staff-id` HTTP request header. It queries the Prisma `Staff` model using `prisma.staff.findFirst({ include: { branch: true } })`.
- **Returned Object**: Returns `staff: AuthenticatedStaff` containing:
  - `staff.id`: Staff ID
  - `staff.name`: Staff Full Name
  - `staff.role`: `"OWNER" | "MANAGER" | "CASHIER"`
  - `staff.branchId`: Assigned Branch ID
  - `staff.branch`: Complete `Branch` object including `name` and `address`
  - `staff.permissions`: Sanitized module permissions object.

### 1.2 Auth Me Route
- **File**: `src/app/api/auth/me/route.ts` (Lines 4–26)
- **Mechanism**: Endpoint `GET /api/auth/me` calls `getAuthStaff(request)` and returns JSON:
  ```json
  {
    "user": {
      "id": "...",
      "name": "...",
      "email": "...",
      "role": "CASHIER",
      "branchId": "branch-id",
      "branchName": "Branch Name",
      "permissions": { ... },
      "publicMetadata": { "role": "CASHIER", "branchId": "branch-id", "permissions": { ... } }
    }
  }
  ```

### 1.3 Client Authentication Context Provider
- **File**: `src/providers/auth-provider.tsx` (Lines 42–87, 137–147)
- **Mechanism**: `AuthProvider` calls `fetchUser()` on mount and on route changes, querying `/api/auth/me`. It populates `user: LocalUser` state with `branchId` and `branchName`. Components consume user data via `useUser()` or `useAuth()`.

---

## 2. Default Branch Fallbacks & "Hledin Branch" Hardcoding Analysis

While the string `"Hledin branch"` is not hardcoded as a literal string constant in `.ts`/`.tsx` files, the system consistently hardcodes `branches[0]` (the first branch returned alphabetically from `prisma.branch.findMany({ orderBy: { name: "asc" } })`, which corresponds to `"Hledin branch"` in seeded environments) as the default state across multiple UI components and pages:

### 2.1 POS Container Falsy Branch Initialization
- **File**: `src/components/pos/pos-container.tsx` (Lines 60–64)
- **Current Logic**:
  ```tsx
  React.useEffect(() => {
    if (!activeBranchId && initialBranches.length > 0) {
      setBranch(initialBranches[0].id, initialBranches[0].name)
    }
  }, [activeBranchId, initialBranches, setBranch])
  ```
- **Flaw**:
  1. When `activeBranchId` in `useCartStore` is empty, it initializes the cart store branch to `initialBranches[0]` (Hledin branch), ignoring `initialStaff.branchId` / `initialStaff.branchName` passed to `POSContainer`.
  2. `useCartStore` uses `zustand/middleware` `persist` with key `"pos-cart-storage"` in `localStorage`. If an OWNER or cashier from Branch 1 previously used the POS, `activeBranchId` remains set to Branch 1 in `localStorage`. When Cashier 2 (assigned to Branch 2) logs in, `POSContainer` retains the stale `activeBranchId` from `localStorage` instead of re-binding to `initialStaff.branchId`.

### 2.2 Sales Orders Modal Branch Initialization
- **File**: `src/app/(dashboard)/sales-orders/page.tsx` (Line 468)
- **Current Logic**: `setNewBranchId(branches[0]?.id || "")`
- **Flaw**: When opening the order creation modal (`openCreate`), `newBranchId` defaults to `branches[0]?.id` (Hledin branch) instead of `user?.branchId`.

### 2.3 Expenses Page Default Branch Selection
- **File**: `src/app/(dashboard)/expenses/page.tsx` (Lines 137–139)
- **Current Logic**: `if (branchData.branches?.length > 0 && !expBranchId) setExpBranchId(branchData.branches[0].id)`
- **Flaw**: Expenses page defaults `expBranchId` to `branches[0].id` (Hledin branch) for all staff instead of `user?.branchId`.

### 2.4 Staff Management Table Branch Display
- **File**: `src/app/(dashboard)/staff/page.tsx` (Line 442 & Line 627)
- **Current Logic**: `{userRole === "MANAGER" ? branches[0]?.name ?? "My Branch" : "All Branches"}`
- **Flaw**: Displays `branches[0]?.name` ("Hledin branch") as the label for MANAGER's branch instead of retrieving `branches.find(b => b.id === user?.branchId)?.name`.

### 2.5 Work Schedule Branch Selection
- **File**: `src/app/(dashboard)/schedule/page.tsx` (Lines 131–133)
- **Current Logic**: `if (branchData.branches?.length > 0 && !shiftBranchId) setShiftBranchId(branchData.branches[0].id)`
- **Flaw**: Defaults shift branch selector to `branches[0].id`.

---

## 3. POS Page Branch Loading & Scoping Architecture

### 3.1 Server Page Component (`src/app/(dashboard)/pos/page.tsx`)
- **Lines 8–63**: `POSPage` executes `getAuthStaff()` to fetch `dbStaff`.
- Builds `initialStaff = { id, name, email, role, branchId, branchName: dbStaff.branch.name }`.
- Queries `branches = await prisma.branch.findMany({ orderBy: { name: "asc" } })`.
- Passes `initialBranches` and `initialStaff` as props to `<POSContainer />`.

### 3.2 Client Container Component (`src/components/pos/pos-container.tsx`)
- **Header Display** (Lines 160–168): Displays `{activeBranchName || "Select Branch..."}`.
- **Branch Selection Dialog** (Lines 277–300): Renders `Dialog` (`isBranchSelectOpen`) allowing clicking any branch to call `handleSelectBranch(branch)`.
- **Flaw for Cashier**: The POS header displays whatever `activeBranchName` is in `useCartStore`, which often defaults to "Hledin branch" (or stale `localStorage` value), and allows cashiers to switch branch selection in the UI.

### 3.3 Checkout Payment Modal (`src/components/pos/payment-dialog.tsx`)
- **Lines 22 & 181**: Reads `activeBranchId` from `useCartStore` and passes `branchId: activeBranchId` in JSON payload to `/api/pos/checkout`.
- **Flaw**: If `activeBranchId` in `useCartStore` was initialized to `initialBranches[0]` ("Hledin branch") while cashier's profile `staff.branchId` is Branch 2, `PaymentDialog` sends `branchId: "Hledin branch"`.

---

## 4. POS Checkout API Scoping & Validation Analysis

### 4.1 Checkout Route Logic (`src/app/api/pos/checkout/route.ts`)
- **Line 27**: `let branchId = body.branchId || staff.branchId;`
- **Lines 30–54**: Validates `targetBranch` in database; falls back to `staffBranch` or `firstBranch` if invalid.
- **Line 58**: `const permCheck = checkStaffPermission(staff, "pos", "write", branchId);`

### 4.2 Auth Helper Branch Isolation Check (`src/lib/auth-helper.ts`)
- **Lines 118–127**:
  ```ts
  // Branch Isolation Boundary Check
  if (targetBranchId && staff.branchId !== targetBranchId) {
    return {
      allowed: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: Access is restricted to your assigned branch / ဆိုင်ခွဲသီးသန့် ကန့်သတ်ထားပါသည်" },
        { status: 403 }
      ),
    };
  }
  ```

### 4.3 Scoping Vulnerability / Error Case
1. When a Cashier assigned to Branch 2 logs in, if the POS frontend defaults or retains `activeBranchId = "Hledin branch"` (Branch 1), `PaymentDialog` sends `branchId: "Hledin branch"`.
2. The checkout API receives `body.branchId = "Hledin branch"` and passes it to `checkStaffPermission`.
3. Because `staff.role !== "OWNER"` and `staff.branchId ("Branch 2") !== targetBranchId ("Hledin branch")`, `checkStaffPermission` returns HTTP 403 Forbidden!
4. The cashier is blocked from completing checkout because the UI defaulted to "Hledin branch".
5. Furthermore, to prevent any client-side payload manipulation by a cashier, the backend checkout API should explicitly force `branchId = staff.branchId` for non-OWNER staff.

---

## 5. Step-by-Step Remediation Plan for R1

### Step 1: Enforce Cashier Assigned Branch in POS Container (`src/components/pos/pos-container.tsx`)
1. Update `POSContainer` mount `useEffect` (lines 60–64):
   - Check if `initialStaff` / `activeStaff` is present.
   - If `activeStaff?.branchId` is present (or if `activeStaff?.role !== "OWNER"`), set `useCartStore` active branch directly to `activeStaff.branchId` and `activeStaff.branchName`:
     ```tsx
     React.useEffect(() => {
       if (activeStaff?.branchId) {
         setBranch(activeStaff.branchId, activeStaff.branchName || "")
       } else if (!activeBranchId && initialBranches.length > 0) {
         setBranch(initialBranches[0].id, initialBranches[0].name)
       }
     }, [activeStaff, activeBranchId, initialBranches, setBranch])
     ```
2. Restrict Branch Switcher UI in POS Header (lines 160–168 & 277–300):
   - Disable/hide branch select modal trigger when `activeStaff?.role !== "OWNER"`.
   - Display assigned branch name with a locked icon or badge for Cashier and Manager roles.

### Step 2: Strict Branch Scoping in POS Checkout API (`src/app/api/pos/checkout/route.ts`)
1. In `POST /api/pos/checkout` (line 27):
   - Override `branchId` for non-OWNER staff:
     ```ts
     const branchId = staff.role === "OWNER" 
       ? (body.branchId || staff.branchId) 
       : staff.branchId;
     ```
   - This ensures all sales transactions created by cashiers are 100% strictly assigned to `staff.branchId` in the database.

### Step 3: Fix Dashboard Page & Stats API (`src/app/(dashboard)/dashboard/page.tsx` & `src/app/api/dashboard/stats/route.ts`)
1. In `DashboardPage` (`src/app/(dashboard)/dashboard/page.tsx`):
   - Initialize `selectedBranchId` to `user?.branchId || "ALL"` for non-OWNER staff.
   - Ensure header badge reflects `user?.branchName` or assigned branch when `role !== "OWNER"`.

### Step 4: Fix Sales Orders Modal Branch Initialization (`src/app/(dashboard)/sales-orders/page.tsx`)
1. In `openCreate()` (line 468):
   - Change `setNewBranchId(branches[0]?.id || "")` to:
     ```tsx
     setNewBranchId(user?.branchId || branches[0]?.id || "")
     ```

### Step 5: Fix Expenses & Schedule Branch Defaults (`src/app/(dashboard)/expenses/page.tsx` & `src/app/(dashboard)/schedule/page.tsx`)
1. In `expenses/page.tsx` (line 138):
   - Change `setExpBranchId(branchData.branches[0].id)` to `setExpBranchId(user?.branchId || branchData.branches[0].id)`.
2. In `schedule/page.tsx` (line 132):
   - Change `setShiftBranchId(branchData.branches[0].id)` to `setShiftBranchId(user?.branchId || branchData.branches[0].id)`.

### Step 6: Fix Staff Management Branch Label (`src/app/(dashboard)/staff/page.tsx`)
1. In `staff/page.tsx` (line 442 and line 627):
   - Replace `branches[0]?.name` with `branches.find(b => b.id === user?.branchId)?.name || "My Branch"`.

---

## 6. Summary of Affected Files & Line Numbers

| Component / Feature | File Path | Line Numbers | Description / Issue |
| --- | --- | --- | --- |
| Auth Staff Helper | `src/lib/auth-helper.ts` | 17–97, 107–144 | Fetches staff branch & enforces RBAC isolation |
| Auth Me API | `src/app/api/auth/me/route.ts` | 4–26 | Returns staff profile with `branchId` & `branchName` |
| Auth Context Provider | `src/providers/auth-provider.tsx` | 42–87 | Exposes `user.branchId` & `user.branchName` to UI |
| POS Page Server Component | `src/app/(dashboard)/pos/page.tsx` | 9–24, 27–62 | Fetches `dbStaff` and passes `initialStaff` |
| POS Container Component | `src/components/pos/pos-container.tsx` | 60–64, 160–168, 277–300 | Defaults `activeBranchId` to `initialBranches[0]` and allows branch modal |
| POS Checkout API | `src/app/api/pos/checkout/route.ts` | 27, 30–54, 58 | Reads `body.branchId` and validates permissions |
| Sales Orders Page | `src/app/(dashboard)/sales-orders/page.tsx` | 468 | Hardcodes `branches[0]?.id` in `openCreate` |
| Expenses Page | `src/app/(dashboard)/expenses/page.tsx` | 138 | Hardcodes `branches[0].id` in `setExpBranchId` |
| Staff Management Page | `src/app/(dashboard)/staff/page.tsx` | 442, 627 | Displays `branches[0]?.name` for Manager's branch |
| Schedule Page | `src/app/(dashboard)/schedule/page.tsx` | 132 | Hardcodes `branches[0].id` in `setShiftBranchId` |
