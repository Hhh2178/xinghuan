import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const currentReleaseIndex = await readFile(new URL("../docs/logbooks/releases/current-release-index.md", import.meta.url), "utf8");
const opsReadme = await readFile(new URL("../ops/README.md", import.meta.url), "utf8");
const grayCurrent = await readFile(new URL("../ops/current/gray.md", import.meta.url), "utf8");
const productionCurrent = await readFile(new URL("../ops/current/production.md", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const memory = await readFile(new URL("../MEMORY.md", import.meta.url), "utf8");
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const prdReadme = await readFile(new URL("../docs/prd/README.md", import.meta.url), "utf8");
const memoryCurrentState = await readFile(new URL("../docs/memory/current-state.md", import.meta.url), "utf8");
const memoryRecentReleaseIndex = await readFile(new URL("../docs/memory/recent-release-index.md", import.meta.url), "utf8");

const grayVersion = extract(currentReleaseIndex, /### Gray[\s\S]*?- 版本：`([^`]+)`/);
const grayRelease = extract(currentReleaseIndex, /### Gray[\s\S]*?- release：`([^`]+)`/);
const grayOpsVersion = extract(opsReadme, /- Gray：[\s\S]*?- 版本：`([^`]+)`/);
const grayOpsRelease = extract(opsReadme, /- Gray：[\s\S]*?- release：`([^`]+)`/);
const grayCurrentVersion = extract(grayCurrent, /- 当前版本：`([^`]+)`/);
const grayCurrentRelease = extract(grayCurrent, /- 当前 release：`([^`]+)`/);
const productionVersion = extract(currentReleaseIndex, /### Production[\s\S]*?- 版本：`([^`]+)`/);
const productionRelease = extract(currentReleaseIndex, /### Production[\s\S]*?- release：`([^`]+)`/);
const productionOpsVersion = extract(opsReadme, /- Production：[\s\S]*?- 版本：`([^`]+)`/);
const productionOpsRelease = extract(opsReadme, /- Production：[\s\S]*?- release：`([^`]+)`/);
const productionCurrentVersion = extract(productionCurrent, /- 当前版本：`([^`]+)`/);
const productionCurrentRelease = extract(productionCurrent, /- 当前 release：`([^`]+)`/);

assert.equal(grayVersion, grayOpsVersion, "Gray release index and ops README version must match");
assert.equal(grayRelease, grayOpsRelease, "Gray release index and ops README must match");
assert.equal(grayVersion, grayCurrentVersion, "Gray release index and ops/current/gray version must match");
assert.equal(grayRelease, grayCurrentRelease, "Gray release index and ops/current/gray must match");
assert.equal(productionVersion, productionOpsVersion, "Production release index and ops README version must match");
assert.equal(productionRelease, productionOpsRelease, "Production release index and ops README must match");
assert.equal(productionVersion, productionCurrentVersion, "Production release index and ops/current/production version must match");
assert.equal(productionRelease, productionCurrentRelease, "Production release index and ops/current/production must match");

for (const [label, source] of [
  ["README.md", readme],
  ["MEMORY.md", memory],
  ["AGENTS.md", agents],
  ["docs/prd/README.md", prdReadme],
  ["docs/memory/current-state.md", memoryCurrentState],
  ["docs/memory/recent-release-index.md", memoryRecentReleaseIndex],
]) {
  assert.match(source, new RegExp(escapeRegExp(grayVersion)), `${label} must mention current gray version`);
  assert.match(source, new RegExp(escapeRegExp(productionVersion)), `${label} must mention current production version`);
  assert.match(source, new RegExp(escapeRegExp(grayRelease)), `${label} must mention current gray release`);
  assert.match(source, new RegExp(escapeRegExp(productionRelease)), `${label} must mention current production release`);
}

console.log(JSON.stringify({
  ok: true,
  grayVersion,
  grayRelease,
  productionVersion,
  productionRelease,
}, null, 2));

function extract(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) throw new Error(`PATTERN_NOT_FOUND:${pattern}`);
  return match[1];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
