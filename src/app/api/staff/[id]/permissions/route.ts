import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { sanitizePermissions } from "@/lib/permissions";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (staff.role === "CASHIER") {
      return NextResponse.json({ error: "Forbidden: Cashiers cannot access staff permissions" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(staff, "staff", "read");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const targetStaff = await prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        permissions: true,
      },
    });

    if (!targetStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    if (staff.role === "MANAGER" && targetStaff.branchId !== staff.branchId) {
      return NextResponse.json(
        { error: "Forbidden: Access is restricted to your assigned branch" },
        { status: 403 }
      );
    }

    const sanitized = sanitizePermissions(targetStaff.permissions, targetStaff.role);

    return NextResponse.json({ permissions: sanitized });
  } catch (error) {
    console.error("GET staff permissions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (staff.role === "CASHIER") {
      return NextResponse.json({ error: "Forbidden: Cashiers cannot modify staff permissions" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(staff, "staff", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const targetStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!targetStaff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    if (targetStaff.role === "OWNER") {
      return NextResponse.json(
        { error: "Owner permissions are unrestricted and cannot be modified" },
        { status: 403 }
      );
    }

    if (staff.role === "MANAGER") {
      if (targetStaff.branchId !== staff.branchId || targetStaff.role !== "CASHIER") {
        return NextResponse.json(
          { error: "Forbidden: Managers can only modify permissions for cashiers in their assigned branch" },
          { status: 403 }
        );
      }
    } else if (staff.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to modify staff permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const sanitized = sanitizePermissions(body.permissions, targetStaff.role);

    await prisma.staff.update({
      where: { id },
      data: {
        permissions: JSON.parse(JSON.stringify(sanitized)),
      },
    });

    await invalidateCache(CACHE_KEYS.staff());

    return NextResponse.json({ success: true, permissions: sanitized });
  } catch (error) {
    console.error("PUT staff permissions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
