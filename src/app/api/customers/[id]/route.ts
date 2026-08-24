import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkStaffPermission, getAuthStaff } from "@/lib/auth-helper";

function normalizePhone(value: unknown): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0095")) digits = `0${digits.slice(4)}`;
  if (digits.startsWith("95")) digits = `0${digits.slice(2)}`;
  return digits;
}

function collectPhones(customer: { phone: string | null; phones: unknown }): string[] {
  const values = [customer.phone || "", ...(Array.isArray(customer.phones) ? customer.phones : [])];
  return Array.from(new Set(values.map(normalizePhone).filter(Boolean)));
}

async function requireWriteAccess(request: Request) {
  const { staff, errorResponse } = await getAuthStaff(request);
  if (errorResponse) return { staff: null, response: errorResponse };
  if (!staff) return { staff: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const salesOrdersCheck = checkStaffPermission(staff, "salesOrders", "write");
  const posCheck = checkStaffPermission(staff, "pos", "write");
  if (!salesOrdersCheck.allowed && !posCheck.allowed) {
    return { staff: null, response: salesOrdersCheck.errorResponse || posCheck.errorResponse };
  }
  return { staff, response: null };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const normalizedPhones: string[] = Array.from(new Set((Array.isArray(body.phones) ? body.phones : [body.phone]).map(normalizePhone).filter(Boolean)));
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!normalizedPhones.length) return NextResponse.json({ error: "At least one phone number is required." }, { status: 400 });

    const existing = await prisma.customer.findMany({ where: { NOT: { id } }, select: { name: true, phone: true, phones: true } });
    if (existing.some((customer) => collectPhones(customer).some((phone) => normalizedPhones.includes(phone)))) {
      return NextResponse.json({ error: "A customer already exists with this phone number." }, { status: 409 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { name, phone: normalizedPhones[0], phones: normalizedPhones as Prisma.InputJsonValue, email: typeof body.email === "string" ? body.email.trim() || null : null, address: typeof body.address === "string" ? body.address.trim() || null : null },
    });
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Update customer error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "This customer cannot be deleted because they have sales orders." }, { status: 409 });
    }
    console.error("Delete customer error:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
