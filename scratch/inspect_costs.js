const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectCosts() {
  console.log("=== Inspecting ProductVariant costPrice ===");
  const variants = await prisma.productVariant.findMany({
    select: { id: true, name: true, costPrice: true }
  });
  const variantsWithCost = variants.filter(v => v.costPrice > 0);
  console.log(`Total variants: ${variants.length}, Variants with costPrice > 0: ${variantsWithCost.length}`);
  if (variantsWithCost.length > 0) {
    console.log("Sample variant with cost:", variantsWithCost[0]);
  } else {
    console.log("Sample variant:", variants[0]);
  }

  console.log("\n=== Inspecting SalesOrderItem unitCost ===");
  const soItems = await prisma.salesOrderItem.findMany({
    select: { id: true, unitCost: true, variantId: true }
  });
  const soItemsWithCost = soItems.filter(i => i.unitCost > 0);
  console.log(`Total SalesOrderItems: ${soItems.length}, Items with unitCost > 0: ${soItemsWithCost.length}`);

  console.log("\n=== Inspecting TransactionItem unitCost ===");
  const txItems = await prisma.transactionItem.findMany({
    select: { id: true, unitCost: true, variantId: true }
  });
  const txItemsWithCost = txItems.filter(i => i.unitCost > 0);
  console.log(`Total TransactionItems: ${txItems.length}, Items with unitCost > 0: ${txItemsWithCost.length}`);

  await prisma.$disconnect();
}

inspectCosts();
