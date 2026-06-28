import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const viteConfig = readFileSync(join(root, "apps", "web", "vite.config.ts"), "utf8");
const expectedVersion = String(rootPackage.version || "").trim();

assert.ok(expectedVersion, "root package version should not be empty");
assert.match(viteConfig, /readFileSync\(path\.resolve\(__dirname, "\.\.\/\.\.\/package\.json"\), "utf8"\)/);
assert.match(viteConfig, /const appVersion = String\(rootPackageJson\.version \|\| ""\)\.trim\(\) \|\| "0\.0\.0"/);
assert.match(viteConfig, /__APP_VERSION__:\s*JSON\.stringify\(appVersion\)/);
assert.ok(!viteConfig.includes('__APP_VERSION__: JSON.stringify("0.5.6")'));

console.log(JSON.stringify({ ok: true, expectedVersion }, null, 2));
