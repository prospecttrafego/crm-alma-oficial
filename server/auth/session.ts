import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
import { SESSION_TTL_MS } from "../constants";

/**
 * Configura middleware de sessao com PostgreSQL
 */
export function getSession() {
  const sessionTtlSec = Math.ceil(SESSION_TTL_MS / 1000);
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: false,
    ttl: sessionTtlSec,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renova sessao a cada requisicao (evita expirar durante uso ativo)
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS,
      sameSite: "lax",
    },
  });
}
