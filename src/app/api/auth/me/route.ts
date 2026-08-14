import { NextResponse } from "next/server";
import { getAuthStaff } from "@/lib/auth-helper";

export async function GET(request: Request) {
  const { staff, errorResponse } = await getAuthStaff(request);
  if (errorResponse) {
    return errorResponse;
  }

  return NextResponse.json({
    user: {
      id: staff!.id,
      name: staff!.name,
      email: staff!.email,
      role: staff!.role,
      branchId: staff!.branchId,
      branchName: staff!.branch.name,
      permissions: staff!.permissions,
      publicMetadata: {
        role: staff!.role,
        branchId: staff!.branchId,
        permissions: staff!.permissions,
      },
    },
  });
}
