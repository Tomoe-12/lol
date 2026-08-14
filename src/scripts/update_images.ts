import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const uploadDir = path.join(process.cwd(), "public", "uploads", "products");

const imagePool = [
  { keywords: ["coffee", "sunday", "3-in-1", "sachet"], file: "/uploads/products/sunday_coffee.jpg" },
  { keywords: ["cola", "coca", "coke", "can", "drink", "soda"], file: "/uploads/products/coca_cola.jpg" },
  { keywords: ["wine", "red mountain", "alcohol"], file: "/uploads/products/red_wine.jpg" },
  { keywords: ["water", "alpine", "mineral", "bottle"], file: "/uploads/products/mineral_water.jpg" },
  { keywords: ["whisky", "whiskey", "royal", "grand"], file: "/uploads/products/whisky.jpg" },
  { keywords: ["chips", "potato", "snack"], file: "/uploads/products/potato_chips.jpg" },
  { keywords: ["biscuit", "biscuits", "chocolate", "premier"], file: "/uploads/products/chocolate_biscuits.jpg" },
  { keywords: ["cookie", "cookies", "danish", "butter"], file: "/uploads/products/danish_cookies.jpg" },
  { keywords: ["cashew", "nut", "nuts", "roasted"], file: "/uploads/products/cashew_nuts.jpg" },
  { keywords: ["wafer", "roll"], file: "/uploads/products/wafer_roll.jpg" },
  { keywords: ["shampoo", "sunsilk", "hair"], file: "/uploads/products/shampoo.jpg" },
  { keywords: ["toothpaste", "colgate", "sensodyne", "toothbrush"], file: "/uploads/products/toothpaste.jpg" },
  { keywords: ["soap", "lux", "beauty"], file: "/uploads/products/soap.jpg" }
];

async function updateAllProducts() {
  const products = await prisma.product.findMany();
  console.log(`Found ${products.length} products in database.`);

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const nameLower = prod.name.toLowerCase();
    
    // Find matching image or fallback to pool cycle
    let matchedImage = imagePool.find(img => img.keywords.some(k => nameLower.includes(k)));
    if (!matchedImage) {
      matchedImage = imagePool[i % imagePool.length];
    }

    await prisma.product.update({
      where: { id: prod.id },
      data: { imageUrl: matchedImage.file }
    });

    console.log(`Updated product "${prod.name}" -> ${matchedImage.file}`);
  }
}

updateAllProducts()
  .then(() => console.log("All products updated with local image files successfully!"))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
