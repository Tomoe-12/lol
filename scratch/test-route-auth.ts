import { prisma } from "../src/lib/prisma";
import { GET as getSO, POST as createSO } from "../src/app/api/sales-orders/route";
import { NextRequest } from "next/server";

async function testAuth() {
  const staff = await prisma.staff.findFirst({ where: { role: "OWNER" } });
  console.log("Found staff:", staff?.name, staff?.id);

  if (!staff) return;

  const cookieVal = JSON.stringify({ id: staff.id });
  const req = new NextRequest("http://localhost:3000/api/sales-orders", {
    method: "GET",
    headers: {
      cookie: `pos_session=${encodeURIComponent(cookieVal)}`
    }
  });

  try {
    const res = await getSO(req);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response data:", data);
  } catch (err) {
    console.error("Error calling route:", err);
  }
}

testAuth();
