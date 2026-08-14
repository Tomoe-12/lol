import { PrismaClient, Role, PaymentMethod, TransactionStatus, PurchaseOrderStatus, SalesOrderStatus, PaymentStatus, StockChangeReason, ExpenseCategory } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Cleaning up old database records...")

  // 1. Delete dependent transactional records
  await prisma.transactionItem.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.salesOrderItem.deleteMany()
  await prisma.orderPayment.deleteMany()
  await prisma.salesOrder.deleteMany()
  await prisma.purchaseItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.inventoryLog.deleteMany()
  await prisma.stockLevel.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.exchangeRate.deleteMany()

  // 2. Delete master data records
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.customer.deleteMany()

  // 3. Delete staff and branches to clear all duplicates
  await prisma.staff.deleteMany()
  await prisma.branch.deleteMany()

  console.log("Database cleared successfully!")

  // 4. Create EXACTLY 4 Branches
  console.log("Creating 4 Branches...")
  const hledan = await prisma.branch.create({
    data: {
      name: "Hledan Branch / လှည်းတန်း ဆိုင်ခွဲ",
      address: "No. 123, Pyay Road, Kamayut Township, Yangon",
      receiptHeader: "Kind Shannon Shop - Hledan Main Store",
    },
  })

  const pyay = await prisma.branch.create({
    data: {
      name: "Pyay Road Branch / ပြည်လမ်း ဆိုင်ခွဲ",
      address: "No. 45, Pyay Road, Mayangone Township, Yangon",
      receiptHeader: "Kind Shannon Shop - Pyay Road Outlet",
    },
  })

  const mandalay = await prisma.branch.create({
    data: {
      name: "Mandalay Branch / မန္တလေး ဆိုင်ခွဲ",
      address: "73rd Street, Between 31st & 32nd, Chanayethazan, Mandalay",
      receiptHeader: "Kind Shannon Shop - Mandalay Branch",
    },
  })

  const taunggyi = await prisma.branch.create({
    data: {
      name: "Taunggyi Branch / တောင်ကြီး ဆိုင်ခွဲ",
      address: "Bogyoke Aung San Road, Taunggyi, Shan State",
      receiptHeader: "Kind Shannon Shop - Taunggyi Branch",
    },
  })

  const allBranches = [hledan, pyay, mandalay, taunggyi]

  // Re-create default staff accounts attached to branches
  const staffMember = await prisma.staff.create({
    data: {
      name: "Admin Owner",
      email: "owner@kindshannon.com",
      role: Role.OWNER,
      branchId: hledan.id,
      pin: "1234",
    },
  })

  await prisma.staff.create({
    data: {
      name: "Pyay Store Manager",
      email: "pyay.manager@kindshannon.com",
      role: Role.MANAGER,
      branchId: pyay.id,
      pin: "1234",
    },
  })

  await prisma.staff.create({
    data: {
      name: "Mandalay Cashier",
      email: "mandalay.cashier@kindshannon.com",
      role: Role.CASHIER,
      branchId: mandalay.id,
      pin: "1234",
    },
  })

  await prisma.staff.create({
    data: {
      name: "Taunggyi Cashier",
      email: "taunggyi.cashier@kindshannon.com",
      role: Role.CASHIER,
      branchId: taunggyi.id,
      pin: "1234",
    },
  })

  // 5. Create 3 Categories
  console.log("Creating 3 Categories...")
  const catBeverages = await prisma.category.create({
    data: { name: "Beverages & Drinks / အအေးနှင့် ဖျော်ရည်" },
  })
  const catSnacks = await prisma.category.create({
    data: { name: "Snacks & Bakery / မုန့်နှင့် မုန့်ပဲသရေစာ" },
  })
  const catPersonal = await prisma.category.create({
    data: { name: "Personal Care / လူသုံးကုန် ပစ္စည်းများ" },
  })

  // 6. Create 15 Clean Products & Variants
  console.log("Creating 15 Products with Variants and Stock Levels...")

  const productsData = [
    // Category 1: Beverages & Drinks (5 products)
    {
      name: "Sunday 3-in-1 Coffee (20 Sachet)",
      categoryId: catBeverages.id,
      imageUrl: "/uploads/products/sunday_coffee.jpg",
      price: 4500,
      variants: [{ name: "Pack", barcode: "885000100001", costPrice: 3500 }],
    },
    {
      name: "Coca-Cola Classic (500ml Can)",
      categoryId: catBeverages.id,
      imageUrl: "/uploads/products/coca_cola.jpg",
      price: 1200,
      variants: [{ name: "Single Can", barcode: "885000100002", costPrice: 800 }],
    },
    {
      name: "Red Mountain Wine (750ml)",
      categoryId: catBeverages.id,
      imageUrl: "/uploads/products/red_wine.jpg",
      price: 24000,
      variants: [{ name: "Bottle", barcode: "885000100003", costPrice: 18000 }],
    },
    {
      name: "Alpine Mineral Water (1 Liter)",
      categoryId: catBeverages.id,
      imageUrl: "/uploads/products/mineral_water.jpg",
      price: 700,
      variants: [{ name: "Bottle", barcode: "885000100004", costPrice: 400 }],
    },
    {
      name: "Grand Royal Whisky (700ml)",
      categoryId: catBeverages.id,
      imageUrl: "/uploads/products/whisky.jpg",
      price: 16000,
      variants: [{ name: "Bottle", barcode: "885000100005", costPrice: 12000 }],
    },

    // Category 2: Snacks & Bakery (5 products)
    {
      name: "Potato Chips Original (100g)",
      categoryId: catSnacks.id,
      imageUrl: "/uploads/products/potato_chips.jpg",
      price: 2200,
      variants: [{ name: "Pack", barcode: "885000200001", costPrice: 1500 }],
    },
    {
      name: "Premier Chocolate Biscuits",
      categoryId: catSnacks.id,
      imageUrl: "/uploads/products/chocolate_biscuits.jpg",
      price: 3000,
      variants: [{ name: "Box", barcode: "885000200002", costPrice: 2000 }],
    },
    {
      name: "Danish Butter Cookies (450g)",
      categoryId: catSnacks.id,
      imageUrl: "/uploads/products/danish_cookies.jpg",
      price: 12000,
      variants: [{ name: "Tin", barcode: "885000200003", costPrice: 8500 }],
    },
    {
      name: "Roasted Cashew Nuts (200g)",
      categoryId: catSnacks.id,
      imageUrl: "/uploads/products/cashew_nuts.jpg",
      price: 6500,
      variants: [{ name: "Pack", barcode: "885000200004", costPrice: 4500 }],
    },
    {
      name: "Wafer Roll Chocolate",
      categoryId: catSnacks.id,
      imageUrl: "/uploads/products/wafer_roll.jpg",
      price: 2800,
      variants: [{ name: "Can", barcode: "885000200005", costPrice: 1800 }],
    },

    // Category 3: Personal Care (5 products)
    {
      name: "Sunsilk Shampoo (320ml)",
      categoryId: catPersonal.id,
      imageUrl: "/uploads/products/shampoo.jpg",
      price: 6000,
      variants: [{ name: "Bottle", barcode: "885000300001", costPrice: 4200 }],
    },
    {
      name: "Colgate Total Toothpaste (150g)",
      categoryId: catPersonal.id,
      imageUrl: "/uploads/products/toothpaste.jpg",
      price: 3500,
      variants: [{ name: "Tube", barcode: "885000300002", costPrice: 2200 }],
    },
    {
      name: "Lux Beauty Soap (100g)",
      categoryId: catPersonal.id,
      imageUrl: "/uploads/products/soap.jpg",
      price: 1600,
      variants: [{ name: "Bar", barcode: "885000300003", costPrice: 1000 }],
    },
    {
      name: "Nivea Men Deodorant Spray",
      categoryId: catPersonal.id,
      imageUrl: "/uploads/products/deodorant.jpg",
      price: 8000,
      variants: [{ name: "Can", barcode: "885000300004", costPrice: 5500 }],
    },
    {
      name: "Sensodyne Gentle Toothbrush",
      categoryId: catPersonal.id,
      imageUrl: "/uploads/products/toothbrush.jpg",
      price: 2800,
      variants: [{ name: "Single Pack", barcode: "885000300005", costPrice: 1800 }],
    },
  ]

  const createdVariants: Array<{ id: string; productId: string; name: string; costPrice: number; retailPrice: number }> = []

  for (const p of productsData) {
    const prod = await prisma.product.create({
      data: {
        name: p.name,
        price: p.price,
        categoryId: p.categoryId,
        imageUrl: p.imageUrl,
      },
    })

    for (const v of p.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: prod.id,
          name: v.name,
          barcode: v.barcode,
          costPrice: v.costPrice,
          lowStockThreshold: 10,
        },
      })
      createdVariants.push({ id: variant.id, productId: prod.id, name: `${p.name} - ${v.name}`, costPrice: v.costPrice, retailPrice: p.price })

      // Create initial stock levels across all 4 branches
      for (const b of allBranches) {
        // Hledan gets 80, others get 35
        const initialQty = b.id === hledan.id ? 80 : 35
        await prisma.stockLevel.create({
          data: {
            branchId: b.id,
            variantId: variant.id,
            quantity: initialQty,
          },
        })
      }
    }
  }

  // 7. Create Suppliers
  console.log("Creating 3 Suppliers...")
  const sup1 = await prisma.supplier.create({
    data: {
      name: "City Wholesale Distribution Co., Ltd.",
      contact: "U Aung Myo (09-420011223)",
      email: "orders@citywholesale.com",
      address: "Pyay Road Industrial Zone, Yangon",
    },
  })
  await prisma.supplier.create({
    data: {
      name: "Myanmar Global Consumer Goods Ltd.",
      contact: "Daw Nilar (09-790123456)",
      email: "sales@mgcg.com.mm",
      address: "Bayintnaung Warehouse, Mayangone, Yangon",
    },
  })
  await prisma.supplier.create({
    data: {
      name: "Grand Asia Trading Co., Ltd.",
      contact: "Ko Soe Win (09-250987654)",
      email: "info@grandasia.com",
      address: "78th Street, Chanayethazan, Mandalay",
    },
  })

  // 8. Create Customers
  console.log("Creating 4 Customers...")
  const cust1 = await prisma.customer.create({
    data: {
      name: "Ko Aung Min",
      phone: "09-450112233",
      email: "aungmin@gmail.com",
      address: "Kamayut Township, Yangon",
    },
  })
  const cust2 = await prisma.customer.create({
    data: {
      name: "Daw Than Than Swe",
      phone: "09-260334455",
      email: "thanthan@gmail.com",
      address: "Mayangone, Yangon",
    },
  })
  await prisma.customer.create({
    data: {
      name: "U Kyaw Swar",
      phone: "09-970556677",
      email: "kyawswar@mandalaystore.com",
      address: "Chanayethazan, Mandalay",
    },
  })
  const cust4 = await prisma.customer.create({
    data: {
      name: "Walk-in Customer",
      phone: "-",
      address: "Yangon",
    },
  })

  // 9. Create Sample POS Transactions
  console.log("Creating sample POS transactions across branches...")
  for (let i = 0; i < allBranches.length; i++) {
    const branch = allBranches[i]
    const v1 = createdVariants[i % createdVariants.length]
    const v2 = createdVariants[(i + 5) % createdVariants.length]

    const item1Qty = 2
    const item1Total = item1Qty * v1.retailPrice
    const item2Qty = 1
    const item2Total = item2Qty * v2.retailPrice
    const orderTotal = item1Total + item2Total

    await prisma.transaction.create({
      data: {
        branchId: branch.id,
        staffId: staffMember.id,
        subtotal: orderTotal,
        discountAmount: 0,
        total: orderTotal,
        currency: "MMK",
        exchangeRate: 1,
        totalInMMK: orderTotal,
        paymentMethod: PaymentMethod.CASH,
        cashReceived: orderTotal,
        changeGiven: 0,
        status: TransactionStatus.COMPLETED,
        items: {
          create: [
            {
              productId: v1.productId,
              variantId: v1.id,
              quantity: item1Qty,
              unitPrice: v1.retailPrice,
              unitCost: v1.costPrice,
              discount: 0,
              total: item1Total,
            },
            {
              productId: v2.productId,
              variantId: v2.id,
              quantity: item2Qty,
              unitPrice: v2.retailPrice,
              unitCost: v2.costPrice,
              discount: 0,
              total: item2Total,
            },
          ],
        },
      },
    })
  }

  // 10. Create Sample Sales Orders
  console.log("Creating sample Sales Orders...")
  const vCoffee = createdVariants[0] // Sunday Coffee
  const so1Subtotal = 10 * 4000 // Wholesale 4,000 Ks
  await prisma.salesOrder.create({
    data: {
      branchId: hledan.id,
      customerId: cust1.id,
      status: SalesOrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      subtotal: so1Subtotal,
      discount: 0,
      total: so1Subtotal,
      amountPaid: so1Subtotal,
      note: "Wholesale Coffee Order - Delivered & Paid",
      items: {
        create: [
          {
            variantId: vCoffee.id,
            quantity: 10,
            unitPrice: 4000,
            unitCost: vCoffee.costPrice,
            discount: 0,
            total: so1Subtotal,
          },
        ],
      },
      payments: {
        create: [
          {
            amount: so1Subtotal,
            method: PaymentMethod.CASH,
            note: "Full cash payment on delivery",
          },
        ],
      },
    },
  })

  const vChips = createdVariants[5] // Potato chips
  const so2Subtotal = 20 * 2000 // Wholesale 2,000 Ks
  const so2Paid = 20000 // Paid 20,000 Ks, 20,000 Ks debt
  await prisma.salesOrder.create({
    data: {
      branchId: pyay.id,
      customerId: cust2.id,
      status: SalesOrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PARTIAL,
      subtotal: so2Subtotal,
      discount: 0,
      total: so2Subtotal,
      amountPaid: so2Paid,
      note: "Credit Wholesale Order - 20,000 Ks Pending Receivable",
      items: {
        create: [
          {
            variantId: vChips.id,
            quantity: 20,
            unitPrice: 2000,
            unitCost: vChips.costPrice,
            discount: 0,
            total: so2Subtotal,
          },
        ],
      },
      payments: {
        create: [
          {
            amount: so2Paid,
            method: PaymentMethod.QR,
            note: "50% Down payment via KBZPay",
          },
        ],
      },
    },
  })

  // 11. Create Sample Purchase Orders
  console.log("Creating sample Purchase Orders...")
  const po1Total = 50 * 3500
  await prisma.purchaseOrder.create({
    data: {
      branchId: hledan.id,
      supplierId: sup1.id,
      status: PurchaseOrderStatus.RECEIVED,
      totalCost: po1Total,
      note: "Restock Coffee for Hledan Main Store",
      items: {
        create: [
          {
            variantId: vCoffee.id,
            quantity: 50,
            unitCost: 3500,
            sellingPrice: 4500,
            total: po1Total,
          },
        ],
      },
    },
  })

  // 12. Create Sample Expenses
  console.log("Creating sample Expenses...")
  await prisma.expense.create({
    data: {
      branchId: hledan.id,
      category: ExpenseCategory.ELECTRICITY,
      amount: 150000,
      note: "Hledan Store Monthly EPC Electricity Payment",
    },
  })

  await prisma.expense.create({
    data: {
      branchId: pyay.id,
      category: ExpenseCategory.WATER,
      amount: 25000,
      note: "Pyay Road Store City Water Meter Bill",
    },
  })

  console.log("All clean seed data populated successfully with EXACTLY 4 Branches!")
}

main()
  .catch((e) => {
    console.error("Error during database seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
