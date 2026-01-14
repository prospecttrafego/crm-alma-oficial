/**
 * Servico Redis (Upstash) para cache, contadores e rate limiting
 */
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { z } from "zod";
import type { Message } from "@shared/schema";
import { createServiceLogger } from "./logger";
import {
  LOGIN_RATE_LIMIT_MAX,
  MESSAGES_CACHE_TTL_SECONDS,
  MAX_CACHED_MESSAGES,
  PRESENCE_TTL_SECONDS,
  DEFAULT_CACHE_TTL_SECONDS,
} from "./constants";

// Cache version - increment when Message schema changes to auto-invalidate old cache
const CACHE_VERSION = "v1";

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

// ========== CACHE DE MENSAGENS ==========

// Versioned cache key to auto-invalidate on schema changes
const MESSAGES_CACHE_KEY = (conversationId: number) => `alma:messages:${CACHE_VERSION}:${conversationId}`;

// Zod schema for validating cached messages (minimal validation for performance)
const cachedMessageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  content: z.string(),
  createdAt: z.string().or(z.date()).nullable(),
}).passthrough();

const cachedMessagesArraySchema = z.array(cachedMessageSchema);

/**
 * Obter mensagens do cache with schema validation
 * Returns null if cache is invalid or schema mismatch (auto-heals on next write)
 */
export async function getCachedMessages(conversationId: number): Promise<Message[] | null> {
  if (!redis) return null;

  try {
    const cached = await redis.get<unknown>(MESSAGES_CACHE_KEY(conversationId));
    if (!cached) return null;

    // Validate cached data against schema
    const result = cachedMessagesArraySchema.safeParse(cached);
    if (!result.success) {
      redisLogger.warn("[Redis] Cache schema mismatch, invalidating", {
        conversationId,
        error: result.error.message,
      });
      // Invalidate stale cache
      await redis.del(MESSAGES_CACHE_KEY(conversationId));
      return null;
    }

    return cached as Message[];
  } catch (error) {
    redisLogger.error("[Redis] Erro ao obter cache de mensagens", { error });
    return null;
  }
}

/**
 * Salvar mensagens no cache (ultimas 20)
 */
export async function setCachedMessages(conversationId: number, messages: Message[]): Promise<void> {
  if (!redis) return;

  try {
    // Cachear apenas as ultimas 20 mensagens
    const toCache = messages.slice(-MAX_CACHED_MESSAGES);
    await redis.setex(MESSAGES_CACHE_KEY(conversationId), MESSAGES_CACHE_TTL_SECONDS, toCache);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao salvar cache de mensagens", { error });
  }
}

/**
 * Adicionar nova mensagem ao cache existente
 */
export async function addMessageToCache(conversationId: number, message: Message): Promise<void> {
  if (!redis) return;

  try {
    const cached = await getCachedMessages(conversationId);
    if (cached) {
      const updated = [...cached, message].slice(-MAX_CACHED_MESSAGES);
      await setCachedMessages(conversationId, updated);
    }
  } catch (error) {
    redisLogger.error("[Redis] Erro ao adicionar mensagem ao cache", { error });
  }
}

/**
 * Invalidar cache de mensagens
 */
export async function invalidateMessagesCache(conversationId: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(MESSAGES_CACHE_KEY(conversationId));
  } catch (error) {
    redisLogger.error("[Redis] Erro ao invalidar cache de mensagens", { error });
  }
}

// ========== CONTADORES DE MENSAGENS NAO LIDAS ==========

const UNREAD_COUNT_KEY = (conversationId: number) => `alma:unread:${conversationId}`;
const UNREAD_COUNT_TTL = 86400; // 24 horas

/**
 * Obter contador de nao lidas do cache
 */
export async function getUnreadCount(conversationId: number): Promise<number | null> {
  if (!redis) return null;

  try {
    const count = await redis.get<number>(UNREAD_COUNT_KEY(conversationId));
    return count;
  } catch (error) {
    redisLogger.error("[Redis] Erro ao obter contador de nao lidas", { error });
    return null;
  }
}

/**
 * Definir contador de nao lidas
 */
export async function setUnreadCount(conversationId: number, count: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.setex(UNREAD_COUNT_KEY(conversationId), UNREAD_COUNT_TTL, count);
  } catch (error) {
    redisLogger.error("[Redis] Erro ao definir contador de nao lidas", { error });
  }
}

/**
 * Incrementar contador de nao lidas
 */
export async function incrementUnreadCount(conversationId: number): Promise<number> {
  if (!redis) return 0;

  try {
    const key = UNREAD_COUNT_KEY(conversationId);
    const newCount = await redis.incr(key);
    await redis.expire(key, UNREAD_COUNT_TTL);
    return newCount;
  } catch (error) {
    redisLogger.error("[Redis] Erro ao incrementar contador de nao lidas", { error });
    return 0;
  }
}

/**
 * Resetar contador de nao lidas (quando usuario le mensagens)
 */
export async function resetUnreadCount(conversationId: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(UNREAD_COUNT_KEY(conversationId));
  } catch (error) {
    redisLogger.error("[Redis] Erro ao resetar contador de nao lidas", { error });
  }
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
