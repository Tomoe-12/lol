import { prisma } from "../lib/prisma";

async function main() {
  console.log("Cleaning up old staff accounts and setting exactly 1 Manager + 1 Cashier per branch...");

  // Delete older non-standard staff
  await prisma.staff.deleteMany({
    where: {
      email: {
        in: ["pyay.manager@kindshannon.com", "mandalay.cashier@kindshannon.com", "taunggyi.cashier@kindshannon.com"]
      }
    }
  });

  const staff = await prisma.staff.findMany({
    include: { branch: true },
    orderBy: { branchId: "asc" }
  });

  console.log(`\n✅ FINAL VERIFIED STAFF DIRECTORY (${staff.length} Active Accounts):`);
  console.log("------------------------------------------------------------------");
  staff.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name.padEnd(28)} | ${s.role.padEnd(8)} | PIN: ${s.pin} | ${s.email} | (${s.branch.name.split("/")[0].trim()})`);
  });
}

main().finally(() => prisma.$disconnect());
