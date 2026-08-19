import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding Manager and Cashier staff for each branch...");

  const branches = await prisma.branch.findMany();
  console.log(`Found ${branches.length} branches.`);

  for (const b of branches) {
    const branchNameClean = b.name.split("/")[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Manager Account
    const mgrEmail = `manager.${branchNameClean}@smartpos.com`;
    const mgrName = `${b.name.split("/")[0].trim()} Manager`;
    await prisma.staff.upsert({
      where: { email: mgrEmail },
      update: {
        branchId: b.id,
        role: "MANAGER",
        pin: "1111",
        permissions: {
          dashboard: { read: true, write: true },
          pos: { read: true, write: true },
          inventory: { read: true, write: true },
          salesOrders: { read: true, write: true },
          purchases: { read: true, write: true },
          expenses: { read: true, write: true },
          staff: { read: true, write: true },
          reports: { read: true, write: true },
          setup: { read: true, write: true },
        }
      },
      create: {
        id: `staff_${branchNameClean}_mgr`,
        clerkId: `clerk_${branchNameClean}_mgr`,
        name: mgrName,
        email: mgrEmail,
        password: "123456",
        pin: "1111",
        role: "MANAGER",
        branchId: b.id,
        permissions: {
          dashboard: { read: true, write: true },
          pos: { read: true, write: true },
          inventory: { read: true, write: true },
          salesOrders: { read: true, write: true },
          purchases: { read: true, write: true },
          expenses: { read: true, write: true },
          staff: { read: true, write: true },
          reports: { read: true, write: true },
          setup: { read: true, write: true },
        }
      }
    });

    // 2. Cashier Account
    const cshEmail = `cashier.${branchNameClean}@smartpos.com`;
    const cshName = `${b.name.split("/")[0].trim()} Cashier`;
    await prisma.staff.upsert({
      where: { email: cshEmail },
      update: {
        branchId: b.id,
        role: "CASHIER",
        pin: "1001",
        permissions: {
          dashboard: { read: true, write: false },
          pos: { read: true, write: true },
          inventory: { read: true, write: false },
          salesOrders: { read: true, write: true },
          purchases: { read: false, write: false },
          expenses: { read: false, write: false },
          staff: { read: false, write: false },
          reports: { read: false, write: false },
          setup: { read: false, write: false },
        }
      },
      create: {
        id: `staff_${branchNameClean}_csh`,
        clerkId: `clerk_${branchNameClean}_csh`,
        name: cshName,
        email: cshEmail,
        password: "123456",
        pin: "1001",
        role: "CASHIER",
        branchId: b.id,
        permissions: {
          dashboard: { read: true, write: false },
          pos: { read: true, write: true },
          inventory: { read: true, write: false },
          salesOrders: { read: true, write: true },
          purchases: { read: false, write: false },
          expenses: { read: false, write: false },
          staff: { read: false, write: false },
          reports: { read: false, write: false },
          setup: { read: false, write: false },
        }
      }
    });

    console.log(`Created Manager (${mgrEmail}) & Cashier (${cshEmail}) for branch: ${b.name}`);
  }
}

main()
  .then(() => console.log("Branch staff seeding complete!"))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
