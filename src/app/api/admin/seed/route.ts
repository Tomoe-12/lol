/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Role,
  StockChangeReason,
  PaymentMethod,
  TransactionStatus,
  PurchaseOrderStatus,
  ExpenseCategory,
} from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "seed_now_please") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    console.log("Cleaning database...");
    try {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`OrderPayment\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`SalesOrderItem\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`SalesOrder\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`AuditLog\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`InventoryLog\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`TransactionItem\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Transaction\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`StockLevel\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`PurchaseItem\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`PurchaseOrder\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Expense\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`ExchangeRate\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`ProductVariant\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Product\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Category\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Staff\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Supplier\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Customer\`;`),
        prisma.$executeRawUnsafe(`DELETE FROM \`Branch\`;`),
        prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`),
      ]);
    } catch {
      await prisma.$transaction([
        prisma.orderPayment.deleteMany(),
        prisma.salesOrderItem.deleteMany(),
        prisma.salesOrder.deleteMany(),
        prisma.auditLog.deleteMany(),
        prisma.inventoryLog.deleteMany(),
        prisma.transactionItem.deleteMany(),
        prisma.transaction.deleteMany(),
        prisma.stockLevel.deleteMany(),
        prisma.purchaseItem.deleteMany(),
        prisma.purchaseOrder.deleteMany(),
        prisma.expense.deleteMany(),
        prisma.exchangeRate.deleteMany(),
        prisma.productVariant.deleteMany(),
        prisma.product.deleteMany(),
        prisma.category.deleteMany(),
        prisma.staff.deleteMany(),
        prisma.supplier.deleteMany(),
        prisma.customer.deleteMany(),
        prisma.branch.deleteMany(),
      ]);
    }
    console.log("Cleaned.");

    // Branches
    const hledan = await prisma.branch.create({ data: { name: "Hledan Branch", address: "Hledan Road, Kamayut Township, Yangon", receiptHeader: "SUPERMARKET - HLEDAN BRANCH\nThank you for shopping with us!" } });
    const tamwe  = await prisma.branch.create({ data: { name: "Tamwe Branch",  address: "Tamwe Road, Tamwe Township, Yangon",    receiptHeader: "CONVENIENCE STORE - TAMWE BRANCH\nThank you for shopping with us!" } });
    const sch    = await prisma.branch.create({ data: { name: "Sanchaung Branch", address: "Sanchaung Street, Sanchaung Township, Yangon", receiptHeader: "SUPERMARKET - SANCHAUNG BRANCH\nThank you for shopping with us!" } });
    const mdl    = await prisma.branch.create({ data: { name: "Mandalay Branch",  address: "83rd Street, Chan Aye Thar Zan Township, Mandalay", receiptHeader: "HYPERMARKET - MANDALAY BRANCH\nThank you for shopping with us!" } });
    const allBranches = [hledan, tamwe, sch, mdl];

    // Owner
    const owner = await prisma.staff.create({ data: { clerkId: "user_owner_dummy", name: "Owner Han", email: "owner@smartpos.com", password: "owner123", pin: "9999", role: Role.OWNER, branchId: hledan.id } });
    // Managers
    const mgrHl    = await prisma.staff.create({ data: { clerkId: "user_mgr_hl",     name: "Kyaw Kyaw",   email: "manager@smartpos.com", password: "manager123", pin: "2201", role: Role.MANAGER, branchId: hledan.id } });
    const mgrTw    = await prisma.staff.create({ data: { clerkId: "user_mgr_tw",     name: "Thida Maung", email: "thidamaung@pos.com", pin: "2202", role: Role.MANAGER, branchId: tamwe.id } });
    const mgrSch   = await prisma.staff.create({ data: { clerkId: "user_mgr_sch",    name: "Myo Min Aung",email: "myominaung@pos.com", pin: "2203", role: Role.MANAGER, branchId: sch.id } });
    const mgrMdl   = await prisma.staff.create({ data: { clerkId: "user_mgr_mdl",    name: "Aye Aye Khin",email: "ayeayekhin@pos.com", pin: "2204", role: Role.MANAGER, branchId: mdl.id } });
    // Cashiers
    const cHl1 = await prisma.staff.create({ data: { clerkId: "user_c_hl1", name: "Su Su",    email: "cashier@smartpos.com", password: "cashier123", pin: "1101", role: Role.CASHIER, branchId: hledan.id } });
    const cHl2 = await prisma.staff.create({ data: { clerkId: "user_c_hl2", name: "Zin Mar",  email: "zinmar@pos.com",  pin: "1102", role: Role.CASHIER, branchId: hledan.id } });
    const cHl3 = await prisma.staff.create({ data: { clerkId: "user_c_hl3", name: "Phyo Wai", email: "phyowai@pos.com", pin: "1103", role: Role.CASHIER, branchId: hledan.id } });
    const cTw1 = await prisma.staff.create({ data: { clerkId: "user_c_tw1", name: "Aung Myo", email: "aungmyo@pos.com", pin: "1201", role: Role.CASHIER, branchId: tamwe.id } });
    const cTw2 = await prisma.staff.create({ data: { clerkId: "user_c_tw2", name: "Nilar Win", email: "nilarwin@pos.com", pin: "1202", role: Role.CASHIER, branchId: tamwe.id } });
    const cSch1 = await prisma.staff.create({ data: { clerkId: "user_c_sc1", name: "Ei Phyu",  email: "eiphyu@pos.com",  pin: "1301", role: Role.CASHIER, branchId: sch.id } });
    const cSch2 = await prisma.staff.create({ data: { clerkId: "user_c_sc2", name: "Tun Lin",  email: "tunlin@pos.com",  pin: "1302", role: Role.CASHIER, branchId: sch.id } });
    const cMdl1 = await prisma.staff.create({ data: { clerkId: "user_c_ml1", name: "Win Htut", email: "winhtut@pos.com", pin: "1401", role: Role.CASHIER, branchId: mdl.id } });
    const cMdl2 = await prisma.staff.create({ data: { clerkId: "user_c_ml2", name: "Khin Myo", email: "khinmyo@pos.com", pin: "1402", role: Role.CASHIER, branchId: mdl.id } });
    const cMdl3 = await prisma.staff.create({ data: { clerkId: "user_c_ml3", name: "Zaw Lin",  email: "zawlin@pos.com",  pin: "1403", role: Role.CASHIER, branchId: mdl.id } });

    // Categories
    const catNames = [
      "Rice & Staples", "Beverages", "Dairy & Eggs", "Instant Noodles",
      "Snacks & Biscuits", "Condiments & Sauces", "Cooking Oil & Spices",
      "Personal Care", "Household & Cleaning", "Healthcare & OTC",
      "Canned & Preserved", "Frozen Foods"
    ];
    const categoryCache: Record<string, string> = {};
    for (const name of catNames) {
      const cat = await prisma.category.create({ data: { name } });
      categoryCache[name] = cat.id;
    }

    // Products
    const productsToCreate = [
      // 1. Rice & Staples
      { name: "Jasmine Rice 5kg", categoryName: "Rice & Staples", variants: [{  name: "Bag", price: 18500 , barcode: "8801007000001" }] },
      { name: "Paw San Hmwe Rice 5kg", categoryName: "Rice & Staples", variants: [{  name: "Bag", price: 26000 , barcode: "8801007000002" }] },
      { name: "White Sugar 1kg", categoryName: "Rice & Staples", variants: [{  name: "Pack", price: 4000 , barcode: "8801007000003" }] },
      { name: "Fine Table Salt 500g", categoryName: "Rice & Staples", variants: [{  name: "Pack", price: 1200 , barcode: "8801007000004" }] },
      { name: "Multi-Purpose Flour 1kg", categoryName: "Rice & Staples", variants: [{  name: "Pack", price: 3200 , barcode: "8801007000005" }] },
      { name: "Brown Sugar 500g", categoryName: "Rice & Staples", variants: [{  name: "Pack", price: 2600 , barcode: "8801007000006" }] },

      // 2. Beverages
      { name: "Coca-Cola Classic", categoryName: "Beverages", variants: [{  name: "325ml Can", price: 1200 , barcode: "88010070000111" }, {  name: "500ml Bottle", price: 1800 , barcode: "88010070000112" }, {  name: "1.5L Bottle", price: 2800 , barcode: "88010070000113" }] },
      { name: "Pepsi Soda", categoryName: "Beverages", variants: [{  name: "500ml Bottle", price: 1800 , barcode: "88010070000121" }, {  name: "1L Bottle", price: 3200 , barcode: "88010070000122" }] },
      { name: "Red Bull Energy Can", categoryName: "Beverages", variants: [{  name: "250ml Can", price: 2200 , barcode: "88010070000131" }, {  name: "Pack of 6", price: 12500 , barcode: "88010070000132" }] },
      { name: "Milo Chocolate Drink 180ml", categoryName: "Beverages", variants: [{  name: "Pack", price: 1300 , barcode: "8801007000014" }] },
      { name: "Pokka Green Tea", categoryName: "Beverages", variants: [{  name: "250ml Can", price: 1200 , barcode: "88010070000151" }, {  name: "500ml Bottle", price: 1800 , barcode: "88010070000152" }, {  name: "1L Bottle", price: 3200 , barcode: "88010070000153" }] },
      { name: "Alpine Purified Water 1L", categoryName: "Beverages", variants: [{  name: "Bottle", price: 800 , barcode: "8801007000016" }] },
      { name: "Shark Energy Drink 250ml", categoryName: "Beverages", variants: [{  name: "Can", price: 1500 , barcode: "8801007000017" }] },

      // 3. Dairy & Eggs
      { name: "Fresh Milk Carton", categoryName: "Dairy & Eggs", variants: [{  name: "1L Carton", price: 3500 , barcode: "8801007000021" }] },
      { name: "Premium Chicken Eggs 10pcs", categoryName: "Dairy & Eggs", variants: [{  name: "Box", price: 3200 , barcode: "8801007000022" }] },
      { name: "Dutch Mill Yogurt Drink", categoryName: "Dairy & Eggs", variants: [{  name: "Bottle", price: 900 , barcode: "8801007000023" }] },
      { name: "Anchor Salted Butter 227g", categoryName: "Dairy & Eggs", variants: [{  name: "Block", price: 6000 , barcode: "8801007000024" }] },
      { name: "Cheddar Cheese Slices 12pcs", categoryName: "Dairy & Eggs", variants: [{  name: "Pack", price: 5000 , barcode: "8801007000025" }] },
      { name: "Sweetened Condensed Milk", categoryName: "Dairy & Eggs", variants: [{  name: "Can", price: 2400 , barcode: "8801007000026" }] },

      // 4. Instant Noodles
      { name: "Mama Instant Noodles", categoryName: "Instant Noodles", variants: [{  name: "Minced Pork Pack", price: 900 , barcode: "8801007000031" }] },
      { name: "A1 ခေါက်ဆွဲ Noodles 65g", categoryName: "Instant Noodles", variants: [{  name: "Pack", price: 700 , barcode: "8801007000032" }] },
      { name: "Wai Wai Instant Noodles", categoryName: "Instant Noodles", variants: [{  name: "Pack", price: 600 , barcode: "8801007000033" }] },
      { name: "Myojo Char Mee Noodles", categoryName: "Instant Noodles", variants: [{  name: "Pack", price: 1400 , barcode: "8801007000034" }] },
      { name: "Samyang Hot Chicken Ramen", categoryName: "Instant Noodles", variants: [{  name: "Pack", price: 3200 , barcode: "8801007000035" }] },
      { name: "Yum Yum Chicken Noodles", categoryName: "Instant Noodles", variants: [{  name: "Pack", price: 700 , barcode: "8801007000036" }] },

      // 5. Snacks & Biscuits
      { name: "Lay's Potato Chips", categoryName: "Snacks & Biscuits", variants: [{  name: "Standard Bag 50g", price: 1800 , barcode: "8801007000041" }] },
      { name: "Pringles Sour Cream 107g", categoryName: "Snacks & Biscuits", variants: [{  name: "Can", price: 4000 , barcode: "8801007000042" }] },
      { name: "Oreo Chocolate Cookie", categoryName: "Snacks & Biscuits", variants: [{  name: "Standard Pack 133g", price: 1200 , barcode: "88010070000431" }, {  name: "Family Pack 256g", price: 2200 , barcode: "88010070000432" }] },
      { name: "AGB Biscuits 200g", categoryName: "Snacks & Biscuits", variants: [{  name: "Pack", price: 1800 , barcode: "8801007000044" }] },
      { name: "Marie Gold Biscuits 120g", categoryName: "Snacks & Biscuits", variants: [{  name: "Pack", price: 1200 , barcode: "8801007000045" }] },
      { name: "Euro Cake Strawberry", categoryName: "Snacks & Biscuits", variants: [{  name: "Pcs", price: 600 , barcode: "8801007000046" }] },
      { name: "Toblerone Chocolate", categoryName: "Snacks & Biscuits", variants: [{  name: "100g Bar", price: 3200 , barcode: "88010070000471" }, {  name: "360g Large Bar", price: 9800 , barcode: "88010070000472" }] },

      // 6. Condiments & Sauces
      { name: "Maggi Oyster Sauce 350g", categoryName: "Condiments & Sauces", variants: [{  name: "Bottle", price: 2800 , barcode: "8801007000051" }] },
      { name: "Healthy Boy Soy Sauce 300ml", categoryName: "Condiments & Sauces", variants: [{  name: "Bottle", price: 2100 , barcode: "8801007000052" }] },
      { name: "Roza Tomato Ketchup 320g", categoryName: "Condiments & Sauces", variants: [{  name: "Bottle", price: 1800 , barcode: "8801007000053" }] },
      { name: "Chili Sauce Hot 300g", categoryName: "Condiments & Sauces", variants: [{  name: "Bottle", price: 1500 , barcode: "8801007000054" }] },
      { name: "Premium Fish Sauce 750ml", categoryName: "Condiments & Sauces", variants: [{  name: "Bottle", price: 2500 , barcode: "8801007000055" }] },
      { name: "Chicken Bouillon Cubes 6pcs", categoryName: "Condiments & Sauces", variants: [{  name: "Box", price: 1200 , barcode: "8801007000056" }] },

      // 7. Cooking Oil & Spices
      { name: "Vegetable Cooking Oil 1L", categoryName: "Cooking Oil & Spices", variants: [{  name: "Bottle", price: 7000 , barcode: "8801007000061" }] },
      { name: "Palm Cooking Oil 5L", categoryName: "Cooking Oil & Spices", variants: [{  name: "Bottle", price: 29000 , barcode: "8801007000062" }] },
      { name: "Garlic Bulbs 500g", categoryName: "Cooking Oil & Spices", variants: [{  name: "Pack", price: 4000 , barcode: "8801007000063" }] },
      { name: "Red Onions 500g", categoryName: "Cooking Oil & Spices", variants: [{  name: "Pack", price: 2800 , barcode: "8801007000064" }] },
      { name: "Ground Turmeric Powder 100g", categoryName: "Cooking Oil & Spices", variants: [{  name: "Pack", price: 1200 , barcode: "8801007000065" }] },
      { name: "Black Pepper Shaker 50g", categoryName: "Cooking Oil & Spices", variants: [{  name: "Bottle", price: 2200 , barcode: "8801007000066" }] },

      // 8. Personal Care
      { name: "Sunsilk Shampoo", categoryName: "Personal Care", variants: [{  name: "320ml Bottle", price: 5000 , barcode: "88010070000711" }, {  name: "650ml Family Pump", price: 9500 , barcode: "88010070000712" }] },
      { name: "Lifebuoy Bar Soap 110g", categoryName: "Personal Care", variants: [{  name: "Bar", price: 1000 , barcode: "8801007000072" }] },
      { name: "Colgate Toothpaste", categoryName: "Personal Care", variants: [{  name: "150g Tube", price: 2200 , barcode: "88010070000731" }, {  name: "Twin Pack", price: 4200 , barcode: "88010070000732" }] },
      { name: "Dettol Antiseptic Liquid 250ml", categoryName: "Personal Care", variants: [{  name: "Bottle", price: 6200 , barcode: "8801007000074" }] },
      { name: "Biore Body Wash 220ml", categoryName: "Personal Care", variants: [{  name: "Bottle", price: 3200 , barcode: "8801007000075" }] },
      { name: "Sunsilk Conditioner 180ml", categoryName: "Personal Care", variants: [{  name: "Bottle", price: 3500 , barcode: "8801007000076" }] },

      // 9. Household & Cleaning
      { name: "Washing Powder 1kg (အမွေဆော)", categoryName: "Household & Cleaning", variants: [{  name: "Pack", price: 5000 , barcode: "8801007000081" }] },
      { name: "Sunlight Dishwashing", categoryName: "Household & Cleaning", variants: [{  name: "750ml Bottle", price: 2500 , barcode: "88010070000821" }, {  name: "Value Pack of 3", price: 7000 , barcode: "88010070000822" }] },
      { name: "Softess Toilet Paper 10 Rolls", categoryName: "Household & Cleaning", variants: [{  name: "Pack", price: 5800 , barcode: "8801007000083" }] },
      { name: "Mr. Muscle Floor Cleaner 1L", categoryName: "Household & Cleaning", variants: [{  name: "Bottle", price: 4800 , barcode: "8801007000084" }] },
      { name: "Vim Scouring Powder 500g", categoryName: "Household & Cleaning", variants: [{  name: "Can", price: 1600 , barcode: "8801007000085" }] },
      { name: "Garbage Bags Medium 30pcs", categoryName: "Household & Cleaning", variants: [{  name: "Pack", price: 2200 , barcode: "8801007000086" }] },

      // 10. Healthcare & OTC
      { name: "Paracetamol 500mg 100pcs", categoryName: "Healthcare & OTC", variants: [{  name: "Box", price: 3000 , barcode: "8801007000091" }] },
      { name: "Vitamin C 500mg 30pcs", categoryName: "Healthcare & OTC", variants: [{  name: "Bottle", price: 2200 , barcode: "8801007000092" }] },
      { name: "Disposable Face Masks 50pcs", categoryName: "Healthcare & OTC", variants: [{  name: "Box", price: 2500 , barcode: "8801007000093" }] },
      { name: "Antacid Tablets (20pcs)", categoryName: "Healthcare & OTC", variants: [{  name: "Strip", price: 1500 , barcode: "8801007000094" }] },
      { name: "Dettol Hand Sanitizer 50ml", categoryName: "Healthcare & OTC", variants: [{  name: "Bottle", price: 1300 , barcode: "8801007000095" }] },
      { name: "Tiger Balm Ointment 19g", categoryName: "Healthcare & OTC", variants: [{  name: "Jar", price: 1800 , barcode: "8801007000096" }] },

      // 11. Canned & Preserved
      { name: "Sardines in Tomato Sauce 155g", categoryName: "Canned & Preserved", variants: [{  name: "Can", price: 900 , barcode: "8801007000101" }] },
      { name: "Canned Tuna in Oil", categoryName: "Canned & Preserved", variants: [{  name: "150g Can", price: 3000 , barcode: "88010070001021" }, {  name: "Premium 3-Pack", price: 8500 , barcode: "88010070001022" }] },
      { name: "Coconut Milk Canned 400ml", categoryName: "Canned & Preserved", variants: [{  name: "Can", price: 1900 , barcode: "8801007000103" }] },
      { name: "Canned Sweet Corn 400g", categoryName: "Canned & Preserved", variants: [{  name: "Can", price: 1600 , barcode: "8801007000104" }] },
      { name: "Canned Baked Beans 400g", categoryName: "Canned & Preserved", variants: [{  name: "Can", price: 2100 , barcode: "8801007000105" }] },
      { name: "Pickled Mustard Greens 140g", categoryName: "Canned & Preserved", variants: [{  name: "Pack", price: 1200 , barcode: "8801007000106" }] },

      // 12. Frozen Foods
      { name: "Wall's Chocolate Ice Cream 1L", categoryName: "Frozen Foods", variants: [{  name: "Tub", price: 5500 , barcode: "8801007000111" }] },
      { name: "Frozen Dim Sum Pork 20pcs", categoryName: "Frozen Foods", variants: [{  name: "Pack", price: 8500 , barcode: "8801007000112" }] },
      { name: "Frozen Mixed Vegetables 500g", categoryName: "Frozen Foods", variants: [{  name: "Pack", price: 3500 , barcode: "8801007000113" }] },
      { name: "Frozen French Fries 1kg", categoryName: "Frozen Foods", variants: [{  name: "Pack", price: 6800 , barcode: "8801007000114" }] },
      { name: "Frozen Chicken Nuggets 500g", categoryName: "Frozen Foods", variants: [{  name: "Pack", price: 7800 , barcode: "8801007000115" }] },
      { name: "Frozen Fish Balls 500g", categoryName: "Frozen Foods", variants: [{  name: "Pack", price: 5500 , barcode: "8801007000116" }] },
    ];

    const createdProducts: any[] = [];
    for (const p of productsToCreate) {
      const firstPrice = p.variants[0]?.price || 0;
      const prod = await prisma.product.create({
        data: {
          name: p.name,
          price: firstPrice,
          categoryId: categoryCache[p.categoryName],
          variants: {
            create: p.variants.map((v) => ({
              name: v.name,
              barcode: v.barcode,
              costPrice: Math.round(v.price * 0.6),
            })),
          },
        },
      });
      createdProducts.push(prod);
    }

    // Primary products mappings
    const coffee = createdProducts.find(p => p.name === "Coca-Cola Classic")!;
    const latte = createdProducts.find(p => p.name === "Pepsi Soda")!;
    const milkTea = createdProducts.find(p => p.name === "Pokka Green Tea")!;
    const matcha = createdProducts.find(p => p.name === "Colgate Toothpaste")!;
    const juice = createdProducts.find(p => p.name === "Oreo Chocolate Cookie")!;
    const cake = createdProducts.find(p => p.name === "Sunsilk Shampoo")!;
    const brownie = createdProducts.find(p => p.name === "Samyang Hot Chicken Ramen")!;
    const sandwich = createdProducts.find(p => p.name === "Fresh Milk Carton")!;
    const fries = createdProducts.find(p => p.name === "Canned Tuna in Oil")!;
    const chips = createdProducts.find(p => p.name === "Lay's Potato Chips")!;
    const noodles = createdProducts.find(p => p.name === "Mama Instant Noodles")!;
    const choco = createdProducts.find(p => p.name === "Toblerone Chocolate")!;

    // Stock Levels & Initial logs
    const baseQty: Record<string, number> = {};
    for (const p of createdProducts) {
      baseQty[p.id] = p.name.length % 3 === 0 ? 40 : p.name.length % 2 === 0 ? 50 : 60;
    }
    const mults: Record<string, number> = { [hledan.id]:1.0, [tamwe.id]:0.7, [sch.id]:0.85, [mdl.id]:0.6 };

    const stockLevelsData: any[] = [];
    const inventoryLogsData: any[] = [];
    const initDate = daysAgo(60);

    const allDbVariants = await prisma.productVariant.findMany();

    for (const br of allBranches) {
      for (const v of allDbVariants) {
        const qty = Math.floor((baseQty[v.productId] || 40) * mults[br.id]);
        stockLevelsData.push({ branchId: br.id, variantId: v.id, quantity: qty });
        inventoryLogsData.push({ branchId: br.id, variantId: v.id, change: qty, reason: StockChangeReason.ADJUSTMENT, note: "Initial stock", createdAt: initDate });
      }
    }
    await prisma.stockLevel.createMany({ data: stockLevelsData });
    await prisma.inventoryLog.createMany({ data: inventoryLogsData });

    // Transactions — 30 days
    const variants = await prisma.productVariant.findMany();
    const vm = (pid: string, vname: string) => variants.find(v => v.productId === pid && v.name === vname) || variants.find(v => v.productId === pid) || variants[0];
    const carts = [
      [{p:coffee,v:vm(coffee.id,"500ml Bottle"),q:2},{p:cake,v:vm(cake.id,"320ml Bottle"),q:1}],
      [{p:latte,v:vm(latte.id,"500ml Bottle"),q:1},{p:brownie,v:vm(brownie.id,"750ml Bottle"),q:2}],
      [{p:milkTea,v:vm(milkTea.id,"250ml Can"),q:2}],
      [{p:sandwich,v:vm(sandwich.id,"1L Carton"),q:2},{p:coffee,v:vm(coffee.id,"325ml Can"),q:2}],
      [{p:fries,v:vm(fries.id,"Premium 3-Pack"),q:1},{p:coffee,v:vm(coffee.id,"1.5L Bottle"),q:1}],
      [{p:chips,v:vm(chips.id,"Standard Bag 50g"),q:3},{p:noodles,v:vm(noodles.id,"Minced Pork Pack"),q:2}],
      [{p:coffee,v:vm(coffee.id,"1.5L Bottle"),q:1}],
      [{p:latte,v:vm(latte.id,"500ml Bottle"),q:2},{p:cake,v:vm(cake.id,"320ml Bottle"),q:1}],
      [{p:fries,v:vm(fries.id,"150g Can"),q:2},{p:milkTea,v:vm(milkTea.id,"250ml Can"),q:1}],
      [{p:noodles,v:vm(noodles.id,"Minced Pork Pack"),q:4}],
      [{p:matcha,v:vm(matcha.id,"Twin Pack"),q:2},{p:brownie,v:vm(brownie.id,"750ml Bottle"),q:1}],
      [{p:juice,v:vm(juice.id,"Family Pack 256g"),q:1},{p:sandwich,v:vm(sandwich.id,"1L Carton"),q:1}],
      [{p:choco,v:vm(choco.id,"100g Bar"),q:2}],
      [{p:coffee,v:vm(coffee.id,"325ml Can"),q:3},{p:chips,v:vm(chips.id,"Standard Bag 50g"),q:1}],
      [{p:matcha,v:vm(matcha.id,"150g Tube"),q:1},{p:cake,v:vm(cake.id,"320ml Bottle"),q:2}],
      [{p:latte,v:vm(latte.id,"1L Bottle"),q:1},{p:fries,v:vm(fries.id,"Premium 3-Pack"),q:1}],
    ];

    const staffByBranch: Record<string,any[]> = {
      [hledan.id]:[cHl1,cHl2,cHl3],
      [tamwe.id]:[cTw1,cTw2],
      [sch.id]:[cSch1,cSch2],
      [mdl.id]:[cMdl1,cMdl2,cMdl3],
    };
    const methods = [PaymentMethod.CASH,PaymentMethod.CARD,PaymentMethod.QR];
    let txCount = 0;
    const vols: [string,number,number][] = [[hledan.id,5,12],[tamwe.id,3,8],[sch.id,3,8],[mdl.id,2,6]];

    for (let day=30;day>=0;day--) {
      const txDate = daysAgo(day);
      const dayPromises: any[] = [];
      for (const [brId,mn,mx] of vols) {
        const bStaff = staffByBranch[brId];
        const count = rand(mn,mx);
        for (let t=0;t<count;t++) {
          const cart = carts[rand(0,carts.length-1)];
          const stf = bStaff[rand(0,bStaff.length-1)];
          const mth = methods[rand(0,2)];
          let sub=0;
          const items = cart.map(ci=>{ if(!ci.v)return null; const tot=ci.p.price*ci.q; sub+=tot; return{productId:ci.p.id,variantId:ci.v.id,quantity:ci.q,unitPrice:ci.p.price,discount:0,total:tot}; }).filter(Boolean) as any[];
          if(!items.length)continue;
          const disc=rand(0,4)===0?Math.floor(sub*0.1):0;
          const tot=sub-disc;
          const cash=mth===PaymentMethod.CASH?Math.ceil(tot/500)*500:undefined;
          const dt=new Date(txDate); dt.setHours(rand(8,21),rand(0,59),0,0);

          dayPromises.push(
            prisma.transaction.create({ data:{branchId:brId,staffId:stf.id,subtotal:sub,discountAmount:disc,total:tot,currency:"MMK",exchangeRate:4500,totalInMMK:tot,paymentMethod:mth,cashReceived:cash,changeGiven:cash?cash-tot:undefined,status:TransactionStatus.COMPLETED,createdAt:dt,updatedAt:dt,items:{create:items}} })
          );
          txCount++;
        }
      }
      if (dayPromises.length > 0) {
        await prisma.$transaction(dayPromises);
      }
    }

    // Suppliers
    const sup1 = await prisma.supplier.create({ data:{name:"City Mart Wholesale",contact:"+959 421 000 001",email:"citymart@supplier.com",address:"Industrial Zone, Hlaing Tharyar, Yangon"} });
    const sup2 = await prisma.supplier.create({ data:{name:"Coca-Cola Pinya Bottles",contact:"+959 421 000 002",email:"cocacola@supplier.com",address:"Mingaladon Township, Yangon"} });
    const sup3 = await prisma.supplier.create({ data:{name:"Myanmar Retail Distributors",contact:"+959 421 000 003",email:"retaildist@supplier.com",address:"Thiri Mingala Market, Mandalay"} });
    const sup4 = await prisma.supplier.create({ data:{name:"Unilever Myanmar Supplies",contact:"+959 421 000 004",email:"unilever@supplier.com",address:"Kamayut Township, Yangon"} });

    // Purchase Orders
    await prisma.purchaseOrder.create({data:{supplierId:sup2.id,branchId:hledan.id,status:PurchaseOrderStatus.RECEIVED,totalCost:240000,note:"Beverages restock",createdAt:daysAgo(25),items:{create:[{variantId:vm(coffee.id,"325ml Can").id,quantity:100,unitCost:1200,total:120000},{variantId:vm(latte.id,"500ml Bottle").id,quantity:80,unitCost:1500,total:120000}]}}});
    await prisma.purchaseOrder.create({data:{supplierId:sup1.id,branchId:hledan.id,status:PurchaseOrderStatus.RECEIVED,totalCost:155000,note:"Weekly personal care & dairy restock",createdAt:daysAgo(15),items:{create:[{variantId:vm(cake.id,"650ml Family Pump").id,quantity:30,unitCost:2500,total:75000},{variantId:vm(brownie.id,"750ml Bottle").id,quantity:40,unitCost:1000,total:40000},{variantId:vm(sandwich.id,"1L Carton").id,quantity:20,unitCost:2000,total:40000}]}}});
    await prisma.purchaseOrder.create({data:{supplierId:sup3.id,branchId:tamwe.id,status:PurchaseOrderStatus.ORDERED,totalCost:180000,note:"Grocery & snacks restock",createdAt:daysAgo(4),items:{create:[{variantId:vm(chips.id,"Standard Bag 50g").id,quantity:100,unitCost:1000,total:100000},{variantId:vm(noodles.id,"Minced Pork Pack").id,quantity:100,unitCost:600,total:60000},{variantId:vm(choco.id,"100g Bar").id,quantity:20,unitCost:1500,total:30000}]}}});
    await prisma.purchaseOrder.create({data:{supplierId:sup2.id,branchId:tamwe.id,status:PurchaseOrderStatus.DRAFT,totalCost:120000,note:"Beverage replenishment",createdAt:daysAgo(1),items:{create:[{variantId:vm(coffee.id,"325ml Can").id,quantity:60,unitCost:1200,total:72000},{variantId:vm(milkTea.id,"250ml Can").id,quantity:60,unitCost:800,total:48000}]}}});
    await prisma.purchaseOrder.create({data:{supplierId:sup4.id,branchId:sch.id,status:PurchaseOrderStatus.RECEIVED,totalCost:195000,note:"Personal care & household supplies",createdAt:daysAgo(18),items:{create:[{variantId:vm(cake.id,"650ml Family Pump").id,quantity:25,unitCost:2500,total:62500},{variantId:vm(brownie.id,"750ml Bottle").id,quantity:50,unitCost:1000,total:50000},{variantId:vm(sandwich.id,"1L Carton").id,quantity:30,unitCost:2000,total:60000}]}}});
    await prisma.purchaseOrder.create({data:{supplierId:sup3.id,branchId:mdl.id,status:PurchaseOrderStatus.RECEIVED,totalCost:150000,note:"Mandalay grocery & snacks",createdAt:daysAgo(22),items:{create:[{variantId:vm(chips.id,"Standard Bag 50g").id,quantity:80,unitCost:1000,total:80000},{variantId:vm(noodles.id,"Minced Pork Pack").id,quantity:80,unitCost:600,total:48000},{variantId:vm(choco.id,"100g Bar").id,quantity:15,unitCost:1500,total:22500}]}}});

    // Customers
    const cust1 = await prisma.customer.create({ data: { name: "Daw Aye Aye", phone: "09420000001", email: "ayeaye@gmail.com", address: "No. 12, Pyay Road, Kamayut Township, Yangon", creditLimit: 500000 } });
    const cust2 = await prisma.customer.create({ data: { name: "U Kyaw Swar", phone: "09420000002", email: "kyawswar@gmail.com", address: "No. 45, Hledan Street, Kamayut Township, Yangon", creditLimit: 1000000 } });
    const cust3 = await prisma.customer.create({ data: { name: "Ko Maung Maung", phone: "09420000003", email: "mgmg@gmail.com", address: "No. 88, Upper Pazundaung Road, Yangon", creditLimit: 750000 } });
    const cust4 = await prisma.customer.create({ data: { name: "Ma Thida", phone: "09420000004", email: "thida@gmail.com", address: "No. 102, 73rd Street, Mandalay", creditLimit: 500000 } });

    // Sales Orders (Delivery Orders & Outstanding Debts)
    await prisma.salesOrder.create({
      data: {
        branchId: hledan.id,
        customerId: cust1.id,
        status: "CONFIRMED",
        paymentStatus: "PARTIAL",
        paymentMethod: "CASH",
        subtotal: 120000,
        discount: 0,
        total: 120000,
        amountPaid: 40000,
        note: "Online wholesale order - Pending delivery",
        isDelivery: true,
        deliveryStatus: "PENDING",
        deliveryCustomerName: cust1.name,
        deliveryPhone: cust1.phone,
        deliveryAddress: cust1.address,
        createdAt: daysAgo(2),
        items: {
          create: [
            { variantId: vm(coffee.id, "325ml Can").id, quantity: 50, unitPrice: 1200, unitCost: 720, discount: 0, total: 60000 },
            { variantId: vm(latte.id, "500ml Bottle").id, quantity: 40, unitPrice: 1500, unitCost: 900, discount: 0, total: 60000 },
          ],
        },
        payments: {
          create: { amount: 40000, method: "CASH", note: "Initial advance deposit", createdAt: daysAgo(2) },
        },
      },
    });

    await prisma.salesOrder.create({
      data: {
        branchId: hledan.id,
        customerId: cust2.id,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CARD",
        subtotal: 85000,
        discount: 0,
        total: 85000,
        amountPaid: 85000,
        note: "POS delivery order - Completed",
        isDelivery: true,
        deliveryStatus: "DELIVERED",
        deliveryCustomerName: cust2.name,
        deliveryPhone: cust2.phone,
        deliveryAddress: cust2.address,
        createdAt: daysAgo(1),
        items: {
          create: [
            { variantId: vm(cake.id, "650ml Family Pump").id, quantity: 5, unitPrice: 9500, unitCost: 5700, discount: 0, total: 47500 },
            { variantId: vm(fries.id, "Premium 3-Pack").id, quantity: 5, unitPrice: 7500, unitCost: 4500, discount: 0, total: 37500 },
          ],
        },
        payments: {
          create: { amount: 85000, method: "CARD", note: "Full card payment", createdAt: daysAgo(1) },
        },
      },
    });

    await prisma.salesOrder.create({
      data: {
        branchId: tamwe.id,
        customerId: cust3.id,
        status: "CONFIRMED",
        paymentStatus: "PARTIAL",
        paymentMethod: "QR",
        subtotal: 150000,
        discount: 0,
        total: 150000,
        amountPaid: 50000,
        note: "Grocery wholesale - Delivery pending",
        isDelivery: true,
        deliveryStatus: "PENDING",
        deliveryCustomerName: cust3.name,
        deliveryPhone: cust3.phone,
        deliveryAddress: cust3.address,
        createdAt: daysAgo(1),
        items: {
          create: [
            { variantId: vm(chips.id, "Standard Bag 50g").id, quantity: 50, unitPrice: 1800, unitCost: 1080, discount: 0, total: 90000 },
            { variantId: vm(noodles.id, "Minced Pork Pack").id, quantity: 60, unitPrice: 1000, unitCost: 600, discount: 0, total: 60000 },
          ],
        },
        payments: {
          create: { amount: 50000, method: "QR", note: "KBZPay advance deposit", createdAt: daysAgo(1) },
        },
      },
    });

    await prisma.salesOrder.create({
      data: {
        branchId: mdl.id,
        customerId: cust4.id,
        status: "CONFIRMED",
        paymentStatus: "PARTIAL",
        paymentMethod: "CASH",
        subtotal: 210000,
        discount: 10000,
        total: 200000,
        amountPaid: 80000,
        note: "Wholesale credit sale",
        isDelivery: false,
        deliveryStatus: "PENDING",
        createdAt: daysAgo(3),
        items: {
          create: [
            { variantId: vm(choco.id, "360g Large Bar").id, quantity: 20, unitPrice: 9800, unitCost: 5880, discount: 0, total: 196000 },
          ],
        },
        payments: {
          create: { amount: 80000, method: "CASH", note: "Partial cash payment", createdAt: daysAgo(3) },
        },
      },
    });

    // Expenses — all 4 branches, 2 months
    const exps = [
      {b:hledan.id,cat:ExpenseCategory.RENT,      amt:1200000,note:"Monthly rent - June",     d:2},
      {b:hledan.id,cat:ExpenseCategory.ELECTRICITY,amt:180000, note:"Electricity - June",      d:3},
      {b:hledan.id,cat:ExpenseCategory.WATER,      amt:25000,  note:"Water bill - June",       d:3},
      {b:hledan.id,cat:ExpenseCategory.SALARIES,   amt:800000, note:"Staff salaries - June",   d:2},
      {b:hledan.id,cat:ExpenseCategory.SUPPLIES,   amt:45000,  note:"Cleaning supplies",       d:15},
      {b:hledan.id,cat:ExpenseCategory.RENT,       amt:1200000,note:"Monthly rent - May",      d:32},
      {b:hledan.id,cat:ExpenseCategory.ELECTRICITY,amt:175000, note:"Electricity - May",       d:33},
      {b:hledan.id,cat:ExpenseCategory.SALARIES,   amt:800000, note:"Staff salaries - May",    d:32},
      {b:tamwe.id, cat:ExpenseCategory.RENT,       amt:900000, note:"Monthly rent - June",     d:2},
      {b:tamwe.id, cat:ExpenseCategory.ELECTRICITY,amt:130000, note:"Electricity - June",      d:3},
      {b:tamwe.id, cat:ExpenseCategory.SALARIES,   amt:500000, note:"Staff salaries - June",   d:2},
      {b:tamwe.id, cat:ExpenseCategory.OTHER,      amt:55000,  note:"Wifi upgrade",            d:20},
      {b:tamwe.id, cat:ExpenseCategory.RENT,       amt:900000, note:"Monthly rent - May",      d:32},
      {b:tamwe.id, cat:ExpenseCategory.SALARIES,   amt:500000, note:"Staff salaries - May",    d:32},
      {b:sch.id,   cat:ExpenseCategory.RENT,       amt:1050000,note:"Monthly rent - June",     d:2},
      {b:sch.id,   cat:ExpenseCategory.ELECTRICITY,amt:150000, note:"Electricity - June",      d:3},
      {b:sch.id,   cat:ExpenseCategory.SALARIES,   amt:600000, note:"Staff salaries - June",   d:2},
      {b:sch.id,   cat:ExpenseCategory.SUPPLIES,   amt:38000,  note:"Eco bags and packing tape",d:10},
      {b:sch.id,   cat:ExpenseCategory.RENT,       amt:1050000,note:"Monthly rent - May",      d:32},
      {b:sch.id,   cat:ExpenseCategory.SALARIES,   amt:600000, note:"Staff salaries - May",    d:32},
      {b:mdl.id,   cat:ExpenseCategory.RENT,       amt:750000, note:"Monthly rent - June",     d:2},
      {b:mdl.id,   cat:ExpenseCategory.ELECTRICITY,amt:110000, note:"Electricity - June",      d:3},
      {b:mdl.id,   cat:ExpenseCategory.SALARIES,   amt:650000, note:"Staff salaries - June",   d:2},
      {b:mdl.id,   cat:ExpenseCategory.OTHER,      amt:42000,  note:"POS barcode scanner repair",d:18},
      {b:mdl.id,   cat:ExpenseCategory.RENT,       amt:750000, note:"Monthly rent - May",      d:32},
      {b:mdl.id,   cat:ExpenseCategory.SALARIES,   amt:650000, note:"Staff salaries - May",    d:32},
    ];
    await prisma.expense.createMany({
      data: exps.map(e => { const d=daysAgo(e.d); return { branchId:e.b,category:e.cat,amount:e.amt,currency:"MMK",note:e.note,date:d,createdAt:d }; })
    });

    // Audit Logs
    const audits=[
      {sId:owner.id,action:"BRANCH_CREATE",details:"Created Tamwe Branch",days:60},
      {sId:owner.id,action:"BRANCH_CREATE",details:"Created Sanchaung Branch",days:55},
      {sId:owner.id,action:"BRANCH_CREATE",details:"Created Mandalay Branch",days:50},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Manager: Kyaw Kyaw at Hledan",days:58},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Manager: Thida Maung at Tamwe",days:57},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Manager: Myo Min Aung at Sanchaung",days:53},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Manager: Aye Aye Khin at Mandalay",days:49},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Cashier: Phyo Wai at Hledan",days:45},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Cashiers at Sanchaung: Ei Phyu and Tun Lin",days:40},
      {sId:owner.id,action:"STAFF_ADD",details:"Added Cashiers at Mandalay: Win Htut, Khin Myo, Zaw Lin",days:38},
      {sId:owner.id,action:"PRODUCT_ADD",details:"Added product: Colgate Toothpaste",days:35},
      {sId:owner.id,action:"PRODUCT_ADD",details:"Added product: Oreo Chocolate Cookies",days:34},
      {sId:owner.id,action:"ROLE_CHANGE",details:"Changed Su Su role to CASHIER",days:30},
      {sId:mgrHl.id,action:"STOCK_ADJUST",details:"Manual adjustment: +20 Coca-Cola Classic at Hledan",days:28},
      {sId:mgrTw.id,action:"STOCK_ADJUST",details:"Manual adjustment: +15 Red Bull Energy Can at Tamwe",days:25},
      {sId:mgrSch.id,action:"PURCHASE_ORDER",details:"Created PO for Unilever Myanmar Supplies 195,000 MMK",days:22},
      {sId:mgrHl.id,action:"PURCHASE_ORDER",details:"Created PO for Coca-Cola Pinya Bottles 240,000 MMK",days:47},
      {sId:mgrTw.id,action:"EXPENSE_ADD",details:"Added wifi upgrade: 55,000 MMK at Tamwe",days:20},
      {sId:mgrHl.id,action:"EXPENSE_ADD",details:"Added electricity: 180,000 MMK at Hledan",days:15},
      {sId:mgrMdl.id,action:"EXPENSE_ADD",details:"Added POS scanner maintenance: 42,000 MMK at Mandalay",days:18},
      {sId:mgrHl.id,action:"STOCK_TRANSFER",details:"Transferred 20 Red Bull: Hledan to Tamwe",days:12},
      {sId:mgrSch.id,action:"STOCK_TRANSFER",details:"Transferred 10 Coca-Cola: Sanchaung to Mandalay",days:10},
      {sId:cHl1.id,action:"VOID_TRANSACTION",details:"Voided transaction — customer request",days:9},
      {sId:cTw1.id,action:"VOID_TRANSACTION",details:"Voided transaction — wrong item scanned",days:7},
      {sId:mgrMdl.id,action:"STOCK_ADJUST",details:"Received goods: +30 Coca-Cola Classic at Mandalay",days:5},
      {sId:owner.id,action:"PRODUCT_UPDATE",details:"Updated price: Pokka Green Tea 1L Bottle to 3,200 MMK",days:4},
      {sId:mgrSch.id,action:"STAFF_CLOCK",details:"Clocked out Tun Lin (forgotten clock out)",days:3},
      {sId:cMdl2.id,action:"VOID_TRANSACTION",details:"Voided transaction — payment issue",days:2},
    ];
    await prisma.auditLog.createMany({
      data: audits.map(a => ({ staffId:a.sId,action:a.action,details:a.details,createdAt:daysAgo(a.days) }))
    });

    return NextResponse.json({
      success: true,
      summary: { branches:allBranches.length, staff:15, categories:catNames.length, products:createdProducts.length, transactions:txCount, suppliers:4, purchaseOrders:6, expenses:exps.length, auditLogs:audits.length },
    });
  } catch (error) {
    console.error("Seed error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Seed failed", details: msg }, { status: 500 });
  }
}
