import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [agents, policy, grayRunbook, productionRunbook, retentionScript, authorityScript, currentEntryScript, rootPackage] = await Promise.all([
  read("../AGENTS.md"),
  read("../docs/governance/release-version-and-retention-policy.md"),
  read("../ops/gray-deploy-runbook.md"),
  read("../ops/production-deploy-runbook.md"),
  read("./release/prune-release-retention.mjs"),
  read("./verify-authority-state.mjs"),
  read("./verify-current-release-entry-consistency.mjs"),
  read("../package.json"),
]);

assert.match(agents, /最近五个.*Release|Release.*最近五个/s);
assert.match(agents, /0\.0\.1/);
assert.match(agents, /MINOR.*MAJOR|MAJOR.*MINOR/s);
assert.match(agents, /release-version-and-retention-policy\.md/);
assert.match(policy, /各自最多保留最近五个/);
assert.match(policy, /默认只在当前 Gray 版本上增加一个 PATCH/);
assert.match(policy, /shared\/data/);
assert.match(policy, /rollbackReleaseId/);
assert.match(grayRunbook, /release:retention:prune/);
assert.match(grayRunbook, /rollbackReleaseId/);
assert.match(productionRunbook, /release:retention:prune/);
assert.match(productionRunbook, /rollbackReleaseId/);
assert.match(retentionScript, /RELEASE_RETENTION_COUNT = 5/);
assert.match(retentionScript, /confirm-retention/);
assert.match(retentionScript, /rollbackReleaseId/);
assert.match(retentionScript, /REFUSE_ROLLBACK_MISSING/);
assert.match(retentionScript, /REFUSE_DELETE_CURRENT/);
assert.match(retentionScript, /REFUSE_DELETE_ROLLBACK/);
assert.match(retentionScript, /REFUSE_CANDIDATE_OUTSIDE_RELEASE_ROOT/);
assert.match(retentionScript, /find \"\$resolved\" -depth -delete/);
assert.match(retentionScript, /if \[ \"\$apply\" = true \] && \[ \"\$expected\" -gt \"\$retention\" \]/);
assert.doesNotMatch(retentionScript, /rm\s+-rf/);
assert.match(authorityScript, /AUTHORIZED_VERSION_CORRECTION_PENDING/);
assert.match(currentEntryScript, /user-authorized correction/);

const scripts = JSON.parse(rootPackage).scripts ?? {};
assert.equal(scripts["release:retention:prune"], "node scripts/release/prune-release-retention.mjs");
assert.equal(scripts["verify:release-governance-contract"], "node scripts/verify-release-governance-contract.mjs");
assert.match(scripts["harness:verify:release"], /verify:release-governance-contract/);

console.log(JSON.stringify({ ok: true, retention: 5, grayVersionIncrement: "patch-only-by-default" }, null, 2));
