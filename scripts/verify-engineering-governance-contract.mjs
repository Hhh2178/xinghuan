import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
const grayPresets = await readFile(new URL("./release/gray-prepare-presets.mjs", import.meta.url), "utf8");
const grayDeploy = await readFile(new URL("./release/deploy-gray-release.mjs", import.meta.url), "utf8");
const preCommitHook = await readFile(new URL("../.githooks/pre-commit", import.meta.url), "utf8");
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const governanceReadme = await readFile(new URL("../docs/governance/README.md", import.meta.url), "utf8");
const governanceStandard = await readFile(new URL("../docs/governance/documentation-governance-standard.md", import.meta.url), "utf8");
const docsIndex = await readFile(new URL("../docs/INDEX.md", import.meta.url), "utf8");
const engineeringGuardrails = await readFile(new URL("../docs/governance/engineering-guardrails.md", import.meta.url), "utf8");
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const releaseIndex = await readFile(new URL("../docs/logbooks/releases/current-release-index.md", import.meta.url), "utf8");
const recordsReadme = await readFile(new URL("../docs/records/README.md", import.meta.url), "utf8");
const preCommitGovernance = await readFile(new URL("./pre-commit-governance.mjs", import.meta.url), "utf8");
const opsReadme = await readFile(new URL("../ops/README.md", import.meta.url), "utf8");
const opsCurrentGray = await readFile(new URL("../ops/current/gray.md", import.meta.url), "utf8");
const adminSystemReadme = await readFile(new URL("../docs/systems/admin/README.md", import.meta.url), "utf8");

assert.match(packageJson, /"verify:file-hotspot-budgets": "node scripts\/verify-file-hotspot-budgets\.mjs"/);
assert.match(packageJson, /"verify:hotspot-watchlist-contract": "node scripts\/verify-hotspot-watchlist-contract\.mjs"/);
assert.match(packageJson, /"verify:hotspot-doc-sync-staged": "node scripts\/verify-hotspot-doc-sync-staged\.mjs"/);
assert.match(packageJson, /"verify:release-logbook-sync-staged": "node scripts\/verify-release-logbook-sync-staged\.mjs"/);
assert.match(packageJson, /"verify:current-release-entry-consistency": "node scripts\/verify-current-release-entry-consistency\.mjs"/);
assert.match(packageJson, /"verify:no-runtime-artifacts-staged": "node scripts\/verify-no-runtime-artifacts-staged\.mjs"/);
assert.match(packageJson, /"verify:staged-source-size-guard": "node scripts\/verify-staged-source-size-guard\.mjs"/);
assert.match(packageJson, /"verify:release-worktree-clean": "node scripts\/verify-release-worktree-clean\.mjs"/);
assert.match(packageJson, /"verify:engineering-governance-contract": "node scripts\/verify-engineering-governance-contract\.mjs"/);
assert.match(packageJson, /"verify:release-governance-contract": "node scripts\/verify-release-governance-contract\.mjs"/);
assert.match(packageJson, /"release:retention:prune": "node scripts\/release\/prune-release-retention\.mjs"/);
assert.match(grayPresets, /verify:file-hotspot-budgets/);
assert.match(grayPresets, /verify:hotspot-watchlist-contract/);
assert.match(grayPresets, /verify:engineering-governance-contract/);
assert.match(grayPresets, /verify:current-release-entry-consistency/);
assert.match(grayDeploy, /verify:release-worktree-clean/);
assert.match(preCommitHook, /node scripts\/pre-commit-governance\.mjs/);
assert.match(agents, /verify:file-hotspot-budgets/);
assert.match(agents, /verify:hotspot-watchlist-contract/);
assert.match(agents, /verify:hotspot-doc-sync-staged/);
assert.match(agents, /ops\/current\/gray\.md/);
assert.match(agents, /verify:release-logbook-sync-staged/);
assert.match(agents, /verify:current-release-entry-consistency/);
assert.match(agents, /verify:no-runtime-artifacts-staged/);
assert.match(agents, /verify:staged-source-size-guard/);
assert.match(agents, /pre-commit/i);
assert.match(agents, /1200\+/);
assert.match(agents, /verify:release-worktree-clean/);
assert.match(agents, /release-version-and-retention-policy\.md/);
assert.match(agents, /最近三个.*Release|Release.*最近三个/s);
assert.match(governanceReadme, /engineering-guardrails\.md/);
assert.match(agents, /hotspot-risk-scorecard\.md/);
assert.match(governanceReadme, /hotspot-risk-scorecard\.md/);
assert.match(governanceReadme, /verify:release-logbook-sync-staged/);
assert.match(governanceReadme, /verify:current-release-entry-consistency/);
assert.match(governanceStandard, /工程文件治理规则/);
assert.match(governanceStandard, /1200\+.*报警线|报警线.*1200\+/s);
assert.match(governanceStandard, /职责密度/);
assert.match(governanceStandard, /变更耦合度/);
assert.match(governanceStandard, /运行态风险/);
assert.match(governanceStandard, /性能与渲染敏感度/);
assert.match(governanceStandard, /可拆分成熟度/);
assert.match(governanceStandard, /verify:file-hotspot-budgets/);
assert.match(governanceStandard, /verify:hotspot-watchlist-contract/);
assert.match(governanceStandard, /verify:hotspot-doc-sync-staged/);
assert.match(governanceStandard, /verify:release-logbook-sync-staged/);
assert.match(governanceStandard, /verify:current-release-entry-consistency/);
assert.match(governanceStandard, /verify:no-runtime-artifacts-staged/);
assert.match(governanceStandard, /verify:staged-source-size-guard/);
assert.match(governanceStandard, /pre-commit/i);
assert.match(governanceStandard, /1200\+/);
assert.match(governanceStandard, /verify:release-worktree-clean/);
assert.match(governanceStandard, /docs\/logbooks\/releases\/current-release-index\.md/);
assert.match(docsIndex, /engineering-guardrails\.md/);
assert.match(docsIndex, /hotspot-risk-scorecard\.md/);
assert.match(docsIndex, /hotspot-superfile-decomposition-ledger\.md/);
assert.match(engineeringGuardrails, /apps\/api\/src\/server\.ts/);
assert.match(engineeringGuardrails, /apps\/worker\/src\/worker\.ts/);
assert.match(engineeringGuardrails, /hotspot-risk-scorecard\.md/);
assert.match(engineeringGuardrails, /verify:hotspot-watchlist-contract/);
assert.match(engineeringGuardrails, /verify:hotspot-doc-sync-staged/);
assert.match(engineeringGuardrails, /verify:release-logbook-sync-staged/);
assert.match(engineeringGuardrails, /verify:current-release-entry-consistency/);
assert.match(engineeringGuardrails, /verify:no-runtime-artifacts-staged/);
assert.match(engineeringGuardrails, /verify:staged-source-size-guard/);
assert.match(engineeringGuardrails, /pre-commit/i);
assert.match(engineeringGuardrails, /1200\+/);
assert.match(preCommitGovernance, /verify-release-logbook-sync-staged/);
assert.match(preCommitGovernance, /verify-current-release-entry-consistency/);
assert.match(gitignore, /^releases\/$/m);
assert.match(gitignore, /^!docs\/logbooks\/releases\/$/m);
assert.match(gitignore, /^!docs\/logbooks\/releases\/\*\*\/\*\.md$/m);
const grayReleaseMatch = releaseIndex.match(/- release：`([^`]+)`/);
assert.ok(grayReleaseMatch?.[1], "current-release-index should expose current gray release");
const currentGrayRelease = grayReleaseMatch[1];
assert.match(opsReadme, new RegExp(currentGrayRelease.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(opsCurrentGray, new RegExp(currentGrayRelease.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(recordsReadme, /architecture\//);
assert.match(recordsReadme, /hotspot-superfile-decomposition-ledger\.md/);
assert.match(adminSystemReadme, /admin-api-settings-panel-helpers\.ts/);
assert.match(adminSystemReadme, /helper \//i);

console.log(JSON.stringify({
  ok: true,
  files: [
    ".gitignore",
    "package.json",
    ".githooks/pre-commit",
    "scripts/release/gray-prepare-presets.mjs",
    "scripts/release/deploy-gray-release.mjs",
    "scripts/verify-hotspot-watchlist-contract.mjs",
    "scripts/verify-hotspot-doc-sync-staged.mjs",
    "scripts/verify-release-logbook-sync-staged.mjs",
    "scripts/verify-current-release-entry-consistency.mjs",
    "scripts/verify-no-runtime-artifacts-staged.mjs",
    "scripts/verify-staged-source-size-guard.mjs",
    "scripts/pre-commit-governance.mjs",
    "AGENTS.md",
    "docs/governance/README.md",
    "docs/governance/documentation-governance-standard.md",
    "docs/governance/engineering-guardrails.md",
    "docs/INDEX.md",
    "docs/logbooks/releases/current-release-index.md",
    "ops/README.md",
    "ops/current/gray.md",
    "docs/systems/admin/README.md",
    "docs/records/README.md",
  ],
}, null, 2));
