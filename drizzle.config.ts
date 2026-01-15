import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // dbCredentials only needed for migrate/push/pull commands, not for generate
  ...(process.env.DATABASE_URL && {
    dbCredentials: {
      url: process.env.DATABASE_URL,
    },
  }),
});
