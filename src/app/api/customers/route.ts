import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";
import { isValidMyanmarPhone, normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

function collectPhones(customer: { phone: string | null; phones: unknown }): string[] {
  const values = [customer.phone || "", ...(Array.isArray(customer.phones) ? customer.phones : [])];
  return Array.from(new Set(values.map(normalizePhone).filter(Boolean)));
}

export async function GET(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "salesOrders", "read");
    if (!permCheck.allowed) {
      const posCheck = checkStaffPermission(staff, "pos", "read");
      if (!posCheck.allowed && permCheck.errorResponse) {
        return permCheck.errorResponse;
      }
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    const searchValue = search?.toLowerCase().trim();
    const filteredCustomers = searchValue
      ? customers.filter((customer) => customer.name.toLowerCase().includes(searchValue) || collectPhones(customer).some((phone) => phone.includes(normalizePhone(searchValue))))
      : customers;

    return NextResponse.json(filteredCustomers.map((customer) => ({ ...customer, phones: collectPhones(customer) })));
  } catch (error) {
    console.error("Fetch customers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const permCheck = checkStaffPermission(staff, "salesOrders", "write");
    if (!permCheck.allowed) {
      const posCheck = checkStaffPermission(staff, "pos", "write");
      if (!posCheck.allowed && permCheck.errorResponse) {
        return permCheck.errorResponse;
      }
    }

    const body = await request.json();
    const { name, phone, phones, email, address } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const requestedPhones = Array.isArray(phones) ? phones : [phone];
    const rawNormalizedPhones = requestedPhones.map(normalizePhone).filter(Boolean);
    if (rawNormalizedPhones.some((phone) => !isValidMyanmarPhone(phone))) {
      return NextResponse.json({ error: "Each phone number must be exactly 11 digits and start with 09." }, { status: 400 });
    }
    const normalizedPhones = Array.from(new Set(rawNormalizedPhones));
    if (normalizedPhones.length === 0) {
      return NextResponse.json({ error: "At least one phone number is required." }, { status: 400 });
    }
    if (normalizedPhones.length !== rawNormalizedPhones.length) {
      return NextResponse.json({ error: "Each phone number must be unique." }, { status: 400 });
    }
    const existingCustomers = await prisma.customer.findMany({ select: { id: true, name: true, phone: true, phones: true } });
    const duplicate = existingCustomers.find((customer) => collectPhones(customer).some((existingPhone) => normalizedPhones.includes(existingPhone)));
    if (duplicate) {
      return NextResponse.json(
        { error: "A customer already exists with this phone number.", customer: { ...duplicate, phones: collectPhones(duplicate) } },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: normalizedPhones[0] || null,
        phones: normalizedPhones.length ? normalizedPhones : Prisma.JsonNull,
        email: email?.trim() || null,
        address,
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Create customer error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
