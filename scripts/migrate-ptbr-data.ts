/**
 * Script para ajustar textos em ingles nos dados existentes.
 *
 * Uso: npx tsx scripts/migrate-ptbr-data.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { activities, deals } from "../shared/schema";

const dealTitleUpdates = [
  { from: "Projeto de Website Institucional", to: "Projeto de Site Institucional" },
  { from: "App Mobile iOS/Android", to: "Aplicativo m\u00f3vel iOS/Android" },
  { from: "E-commerce Completo", to: "Com\u00e9rcio eletr\u00f4nico completo" },
  { from: "Landing Page para Lancamento", to: "P\u00e1gina de captura para lan\u00e7amento" },
];

const activityTitleUpdates = [
  { from: "Follow-up", to: "Acompanhamento" },
];

async function migratePtBrData() {
  console.log("=".repeat(60));
  console.log("Migracao de textos em PT-BR");
  console.log("=".repeat(60));
  console.log("");

  try {
    let updatedDeals = 0;
    console.log("Atualizando titulos de negocios...");

    for (const update of dealTitleUpdates) {
      const result = await db
        .update(deals)
        .set({ title: update.to })
        .where(eq(deals.title, update.from))
        .returning({ id: deals.id });

      if (result.length > 0) {
        console.log(`  OK: ${update.from} -> ${update.to} (${result.length})`);
        updatedDeals += result.length;
      } else {
        console.log(`  SKIP: ${update.from} (0)`);
      }
    }

    let updatedActivities = 0;
    console.log("");
    console.log("Atualizando titulos de atividades...");

    for (const update of activityTitleUpdates) {
      const result = await db
        .update(activities)
        .set({ title: update.to })
        .where(eq(activities.title, update.from))
        .returning({ id: activities.id });

      if (result.length > 0) {
        console.log(`  OK: ${update.from} -> ${update.to} (${result.length})`);
        updatedActivities += result.length;
      } else {
        console.log(`  SKIP: ${update.from} (0)`);
      }
    }

    console.log("");
    console.log("Resumo:");
    console.log(`  - Negocios atualizados: ${updatedDeals}`);
    console.log(`  - Atividades atualizadas: ${updatedActivities}`);
    console.log("");
    console.log("Migracao concluida.");
  } catch (error) {
    console.error("Erro durante a migracao:", error);
    process.exit(1);
  }
}

migratePtBrData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro fatal:", error);
    process.exit(1);
  });
