/**
 * Health Check Module
 * Verifica status de todos os servicos dependentes
 */

import { db, getPoolStats } from "./db";
import { sql } from "drizzle-orm";
import { DB_POOL_MAX } from "./constants";
import { getJobQueueHealth, type QueueHealth } from "./jobs/queue";
import { getAllCircuitBreakerMetrics, type CircuitBreakerMetrics } from "./lib/circuit-breaker";

export interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface JobQueueStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
  details?: QueueHealth;
}

export interface CircuitBreakersStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
  details?: Record<string, CircuitBreakerMetrics>;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis?: ServiceStatus;
    supabase?: ServiceStatus;
    evolutionApi?: ServiceStatus;
    jobQueue?: JobQueueStatus;
    circuitBreakers?: CircuitBreakersStatus;
  };
}

/**
 * Verifica conexao com PostgreSQL
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const poolStats = getPoolStats();

    // Warn if pool is under pressure (waiting > 0 or usage > 80%)
    // Safe math: ensure we don't divide by zero and values are valid numbers
    const activeConnections = Math.max(0, (poolStats.totalCount ?? 0) - (poolStats.idleCount ?? 0));
    const maxPool = DB_POOL_MAX > 0 ? DB_POOL_MAX : 1; // Prevent division by zero
    const poolUsagePercent = Math.min(100, (activeConnections / maxPool) * 100);
    const isUnderPressure = poolStats.waitingCount > 0 || poolUsagePercent > 80;

    return {
      status: isUnderPressure ? "degraded" : "healthy",
      latencyMs: Date.now() - start,
      details: {
        pool: {
          ...poolStats,
          usagePercent: Math.round(poolUsagePercent),
        },
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

/**
 * Verifica conexao com Redis (Upstash)
 */
async function checkRedis(): Promise<ServiceStatus | undefined> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return undefined; // Redis nao configurado
  }

  const start = Date.now();
  try {
    const response = await fetch(`${redisUrl}/ping`, {
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: "healthy",
        latencyMs: Date.now() - start,
      };
    }

    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: `Redis returned status ${response.status}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Redis connection failed",
    };
  }
}

/**
 * Verifica conexao com Supabase Storage
 */
async function checkSupabase(): Promise<ServiceStatus | undefined> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return undefined; // Supabase nao configurado
  }

  const start = Date.now();
  try {
    // Verificar se consegue listar buckets (endpoint de health)
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: "healthy",
        latencyMs: Date.now() - start,
      };
    }

    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      error: `Supabase returned status ${response.status}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Supabase connection failed",
    };
  }
}

/**
 * Verifica conexao com Evolution API (WhatsApp)
 */
async function checkEvolutionApi(): Promise<ServiceStatus | undefined> {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const evolutionKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionUrl || !evolutionKey) {
    return undefined; // Evolution API nao configurada
  }

  const start = Date.now();
  try {
    const response = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
      headers: {
        apikey: evolutionKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: "healthy",
        latencyMs: Date.now() - start,
      };
    }

    return {
      status: "degraded",
      latencyMs: Date.now() - start,
      error: `Evolution API returned status ${response.status}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Evolution API connection failed",
    };
  }
}

/**
 * Verifica status da fila de jobs
 */
async function checkJobQueue(): Promise<JobQueueStatus> {
  const start = Date.now();
  try {
    const health = await getJobQueueHealth();

    // Job queue is unhealthy if in production without Redis
    if (health.isProduction && !health.redisAvailable) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        error: "Redis not available in production",
        details: health,
      };
    }

    // Degraded if worker is not running
    if (!health.workerRunning) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: "Job worker not running",
        details: health,
      };
    }

    // Degraded if too many pending jobs (backlog)
    if (health.stats.pending > 100) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: `High job backlog: ${health.stats.pending} pending`,
        details: health,
      };
    }

    return {
      status: "healthy",
      latencyMs: Date.now() - start,
      details: health,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Job queue check failed",
    };
  }
}

/**
 * Verifica status dos circuit breakers
 */
function checkCircuitBreakers(): CircuitBreakersStatus {
  const start = Date.now();
  try {
    const metrics = getAllCircuitBreakerMetrics();
    const breakerNames = Object.keys(metrics);

    // No circuit breakers registered yet
    if (breakerNames.length === 0) {
      return {
        status: "healthy",
        latencyMs: Date.now() - start,
        details: metrics,
      };
    }

    // Check for any open circuit breakers
    const openCircuits = breakerNames.filter((name) => metrics[name].state === "OPEN");
    const halfOpenCircuits = breakerNames.filter((name) => metrics[name].state === "HALF_OPEN");

    if (openCircuits.length > 0) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: `Circuit breakers OPEN: ${openCircuits.join(", ")}`,
        details: metrics,
      };
    }

    if (halfOpenCircuits.length > 0) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: `Circuit breakers HALF_OPEN: ${halfOpenCircuits.join(", ")}`,
        details: metrics,
      };
    }

    return {
      status: "healthy",
      latencyMs: Date.now() - start,
      details: metrics,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Circuit breaker check failed",
    };
  }
}

/**
 * Executa health check completo
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [database, redis, supabase, evolutionApi, jobQueue] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkSupabase(),
    checkEvolutionApi(),
    checkJobQueue(),
  ]);

  // Circuit breakers are synchronous
  const circuitBreakers = checkCircuitBreakers();

  // Determinar status geral baseado nos servicos
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Database e essencial - se falhar, sistema esta unhealthy
  if (database.status === "unhealthy") {
    overallStatus = "unhealthy";
  } else if (database.status === "degraded") {
    overallStatus = "degraded";
  }

  // Job queue unhealthy in production degrades the system
  if (jobQueue.status === "unhealthy" && overallStatus !== "unhealthy") {
    overallStatus = process.env.NODE_ENV === "production" ? "unhealthy" : "degraded";
  } else if (jobQueue.status === "degraded" && overallStatus === "healthy") {
    overallStatus = "degraded";
  }

  // Circuit breakers degraded means external services are having issues
  if (circuitBreakers.status === "degraded" && overallStatus === "healthy") {
    overallStatus = "degraded";
  }

  // Servicos opcionais podem degradar mas nao derrubar o sistema
  const optionalServices = [redis, supabase, evolutionApi].filter(Boolean);
  for (const service of optionalServices) {
    if (service && service.status === "unhealthy" && overallStatus === "healthy") {
      overallStatus = "degraded";
    }
  }

  const services: HealthCheckResult["services"] = {
    database,
    jobQueue,
    circuitBreakers,
  };

  if (redis) services.redis = redis;
  if (supabase) services.supabase = supabase;
  if (evolutionApi) services.evolutionApi = evolutionApi;

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services,
  };
}
