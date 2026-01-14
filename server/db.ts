import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * PostgreSQL connection pool configuration
 * Optimized settings for production workloads
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Maximum number of clients the pool should contain
  max: 20,
  // Minimum number of idle clients to maintain
  min: 5,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,
  // Return an error after 2 seconds if connection cannot be established
  connectionTimeoutMillis: 2000,
  // Maximum time a client can be checked out before being forcefully released
  maxUses: 7500,
});

// Log pool errors
pool.on("error", (err) => {
  console.error("[DB Pool] Unexpected error on idle client", err);
});

/**
 * Get pool statistics for health checks
 */
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export const db = drizzle(pool, { schema });
