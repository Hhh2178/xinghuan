import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const opsReadme = await readFile(new URL("../ops/README.md", import.meta.url), "utf8");
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const releaseState = JSON.parse(await readFile(new URL("../ops/current/release-state.json", import.meta.url), "utf8"));

const version = packageJson.version;
const grayRelease = releaseState.environments.gray.releaseId;
const productionRelease = releaseState.environments.production.releaseId;

assert.equal(releaseState.environments.gray.version, version, "Gray manifest version must match package version");
assert.equal(releaseState.environments.production.version, version, "Production manifest version must match package version");
assert.match(agents, /package\.json/);
assert.match(agents, /config\/environments\.json/);
assert.match(agents, /ops\/current\/release-state\.json/);
assert.match(opsReadme, /current\/release-state\.json/);
assert.match(opsReadme, /docs\/logbooks\/releases\/current-release-index\.md/);

console.log(JSON.stringify({
  ok: true,
  version,
  grayRelease,
  productionRelease,
  source: "package.json + ops/current/release-state.json",
}, null, 2));
