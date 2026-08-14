import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.staff.updateMany({
    where: { email: "li8993han@gmail.com" },
    data: { role: "OWNER" },
  });
  console.log(`✅ Updated ${result.count} staff record(s) to OWNER role`);

  // Verify
  const staff = await prisma.staff.findFirst({
    where: { email: "li8993han@gmail.com" },
    select: { name: true, email: true, role: true, pin: true },
  });
  console.log("Staff record:", staff);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
