// Direct seed script — run with: npx tsx prisma/seed.ts
import "dotenv/config";
import { PrismaClient, Role, StockChangeReason, PaymentMethod, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning database tables before seed...");
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
  const tables = [
    "AuditLog", "InventoryLog", "TransactionItem", "Transaction",
    "StockLevel", "ProductVariant", "Product", "Category",
    "ExchangeRate", "Expense", "PurchaseItem", "PurchaseOrder",
    "Supplier", "Staff", "Branch", "Customer", "SalesOrderItem",
    "OrderPayment", "SalesOrder"
  ];
  for (const table of tables) {
    try { await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`); } catch { /* skip */ }
  }
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
  console.log("🧹 Database cleaned successfully.");

  // ─── 4 Branches ─────────────────────────────────────────────────────────────
  const hledan   = await prisma.branch.create({ data: { name: "Hledan Branch",    address: "Hledan Road, Kamayut Township, Yangon",             receiptHeader: "SUPERMARKET - HLEDAN BRANCH\nThank you for shopping with us!" } });
  const tamwe    = await prisma.branch.create({ data: { name: "Tamwe Branch",     address: "Tamwe Road, Tamwe Township, Yangon",                receiptHeader: "CONVENIENCE STORE - TAMWE BRANCH\nThank you for shopping with us!" } });
  const sanchaung = await prisma.branch.create({ data: { name: "Sanchaung Branch", address: "Sanchaung Street, Sanchaung Township, Yangon",      receiptHeader: "SUPERMARKET - SANCHAUNG BRANCH\nThank you for shopping with us!" } });
  const mandalay = await prisma.branch.create({ data: { name: "Mandalay Branch",  address: "83rd Street, Chan Aye Thar Zan Township, Mandalay", receiptHeader: "HYPERMARKET - MANDALAY BRANCH\nThank you for shopping with us!" } });
  const allBranches = [hledan, tamwe, sanchaung, mandalay];
  console.log("✅ 4 Branches created.");

  // ─── Staff (1 Owner, 4 Managers, 4 Cashiers - 1 Mgr & 1 Cashier per branch) ─
  const owner = await prisma.staff.create({
    data: {
      clerkId: "user_owner",
      name: "Owner Han",
      email: "owner@smartos.com",
      password: "owner123",
      pin: "9999",
      role: Role.OWNER,
      branchId: hledan.id
    }
  });

  const mgrHledan = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_hl",
      name: "Kyaw Kyaw",
      email: "manager@smartos.com",
      password: "manager123",
      pin: "2201",
      role: Role.MANAGER,
      branchId: hledan.id
    }
  });
  const mgrTamwe = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_tw",
      name: "Thida Maung",
      email: "manager2@smartos.com",
      password: "manager123",
      pin: "2202",
      role: Role.MANAGER,
      branchId: tamwe.id
    }
  });
  const mgrSanchaung = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_sch",
      name: "Myo Min Aung",
      email: "manager3@smartos.com",
      password: "manager123",
      pin: "2203",
      role: Role.MANAGER,
      branchId: sanchaung.id
    }
  });
  const mgrMandalay = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_mdl",
      name: "Aye Aye Khin",
      email: "manager4@smartos.com",
      password: "manager123",
      pin: "2204",
      role: Role.MANAGER,
      branchId: mandalay.id
    }
  });

  const cashierHledan = await prisma.staff.create({
    data: {
      clerkId: "user_c_hl",
      name: "Su Su",
      email: "cashier@smartos.com",
      password: "cashier123",
      pin: "1101",
      role: Role.CASHIER,
      branchId: hledan.id
    }
  });
  const cashierTamwe = await prisma.staff.create({
    data: {
      clerkId: "user_c_tw",
      name: "Aung Myo",
      email: "cashier2@smartos.com",
      password: "cashier123",
      pin: "1201",
      role: Role.CASHIER,
      branchId: tamwe.id
    }
  });
  const cashierSanchaung = await prisma.staff.create({
    data: {
      clerkId: "user_c_sch",
      name: "Ei Phyu",
      email: "cashier3@smartos.com",
      password: "cashier123",
      pin: "1301",
      role: Role.CASHIER,
      branchId: sanchaung.id
    }
  });
  const cashierMandalay = await prisma.staff.create({
    data: {
      clerkId: "user_c_mdl",
      name: "Win Htut",
      email: "cashier4@smartos.com",
      password: "cashier123",
      pin: "1401",
      role: Role.CASHIER,
      branchId: mandalay.id
    }
  });

  console.log("✅ 9 Staff members created (1 Owner, 4 Managers, 4 Cashiers).");

  // ─── Exchange Rates ─────────────────────────────────────────────────────────
  for (const br of allBranches) {
    await prisma.exchangeRate.create({
      data: { mmkPerUsd: 4500, setByStaffId: owner.id, branchId: br.id }
    });
  }

  // ─── Categories ─────────────────────────────────────────────────────────────
  const catNames = ["Beverages", "Alcohol & Spirits", "Snacks & Biscuits", "Personal Care", "Instant Noodles", "Rice & Staples"];
  const cat: Record<string, string> = {};
  for (const name of catNames) {
    const c = await prisma.category.create({ data: { name } });
    cat[name] = c.id;
  }

  // ─── 15 Products (No Extra Variants - 1 default variant per product) ────────
  const productsToCreate = [
    { name: "Coca-Cola Classic",    cat: "Beverages",         price: 1200,  img: "/uploads/products/coca_cola.jpg",            barcode: "8801007000001", cost: 720 },
    { name: "Mineral Water 1L",     cat: "Beverages",         price: 800,   img: "/uploads/products/mineral_water.jpg",         barcode: "8801007000002", cost: 450 },
    { name: "Sunday Coffee",        cat: "Beverages",         price: 2500,  img: "/uploads/products/sunday_coffee.jpg",         barcode: "8801007000003", cost: 1500 },
    { name: "Red Wine",             cat: "Alcohol & Spirits", price: 18000, img: "/uploads/products/red_wine.jpg",              barcode: "8801007000004", cost: 11000 },
    { name: "Whisky",               cat: "Alcohol & Spirits", price: 35000, img: "/uploads/products/whisky.jpg",                barcode: "8801007000005", cost: 22000 },
    { name: "Lay's Potato Chips",   cat: "Snacks & Biscuits", price: 1800,  img: "/uploads/products/potato_chips.jpg",          barcode: "8801007000006", cost: 1080 },
    { name: "Chocolate Biscuits",   cat: "Snacks & Biscuits", price: 2200,  img: "/uploads/products/chocolate_biscuits.jpg",    barcode: "8801007000007", cost: 1320 },
    { name: "Danish Cookies",       cat: "Snacks & Biscuits", price: 3500,  img: "/uploads/products/danish_cookies.jpg",        barcode: "8801007000008", cost: 2100 },
    { name: "Cashew Nuts",          cat: "Snacks & Biscuits", price: 5500,  img: "/uploads/products/cashew_nuts.jpg",           barcode: "8801007000009", cost: 3300 },
    { name: "Wafer Roll",           cat: "Snacks & Biscuits", price: 1200,  img: "/uploads/products/wafer_roll.jpg",            barcode: "8801007000010", cost: 720 },
    { name: "Shampoo",              cat: "Personal Care",     price: 4800,  img: "/uploads/products/shampoo.jpg",               barcode: "8801007000011", cost: 2880 },
    { name: "Soap",                 cat: "Personal Care",     price: 1500,  img: "/uploads/products/soap.jpg",                  barcode: "8801007000012", cost: 900 },
    { name: "Toothpaste",           cat: "Personal Care",     price: 2800,  img: "/uploads/products/toothpaste.jpg",            barcode: "8801007000013", cost: 1680 },
    { name: "Mama Instant Noodles", cat: "Instant Noodles",   price: 900,   img: "https://picsum.photos/seed/noodles/400/400",  barcode: "8801007000014", cost: 540 },
    { name: "Jasmine Rice 5kg",     cat: "Rice & Staples",    price: 18500, img: "https://picsum.photos/seed/rice/400/400",     barcode: "8801007000015", cost: 13000 },
  ];

  const createdVariants: { id: string; productId: string; productName: string; price: number; cost: number }[] = [];
  for (const p of productsToCreate) {
    const prod = await prisma.product.create({
      data: {
        name: p.name,
        price: p.price,
        imageUrl: p.img,
        categoryId: cat[p.cat],
        variants: {
          create: [{ name: "Standard", barcode: p.barcode, costPrice: p.cost }]
        },
      },
      include: { variants: true },
    });
    createdVariants.push({
      id: prod.variants[0].id,
      productId: prod.id,
      productName: prod.name,
      price: prod.price,
      cost: p.cost,
    });
  }
  console.log(`✅ ${createdVariants.length} Products created (no extra variants).`);

  // ─── Stock Levels & Inventory Logs for All 4 Branches ──────────────────────
  const stockData: { branchId: string; variantId: string; quantity: number }[] = [];
  const logData: { branchId: string; variantId: string; change: number; reason: StockChangeReason; note: string }[] = [];

  for (const br of allBranches) {
    for (const v of createdVariants) {
      stockData.push({ branchId: br.id, variantId: v.id, quantity: 100 });
      logData.push({ branchId: br.id, variantId: v.id, change: 100, reason: StockChangeReason.ADJUSTMENT, note: "Initial stock setup" });
    }
  }
  await prisma.stockLevel.createMany({ data: stockData });
  await prisma.inventoryLog.createMany({ data: logData });
  console.log("✅ Stock levels populated for all 15 products across all 4 branches.");

  // ─── 2 Customers ─────────────────────────────────────────────────────────────
  const cust1 = await prisma.customer.create({
    data: {
      name: "Daw Aye Aye",
      phone: "09420000001",
      email: "ayeaye@gmail.com",
      address: "No. 12, Pyay Road, Kamayut Township, Yangon",
      creditLimit: 500000,
    }
  });

  const cust2 = await prisma.customer.create({
    data: {
      name: "U Kyaw Swar",
      phone: "09420000002",
      email: "kyawswar@gmail.com",
      address: "No. 45, Hledan Street, Kamayut Township, Yangon",
      creditLimit: 1000000,
    }
  });
  console.log("✅ 2 Customers created.");

  // ─── 2 Suppliers ─────────────────────────────────────────────────────────────
  await prisma.supplier.create({
    data: {
      name: "City Mart Wholesale",
      contact: "+959 421 000 001",
      email: "citymart@supplier.com",
      address: "Industrial Zone, Hlaing Tharyar, Yangon",
    }
  });

  await prisma.supplier.create({
    data: {
      name: "Coca-Cola Pinya Bottles",
      contact: "+959 421 000 002",
      email: "cocacola@supplier.com",
      address: "Mingaladon Township, Yangon",
    }
  });
  console.log("✅ 2 Suppliers created.");

  // ─── 2 All Transactions ─────────────────────────────────────────────────────
  const cocaVar = createdVariants.find(v => v.productName === "Coca-Cola Classic")!;
  const chipsVar = createdVariants.find(v => v.productName === "Lay's Potato Chips")!;
  const waterVar = createdVariants.find(v => v.productName === "Mineral Water 1L")!;
  const coffeeVar = createdVariants.find(v => v.productName === "Sunday Coffee")!;

  // Transaction 1: Hledan Branch (Cashier Su Su)
  const tx1Subtotal = (cocaVar.price * 3) + (chipsVar.price * 2); // 3600 + 3600 = 7200
  await prisma.transaction.create({
    data: {
      branchId: hledan.id,
      staffId: cashierHledan.id,
      subtotal: tx1Subtotal,
      discountAmount: 0,
      total: tx1Subtotal,
      currency: "MMK",
      exchangeRate: 4500,
      totalInMMK: tx1Subtotal,
      paymentMethod: PaymentMethod.CASH,
      cashReceived: 10000,
      changeGiven: 2800,
      status: TransactionStatus.COMPLETED,
      note: "POS Checkout Voucher #1",
      items: {
        create: [
          { productId: cocaVar.productId, variantId: cocaVar.id, quantity: 3, unitPrice: cocaVar.price, unitCost: cocaVar.cost, discount: 0, total: cocaVar.price * 3 },
          { productId: chipsVar.productId, variantId: chipsVar.id, quantity: 2, unitPrice: chipsVar.price, unitCost: chipsVar.cost, discount: 0, total: chipsVar.price * 2 },
        ]
      }
    }
  });

  // Transaction 2: Tamwe Branch (Cashier Aung Myo)
  const tx2Subtotal = (waterVar.price * 4) + (coffeeVar.price * 2); // 3200 + 5000 = 8200
  await prisma.transaction.create({
    data: {
      branchId: tamwe.id,
      staffId: cashierTamwe.id,
      subtotal: tx2Subtotal,
      discountAmount: 0,
      total: tx2Subtotal,
      currency: "MMK",
      exchangeRate: 4500,
      totalInMMK: tx2Subtotal,
      paymentMethod: PaymentMethod.CARD,
      cashReceived: null,
      changeGiven: null,
      status: TransactionStatus.COMPLETED,
      note: "POS Checkout Voucher #2",
      items: {
        create: [
          { productId: waterVar.productId, variantId: waterVar.id, quantity: 4, unitPrice: waterVar.price, unitCost: waterVar.cost, discount: 0, total: waterVar.price * 4 },
          { productId: coffeeVar.productId, variantId: coffeeVar.id, quantity: 2, unitPrice: coffeeVar.price, unitCost: coffeeVar.cost, discount: 0, total: coffeeVar.price * 2 },
        ]
      }
    }
  });

  console.log("✅ 2 Transactions created.");

  console.log(`
🎉 Seed Complete!
  - Branches:     ${allBranches.length}
  - Staff:        9 (1 Owner, 4 Managers, 4 Cashiers)
  - Products:     ${createdVariants.length} (no extra variants)
  - Customers:    2
  - Suppliers:    2
  - Transactions: 2
`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
