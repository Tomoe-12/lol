import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "dashboard", "read");
    if (!permCheck.allowed) {
      const repCheck = checkStaffPermission(staff, "reports", "read");
      if (!repCheck.allowed && permCheck.errorResponse) {
        return permCheck.errorResponse;
      }
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type || (type !== "transactions" && type !== "stock")) {
      return NextResponse.json(
        { error: "Invalid or missing export type. Expected 'transactions' or 'stock'." },
        { status: 400 }
      );
    }

    const effectiveBranchId = staff.role === "MANAGER" ? staff.branchId : undefined;

    let csvContent = "";
    let filename = "";

    if (type === "transactions") {
      filename = `transactions_export_${Date.now()}.csv`;
      csvContent = "Date,Transaction ID,Branch,Cashier,Total,Currency,Payment Method,Note\n";

      const transactions = await prisma.transaction.findMany({
        where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
        include: {
          branch: true,
          staff: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      transactions.forEach((tx) => {
        const dateStr = new Date(tx.createdAt).toISOString().split("T")[0];
        const id = tx.id;
        const branch = tx.branch.name.replace(/,/g, " ");
        const cashier = tx.staff.name.replace(/,/g, " ");
        const total = tx.total;
        const currency = tx.currency;
        const method = tx.paymentMethod;
        const note = (tx.note || "").replace(/,/g, " ").replace(/\n/g, " ");

        csvContent += `${dateStr},${id},${branch},${cashier},${total},${currency},${method},${note}\n`;
      });
    } else {
      filename = `stock_levels_export_${Date.now()}.csv`;
      csvContent = "Branch,Product,Barcode,Quantity,Low Stock Threshold\n";

      const stockLevels = await prisma.stockLevel.findMany({
        where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
        include: {
          branch: true,
          variant: { include: { product: true } },
        },
        orderBy: [
          { branch: { name: "asc" } },
        ],
      });

      stockLevels.forEach((s) => {
        const branch = s.branch.name.replace(/,/g, " ");
        const product = `${s.variant.product.name} - ${s.variant.name}`.replace(/,/g, " ");
        const barcode = s.variant.barcode || "";
        const quantity = s.quantity;
        const threshold = s.variant.lowStockThreshold;

        csvContent += `${branch},${product},${barcode},${quantity},${threshold}\n`;
      });
    }

    // Return raw CSV file trigger
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
