const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating StockLevel and InventoryLog...');
  
  // Update StockLevel
  const stockLevels = await prisma.stockLevel.findMany({
    where: { productId: { not: null }, variantId: null }
  });
  
  for (const sl of stockLevels) {
    const variant = await prisma.productVariant.findFirst({
      where: { productId: sl.productId }
    });
    
    if (variant) {
      await prisma.stockLevel.update({
        where: { id: sl.id },
        data: { variantId: variant.id }
      });
      console.log(`Updated StockLevel ${sl.id} with variant ${variant.id}`);
    }
  }

  // Update InventoryLog
  const logs = await prisma.inventoryLog.findMany({
    where: { productId: { not: null }, variantId: null }
  });
  
  for (const log of logs) {
    const variant = await prisma.productVariant.findFirst({
      where: { productId: log.productId }
    });
    
    if (variant) {
      await prisma.inventoryLog.update({
        where: { id: log.id },
        data: { variantId: variant.id }
      });
      console.log(`Updated InventoryLog ${log.id} with variant ${variant.id}`);
    }
  }

  console.log('Migration complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
