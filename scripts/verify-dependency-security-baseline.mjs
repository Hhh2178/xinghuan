import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const api = JSON.parse(await readFile(new URL("../apps/api/package.json", import.meta.url), "utf8"));
const web = JSON.parse(await readFile(new URL("../apps/web/package.json", import.meta.url), "utf8"));
const admin = JSON.parse(await readFile(new URL("../apps/admin/package.json", import.meta.url), "utf8"));
const shared = JSON.parse(await readFile(new URL("../packages/shared/package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

assert.match(api.dependencies?.sharp || "", /0\.35\./, "API must require sharp 0.35 or newer");
assert.match(shared.dependencies?.sharp || "", /0\.35\./, "Shared image preprocessing must require sharp 0.35 or newer");
for (const [label, value] of [
  ["root", root.dependencies?.vite],
  ["web", web.devDependencies?.vite],
  ["admin", admin.devDependencies?.vite],
]) {
  assert.match(value || "", /8\./, `${label} must require Vite 8 or newer`);
}

const resolved = Object.entries(lock.packages || {})
  .filter(([, row]) => row && typeof row === "object" && typeof row.version === "string")
  .map(([path, row]) => ({ path, version: row.version }));

assert.ok(resolved.some((item) => item.path.endsWith("node_modules/sharp") && atLeast(item.version, "0.35.0")), "lockfile must resolve sharp >= 0.35.0");
for (const item of resolved.filter((entry) => entry.path.endsWith("node_modules/esbuild"))) {
  assert.ok(atLeast(item.version, "0.28.1"), `esbuild security regression at ${item.path}: ${item.version}`);
}
for (const item of resolved.filter((entry) => entry.path.endsWith("node_modules/brace-expansion"))) {
  if (major(item.version) === 1) {
    assert.ok(atLeast(item.version, "1.1.16"), `brace-expansion security regression at ${item.path}: ${item.version}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  sharp: resolved.filter((item) => item.path.endsWith("node_modules/sharp")).map((item) => item.version),
  esbuild: [...new Set(resolved.filter((item) => item.path.endsWith("node_modules/esbuild")).map((item) => item.version))],
  braceExpansion: [...new Set(resolved.filter((item) => item.path.endsWith("node_modules/brace-expansion")).map((item) => item.version))],
}, null, 2));

function major(version) {
  return Number.parseInt(String(version).split(".")[0] || "0", 10);
}

function atLeast(actual, minimum) {
  const left = String(actual).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = String(minimum).split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return true;
    if ((left[index] || 0) < (right[index] || 0)) return false;
  }
  return true;
}
