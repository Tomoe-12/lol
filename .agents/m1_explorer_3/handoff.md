# Handoff Report — Explorer 3: Auth Helper, API Auth Me, and Auth Provider Permission Integration (Milestone M1)

## 1. Observation

Direct examination of the codebase revealed the following file locations and structures:

### A. `src/lib/auth-helper.ts` (Lines 1-84)
- **Current `AuthenticatedStaff` Type**:
  ```ts
  export type AuthenticatedStaff = Staff & {
    branch: Branch;
  };
  ```
- **Current `getAuthStaff` Function**: Fetches staff with `{ include: { branch: true } }`, but does not attach parsed `permissions` to the returned `AuthenticatedStaff` object.
- **Permission Checking Helper**: Currently missing `checkStaffPermission(staff, module, action, targetBranchId)` helper function.

### B. `src/app/api/auth/me/route.ts` (Lines 1-25)
- **Current Return Payload**:
  ```ts
  return NextResponse.json({
    user: {
      id: staff!.id,
      name: staff!.name,
      email: staff!.email,
      role: staff!.role,
      branchId: staff!.branchId,
      branchName: staff!.branch.name,
      publicMetadata: {
        role: staff!.role,
        branchId: staff!.branchId,
      },
    },
  });
  ```
- `permissions` is currently omitted from both `user` and `user.publicMetadata`.

### C. `src/providers/auth-provider.tsx` (Lines 1-194)
- **Current `LocalUser` Interface**:
  ```ts
  export interface LocalUser {
    id: string;
    name: string;
    fullName: string;
    email: string;
    primaryEmailAddress: { emailAddress: string };
    role: "OWNER" | "MANAGER" | "CASHIER";
    branchId: string;
    branchName: string;
    publicMetadata: {
      role: "OWNER" | "MANAGER" | "CASHIER";
      branchId: string;
    };
    reload: () => Promise<void>;
  }
  ```
- `permissions` property is missing from `LocalUser` interface and state initialization in `fetchUser`.
- `reload: () => Promise<void>` is already defined and calls `fetchUser()`.

---

## 2. Logic Chain

1. **Integrating Staff Permissions into Server Session (`auth-helper.ts`)**:
   - `getAuthStaff` is the central server-side session resolver used by all API controllers.
   - By parsing `staff.permissions` (or obtaining role defaults via `getStaffPermissions(staff)` from `@/lib/permissions`) inside `getAuthStaff`, every API handler gains instant access to `staff.permissions`.
   - Adding `checkStaffPermission(staff, module, action, targetBranchId)` in `auth-helper.ts` provides a unified, reusable server authorization check.
   - The permission check logic evaluates:
     1. **OWNER Role Bypass**: `staff.role === "OWNER"` is granted unconditional access.
     2. **Branch Isolation Boundary**: If `targetBranchId` is passed and `staff.branchId !== targetBranchId`, access is denied with a `403 Forbidden` response.
     3. **Granular Permission Check**: Evaluates `staff.permissions[module][action]`. If `false`, access is denied with a `403 Forbidden` response.

2. **Exposing Permissions in `/api/auth/me` (`route.ts`)**:
   - The client application fetches `/api/auth/me` to hydrate `AuthProvider`.
   - Adding `permissions: staff.permissions` to `/api/auth/me` response enables the frontend client context (`AuthProvider`, `Sidebar`, route guards) to read the user's granular permissions upon login and reload.

3. **Hydrating Permissions in Client State (`auth-provider.tsx`)**:
   - `LocalUser` interface must include `permissions?: StaffPermissions`.
   - `fetchUser` inside `AuthProvider` populates `permissions` from `/api/auth/me` JSON response (falling back to `getDefaultPermissions(user.role)` if needed).
   - Calling `user.reload()` re-executes `fetchUser()`, updating `user.permissions` in state immediately when staff permissions are edited in the UI.

---

## 3. Caveats

- `src/lib/permissions.ts` is created as part of Milestone M1 (Explorer 2 / Implementer 1) and defines `StaffPermissions`, `ModuleKey`, `getStaffPermissions`, and `getDefaultPermissions`. `auth-helper.ts` and `auth-provider.tsx` depend on exports from `@/lib/permissions`.
- `checkStaffPermission` returns an object `{ allowed: boolean; errorResponse: NextResponse | null }`, allowing REST API route handlers to do concise guard checks:
  ```ts
  const check = checkStaffPermission(staff, "staff", "write", targetBranchId);
  if (!check.allowed) return check.errorResponse;
  ```
- No caveats.

---

## 4. Conclusion & Precise Code Specifications

Below are the exact code modifications to implement in Milestone M1:

### Specification 1: Update `src/lib/auth-helper.ts`

```typescript
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Staff, Branch } from "@prisma/client";
import { StaffPermissions, ModuleKey, getStaffPermissions } from "@/lib/permissions";

export type AuthenticatedStaff = Staff & {
  branch: Branch;
  permissions: StaffPermissions;
};

export interface PermissionCheckResult {
  allowed: boolean;
  errorResponse: NextResponse | null;
}

export async function getAuthStaff(req?: Request): Promise<{
  staff: AuthenticatedStaff | null;
  errorResponse: NextResponse | null;
}> {
  try {
    let sessionVal: string | undefined;

    try {
      const cookieStore = await cookies();
      sessionVal = cookieStore.get("pos_session")?.value;
    } catch {
      // Outside server request scope (e.g. direct route testing)
    }

    if (!sessionVal && req) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/pos_session=([^;]+)/);
        if (match) {
          sessionVal = decodeURIComponent(match[1]);
        }
      }
      if (!sessionVal) {
        sessionVal = req.headers.get("x-staff-id") || undefined;
      }
    }

    if (!sessionVal) {
      return {
        staff: null,
        errorResponse: NextResponse.json(
          { error: "Unauthorized / မည်သူမည်ဝါဖြစ်ကြောင်းအတည်မပြုနိုင်ပါ" },
          { status: 401 }
        ),
      };
    }

    let staffIdentifier = sessionVal;
    try {
      const parsed = JSON.parse(sessionVal);
      if (parsed.id) staffIdentifier = parsed.id;
    } catch {
      // raw string value
    }

    const staff = await prisma.staff.findFirst({
      where: {
        OR: [
          { id: staffIdentifier },
          { email: staffIdentifier }
        ]
      },
      include: { branch: true },
    });

    if (!staff) {
      return {
        staff: null,
        errorResponse: NextResponse.json(
          { error: "Access Denied: You are not registered as an employee / ဝန်ထမ်းစာရင်းတွင်မရှိပါ" },
          { status: 403 }
        ),
      };
    }

    const permissions = getStaffPermissions(staff);
    const authenticatedStaff: AuthenticatedStaff = {
      ...(staff as Staff & { branch: Branch }),
      permissions,
    };

    return { staff: authenticatedStaff, errorResponse: null };
  } catch (error) {
    console.error("Auth helper error:", error);
    return {
      staff: null,
      errorResponse: NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
    };
  }
}

/**
 * Validates staff permissions against module, action, and target branch isolation boundary.
 *
 * Rules:
 * 1. OWNER has full access to all modules and branches.
 * 2. If targetBranchId is specified and staff.role !== 'OWNER', staff.branchId must match targetBranchId.
 * 3. Evaluates staff.permissions[module][action].
 */
export function checkStaffPermission(
  staff: AuthenticatedStaff,
  module: ModuleKey,
  action: "read" | "write",
  targetBranchId?: string | null
): PermissionCheckResult {
  // 1. OWNER full access bypass
  if (staff.role === "OWNER") {
    return { allowed: true, errorResponse: null };
  }

  // 2. Branch Isolation Boundary Check
  if (targetBranchId && staff.branchId !== targetBranchId) {
    return {
      allowed: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: Access is restricted to your assigned branch / ဆိုင်ခွဲသီးသန့် ကန့်သတ်ထားပါသည်" },
        { status: 403 }
      ),
    };
  }

  // 3. Granular Module Permission Check
  const modulePerm = staff.permissions[module];
  const hasAccess = modulePerm ? modulePerm[action] : false;

  if (!hasAccess) {
    return {
      allowed: false,
      errorResponse: NextResponse.json(
        { error: `Forbidden: You do not have ${action} permission for module '${module}' / ဤလုပ်ဆောင်ချက်ကို လုပ်ဆောင်ရန် အခွင့်အရေးမရှိပါ` },
        { status: 403 }
      ),
    };
  }

  return { allowed: true, errorResponse: null };
}
```

---

### Specification 2: Update `src/app/api/auth/me/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getAuthStaff } from "@/lib/auth-helper";

export async function GET(request: Request) {
  const { staff, errorResponse } = await getAuthStaff(request);
  if (errorResponse) {
    return errorResponse;
  }

  return NextResponse.json({
    user: {
      id: staff!.id,
      name: staff!.name,
      email: staff!.email,
      role: staff!.role,
      branchId: staff!.branchId,
      branchName: staff!.branch.name,
      permissions: staff!.permissions,
      publicMetadata: {
        role: staff!.role,
        branchId: staff!.branchId,
        permissions: staff!.permissions,
      },
    },
  });
}
```

---

### Specification 3: Update `src/providers/auth-provider.tsx`

```typescript
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { StaffPermissions, getDefaultPermissions } from "@/lib/permissions";

export interface LocalUser {
  id: string;
  name: string;
  fullName: string;
  email: string;
  primaryEmailAddress: { emailAddress: string };
  role: "OWNER" | "MANAGER" | "CASHIER";
  branchId: string;
  branchName: string;
  permissions?: StaffPermissions;
  publicMetadata: {
    role: "OWNER" | "MANAGER" | "CASHIER";
    branchId: string;
    permissions?: StaffPermissions;
  };
  reload: () => Promise<void>;
}

// ... rest of imports & context definition ...

// Inside fetchUser callback:
const fetchUser = React.useCallback(async () => {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        const userPermissions = data.user.permissions || getDefaultPermissions(data.user.role);
        const u: LocalUser = {
          id: data.user.id,
          name: data.user.name,
          fullName: data.user.name,
          email: data.user.email,
          primaryEmailAddress: { emailAddress: data.user.email },
          role: data.user.role,
          branchId: data.user.branchId,
          branchName: data.user.branchName,
          permissions: userPermissions,
          publicMetadata: {
            role: data.user.role,
            branchId: data.user.branchId,
            permissions: userPermissions,
          },
          reload: async () => {
            await fetchUser();
          },
        };
        setUser(u);
      } else {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  } catch {
    setUser(null);
  } finally {
    setIsLoaded(true);
  }
}, []);
```

---

## 5. Verification Method

1. **Type Checking & Build Test**:
   - Run `npx tsc --noEmit` or `npm run build` after changes to verify no TypeScript compilation errors occur.
2. **API Auth Me Verification**:
   - Execute a `GET /api/auth/me` request using a valid `pos_session` cookie or `x-staff-id` header.
   - Confirm the JSON response contains `user.permissions` object with all 9 module keys (`dashboard`, `pos`, `inventory`, `salesOrders`, `purchases`, `expenses`, `staff`, `reports`, `setup`) mapping to `{ read: boolean, write: boolean }`.
3. **Permission Guard Verification**:
   - Call `checkStaffPermission(staff, "staff", "write", targetBranchId)` in a test script for:
     - OWNER: returns `{ allowed: true, errorResponse: null }`.
     - CASHIER attempting write access on "staff": returns `{ allowed: false }` with a 403 NextResponse.
     - MANAGER attempting access on targetBranchId belonging to another branch: returns `{ allowed: false }` with a 403 branch restriction error.
