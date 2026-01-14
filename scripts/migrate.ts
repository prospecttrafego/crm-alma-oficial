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

import "../server/env";
import path from "node:path";
import fs from "node:fs";
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

  // Verificar se pasta de migrações existe
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }

  // Listar conteúdo da pasta
  const files = fs.readdirSync(migrationsFolder);
  console.log(`[DB] Files in migrations folder: ${files.join(", ")}`);

  // Verificar se meta folder existe
  const metaFolder = path.join(migrationsFolder, "meta");
  if (!fs.existsSync(metaFolder)) {
    throw new Error(`Meta folder not found: ${metaFolder}`);
  }

  const metaFiles = fs.readdirSync(metaFolder);
  console.log(`[DB] Files in meta folder: ${metaFiles.join(", ")}`);

  // Ler journal
  const journalPath = path.join(metaFolder, "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Journal file not found: ${journalPath}`);
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  console.log(`[DB] Journal entries: ${journal.entries.length}`);
  for (const entry of journal.entries) {
    console.log(`[DB]   - ${entry.tag} (idx: ${entry.idx})`);
  }

  // Verificar se arquivos SQL existem
  for (const entry of journal.entries) {
    const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL file not found: ${sqlFile}`);
    }
    const sqlContent = fs.readFileSync(sqlFile, "utf-8");
    console.log(`[DB] SQL file ${entry.tag}.sql: ${sqlContent.length} bytes, ${sqlContent.split("CREATE TABLE").length - 1} CREATE TABLE statements`);
  }

  const migrationsSchema = process.env.DRIZZLE_MIGRATIONS_SCHEMA?.trim() || "drizzle";
  const migrationsTable = process.env.DRIZZLE_MIGRATIONS_TABLE?.trim() || "__drizzle_migrations";

  // Verificar estado atual do banco
  try {
    const schemaExists = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
      [migrationsSchema]
    );
    console.log(`[DB] Schema '${migrationsSchema}' exists: ${schemaExists.rows[0].exists}`);

    if (schemaExists.rows[0].exists) {
      const tableExists = await pool.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)`,
        [migrationsSchema, migrationsTable]
      );
      console.log(`[DB] Table '${migrationsSchema}.${migrationsTable}' exists: ${tableExists.rows[0].exists}`);

      if (tableExists.rows[0].exists) {
        const appliedMigrations = await pool.query(
          `SELECT hash, created_at FROM ${quoteIdentifier(migrationsSchema)}.${quoteIdentifier(migrationsTable)} ORDER BY created_at`
        );
        console.log(`[DB] Applied migrations in DB: ${appliedMigrations.rowCount}`);
        for (const row of appliedMigrations.rows) {
          console.log(`[DB]   - hash: ${row.hash}, created_at: ${row.created_at}`);
        }
      }
    }

    // Verificar tabelas no schema public
    const publicTables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const publicTableCount = publicTables.rowCount ?? 0;
    console.log(`[DB] Tables in public schema: ${publicTableCount}`);
    if (publicTableCount > 0) {
      console.log(`[DB]   ${publicTables.rows.map((r: { table_name: string }) => r.table_name).join(", ")}`);
    }
  } catch (err) {
    console.log(`[DB] Error checking database state: ${err}`);
  }

  const baselineRequested =
    process.argv.includes("--baseline") ||
    process.env.DRIZZLE_BASELINE === "true" ||
    process.env.DRIZZLE_BASELINE === "1";

  if (baselineRequested) {
    console.log("[DB] Baseline mode enabled (will not execute SQL migrations).");
    await baselineMigrations({ migrationsFolder, migrationsSchema, migrationsTable });
    return;
  }

  console.log("[DB] Running drizzle migrate...");
  await migrate(db, { migrationsFolder, migrationsSchema, migrationsTable });

  // Verificar tabelas após migração
  const publicTablesAfter = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  const publicTableCountAfter = publicTablesAfter.rowCount ?? 0;
  console.log(`[DB] Tables in public schema AFTER migration: ${publicTableCountAfter}`);
  if (publicTableCountAfter > 0) {
    console.log(`[DB]   ${publicTablesAfter.rows.map((r: { table_name: string }) => r.table_name).join(", ")}`);
  }

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
