import { prisma } from "../lib/prisma";

async function main() {
  const staff = await prisma.staff.findMany({
    include: { branch: true }
  });
  console.log(`TOTAL STAFF MEMBERS IN DB: ${staff.length}`);
  staff.forEach((s, i) => {
    console.log(`${i + 1}. [${s.name}] | Role: ${s.role} | Email: ${s.email} | PIN: ${s.pin} | Branch: ${s.branch.name}`);
  });
}

main().finally(() => prisma.$disconnect());
