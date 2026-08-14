import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT 1 as ok`
  .then(() => console.log("✅ Database connection OK"))
  .catch((e: Error) => console.error("❌ DB Error:", e.message))
  .finally(() => prisma.$disconnect());
