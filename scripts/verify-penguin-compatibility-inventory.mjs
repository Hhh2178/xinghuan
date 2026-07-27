import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [inventory, boundary, app, canvas, registry, packageJson] = await Promise.all([
  read("docs/records/canvas/2026-07-27-penguin-compatibility-inventory.md"),
  read("apps/web/src/components/ErrorBoundary.tsx"),
  read("apps/web/src/App.tsx"),
  read("apps/web/src/components/Canvas.tsx"),
  read("apps/web/src/config/nodeRegistry.ts"),
  read("package.json"),
]);

for (const category of ["visible-copy", "compatibility-contract", "sample-content"]) assert.ok(inventory.includes("`" + category + "`"));
for (const contract of ["penguin:*", "penguin-portrait", "t8-penguin-canvas-export"]) assert.ok(inventory.includes(contract), `inventory missing ${contract}`);
assert.doesNotMatch(boundary, /🐧/u, "legacy boundary must not render a penguin fallback");
assert.doesNotMatch(boundary, /state\.error\?\.message/, "legacy boundary must not render raw error messages");
assert.match(app, /penguin:open-workflow-templates/, "App must retain event compatibility");
assert.match(canvas, /t8-penguin-canvas-export/, "Canvas must retain export compatibility");
assert.match(registry, /penguin-portrait/, "node registry must retain historical hidden node compatibility");
assert.match(packageJson, /verify:penguin-compatibility-inventory/, "package script must expose the inventory verifier");

console.log(JSON.stringify({ ok: true, contract: "penguin-compatibility-inventory" }, null, 2));
