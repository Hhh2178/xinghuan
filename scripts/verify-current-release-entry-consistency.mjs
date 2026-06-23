import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const currentReleaseIndex = await readFile(new URL("../docs/logbooks/releases/current-release-index.md", import.meta.url), "utf8");
const opsReadme = await readFile(new URL("../ops/README.md", import.meta.url), "utf8");
const grayCurrent = await readFile(new URL("../ops/current/gray.md", import.meta.url), "utf8");
const productionCurrent = await readFile(new URL("../ops/current/production.md", import.meta.url), "utf8");

const grayRelease = extract(currentReleaseIndex, /### Gray[\s\S]*?- release：`([^`]+)`/);
const grayOpsRelease = extract(opsReadme, /- Gray：[\s\S]*?- release：`([^`]+)`/);
const grayCurrentRelease = extract(grayCurrent, /- 当前 release：`([^`]+)`/);
const productionRelease = extract(currentReleaseIndex, /### Production[\s\S]*?- release：`([^`]+)`/);
const productionOpsRelease = extract(opsReadme, /- Production：[\s\S]*?- release：`([^`]+)`/);
const productionCurrentRelease = extract(productionCurrent, /- 当前 release：`([^`]+)`/);

assert.equal(grayRelease, grayOpsRelease, "Gray release index and ops README must match");
assert.equal(grayRelease, grayCurrentRelease, "Gray release index and ops/current/gray must match");
assert.equal(productionRelease, productionOpsRelease, "Production release index and ops README must match");
assert.equal(productionRelease, productionCurrentRelease, "Production release index and ops/current/production must match");

console.log(JSON.stringify({
  ok: true,
  grayRelease,
  productionRelease,
}, null, 2));

function extract(text, pattern) {
  const match = String(text || "").match(pattern);
  if (!match) throw new Error(`PATTERN_NOT_FOUND:${pattern}`);
  return match[1];
}
