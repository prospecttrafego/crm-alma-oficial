/* global process, console */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IGNORE_FILES = new Set([
  // This file contains the patterns list by design.
  "scripts/check-debug-logs.js",
]);
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "storybook-static",
  ".git",
  ".cursor",
]);

const PATTERNS = [
  "127.0.0.1:7242",
  "#region agent log",
  "debug-session",
];

function shouldScanFile(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  if (IGNORE_FILES.has(relativePath)) return false;
  const ext = path.extname(filePath);
  return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md"].includes(ext);
}

async function walk(dir, results = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), results);
    } else if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      if (shouldScanFile(fullPath)) results.push(fullPath);
    }
  }
  return results;
}

function findMatches(content) {
  return PATTERNS.filter((pattern) => content.includes(pattern));
}

const files = await walk(ROOT);
const hits = [];

for (const file of files) {
  const content = await fs.promises.readFile(file, "utf8");
  const matches = findMatches(content);
  if (matches.length > 0) {
    hits.push({ file, matches });
  }
}

if (hits.length > 0) {
  console.error("[Guardrails] Debug/malicious markers found:");
  for (const hit of hits) {
    console.error(`- ${path.relative(ROOT, hit.file)}: ${hit.matches.join(", ")}`);
  }
  process.exit(1);
}

console.log("[Guardrails] OK");
