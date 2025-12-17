/**
 * Script de migracao de usuarios do Replit Auth para autenticacao local
 *
 * Este script gera senhas temporarias para usuarios existentes que foram
 * criados via Replit Auth e nao possuem passwordHash.
 *
 * Uso: npx tsx scripts/migrate-users.ts
 *
 * IMPORTANTE: Apos executar, envie as senhas temporarias para os usuarios
 * e solicite que alterem suas senhas.
 */
import bcrypt from "bcryptjs";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq, isNull } from "drizzle-orm";

const BCRYPT_ROUNDS = 12;

async function migrateUsers() {
  console.log("=".repeat(60));
  console.log("Migracao de Usuarios - Replit Auth para Auth Local");
  console.log("=".repeat(60));
  console.log("");

  try {
    // Buscar usuarios sem passwordHash
    const usersWithoutPassword = await db
      .select()
      .from(users)
      .where(isNull(users.passwordHash));

    if (usersWithoutPassword.length === 0) {
      console.log("Nenhum usuario para migrar.");
      console.log("Todos os usuarios ja possuem senha configurada.");
      return;
    }

    console.log(`Encontrados ${usersWithoutPassword.length} usuario(s) para migrar`);
    console.log("");
    console.log("Gerando senhas temporarias...");
    console.log("-".repeat(60));

    const migratedUsers: Array<{ email: string; tempPassword: string }> = [];

    for (const user of usersWithoutPassword) {
      // Gerar senha temporaria baseada no ID do usuario
      const tempPassword = `temp_${user.id.substring(0, 8)}`;
      const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, user.id));

      migratedUsers.push({
        email: user.email || "(sem email)",
        tempPassword,
      });

      console.log(`Usuario migrado: ${user.email || user.id}`);
    }

    console.log("-".repeat(60));
    console.log("");
    console.log("SENHAS TEMPORARIAS GERADAS:");
    console.log("(Guarde estas informacoes em local seguro)");
    console.log("");

    migratedUsers.forEach(({ email, tempPassword }) => {
      console.log(`  Email: ${email}`);
      console.log(`  Senha: ${tempPassword}`);
      console.log("");
    });

    console.log("=".repeat(60));
    console.log("MIGRACAO CONCLUIDA COM SUCESSO!");
    console.log("=".repeat(60));
    console.log("");
    console.log("PROXIMOS PASSOS:");
    console.log("1. Envie as senhas temporarias para cada usuario");
    console.log("2. Solicite que os usuarios alterem suas senhas");
    console.log("3. Considere implementar funcionalidade de 'esqueci minha senha'");
    console.log("");

  } catch (error) {
    console.error("ERRO durante a migracao:", error);
    process.exit(1);
  }
}

migrateUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro fatal:", error);
    process.exit(1);
  });
