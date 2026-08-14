import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/**
 * Retries a Prisma operation once when the connection is reset.
 * Supabase's pgBouncer in transaction mode drops idle connections,
 * which causes P1017 "Server has closed the connection" errors.
 * On retry Prisma will automatically reconnect.
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error: unknown) {
    const isConnectionError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P1017"

    if (isConnectionError) {
      // Give Prisma 300ms to re-establish the connection, then retry once
      await new Promise((resolve) => setTimeout(resolve, 300))
      try {
        await prisma.$connect()
      } catch {
        // $connect may throw if already connecting; proceed anyway
      }
      return await operation()
    }
    throw error
  }
}
