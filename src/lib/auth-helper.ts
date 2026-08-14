import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Staff, Branch } from "@prisma/client";
import { StaffPermissions, ModuleKey, sanitizePermissions } from "@/lib/permissions";

export type AuthenticatedStaff = Omit<Staff, "permissions"> & {
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

    const permissions = sanitizePermissions(staff.permissions, staff.role);
    const authenticatedStaff: AuthenticatedStaff = {
      ...staff,
      branch: staff.branch,
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
