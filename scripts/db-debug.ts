import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany();
  console.log("Branches:", branches);

  const staff = await prisma.staff.findMany();
  console.log("Staff:", staff);

  const products = await prisma.product.findMany();
  console.log("Products:", products);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
