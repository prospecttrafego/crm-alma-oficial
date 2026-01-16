import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const root = process.cwd();
const explicitFile = process.env.DOTENV_FILE || process.env.ENV_FILE;
const appEnv = process.env.APP_ENV || process.env.NODE_ENV;

let loadedEnvFile = false;

if (explicitFile) {
  const resolved = path.resolve(root, explicitFile);
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved });
    loadedEnvFile = true;
  }
} else if (appEnv) {
  const envFile = path.resolve(root, `.env.${appEnv}`);
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    loadedEnvFile = true;
  }
}

const baseEnv = path.resolve(root, ".env");
if (fs.existsSync(baseEnv)) {
  dotenv.config({ path: baseEnv });
} else if (!loadedEnvFile) {
  dotenv.config();
}

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const optionalString = () => z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = () => z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalBooleanString = () =>
  z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional());

const envSchema = z
  .object({
    NODE_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(["development", "production", "test"]).optional(),
    ),
    APP_ENV: optionalString(),
    PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1, "DATABASE_URL is required")),
    SESSION_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    ),
    APP_URL: optionalUrl(),
    APP_VERSION: optionalString(),
    DEFAULT_ORGANIZATION_ID: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    ALLOW_REGISTRATION: optionalBooleanString(),
    VITE_ALLOW_REGISTRATION: optionalBooleanString(),
    SUPABASE_URL: optionalUrl(),
    SUPABASE_ANON_KEY: optionalString(),
    SUPABASE_SERVICE_ROLE_KEY: optionalString(),
    OPENAI_API_KEY: optionalString(),
    UPSTASH_REDIS_REST_URL: optionalUrl(),
    UPSTASH_REDIS_REST_TOKEN: optionalString(),
    FIREBASE_PROJECT_ID: optionalString(),
    FIREBASE_PRIVATE_KEY: optionalString(),
    FIREBASE_CLIENT_EMAIL: optionalString(),
    VITE_FIREBASE_API_KEY: optionalString(),
    VITE_FIREBASE_AUTH_DOMAIN: optionalString(),
    VITE_FIREBASE_PROJECT_ID: optionalString(),
    VITE_FIREBASE_STORAGE_BUCKET: optionalString(),
    VITE_FIREBASE_MESSAGING_SENDER_ID: optionalString(),
    VITE_FIREBASE_APP_ID: optionalString(),
    VITE_FIREBASE_VAPID_KEY: optionalString(),
    EVOLUTION_API_URL: optionalUrl(),
    EVOLUTION_API_KEY: optionalString(),
    EVOLUTION_INSTANCE_PREFIX: optionalString(),
    EVOLUTION_WEBHOOK_SECRET: optionalString(),
    GOOGLE_CLIENT_ID: optionalString(),
    GOOGLE_CLIENT_SECRET: optionalString(),
    GOOGLE_REDIRECT_URI: optionalString(),
    GOOGLE_TOKEN_ENCRYPTION_KEY: optionalString(),
    SENTRY_DSN: optionalUrl(),
    DOTENV_FILE: optionalString(),
    ENV_FILE: optionalString(),
    DRIZZLE_MIGRATIONS_SCHEMA: optionalString(),
    DRIZZLE_MIGRATIONS_TABLE: optionalString(),
    DRIZZLE_BASELINE: optionalString(),
  })
  .superRefine((env, ctx) => {
    const isProd = env.NODE_ENV === "production";
    if (isProd && !env.APP_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_URL"],
        message: "APP_URL is required in production",
      });
    }

    // Infra oficial: Supabase (Storage) em producao
    if (isProd && !env.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL is required in production",
      });
    }
    if (isProd && !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "SUPABASE_SERVICE_ROLE_KEY is required in production",
      });
    }

    if ((env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY) && !env.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL is required when Supabase is configured",
      });
    }
    if ((env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY) && !env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "SUPABASE_SERVICE_ROLE_KEY is required when Supabase is configured",
      });
    }

    if ((env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN) && !env.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_URL"],
        message: "UPSTASH_REDIS_REST_URL is required when Redis is configured",
      });
    }
    if ((env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN) && !env.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_TOKEN"],
        message: "UPSTASH_REDIS_REST_TOKEN is required when Redis is configured",
      });
    }

    if ((env.EVOLUTION_API_URL || env.EVOLUTION_API_KEY) && !env.EVOLUTION_API_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EVOLUTION_API_URL"],
        message: "EVOLUTION_API_URL is required when Evolution is configured",
      });
    }
    if ((env.EVOLUTION_API_URL || env.EVOLUTION_API_KEY) && !env.EVOLUTION_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EVOLUTION_API_KEY"],
        message: "EVOLUTION_API_KEY is required when Evolution is configured",
      });
    }

    if ((env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET) && !env.GOOGLE_CLIENT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_CLIENT_ID"],
        message: "GOOGLE_CLIENT_ID is required when Google Calendar is configured",
      });
    }
    if ((env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET) && !env.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "GOOGLE_CLIENT_SECRET is required when Google Calendar is configured",
      });
    }

    const firebaseConfigured = env.FIREBASE_PROJECT_ID || env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_PRIVATE_KEY;
    if (firebaseConfigured && !env.FIREBASE_PROJECT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FIREBASE_PROJECT_ID"],
        message: "FIREBASE_PROJECT_ID is required when Firebase is configured",
      });
    }
    if (firebaseConfigured && !env.FIREBASE_CLIENT_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FIREBASE_CLIENT_EMAIL"],
        message: "FIREBASE_CLIENT_EMAIL is required when Firebase is configured",
      });
    }
    if (firebaseConfigured && !env.FIREBASE_PRIVATE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FIREBASE_PRIVATE_KEY"],
        message: "FIREBASE_PRIVATE_KEY is required when Firebase is configured",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
