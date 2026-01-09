/**
 * Health Check Module
 * Verifica status de todos os servicos dependentes
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
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
  };
}

/**
 * Verifica conexao com PostgreSQL
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: "healthy",
      latencyMs: Date.now() - start,
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
 * Executa health check completo
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [database, redis, supabase, evolutionApi] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkSupabase(),
    checkEvolutionApi(),
  ]);

  // Determinar status geral baseado nos servicos
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Database e essencial - se falhar, sistema esta unhealthy
  if (database.status === "unhealthy") {
    overallStatus = "unhealthy";
  } else if (database.status === "degraded") {
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
