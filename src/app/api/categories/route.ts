import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, invalidateCache, CACHE_KEYS, TTL } from "@/lib/redis";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "setup", "read");
    if (!permCheck.allowed) {
      const invCheck = checkStaffPermission(staff, "inventory", "read");
      const posCheck = checkStaffPermission(staff, "pos", "read");
      if (!invCheck.allowed && !posCheck.allowed && permCheck.errorResponse) {
        return permCheck.errorResponse;
      }
    }

    const categories = await withCache(
      CACHE_KEYS.categories,
      TTL.CATEGORIES,
      () => prisma.category.findMany({ orderBy: { name: "asc" } })
    );
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Fetch categories error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "setup", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: { name },
    });

    await invalidateCache(CACHE_KEYS.categories, CACHE_KEYS.products());
    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Create category error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "setup", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const body = await request.json();
    const { id, name } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name },
    });

    await invalidateCache(CACHE_KEYS.categories, CACHE_KEYS.products());
    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Update category error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "setup", "write");
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing category ID" }, { status: 400 });
    }

    // Check if category has any products
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete category that contains products / ပစ္စည်းများရှိနေသောကြောင့် ဖျက်၍မရပါ။" },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    await invalidateCache(CACHE_KEYS.categories, CACHE_KEYS.products());
    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Delete category error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
