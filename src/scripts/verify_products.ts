import { prisma } from "../lib/prisma";

async function main() {
  const products = await prisma.product.findMany({
    select: { name: true, imageUrl: true }
  });
  console.log(`TOTAL PRODUCTS IN DB: ${products.length}`);
  products.forEach((p, i) => {
    console.log(`${i + 1}. [${p.name}] -> ${p.imageUrl}`);
  });
}

main().finally(() => prisma.$disconnect());
