import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageJsonPath = join(root, "package.json");
const source = readFileSync(packageJsonPath, "utf8");

assert.match(
  source,
  /"verify:environment-sync-smoke"\s*:\s*"node scripts\/verify-environment-sync-smoke\.mjs"/,
  "package.json should expose verify:environment-sync-smoke",
);

console.log(JSON.stringify({ ok: true, verifiedFile: packageJsonPath }, null, 2));
