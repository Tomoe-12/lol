import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, invalidateCache, CACHE_KEYS, TTL } from "@/lib/redis";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

// GET all products
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

    const products = await withCache(
      CACHE_KEYS.products(),
      TTL.PRODUCTS,
      () => prisma.product.findMany({
        where: { isActive: true },
        include: {
          category: true,
          variants: {
            include: {
              stockLevels: true
            }
          },
        },
        orderBy: { name: "asc" },
      })
    );
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Fetch products error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

// POST create a product
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
    const { name, categoryId, imageUrl, variants, price, costPrice } = body;

    if (!name || !categoryId || !variants || variants.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: name, categoryId, or variants" },
        { status: 400 }
      );
    }

    const newProduct = await prisma.$transaction(async (tx) => {
      const productPrice = Number(price ?? variants[0]?.price ?? 0);
      const productCostPrice = Number(costPrice) > 0
        ? Number(costPrice)
        : Number(variants.find((v: { costPrice?: number }) => Number(v.costPrice) > 0)?.costPrice ?? 0);

      // 1. Create Product
      const product = await tx.product.create({
        data: {
          name,
          categoryId,
          price: productPrice,
          costPrice: productCostPrice,
          imageUrl: imageUrl || null,
          isActive: true,
        },
      });

      // 2. Create variants if provided
      if (variants && Array.isArray(variants)) {
        for (const v of variants) {
          await tx.productVariant.create({
            data: {
              productId: product.id,
              name: v.name,
              barcode: v.barcode,
              lowStockThreshold: v.lowStockThreshold ?? 10,
              costPrice: productCostPrice,
              price: productPrice,
            }
          });
        }
      }

      // Fetch full created product to return
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          variants: true,
          category: true,
        },
      });
    });

    await invalidateCache(CACHE_KEYS.products());
    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: unknown) {
    console.error("Create product error:", error);
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Barcode already exists. Barcodes must be unique." }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

// PUT update a product
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
    const { id, name, categoryId, imageUrl, variants, isActive, price, costPrice } = body;

    if (!id || !name || !categoryId || !variants || variants.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, categoryId, or variants" },
        { status: 400 }
      );
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUnique({ where: { id } });
      const productPrice = Number(price ?? existingProduct?.price ?? 0);
      const productCostPrice = Number(costPrice) > 0
        ? Number(costPrice)
        : Number(
            variants.find((v: { costPrice?: number }) => Number(v.costPrice) > 0)?.costPrice
              ?? existingProduct?.costPrice
              ?? 0
          );

      // 1. Update Product details
      await tx.product.update({
        where: { id },
        data: {
          name,
          categoryId,
          imageUrl: imageUrl || null,
          isActive: isActive ?? true,
          price: productPrice,
          costPrice: productCostPrice,
        },
      });

      // 2. Handle Variants update
      if (variants && Array.isArray(variants)) {
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id },
        });

        const incomingIds = variants.map((v) => v.id).filter(Boolean);

        // Delete removed variants that are not in incoming list
        for (const ev of existingVariants) {
          if (!incomingIds.includes(ev.id)) {
            // Check if variant is referenced in TransactionItems
            const refCount = await tx.transactionItem.count({
              where: { variantId: ev.id },
            });
            if (refCount === 0) {
              await tx.productVariant.delete({ where: { id: ev.id } });
            } else {
              // If referenced, we don't delete to avoid breaking historical logs
              // We just do nothing, or we could rename it or flag it
            }
          }
        }

        // Upsert incoming variants
        for (const v of variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                barcode: v.barcode,
                lowStockThreshold: v.lowStockThreshold ?? 10,
                costPrice: productCostPrice,
                price: productPrice,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                name: v.name,
                barcode: v.barcode,
                lowStockThreshold: v.lowStockThreshold ?? 10,
                costPrice: productCostPrice,
                price: productPrice,
              },
            });
          }
        }

        // Product price is shared by every variant.
        await tx.productVariant.updateMany({
          where: { productId: id },
          data: { price: productPrice },
        });
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          variants: true,
          category: true,
        },
      });
    });

    await invalidateCache(CACHE_KEYS.products());
    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: unknown) {
    console.error("Update product error:", error);
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Barcode already exists. Barcodes must be unique." }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE product (Soft delete by default to protect historical transactions)
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
      return NextResponse.json({ error: "Missing product ID" }, { status: 400 });
    }

    // Toggle isActive to false as a soft delete
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await invalidateCache(CACHE_KEYS.products());
    return NextResponse.json({ success: true, message: "Product soft deleted", product });
  } catch (error) {
    console.error("Delete product error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
