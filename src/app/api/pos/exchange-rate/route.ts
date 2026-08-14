import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getAuthStaff, checkStaffPermission } from "@/lib/auth-helper";

export async function POST(request: Request) {
  try {
    const { staff, errorResponse } = await getAuthStaff(request);
    if (errorResponse) return errorResponse;
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { mmkPerUsd } = body;
    const branchId = body.branchId || staff.branchId;
    const setByStaffId = staff.id;

    const permCheck = checkStaffPermission(staff, "pos", "write", branchId);
    if (!permCheck.allowed && permCheck.errorResponse) {
      return permCheck.errorResponse;
    }

    if (!mmkPerUsd || !setByStaffId || !branchId) {
      return NextResponse.json(
        { error: "Missing required fields: mmkPerUsd or branchId" },
        { status: 400 }
      );
    }

    const rateVal = parseFloat(mmkPerUsd);

    const rate = await prisma.exchangeRate.create({
      data: {
        mmkPerUsd: rateVal,
        setByStaffId,
        branchId,
      },
      include: {
        setByStaff: true,
        branch: true,
      },
    });

    // Record in AuditLog
    await prisma.auditLog.create({
      data: {
        staffId: setByStaffId,
        action: "EXCHANGE_RATE_UPDATE",
        details: `Updated MMK/USD exchange rate to ${rateVal.toLocaleString()} Ks at ${rate.branch.name}`,
      },
    });

    // Send Telegram Notification
    const telegramText = `*Exchange Rate Updated*\n*Branch:* ${rate.branch.name}\n*New Rate:* 1 USD = ${rateVal.toLocaleString()} MMK\n*Updated By:* ${rate.setByStaff.name}`;
    await sendTelegramMessage(telegramText);

    return NextResponse.json({ success: true, rate });
  } catch (error) {
    console.error("Exchange rate update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
