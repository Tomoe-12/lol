const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const branches = await prisma.branch.findMany();
    console.log("Branches count:", branches.length);
    const staff = await prisma.staff.findMany();
    console.log("Staff count:", staff.length);
    const salesOrders = await prisma.salesOrder.findMany({ include: { items: true } });
    console.log("SalesOrders count:", salesOrders.length);
    const transactions = await prisma.transaction.findMany({ include: { items: true } });
    console.log("Transactions count:", transactions.length);
  } catch (err) {
    console.error("DB connection error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
