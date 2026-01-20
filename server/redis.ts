/**
 * Servico Redis (Upstash) para cache, contadores e rate limiting
 */
/**
 * Redis Service (Upstash) for rate limiting, presence tracking, and generic cache
 *
 * NOTE: Message cache and unread count functions were removed (2026-01-20)
 * as they were dead code never integrated into the main flow.
 * The database is the source of truth for messages and unread counts.
 */
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createServiceLogger } from "./logger";
import {
  LOGIN_RATE_LIMIT_MAX,
  PRESENCE_TTL_SECONDS,
  DEFAULT_CACHE_TTL_SECONDS,
} from "./constants";

const redisLogger = createServiceLogger("redis");

// Inicializar cliente Redis apenas se as variaveis de ambiente estiverem configuradas
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;
let loginRatelimit: Ratelimit | null = null;

const LOGIN_RATE_LIMIT_WINDOW = "1 m";

if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  // Rate limiter: 100 requisicoes por minuto por usuario
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    analytics: true,
    prefix: "alma:ratelimit",
  });

  loginRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW),
    analytics: true,
    prefix: "alma:ratelimit:login",
  });

  redisLogger.info("[Redis] Conectado ao Upstash");
} else {
  redisLogger.info("[Redis] Variaveis de ambiente nao configuradas, funcionando sem cache");
}

// ========== RATE LIMITING ==========

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Verificar rate limit para um usuario
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    return { success: true, limit: 100, remaining: 100, reset: 0 };
  }

  try {
    const result = await ratelimit.limit(userId);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    redisLogger.error("[Redis] Erro ao verificar rate limit", { error });
    // Em caso de erro, permitir a requisicao
    return { success: true, limit: 100, remaining: 100, reset: 0 };
  }
}

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Verificar rate limit para tentativas de login (por IP)
 */
export async function checkLoginRateLimit(identifier: string): Promise<LoginRateLimitResult | null> {
  if (!loginRatelimit) return null;

  try {
    const result = await loginRatelimit.limit(identifier);
    if (result.success) {
      return { allowed: true };
    }
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return { allowed: false, retryAfter };
  } catch (error) {
    redisLogger.error("[Redis] Erro ao verificar rate limit de login", { error });
    return null;
  }
}

/**
 * Resetar rate limit de login para um identificador
 */
export async function resetLoginRateLimit(identifier: string): Promise<void> {
  if (!loginRatelimit) return;

  try {
    await loginRatelimit.resetUsedTokens(identifier);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao resetar rate limit de login", { error });
  }
}

// ========== PRESENCE (USUARIOS ONLINE) ==========

const PRESENCE_KEY = "alma:presence";

/**
 * Marcar usuario como online
 */
export async function setUserOnline(userId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.hset(PRESENCE_KEY, { [userId]: Date.now().toString() });
  } catch (error) {
    redisLogger.error("[Redis] Erro ao marcar usuario online", { error });
  }
}

/**
 * Remover usuario (offline)
 */
export async function setUserOffline(userId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.hdel(PRESENCE_KEY, userId);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao marcar usuario offline", { error });
  }
}

/**
 * Obter usuarios online
 */
export async function getOnlineUsers(): Promise<string[]> {
  if (!redis) return [];

  try {
    const presence = await redis.hgetall<Record<string, string>>(PRESENCE_KEY);
    if (!presence) return [];

    const now = Date.now();
    const onlineUsers: string[] = [];

    // Filtrar usuarios que estao online (dentro do TTL)
    for (const [userId, timestamp] of Object.entries(presence)) {
      const lastSeen = parseInt(timestamp, 10);
      if (now - lastSeen < PRESENCE_TTL_SECONDS * 1000) {
        onlineUsers.push(userId);
      }
    }

    return onlineUsers;
  } catch (error) {
    redisLogger.error("[Redis] Erro ao obter usuarios online", { error });
    return [];
  }
}

/**
 * Verificar se usuario esta online
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const timestamp = await redis.hget<string>(PRESENCE_KEY, userId);
    if (!timestamp) return false;

    const lastSeen = parseInt(timestamp, 10);
    return Date.now() - lastSeen < PRESENCE_TTL_SECONDS * 1000;
  } catch (error) {
    redisLogger.error("[Redis] Erro ao verificar se usuario esta online", { error });
    return false;
  }
}

// ========== GENERIC CACHE ==========

/**
 * Cache generico - obter valor
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    return await redis.get<T>(`alma:cache:${key}`);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao obter cache", { error });
    return null;
  }
}

/**
 * Cache generico - definir valor
 */
export async function setCache<T>(key: string, value: T, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS): Promise<void> {
  if (!redis) return;

  try {
    await redis.setex(`alma:cache:${key}`, ttlSeconds, value);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao definir cache", { error });
  }
}

/**
 * Cache generico - deletar valor
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(`alma:cache:${key}`);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao deletar cache", { error });
  }
}

// Exportar instancia do Redis para uso direto se necessario
export { redis };
