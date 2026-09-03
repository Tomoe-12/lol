// Direct seed script � run with: npx tsx prisma/seed.ts
import "dotenv/config";
import { PrismaClient, Role, StockChangeReason, PaymentMethod, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("?? Cleaning database tables before seed...");
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
  console.log("?? Database cleaned successfully.");

  const SEED_DATE = new Date("2026-08-12T10:00:00.000Z");

  const yayayekwin = await prisma.branch.create({ data: { name: "Yay Aye Kwin Branch", address: "Yay Aye Kwin Main Road, Yay Aye Kwin Quarter, Taunggyi, Shan State", receiptHeader: "SMARTPOS - YAY AYE KWIN BRANCH (MAIN)\nThank you for shopping with us!", isActive: true } });
  const zaypine    = await prisma.branch.create({ data: { name: "Zaypine Branch",    address: "Bogyoke Aung San Road, Zaypine Quarter, Taunggyi, Shan State",    receiptHeader: "SMARTPOS - ZAYPINE BRANCH\nThank you for shopping with us!",    isActive: true } });
  const kanthar    = await prisma.branch.create({ data: { name: "Kanthar Branch",    address: "Circular Lake Road, Kanthar Quarter, Taunggyi, Shan State",        receiptHeader: "SMARTPOS - KANTHAR BRANCH\nThank you for shopping with us!",    isActive: true } });
  const pyidaungsu = await prisma.branch.create({ data: { name: "Pyidaungsu Branch", address: "Pyidaungsu Road, Pyidaungsu Quarter, Taunggyi, Shan State",        receiptHeader: "SMARTPOS - PYIDAUNGSU BRANCH\nThank you for shopping with us!", isActive: true } });
  const allBranches = [yayayekwin, zaypine, kanthar, pyidaungsu];
  console.log("? 4 Taunggyi Branches created.");

  const owner            = await prisma.staff.create({ data: { clerkId: "user_owner",   name: "Owner Han",    email: "owner@smartpos.com",    password: "owner123",   pin: "9999", role: Role.OWNER,   branchId: yayayekwin.id } });
  await prisma.staff.create({ data: { clerkId: "user_mgr_yak", name: "Kyaw Kyaw",    email: "manager@smartpos.com",  password: "manager123", pin: "2201", role: Role.MANAGER, branchId: yayayekwin.id } });
  const mgrZaypine    = await prisma.staff.create({ data: { clerkId: "user_mgr_zp",  name: "Thida Maung",  email: "manager2@smartpos.com", password: "manager123", pin: "2202", role: Role.MANAGER, branchId: zaypine.id } });
  const mgrKanthar    = await prisma.staff.create({ data: { clerkId: "user_mgr_kt",  name: "Myo Min Aung", email: "manager3@smartpos.com", password: "manager123", pin: "2203", role: Role.MANAGER, branchId: kanthar.id } });
  const mgrPyidaungsu = await prisma.staff.create({ data: { clerkId: "user_mgr_pds", name: "Aye Aye Khin", email: "manager4@smartpos.com", password: "manager123", pin: "2204", role: Role.MANAGER, branchId: pyidaungsu.id } });
  const cashierYAK    = await prisma.staff.create({ data: { clerkId: "user_c_yak",   name: "Su Su",        email: "cashier@smartpos.com",  password: "cashier123", pin: "1101", role: Role.CASHIER, branchId: yayayekwin.id } });
  const cashierZP     = await prisma.staff.create({ data: { clerkId: "user_c_zp",    name: "Aung Myo",     email: "cashier2@smartpos.com", password: "cashier123", pin: "1201", role: Role.CASHIER, branchId: zaypine.id } });
  await prisma.staff.create({ data: { clerkId: "user_c_kt",  name: "Ei Phyu",      email: "cashier3@smartpos.com", password: "cashier123", pin: "1301", role: Role.CASHIER, branchId: kanthar.id } });
  await prisma.staff.create({ data: { clerkId: "user_c_pds", name: "Win Htut",      email: "cashier4@smartpos.com", password: "cashier123", pin: "1401", role: Role.CASHIER, branchId: pyidaungsu.id } });
  console.log("? 9 Staff members created.");

  for (const br of allBranches) {
    await prisma.exchangeRate.create({ data: { branchId: br.id, setByStaffId: owner.id, mmkPerUsd: 4500, createdAt: SEED_DATE } });
  }
  console.log("? Exchange rates initialized.");

  const catNames = ["Beverages", "Alcohol & Spirits", "Snacks & Biscuits", "Personal Care", "Instant Noodles", "Rice & Staples"];
  const cat: Record<string, string> = {};
  for (const name of catNames) { const c = await prisma.category.create({ data: { name } }); cat[name] = c.id; }

  const productsToCreate = [
    { name: "Coca-Cola Classic",    cat: "Beverages",         price: 1200,  img: "/uploads/products/coca_cola.jpg",          barcode: "8801007000001", cost: 720,   sup: "coke"      },
    { name: "Mineral Water 1L",     cat: "Beverages",         price: 800,   img: "/uploads/products/mineral_water.jpg",      barcode: "8801007000002", cost: 450,   sup: "coke"      },
    { name: "Sunday Coffee",        cat: "Beverages",         price: 2500,  img: "/uploads/products/sunday_coffee.jpg",      barcode: "8801007000003", cost: 1500,  sup: "wholesale" },
    { name: "Red Wine",             cat: "Alcohol & Spirits", price: 18000, img: "/uploads/products/red_wine.jpg",           barcode: "8801007000004", cost: 11000, sup: "wholesale" },
    { name: "Whisky",               cat: "Alcohol & Spirits", price: 35000, img: "/uploads/products/whisky.jpg",             barcode: "8801007000005", cost: 22000, sup: "wholesale" },
    { name: "Lay's Potato Chips",   cat: "Snacks & Biscuits", price: 1800,  img: "/uploads/products/potato_chips.jpg",      barcode: "8801007000006", cost: 1080,  sup: "wholesale" },
    { name: "Chocolate Biscuits",   cat: "Snacks & Biscuits", price: 2200,  img: "/uploads/products/chocolate_biscuits.jpg",barcode: "8801007000007", cost: 1320,  sup: "wholesale" },
    { name: "Danish Cookies",       cat: "Snacks & Biscuits", price: 3500,  img: "/uploads/products/danish_cookies.jpg",    barcode: "8801007000008", cost: 2100,  sup: "wholesale" },
    { name: "Cashew Nuts",          cat: "Snacks & Biscuits", price: 5500,  img: "/uploads/products/cashew_nuts.jpg",       barcode: "8801007000009", cost: 3300,  sup: "wholesale" },
    { name: "Wafer Roll",           cat: "Snacks & Biscuits", price: 1200,  img: "/uploads/products/wafer_roll.jpg",        barcode: "8801007000010", cost: 720,   sup: "wholesale" },
    { name: "Shampoo",              cat: "Personal Care",     price: 4800,  img: "/uploads/products/shampoo.jpg",           barcode: "8801007000011", cost: 2880,  sup: "wholesale" },
    { name: "Soap",                 cat: "Personal Care",     price: 1500,  img: "/uploads/products/soap.jpg",              barcode: "8801007000012", cost: 900,   sup: "wholesale" },
    { name: "Toothpaste",           cat: "Personal Care",     price: 2800,  img: "/uploads/products/toothpaste.jpg",        barcode: "8801007000013", cost: 1680,  sup: "wholesale" },
    { name: "Mama Instant Noodles", cat: "Instant Noodles",   price: 900,   img: "/uploads/products/instant_noodles.jpg",  barcode: "8801007000014", cost: 540,   sup: "wholesale" },
    { name: "Jasmine Rice 5kg",     cat: "Rice & Staples",    price: 18500, img: "/uploads/products/jasmine_rice.jpg",      barcode: "8801007000015", cost: 13000, sup: "wholesale" },
  ];

  const createdVariants: { id: string; productId: string; productName: string; price: number; cost: number; sup: string }[] = [];
  for (const p of productsToCreate) {
    const prod = await prisma.product.create({
      data: {
        name: p.name,
        price: p.price,
        costPrice: p.cost,
        imageUrl: p.img,
        categoryId: cat[p.cat],
        variants: { create: [{ name: "Standard", barcode: p.barcode, costPrice: p.cost, price: p.price, lowStockThreshold: 10 }] },
      },
      include: { variants: true },
    });
    createdVariants.push({ id: prod.variants[0].id, productId: prod.id, productName: prod.name, price: prod.price, cost: p.cost, sup: p.sup });
  }
  console.log("? 15 Products created (costPrice on Product + Variant, local image URLs fixed).");

  await prisma.customer.create({ data: { name: "Daw Aye Aye",  phone: "09420000001", phones: ["09420000001"], email: "ayeaye@gmail.com",   address: "No. 12, Circular Lake Road, Kanthar Quarter, Taunggyi", creditLimit: 500000  } });
  await prisma.customer.create({ data: { name: "U Kyaw Swar",  phone: "09420000002", phones: ["09420000002"], email: "kyawswar@gmail.com", address: "No. 45, Bogyoke Road, Zaypine Quarter, Taunggyi",        creditLimit: 1000000 } });
  console.log("? 2 Customers created.");

  const supplierWholesale = await prisma.supplier.create({ data: { name: "Taunggyi Wholesale Center",         contact: "+959 421 000 001", email: "wholesale@supplier.com", address: "Industrial Zone, Ayetharyar, Taunggyi"     } });
  const supplierCoke      = await prisma.supplier.create({ data: { name: "Coca-Cola Pinya Bottles (Shan State)", contact: "+959 421 000 002", email: "cocacola@supplier.com",  address: "Main Highway Road, Ayetharyar, Taunggyi" } });
  console.log("? 2 Suppliers created.");

  const wholesaleVars = createdVariants.filter(v => v.sup === "wholesale");
  const cokeVars      = createdVariants.filter(v => v.sup === "coke");
  const branchReceiverMap: Record<string, string> = { [yayayekwin.id]: owner.id, [zaypine.id]: mgrZaypine.id, [kanthar.id]: mgrKanthar.id, [pyidaungsu.id]: mgrPyidaungsu.id };

  for (const br of allBranches) {
    const receivedById = branchReceiverMap[br.id];

    const wholesaleTotalCost = wholesaleVars.reduce((s, v) => s + v.cost * 100, 0);
    const po1 = await prisma.purchaseOrder.create({
      data: {
        supplierId: supplierWholesale.id, branchId: br.id, createdById: owner.id, receivedById,
        status: "RECEIVED", totalCost: wholesaleTotalCost, paymentStatus: "PAID",
        amountPaid: wholesaleTotalCost, cashFlowAmount: wholesaleTotalCost, refundAmount: 0,
        cashFlowDate: SEED_DATE, arrivalDate: SEED_DATE, voucherDate: SEED_DATE,
        voucherNumber: `VCH-TW-${br.name.substring(0, 3).toUpperCase()}-01`,
        note: "Initial stock purchase � Taunggyi Wholesale Center", createdAt: SEED_DATE,
        items: { create: wholesaleVars.map(v => ({ variantId: v.id, quantity: 100, unitCost: v.cost, sellingPrice: v.price, total: v.cost * 100 })) }
      }
    });

    const cokeTotalCost = cokeVars.reduce((s, v) => s + v.cost * 100, 0);
    const po2 = await prisma.purchaseOrder.create({
      data: {
        supplierId: supplierCoke.id, branchId: br.id, createdById: owner.id, receivedById,
        status: "RECEIVED", totalCost: cokeTotalCost, paymentStatus: "PAID",
        amountPaid: cokeTotalCost, cashFlowAmount: cokeTotalCost, refundAmount: 0,
        cashFlowDate: SEED_DATE, arrivalDate: SEED_DATE, voucherDate: SEED_DATE,
        voucherNumber: `VCH-CC-${br.name.substring(0, 3).toUpperCase()}-01`,
        note: "Initial stock purchase � Coca-Cola Pinya Bottles", createdAt: SEED_DATE,
        items: { create: cokeVars.map(v => ({ variantId: v.id, quantity: 100, unitCost: v.cost, sellingPrice: v.price, total: v.cost * 100 })) }
      }
    });

    for (const v of createdVariants) {
      await prisma.stockLevel.create({ data: { branchId: br.id, variantId: v.id, quantity: 100 } });
      await prisma.inventoryLog.create({
        data: {
          branchId: br.id, variantId: v.id, change: 100,
          reason: StockChangeReason.PURCHASE_RECEIVED,
          note: "Initial stock from purchase order",
          performedByStaffId: owner.id,
          purchaseOrderId: v.sup === "wholesale" ? po1.id : po2.id,
          createdAt: SEED_DATE,
        }
      });
    }
    console.log(`  ? ${br.name}: 2 POs + 15 stock levels + 15 PURCHASE_RECEIVED logs.`);
  }
  console.log("? 8 Purchase Orders created (4 branches � 2 suppliers, Aug 12 2026, RECEIVED+PAID).");

  const cocaVar   = createdVariants.find(v => v.productName === "Coca-Cola Classic")!;
  const chipsVar  = createdVariants.find(v => v.productName === "Lay's Potato Chips")!;
  const waterVar  = createdVariants.find(v => v.productName === "Mineral Water 1L")!;
  const coffeeVar = createdVariants.find(v => v.productName === "Sunday Coffee")!;

  const tx1Total = cocaVar.price * 3 + chipsVar.price * 2;
  const tx1 = await prisma.transaction.create({
    data: {
      branchId: yayayekwin.id, staffId: cashierYAK.id,
      subtotal: tx1Total, discountAmount: 0, total: tx1Total,
      currency: "MMK", exchangeRate: 1, totalInMMK: tx1Total,
      paymentMethod: PaymentMethod.CASH, cashReceived: 10000, changeGiven: 10000 - tx1Total,
      status: TransactionStatus.COMPLETED, note: "POS Checkout Voucher #1", createdAt: SEED_DATE,
      items: { create: [
        { productId: cocaVar.productId,  variantId: cocaVar.id,  quantity: 3, unitPrice: cocaVar.price,  unitCost: cocaVar.cost,  discount: 0, total: cocaVar.price  * 3 },
        { productId: chipsVar.productId, variantId: chipsVar.id, quantity: 2, unitPrice: chipsVar.price, unitCost: chipsVar.cost, discount: 0, total: chipsVar.price * 2 },
      ]}
    }
  });
  await prisma.stockLevel.update({ where: { branchId_variantId: { branchId: yayayekwin.id, variantId: cocaVar.id  } }, data: { quantity: { decrement: 3 } } });
  await prisma.stockLevel.update({ where: { branchId_variantId: { branchId: yayayekwin.id, variantId: chipsVar.id } }, data: { quantity: { decrement: 2 } } });
  await prisma.inventoryLog.createMany({ data: [
    { branchId: yayayekwin.id, variantId: cocaVar.id,  change: -3, reason: StockChangeReason.SALE, note: "POS sale", performedByStaffId: cashierYAK.id, transactionId: tx1.id, createdAt: SEED_DATE },
    { branchId: yayayekwin.id, variantId: chipsVar.id, change: -2, reason: StockChangeReason.SALE, note: "POS sale", performedByStaffId: cashierYAK.id, transactionId: tx1.id, createdAt: SEED_DATE },
  ]});

  const tx2Total = waterVar.price * 4 + coffeeVar.price * 2;
  const tx2 = await prisma.transaction.create({
    data: {
      branchId: zaypine.id, staffId: cashierZP.id,
      subtotal: tx2Total, discountAmount: 0, total: tx2Total,
      currency: "MMK", exchangeRate: 1, totalInMMK: tx2Total,
      paymentMethod: PaymentMethod.CARD, cashReceived: null, changeGiven: null,
      status: TransactionStatus.COMPLETED, note: "POS Checkout Voucher #2", createdAt: SEED_DATE,
      items: { create: [
        { productId: waterVar.productId,  variantId: waterVar.id,  quantity: 4, unitPrice: waterVar.price,  unitCost: waterVar.cost,  discount: 0, total: waterVar.price  * 4 },
        { productId: coffeeVar.productId, variantId: coffeeVar.id, quantity: 2, unitPrice: coffeeVar.price, unitCost: coffeeVar.cost, discount: 0, total: coffeeVar.price * 2 },
      ]}
    }
  });
  await prisma.stockLevel.update({ where: { branchId_variantId: { branchId: zaypine.id, variantId: waterVar.id  } }, data: { quantity: { decrement: 4 } } });
  await prisma.stockLevel.update({ where: { branchId_variantId: { branchId: zaypine.id, variantId: coffeeVar.id } }, data: { quantity: { decrement: 2 } } });
  await prisma.inventoryLog.createMany({ data: [
    { branchId: zaypine.id, variantId: waterVar.id,  change: -4, reason: StockChangeReason.SALE, note: "POS sale", performedByStaffId: cashierZP.id, transactionId: tx2.id, createdAt: SEED_DATE },
    { branchId: zaypine.id, variantId: coffeeVar.id, change: -2, reason: StockChangeReason.SALE, note: "POS sale", performedByStaffId: cashierZP.id, transactionId: tx2.id, createdAt: SEED_DATE },
  ]});

  console.log("? 2 Transactions created (Aug 12 2026) + stock decrements + SALE inventory logs.");
  console.log(`
?? Seed Complete! (Reference date: Aug 12, 2026)
  Branches:          4
  Staff:             9 (1 Owner � 4 Managers � 4 Cashiers)
  Products:          15 (costPrice fixed � local images fixed)
  Customers:         2
  Suppliers:         2
  Purchase Orders:   8 (4 branches � 2 suppliers � RECEIVED � PAID)
  Inventory Logs:    PURCHASE_RECEIVED (not ADJUSTMENT) + 4 SALE logs
  Transactions:      2 (YAK CASH 7,200 Ks � Zaypine CARD 8,200 Ks)
  Final Stock:       Coca-Cola@YAK=97 � Lay's@YAK=98 � Water@ZP=96 � Coffee@ZP=98
`);
}

main()
  .catch((e) => { console.error("? Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
