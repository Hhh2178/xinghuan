import { spawnSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./verify-release-logbook-sync-staged.mjs", import.meta.url));

const grayFailure = run([
  "--staged=docs/logbooks/releases/gray/2026-06-24-sample-gray.md",
]);
assert.notEqual(grayFailure.status, 0, "gray release record without synced entry docs should fail");
assert.match(
  `${grayFailure.stdout}\n${grayFailure.stderr}`,
  /current-release-index\.md|ops\/README\.md|ops\/current\/gray\.md/,
  "gray failure should explain the missing synced release entry docs",
);

const grayPass = run([
  "--staged=docs/logbooks/releases/gray/2026-06-24-sample-gray.md,docs/logbooks/releases/current-release-index.md,ops/README.md,ops/current/gray.md",
]);
assert.equal(grayPass.status, 0, "gray release record with synced entry docs should pass");

const productionFailure = run([
  "--staged=docs/logbooks/releases/production/2026-06-24-sample-production.md,docs/logbooks/releases/current-release-index.md,ops/README.md",
]);
assert.notEqual(productionFailure.status, 0, "production release record without ops/current/production.md should fail");
assert.match(
  `${productionFailure.stdout}\n${productionFailure.stderr}`,
  /ops\/current\/production\.md/,
  "production failure should explain the missing synced production entry doc",
);

const productionPass = run([
  "--staged=docs/logbooks/releases/production/2026-06-24-sample-production.md,docs/logbooks/releases/current-release-index.md,ops/README.md,ops/current/production.md",
]);
assert.equal(productionPass.status, 0, "production release record with synced entry docs should pass");

console.log("PASS release logbook sync staged contract");

function run(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
}
