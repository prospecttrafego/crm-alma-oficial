/**
 * Database Seed Script
 * Creates initial organization, admin user, and default pipeline
 *
 * Usage: npm run db:seed
 *
 * Environment variables:
 * - DATABASE_URL: PostgreSQL connection string (required)
 * - SEED_ADMIN_EMAIL: Admin email (default: admin@example.com)
 * - SEED_ADMIN_PASSWORD: Admin password (default: Admin123!)
 * - SEED_ORG_NAME: Organization name (default: Alma Digital)
 */

import "../server/env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  organizations,
  users,
  pipelines,
  pipelineStages,
} from "../shared/schema";

const { Pool } = pg;

const BCRYPT_ROUNDS = 12;

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não configurada");
    process.exit(1);
  }

  console.log("🌱 Iniciando seed do banco de dados...\n");

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // Configuration from environment or defaults
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
    const orgName = process.env.SEED_ORG_NAME || "Alma Digital";

    // 1. Check/Create Organization
    console.log("📦 Verificando organização...");
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .limit(1);

    let orgId: number;

    if (existingOrg) {
      console.log(`   ✓ Organização existente: ${existingOrg.name} (ID: ${existingOrg.id})`);
      orgId = existingOrg.id;
    } else {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: orgName,
          domain: orgName.toLowerCase().replace(/\s+/g, "-"),
        })
        .returning();
      console.log(`   ✓ Organização criada: ${newOrg.name} (ID: ${newOrg.id})`);
      orgId = newOrg.id;
    }

    // 2. Check/Create Admin User
    console.log("\n👤 Verificando usuário admin...");
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail.toLowerCase()))
      .limit(1);

    if (existingAdmin) {
      console.log(`   ✓ Admin existente: ${existingAdmin.email}`);
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

      const [newAdmin] = await db
        .insert(users)
        .values({
          email: adminEmail.toLowerCase(),
          passwordHash,
          firstName: "Admin",
          lastName: "Sistema",
          role: "admin",
          organizationId: orgId,
        })
        .returning();

      console.log(`   ✓ Admin criado: ${newAdmin.email}`);
      console.log(`   ⚠️  Senha inicial: ${adminPassword}`);
      console.log(`   ⚠️  IMPORTANTE: Altere a senha após o primeiro login!`);
    }

    // 3. Check/Create Default Pipeline
    console.log("\n📊 Verificando pipeline padrão...");
    const [existingPipeline] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.organizationId, orgId))
      .limit(1);

    if (existingPipeline) {
      console.log(`   ✓ Pipeline existente: ${existingPipeline.name}`);
    } else {
      const [newPipeline] = await db
        .insert(pipelines)
        .values({
          name: "Pipeline de Vendas",
          organizationId: orgId,
          isDefault: true,
        })
        .returning();

      // Create default stages
      const defaultStages = [
        { name: "Novo Lead", order: 0, color: "#6B7280" },
        { name: "Qualificado", order: 1, color: "#3B82F6" },
        { name: "Proposta", order: 2, color: "#F59E0B" },
        { name: "Negociação", order: 3, color: "#8B5CF6" },
        { name: "Fechado (Ganho)", order: 4, color: "#10B981", isWon: true },
        { name: "Fechado (Perdido)", order: 5, color: "#EF4444", isLost: true },
      ];

      await db.insert(pipelineStages).values(
        defaultStages.map((stage) => ({
          ...stage,
          pipelineId: newPipeline.id,
        }))
      );

      console.log(`   ✓ Pipeline criado: ${newPipeline.name} com ${defaultStages.length} estágios`);
    }

    // 4. Summary
    console.log("\n" + "=".repeat(50));
    console.log("✅ Seed concluído com sucesso!\n");

    const [userCount] = await db.select({ count: count() }).from(users);
    const [pipelineCount] = await db.select({ count: count() }).from(pipelines);

    console.log("📈 Resumo do banco:");
    console.log(`   - Organizações: 1`);
    console.log(`   - Usuários: ${userCount.count}`);
    console.log(`   - Pipelines: ${pipelineCount.count}`);

    console.log("\n🔧 Próximos passos:");
    console.log("   1. Configure DEFAULT_ORGANIZATION_ID=" + orgId + " no .env");
    console.log("   2. Inicie a aplicação com npm run dev");
    console.log("   3. Faça login com as credenciais do admin");

  } catch (error) {
    console.error("\n❌ Erro durante o seed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
