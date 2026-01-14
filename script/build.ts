import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// Dependencias do servidor para bundlar e reduzir chamadas openat(2)
// o que ajuda no tempo de cold start
const allowlist = [
  "@supabase/supabase-js",
  "bcryptjs",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "ws",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));

  // IMPORTANT (production): only treat runtime deps as externals.
  // devDependencies must not be required at runtime.
  const runtimeDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
  ];
  const externals = runtimeDeps.filter((dep) => !allowlist.includes(dep));

  const commonEsbuildOptions = {
    platform: "node" as const,
    bundle: true,
    format: "cjs" as const,
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    sourcemap: true,
    external: externals,
    logLevel: "info" as const,
  };

  await esbuild({
    entryPoints: ["server/index.ts"],
    outfile: "dist/index.cjs",
    ...commonEsbuildOptions,
  });

  console.log("building operational scripts...");
  await Promise.all([
    esbuild({
      entryPoints: ["scripts/seed.ts"],
      outfile: "dist/seed.cjs",
      ...commonEsbuildOptions,
    }),
    esbuild({
      entryPoints: ["scripts/migrate.ts"],
      outfile: "dist/migrate.cjs",
      ...commonEsbuildOptions,
    }),
  ]);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
