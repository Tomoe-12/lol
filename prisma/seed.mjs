import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting local database seed...");

  // Clear existing records
  await prisma.auditLog.deleteMany();
  await prisma.shiftLog.deleteMany();
  await prisma.shiftSchedule.deleteMany();
  await prisma.exchangeRate.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.productAddon.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.branch.deleteMany();

  // 1. Create Branches
  const mainBranch = await prisma.branch.create({
    data: {
      name: "Main Branch (Yangon)",
      address: "No. 123, Pyay Road, Latha Tsp, Yangon",
      receiptHeader: "BuyShopOS - Main Branch\nThank you for shopping with us!",
    },
  });

  const sanchaungBranch = await prisma.branch.create({
    data: {
      name: "Sanchaung Branch",
      address: "No. 45, Baho Road, Sanchaung Tsp, Yangon",
      receiptHeader: "BuyShopOS - Sanchaung\nHave a great day!",
    },
  });

  const mandalayBranch = await prisma.branch.create({
    data: {
      name: "Mandalay Branch",
      address: "Corner of 78th & 30th St, Chanayethazan Tsp, Mandalay",
      receiptHeader: "BuyShopOS - Mandalay\nWelcome back!",
    },
  });

  console.log("✅ Created 3 Branches");

  // 2. Create Staff Accounts
  const owner = await prisma.staff.create({
    data: {
      name: "System Owner",
      email: "owner@buyshopos.com",
      password: "owner123",
      pin: "1111",
      role: "OWNER",
      branchId: mainBranch.id,
    },
  });

  const manager = await prisma.staff.create({
    data: {
      name: "Sanchaung Manager",
      email: "manager@buyshopos.com",
      password: "manager123",
      pin: "2222",
      role: "MANAGER",
      branchId: sanchaungBranch.id,
    },
  });

  const cashier = await prisma.staff.create({
    data: {
      name: "Yangon Cashier",
      email: "cashier@buyshopos.com",
      password: "cashier123",
      pin: "3333",
      role: "CASHIER",
      branchId: mainBranch.id,
    },
  });

  const extraCashier = await prisma.staff.create({
    data: {
      name: "Ma ma Thi",
      email: "geminikhun@gmail.com",
      password: "123456",
      pin: "4444",
      role: "CASHIER",
      branchId: sanchaungBranch.id,
    },
  });

  console.log("✅ Created Staff Accounts (Owner, Manager, Cashiers)");

  // 3. Create Categories
  const catCoffee = await prisma.category.create({ data: { name: "Coffee & Espresso" } });
  const catTea = await prisma.category.create({ data: { name: "Tea & Cold Drinks" } });
  const catBakery = await prisma.category.create({ data: { name: "Bakery & Pastries" } });
  const catBeans = await prisma.category.create({ data: { name: "Coffee Beans & Merch" } });

  console.log("✅ Created Categories");

  // 4. Create Products with Variants, Addons, Stock
  const americano = await prisma.product.create({
    data: {
      name: "Iced Americano",
      barcode: "100101",
      costPrice: 1500,
      categoryId: catCoffee.id,
      variants: {
        create: [
          { name: "Regular (12oz)", price: 3500 },
          { name: "Large (16oz)", price: 4200 },
        ],
      },
      addons: {
        create: [
          { name: "Extra Espresso Shot", price: 1000 },
          { name: "Vanilla Syrup", price: 800 },
        ],
      },
    },
  });

  const latte = await prisma.product.create({
    data: {
      name: "Caffè Latte",
      barcode: "100102",
      costPrice: 1800,
      categoryId: catCoffee.id,
      variants: {
        create: [
          { name: "Hot (12oz)", price: 4000 },
          { name: "Iced (16oz)", price: 4800 },
        ],
      },
      addons: {
        create: [
          { name: "Oat Milk Substitute", price: 1200 },
          { name: "Hazelnut Syrup", price: 800 },
        ],
      },
    },
  });

  const matcha = await prisma.product.create({
    data: {
      name: "Kyoto Matcha Latte",
      barcode: "100201",
      costPrice: 2200,
      categoryId: catTea.id,
      variants: {
        create: [
          { name: "Regular", price: 5200 },
          { name: "Large", price: 6000 },
        ],
      },
      addons: {
        create: [{ name: "Sweet Cream Foam", price: 1000 }],
      },
    },
  });

  const croissant = await prisma.product.create({
    data: {
      name: "Butter Croissant",
      barcode: "100301",
      costPrice: 1200,
      categoryId: catBakery.id,
      variants: {
        create: [{ name: "Standard", price: 3000 }],
      },
    },
  });

  const beansBag = await prisma.product.create({
    data: {
      name: "House Blend Roast 250g",
      barcode: "100401",
      costPrice: 12000,
      categoryId: catBeans.id,
      variants: {
        create: [{ name: "Whole Bean", price: 25000 }],
      },
    },
  });

  console.log("✅ Created Products with Variants & Addons");

  // 5. Seed Stock Levels for each branch
  const allBranches = [mainBranch, sanchaungBranch, mandalayBranch];
  const allProducts = [americano, latte, matcha, croissant, beansBag];

  for (const b of allBranches) {
    for (const p of allProducts) {
      await prisma.stockLevel.create({
        data: {
          branchId: b.id,
          productId: p.id,
          quantity: Math.floor(Math.random() * 50) + 20,
          lowStockThreshold: 10,
        },
      });
    }
  }

  console.log("✅ Seeded Stock Levels for all Branches");

  // 6. Seed Initial Expenses
  await prisma.expense.createMany({
    data: [
      { branchId: mainBranch.id, category: "RENT", amount: 1500000, currency: "MMK", note: "Monthly Shop Rent" },
      { branchId: mainBranch.id, category: "ELECTRICITY", amount: 350000, currency: "MMK", note: "Power Bill" },
      { branchId: sanchaungBranch.id, category: "RENT", amount: 1200000, currency: "MMK", note: "Sanchaung Rent" },
    ],
  });

  console.log("🎉 Local Database Seed Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
