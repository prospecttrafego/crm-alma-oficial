import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import {
  DB_POOL_MAX,
  DB_POOL_MIN,
  DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECTION_TIMEOUT_MS,
  DB_POOL_MAX_USES,
} from "./constants";

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
  max: DB_POOL_MAX,
  // Minimum number of idle clients to maintain
  min: DB_POOL_MIN,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
  // Return an error after 2 seconds if connection cannot be established
  connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
  // Maximum time a client can be checked out before being forcefully released
  maxUses: DB_POOL_MAX_USES,
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
