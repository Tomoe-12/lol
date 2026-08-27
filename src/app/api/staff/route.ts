import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { withCache, invalidateCache, CACHE_KEYS, TTL } from "@/lib/redis";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

// GET /api/staff — List all staff (branch-isolated for Managers, blocked for Cashiers)
export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (staff.role === Role.CASHIER) {
      return NextResponse.json({ error: "Forbidden: Cashiers cannot access staff management" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(staff, "staff", "read");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const effectiveBranchId = staff.role === Role.OWNER ? undefined : staff.branchId;

    const staffList = await withCache(
      CACHE_KEYS.staff(effectiveBranchId),
      TTL.STAFF,
      () => prisma.staff.findMany({
        where: {
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        include: {
          branch: { select: { id: true, name: true } },
          _count: {
            select: {
              transactions: true,
            },
          },
        },
        orderBy: { name: "asc" },
      })
    );
    return NextResponse.json({ staff: staffList });
  } catch (error) {
    console.error("GET staff error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/staff — Create a new staff member (allowed for Owner or Manager with staff.write within same branch)
export async function POST(request: Request) {
  try {
    const { staff: currentStaff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!currentStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (currentStaff.role === Role.CASHIER) {
      return NextResponse.json({ error: "Forbidden: Cashiers cannot create staff members" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(currentStaff, "staff", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { name, email, password, role, branchId } = body as {
      name: string;
      email: string;
      password?: string;
      role: Role;
      branchId: string;
    };

    if (!name?.trim() || !email?.trim() || !branchId || !role) {
      return NextResponse.json(
        { error: "Name, email, role, and branchId are required" },
        { status: 400 }
      );
    }

    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: "Invalid staff role" }, { status: 400 });
    }

    if (!(await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Assigned branch not found" }, { status: 400 });
    }

    // Branch isolation boundary & role restriction for Managers
    if (currentStaff.role === Role.MANAGER) {
      if (branchId !== currentStaff.branchId) {
        return NextResponse.json(
          { error: "Forbidden: Managers can only create staff members for their own assigned branch" },
          { status: 403 }
        );
      }
      if (role !== Role.CASHIER) {
        return NextResponse.json(
          { error: "Forbidden: Managers can only create Cashier staff members" },
          { status: 403 }
        );
      }
    }

    // Verify unique email
    const existingEmail = await prisma.staff.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existingEmail) {
      return NextResponse.json({ error: "Email is already in use by another staff member" }, { status: 400 });
    }

    const newStaff = await prisma.staff.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password?.trim() || "123456",
        pin: null,
        role,
        branchId,
      },
      include: { branch: true },
    });

    await invalidateCache(CACHE_KEYS.staff());
    return NextResponse.json({ staff: newStaff });
  } catch (error) {
    console.error("POST staff error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// PUT /api/staff — Update an existing staff member (allowed for Owner or Manager with staff.write within same branch)
export async function PUT(request: Request) {
  try {
    const { staff: currentStaff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!currentStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (currentStaff.role === Role.CASHIER) {
      return NextResponse.json({ error: "Forbidden: Cashiers cannot modify staff members" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(currentStaff, "staff", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { id, name, email, password, role, branchId } = body as {
      id: string;
      name: string;
      email: string;
      password?: string;
      role: Role;
      branchId: string;
    };

    if (!id || !name?.trim() || !email?.trim() || !branchId || !role) {
      return NextResponse.json(
        { error: "ID, name, email, role, and branchId are required" },
        { status: 400 }
      );
    }

    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: "Invalid staff role" }, { status: 400 });
    }

    if (!(await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Assigned branch not found" }, { status: 400 });
    }

    const targetStaff = await prisma.staff.findUnique({ where: { id } });
    if (!targetStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    // Manager constraints
    if (currentStaff.role === Role.MANAGER) {
      if (targetStaff.branchId !== currentStaff.branchId || branchId !== currentStaff.branchId) {
        return NextResponse.json(
          { error: "Forbidden: Managers can only manage staff members in their assigned branch" },
          { status: 403 }
        );
      }
      if (
        targetStaff.id !== currentStaff.id &&
        targetStaff.role !== Role.CASHIER
      ) {
        return NextResponse.json(
          { error: "Forbidden: Managers can only modify Cashier staff members" },
          { status: 403 }
        );
      }
      if (targetStaff.id === currentStaff.id && role !== Role.MANAGER) {
        return NextResponse.json(
          { error: "Forbidden: Managers cannot change their own role" },
          { status: 403 }
        );
      }
      if (role === Role.OWNER) {
        return NextResponse.json(
          { error: "Forbidden: Managers cannot modify or assign Owner role" },
          { status: 403 }
        );
      }
    }

    if (targetStaff.role === Role.OWNER && role !== Role.OWNER) {
      const ownerCount = await prisma.staff.count({ where: { role: Role.OWNER } });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot change the role of the last Owner" },
          { status: 400 }
        );
      }
    }

    // Check unique email
    const existingEmail = await prisma.staff.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        id: { not: id },
      },
    });
    if (existingEmail) {
      return NextResponse.json({ error: "Email is already in use by another staff member" }, { status: 400 });
    }

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(password?.trim() ? { password: password.trim() } : {}),
        pin: null,
        role,
        branchId,
      },
      include: { branch: true },
    });

    await invalidateCache(CACHE_KEYS.staff());
    return NextResponse.json({ staff: updated });
  } catch (error) {
    console.error("PUT staff error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// DELETE /api/staff — Delete a staff member (allowed for Owner or Manager with staff.write within same branch)
export async function DELETE(request: Request) {
  try {
    const { staff: currentStaff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!currentStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (currentStaff.role === Role.CASHIER) {
      return NextResponse.json({ error: "Forbidden: Cashiers cannot delete staff members" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(currentStaff, "staff", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });

    const targetStaff = await prisma.staff.findUnique({ where: { id } });
    if (!targetStaff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

    if (targetStaff.id === currentStaff.id) {
      return NextResponse.json({ error: "You cannot delete your own staff account" }, { status: 400 });
    }

    // Manager constraints
    if (currentStaff.role === Role.MANAGER) {
      if (targetStaff.branchId !== currentStaff.branchId) {
        return NextResponse.json(
          { error: "Forbidden: Managers can only delete staff members in their assigned branch" },
          { status: 403 }
        );
      }
      if (targetStaff.id !== currentStaff.id && targetStaff.role !== Role.CASHIER) {
        return NextResponse.json(
          { error: "Forbidden: Managers can only delete Cashier staff members" },
          { status: 403 }
        );
      }
    }

    // Prevent deleting the last owner
    if (targetStaff.role === Role.OWNER) {
      const ownerCount = await prisma.staff.count({ where: { role: Role.OWNER } });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last Owner in the system" }, { status: 400 });
      }
    }

    await prisma.staff.delete({ where: { id } });
    await invalidateCache(CACHE_KEYS.staff());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE staff error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
