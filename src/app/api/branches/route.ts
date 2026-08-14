import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "setup", "read");
    if (!permCheck.allowed) {
      // Allow GET branches if staff has read access to any module that uses branch selection (pos, inventory, etc.)
      const hasAnyRead = staff.permissions.pos?.read || staff.permissions.inventory?.read || staff.permissions.salesOrders?.read || staff.permissions.purchases?.read || staff.permissions.reports?.read;
      if (!hasAnyRead && permCheck.errorResponse) {
        return permCheck.errorResponse;
      }
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const branches = await prisma.branch.findMany({
      where: includeArchived ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ branches });
  } catch (error) {
    console.error("Fetch branches error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff || staff.role !== "OWNER") {
      return NextResponse.json({ error: "Access Denied: Only Owner can create branches" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(staff, "setup", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { name, address } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    // 1. Create the new branch
    const newBranch = await prisma.branch.create({
      data: {
        name,
        address: address || null,
        isActive: true,
      },
    });

    // 2. Fetch all existing product variants
    const variants = await prisma.productVariant.findMany();

    // 3. Initialize StockLevel for each variant at the new branch
    if (variants.length > 0) {
      await prisma.stockLevel.createMany({
        data: variants.map((variant) => ({
          branchId: newBranch.id,
          variantId: variant.id,
          quantity: 0,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, branch: newBranch });
  } catch (error) {
    console.error("Create branch error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { staff: currentStaff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!currentStaff || currentStaff.role !== "OWNER") {
      return NextResponse.json({ error: "Access Denied: Only Owner can update branches" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(currentStaff, "setup", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { id, name, address, isActive } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        address: address !== undefined ? address : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({ success: true, branch: updatedBranch });
  } catch (error) {
    console.error("Update branch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { staff: currentStaff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!currentStaff || currentStaff.role !== "OWNER") {
      return NextResponse.json({ error: "Access Denied: Only Owner can delete branches" }, { status: 403 });
    }

    const permCheck = checkStaffPermission(currentStaff, "setup", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    // Soft-delete/archive the branch
    await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Archive branch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
