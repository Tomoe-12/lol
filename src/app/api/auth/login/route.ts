import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, pin } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find staff by email
    const staff = await prisma.staff.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { branch: true },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Email not found in employee system / အကောင့်ရှာမတွေ့ပါ" },
        { status: 401 }
      );
    }

    // Verify Password or PIN
    if (password && staff.password && staff.password !== password) {
      return NextResponse.json(
        { error: "Incorrect password / စကားဝှက်မှားယွင်းနေပါသည်" },
        { status: 401 }
      );
    }

    if (pin && staff.pin && staff.pin !== pin) {
      return NextResponse.json(
        { error: "Incorrect PIN / ပင်နံပါတ်မှားယွင်းနေပါသည်" },
        { status: 401 }
      );
    }

    // Set local session cookie
    const sessionData = JSON.stringify({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      branchId: staff.branchId,
      branchName: staff.branch.name,
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set("pos_session", sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    } catch {
      // Outside server request scope (e.g. direct route testing)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        branchId: staff.branchId,
        branchName: staff.branch.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
