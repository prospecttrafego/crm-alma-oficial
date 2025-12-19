/**
 * Servico Redis (Upstash) para cache, contadores e rate limiting
 */
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import type { Message } from "@shared/schema";

// Inicializar cliente Redis apenas se as variaveis de ambiente estiverem configuradas
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

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

  console.log("[Redis] Conectado ao Upstash");
} else {
  console.log("[Redis] Variaveis de ambiente nao configuradas, funcionando sem cache");
}

// ========== CACHE DE MENSAGENS ==========

const MESSAGES_CACHE_KEY = (conversationId: number) => `alma:messages:${conversationId}`;
const MESSAGES_CACHE_TTL = 300; // 5 minutos
const MAX_CACHED_MESSAGES = 20;

/**
 * Obter mensagens do cache
 */
export async function getCachedMessages(conversationId: number): Promise<Message[] | null> {
  if (!redis) return null;

  try {
    const cached = await redis.get<Message[]>(MESSAGES_CACHE_KEY(conversationId));
    return cached;
  } catch (error) {
    console.error("[Redis] Erro ao obter cache de mensagens:", error);
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
    await redis.setex(MESSAGES_CACHE_KEY(conversationId), MESSAGES_CACHE_TTL, toCache);
  } catch (error) {
    console.error("[Redis] Erro ao salvar cache de mensagens:", error);
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
    console.error("[Redis] Erro ao adicionar mensagem ao cache:", error);
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
    console.error("[Redis] Erro ao invalidar cache de mensagens:", error);
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
    console.error("[Redis] Erro ao obter contador de nao lidas:", error);
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
    console.error("[Redis] Erro ao definir contador de nao lidas:", error);
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
    console.error("[Redis] Erro ao incrementar contador de nao lidas:", error);
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
    console.error("[Redis] Erro ao resetar contador de nao lidas:", error);
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
    console.error("[Redis] Erro ao verificar rate limit:", error);
    // Em caso de erro, permitir a requisicao
    return { success: true, limit: 100, remaining: 100, reset: 0 };
  }
}

// ========== PRESENCE (USUARIOS ONLINE) ==========

const PRESENCE_KEY = "alma:presence";
const PRESENCE_TTL = 60; // 1 minuto

/**
 * Marcar usuario como online
 */
export async function setUserOnline(userId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.hset(PRESENCE_KEY, { [userId]: Date.now().toString() });
  } catch (error) {
    console.error("[Redis] Erro ao marcar usuario online:", error);
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
    console.error("[Redis] Erro ao marcar usuario offline:", error);
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
      if (now - lastSeen < PRESENCE_TTL * 1000) {
        onlineUsers.push(userId);
      }
    }

    return onlineUsers;
  } catch (error) {
    console.error("[Redis] Erro ao obter usuarios online:", error);
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
    return Date.now() - lastSeen < PRESENCE_TTL * 1000;
  } catch (error) {
    console.error("[Redis] Erro ao verificar se usuario esta online:", error);
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
    console.error("[Redis] Erro ao obter cache:", error);
    return null;
  }
}

/**
 * Cache generico - definir valor
 */
export async function setCache<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  if (!redis) return;

  try {
    await redis.setex(`alma:cache:${key}`, ttlSeconds, value);
  } catch (error) {
    console.error("[Redis] Erro ao definir cache:", error);
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
    console.error("[Redis] Erro ao deletar cache:", error);
  }
}

// Exportar instancia do Redis para uso direto se necessario
export { redis };
