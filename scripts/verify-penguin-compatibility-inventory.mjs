import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [inventory, boundary, app, canvas, registry, templates, packageJson, webSource] = await Promise.all([
  read("docs/records/canvas/2026-07-27-penguin-compatibility-inventory.md"),
  read("apps/web/src/components/ErrorBoundary.tsx"),
  read("apps/web/src/App.tsx"),
  read("apps/web/src/components/Canvas.tsx"),
  read("apps/web/src/config/nodeRegistry.ts"),
  read("apps/web/src/config/canvasTemplates.ts"),
  read("package.json"),
  readTree(new URL("../apps/web/src/", import.meta.url)),
]);

for (const category of ["visible-copy", "compatibility-contract", "dead-code"]) assert.ok(inventory.includes("`" + category + "`"));
for (const contract of ["penguin:*", "penguin-portrait", "t8-penguin-canvas-export", "t8-penguin-canvas-settings"]) assert.ok(inventory.includes(contract), `inventory missing ${contract}`);
for (const eventName of sourceMatches(webSource, /penguin:[a-z0-9-]+/g)) {
  assert.ok(inventory.includes(`\`${eventName}\``), `inventory missing event ${eventName}`);
}
for (const nodeType of hiddenNodeTypes(registry)) {
  assert.ok(inventory.includes(`\`${nodeType}\``), `inventory missing hidden node ${nodeType}`);
}
for (const identifier of sourceMatches(webSource, /t8-penguin-canvas(?:-[a-z]+)?/gi)) {
  assert.ok(inventory.toLowerCase().includes(identifier.toLowerCase()), `inventory missing identifier ${identifier}`);
}
for (const templateId of ["tpl-text-to-image", "tpl-llm-rewrite", "tpl-suno"]) {
  assert.match(templates, new RegExp(`id: '${templateId}'`), `template source missing ${templateId}`);
  assert.ok(inventory.includes(`\`${templateId}\``), `inventory missing template ${templateId}`);
}
assert.doesNotMatch(boundary, /🐧/u, "legacy boundary must not render a penguin fallback");
assert.doesNotMatch(boundary, /state\.error\?\.message/, "legacy boundary must not render raw error messages");
assert.match(app, /penguin:open-workflow-templates/, "App must retain event compatibility");
assert.match(canvas, /t8-penguin-canvas-export/, "Canvas must retain export compatibility");
assert.match(registry, /penguin-portrait/, "node registry must retain historical hidden node compatibility");
assert.match(packageJson, /verify:penguin-compatibility-inventory/, "package script must expose the inventory verifier");

console.log(JSON.stringify({ ok: true, contract: "penguin-compatibility-inventory" }, null, 2));

function sourceMatches(source, pattern) {
  return [...new Set(Array.from(source.matchAll(pattern), (match) => match[0]))].sort();
}

function hiddenNodeTypes(source) {
  return sourceMatches(source, /type:\s*'([^']+)'[^\n]*hidden:\s*true/g)
    .map((match) => /type:\s*'([^']+)'/.exec(match)?.[1])
    .filter(Boolean);
}

async function readTree(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = new URL(entry.name, directoryUrl);
    if (entry.isDirectory()) return readTree(new URL(`${entry.name}/`, directoryUrl));
    return /\.(?:ts|tsx)$/.test(entry.name) ? readFile(target, "utf8") : "";
  }));
  return files.flat().join("\n");
}
