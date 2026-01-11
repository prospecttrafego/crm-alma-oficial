import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

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
