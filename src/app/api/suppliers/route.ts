import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

// GET /api/suppliers — list all suppliers with their PO count (blocked for Cashiers)
export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "purchases", "read");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error("GET suppliers error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// POST /api/suppliers — create a new supplier
export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "purchases", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { name, contact, email, address } = body as {
      name: string;
      contact?: string;
      email?: string;
      address?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), contact, email, address },
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error("POST suppliers error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// PUT /api/suppliers — update a supplier
export async function PUT(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "purchases", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { id, name, contact, email, address } = body as {
      id: string;
      name: string;
      contact?: string;
      email?: string;
      address?: string;
    };

    if (!id || !name?.trim()) return NextResponse.json({ error: "Supplier ID and name are required" }, { status: 400 });

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name: name.trim(), contact, email, address },
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error("PUT suppliers error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

// DELETE /api/suppliers — delete a supplier
export async function DELETE(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "purchases", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Supplier ID is required" }, { status: 400 });

    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE suppliers error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
