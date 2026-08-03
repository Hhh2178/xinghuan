import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [packageText, harnessReadme, harnessMap, convention] = await Promise.all([
  read("package.json"),
  read("docs/systems/harness/README.md"),
  read("docs/systems/harness/workspace-verify-release-map.md"),
  read("docs/systems/harness/subharness-convention.md"),
]);
const scripts = JSON.parse(packageText).scripts ?? {};

assert.equal(
  scripts["verify:sealed-production-artifact-harness"],
  "node scripts/verify-sealed-production-artifact-harness.mjs",
  "package.json must expose the sealed production artifact harness",
);
assert.match(
  scripts["harness:verify:release"] ?? "",
  /verify:sealed-production-artifact-harness/,
  "release harness must run the sealed production artifact harness",
);

for (const [name, source] of Object.entries({
  "harness README": harnessReadme,
  "workspace / verify / release map": harnessMap,
  "subharness convention": convention,
})) {
  for (const required of [
    "0.8.16",
    "sealed production artifact",
    "0.8.17",
    "admin tiers",
    "0.8.18",
    "RunningHub groups",
    "same Gray archive",
    "actual verification evidence",
  ]) {
    assert.match(source, new RegExp(required, "i"), `${name} must record ${required}`);
  }
}

console.log("sealed production artifact harness: ok");
