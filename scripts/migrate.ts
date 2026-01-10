/**
 * Runtime migrations runner (Drizzle ORM migrator)
 *
 * This is intended for production deploys where you want to apply SQL migrations
 * without requiring drizzle-kit/tsx inside the running container.
 *
 * Usage (after build):
 *   node dist/migrate.cjs
 *   node dist/migrate.cjs --baseline   # mark existing schema as migrated (one-time)
 */

import "dotenv/config";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { db, pool } from "../server/db";

function quoteIdentifier(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

async function baselineMigrations({
  migrationsFolder,
  migrationsSchema,
  migrationsTable,
}: {
  migrationsFolder: string;
  migrationsSchema: string;
  migrationsTable: string;
}) {
  const publicTables = await pool.query<{
    count: string;
  }>(`SELECT COUNT(*)::text as count FROM pg_tables WHERE schemaname = 'public'`);
  const publicTableCount = Number(publicTables.rows[0]?.count ?? 0);
  if (!Number.isFinite(publicTableCount) || publicTableCount === 0) {
    throw new Error(
      "Baseline requested, but database appears empty (no tables in public schema). Run normal migrations instead.",
    );
  }

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(migrationsSchema)}`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(migrationsSchema)}.${quoteIdentifier(migrationsTable)} (\n` +
      `  id SERIAL PRIMARY KEY,\n` +
      `  hash text NOT NULL,\n` +
      `  created_at bigint\n` +
      `)`,
  );

  const existing = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ${quoteIdentifier(migrationsSchema)}.${quoteIdentifier(migrationsTable)}`,
  );
  const existingCount = Number(existing.rows[0]?.count ?? 0);
  if (existingCount > 0) {
    console.log(
      `[DB] Baseline skipped: migrations table already has ${existingCount} row(s).`,
    );
    return;
  }

  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) {
    console.log("[DB] No migrations found; nothing to baseline.");
    return;
  }

  await pool.query("BEGIN");
  try {
    for (const migrationMeta of migrations) {
      await pool.query(
        `INSERT INTO ${quoteIdentifier(migrationsSchema)}.${quoteIdentifier(migrationsTable)} ("hash", "created_at") VALUES ($1, $2)`,
        [migrationMeta.hash, migrationMeta.folderMillis],
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => undefined);
    throw error;
  }

  console.log(`[DB] Baseline completed: marked ${migrations.length} migration(s) as applied.`);
}

async function main() {
  const migrationsFolder = path.resolve(process.cwd(), "migrations");
  console.log(`[DB] Running migrations from: ${migrationsFolder}`);

  const migrationsSchema = process.env.DRIZZLE_MIGRATIONS_SCHEMA?.trim() || "drizzle";
  const migrationsTable = process.env.DRIZZLE_MIGRATIONS_TABLE?.trim() || "__drizzle_migrations";

  const baselineRequested =
    process.argv.includes("--baseline") ||
    process.env.DRIZZLE_BASELINE === "true" ||
    process.env.DRIZZLE_BASELINE === "1";

  if (baselineRequested) {
    console.log("[DB] Baseline mode enabled (will not execute SQL migrations).");
    await baselineMigrations({ migrationsFolder, migrationsSchema, migrationsTable });
    return;
  }

  await migrate(db, { migrationsFolder, migrationsSchema, migrationsTable });

  console.log("[DB] Migrations completed");
}

main()
  .catch((error) => {
    console.error("[DB] Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
