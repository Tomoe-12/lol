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

  // ─── 4 Branches in Taunggyi (Yay Aye Kwin is Main Branch) ───────────────────
  const yayayekwin = await prisma.branch.create({
    data: {
      name: "Yay Aye Kwin Branch",
      address: "Yay Aye Kwin Main Road, Yay Aye Kwin Quarter, Taunggyi, Shan State",
      receiptHeader: "SMARTPOS - YAY AYE KWIN BRANCH (MAIN)\nThank you for shopping with us!",
      isActive: true,
    }
  });

  const zaypine = await prisma.branch.create({
    data: {
      name: "Zaypine Branch",
      address: "Bogyoke Aung San Road, Zaypine Quarter, Taunggyi, Shan State",
      receiptHeader: "SMARTPOS - ZAYPINE BRANCH\nThank you for shopping with us!",
      isActive: true,
    }
  });

  const kanthar = await prisma.branch.create({
    data: {
      name: "Kanthar Branch",
      address: "Circular Lake Road, Kanthar Quarter, Taunggyi, Shan State",
      receiptHeader: "SMARTPOS - KANTHAR BRANCH\nThank you for shopping with us!",
      isActive: true,
    }
  });

  const pyidaungsu = await prisma.branch.create({
    data: {
      name: "Pyidaungsu Branch",
      address: "Pyidaungsu Road, Pyidaungsu Quarter, Taunggyi, Shan State",
      receiptHeader: "SMARTPOS - PYIDAUNGSU BRANCH\nThank you for shopping with us!",
      isActive: true,
    }
  });

  const allBranches = [yayayekwin, zaypine, kanthar, pyidaungsu];
  console.log("✅ 4 Taunggyi Branches created (Yay Aye Kwin as Main).");

  // ─── Staff (1 Owner, 4 Managers, 4 Cashiers - 1 Mgr & 1 Cashier per branch) ─
  const owner = await prisma.staff.create({
    data: {
      clerkId: "user_owner",
      name: "Owner Han",
      email: "owner@smartpos.com",
      password: "owner123",
      pin: "9999",
      role: Role.OWNER,
      branchId: yayayekwin.id
    }
  });

  const mgrYayAyeKwin = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_yak",
      name: "Kyaw Kyaw",
      email: "manager@smartpos.com",
      password: "manager123",
      pin: "2201",
      role: Role.MANAGER,
      branchId: yayayekwin.id
    }
  });

  const mgrZaypine = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_zp",
      name: "Thida Maung",
      email: "manager2@smartpos.com",
      password: "manager123",
      pin: "2202",
      role: Role.MANAGER,
      branchId: zaypine.id
    }
  });

  const mgrKanthar = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_kt",
      name: "Myo Min Aung",
      email: "manager3@smartpos.com",
      password: "manager123",
      pin: "2203",
      role: Role.MANAGER,
      branchId: kanthar.id
    }
  });

  const mgrPyidaungsu = await prisma.staff.create({
    data: {
      clerkId: "user_mgr_pds",
      name: "Aye Aye Khin",
      email: "manager4@smartpos.com",
      password: "manager123",
      pin: "2204",
      role: Role.MANAGER,
      branchId: pyidaungsu.id
    }
  });

  const cashierYayAyeKwin = await prisma.staff.create({
    data: {
      clerkId: "user_c_yak",
      name: "Su Su",
      email: "cashier@smartpos.com",
      password: "cashier123",
      pin: "1101",
      role: Role.CASHIER,
      branchId: yayayekwin.id
    }
  });

  const cashierZaypine = await prisma.staff.create({
    data: {
      clerkId: "user_c_zp",
      name: "Aung Myo",
      email: "cashier2@smartpos.com",
      password: "cashier123",
      pin: "1201",
      role: Role.CASHIER,
      branchId: zaypine.id
    }
  });

  const cashierKanthar = await prisma.staff.create({
    data: {
      clerkId: "user_c_kt",
      name: "Ei Phyu",
      email: "cashier3@smartpos.com",
      password: "cashier123",
      pin: "1301",
      role: Role.CASHIER,
      branchId: kanthar.id
    }
  });

  const cashierPyidaungsu = await prisma.staff.create({
    data: {
      clerkId: "user_c_pds",
      name: "Win Htut",
      email: "cashier4@smartpos.com",
      password: "cashier123",
      pin: "1401",
      role: Role.CASHIER,
      branchId: pyidaungsu.id
    }
  });

  console.log("✅ 9 Staff members created (1 Owner, 4 Managers, 4 Cashiers).");

  // ─── Default Exchange Rates (4500 MMK/USD) for each Branch ─────────────────
  for (const br of allBranches) {
    await prisma.exchangeRate.create({
      data: {
        branchId: br.id,
        setByStaffId: owner.id,
        mmkPerUsd: 4500,
      }
    });
  }
  console.log("✅ Exchange rates initialized (4,500 MMK/USD) for all 4 branches.");

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
          create: [{ name: "Standard", barcode: p.barcode, costPrice: p.cost, price: p.price, lowStockThreshold: 10 }]
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
      address: "No. 12, Circular Lake Road, Kanthar Quarter, Taunggyi",
      creditLimit: 500000,
    }
  });

  const cust2 = await prisma.customer.create({
    data: {
      name: "U Kyaw Swar",
      phone: "09420000002",
      email: "kyawswar@gmail.com",
      address: "No. 45, Bogyoke Road, Zaypine Quarter, Taunggyi",
      creditLimit: 1000000,
    }
  });
  console.log("✅ 2 Customers created.");

  // ─── 2 Suppliers ─────────────────────────────────────────────────────────────
  await prisma.supplier.create({
    data: {
      name: "Taunggyi Wholesale Center",
      contact: "+959 421 000 001",
      email: "wholesale@supplier.com",
      address: "Industrial Zone, Ayetharyar, Taunggyi",
    }
  });

  await prisma.supplier.create({
    data: {
      name: "Coca-Cola Pinya Bottles (Shan State)",
      contact: "+959 421 000 002",
      email: "cocacola@supplier.com",
      address: "Main Highway Road, Ayetharyar, Taunggyi",
    }
  });
  console.log("✅ 2 Suppliers created.");

  // ─── 2 Sample Transactions ──────────────────────────────────────────────────
  const cocaVar = createdVariants.find(v => v.productName === "Coca-Cola Classic")!;
  const chipsVar = createdVariants.find(v => v.productName === "Lay's Potato Chips")!;
  const waterVar = createdVariants.find(v => v.productName === "Mineral Water 1L")!;
  const coffeeVar = createdVariants.find(v => v.productName === "Sunday Coffee")!;

  // Transaction 1: Yay Aye Kwin Main Branch (Cashier Su Su)
  const tx1Subtotal = (cocaVar.price * 3) + (chipsVar.price * 2); // 3600 + 3600 = 7200
  await prisma.transaction.create({
    data: {
      branchId: yayayekwin.id,
      staffId: cashierYayAyeKwin.id,
      subtotal: tx1Subtotal,
      discountAmount: 0,
      total: tx1Subtotal,
      currency: "MMK",
      exchangeRate: 1,
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

  // Transaction 2: Zaypine Branch (Cashier Aung Myo)
  const tx2Subtotal = (waterVar.price * 4) + (coffeeVar.price * 2); // 3200 + 5000 = 8200
  await prisma.transaction.create({
    data: {
      branchId: zaypine.id,
      staffId: cashierZaypine.id,
      subtotal: tx2Subtotal,
      discountAmount: 0,
      total: tx2Subtotal,
      currency: "MMK",
      exchangeRate: 1,
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
