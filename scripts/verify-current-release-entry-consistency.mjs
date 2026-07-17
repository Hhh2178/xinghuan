import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const opsReadme = await readFile(new URL("../ops/README.md", import.meta.url), "utf8");
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const releaseState = JSON.parse(await readFile(new URL("../ops/current/release-state.json", import.meta.url), "utf8"));

const version = packageJson.version;
const grayRelease = releaseState.environments.gray.releaseId;
const productionRelease = releaseState.environments.production.releaseId;

const candidateVersion = parseVersion(version, "package.json");
const grayVersion = parseVersion(releaseState.environments.gray.version, "gray manifest");
const productionVersion = parseVersion(releaseState.environments.production.version, "production manifest");
const grayCorrection = isAuthorizedVersionCorrection(releaseState.versionTransition, "gray", releaseState.environments.gray.version, version);
assert.ok(compareVersions(grayVersion, candidateVersion) <= 0 || grayCorrection, "Gray manifest version must not be ahead of package version without a user-authorized correction");
assert.ok(compareVersions(productionVersion, candidateVersion) <= 0, "Production manifest version must not be ahead of package version");
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

function parseVersion(value, label) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  assert.ok(match, `${label} must contain a semantic version`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function isAuthorizedVersionCorrection(transition, environment, deployedVersion, candidateVersion) {
  return transition?.authorizedBy === "user"
    && transition?.environment === environment
    && transition?.from === deployedVersion
    && transition?.to === candidateVersion;
}
