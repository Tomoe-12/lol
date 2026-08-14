import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

/**
 * Generic cache-aside helper.
 * - On cache HIT  → returns cached JSON instantly (~5ms)
 * - On cache MISS → runs fetcher(), stores result in Redis, returns it
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) {
    return fetcher();
  }

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetcher();
    redis.setex(key, ttl, JSON.stringify(fresh)).catch(() => {});
    return fresh;
  } catch {
    return fetcher();
  }
}

/**
 * Invalidate one or more cache keys.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!redis) return;
  try {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Ignore Redis errors
  }
}

export const CACHE_KEYS = {
  dashboardStats: (branchId?: string) =>
    branchId ? `dashboard:stats:${branchId}` : "dashboard:stats:all",
  products: (branchId?: string) =>
    branchId ? `products:${branchId}` : "products:all",
  categories: "categories:all",
  staff: (branchId?: string) =>
    branchId ? `staff:${branchId}` : "staff:all",
  suppliers: "suppliers:all",
  inventory: (branchId?: string) =>
    branchId ? `inventory:${branchId}` : "inventory:all",
  notifications: (staffId?: string) =>
    staffId ? `notifications:${staffId}` : "notifications:all",
  expenses: (branchId?: string) =>
    branchId ? `expenses:${branchId}` : "expenses:all",
  auditLogs: "audit-logs:all",
} as const;

export const TTL = {
  STATS: 60,
  PRODUCTS: 120,
  CATEGORIES: 300,
  STAFF: 120,
  SUPPLIERS: 300,
  INVENTORY: 60,
  NOTIFICATIONS: 60,
  EXPENSES: 60,
  SCHEDULE: 60,
  AUDIT_LOGS: 120,
  SHIFT_LOGS: 60,
} as const;
