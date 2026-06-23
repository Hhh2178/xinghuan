import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
const grayPresets = await readFile(new URL("./release/gray-prepare-presets.mjs", import.meta.url), "utf8");
const grayDeploy = await readFile(new URL("./release/deploy-gray-release.mjs", import.meta.url), "utf8");
const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const governanceReadme = await readFile(new URL("../docs/governance/README.md", import.meta.url), "utf8");
const governanceStandard = await readFile(new URL("../docs/governance/documentation-governance-standard.md", import.meta.url), "utf8");
const docsIndex = await readFile(new URL("../docs/INDEX.md", import.meta.url), "utf8");
const engineeringGuardrails = await readFile(new URL("../docs/governance/engineering-guardrails.md", import.meta.url), "utf8");
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const releaseIndex = await readFile(new URL("../docs/logbooks/releases/current-release-index.md", import.meta.url), "utf8");
const recordsReadme = await readFile(new URL("../docs/records/README.md", import.meta.url), "utf8");

assert.match(packageJson, /"verify:file-hotspot-budgets": "node scripts\/verify-file-hotspot-budgets\.mjs"/);
assert.match(packageJson, /"verify:hotspot-watchlist-contract": "node scripts\/verify-hotspot-watchlist-contract\.mjs"/);
assert.match(packageJson, /"verify:release-worktree-clean": "node scripts\/verify-release-worktree-clean\.mjs"/);
assert.match(packageJson, /"verify:engineering-governance-contract": "node scripts\/verify-engineering-governance-contract\.mjs"/);
assert.match(grayPresets, /verify:file-hotspot-budgets/);
assert.match(grayPresets, /verify:hotspot-watchlist-contract/);
assert.match(grayPresets, /verify:engineering-governance-contract/);
assert.match(grayDeploy, /verify:release-worktree-clean/);
assert.match(agents, /verify:file-hotspot-budgets/);
assert.match(agents, /verify:hotspot-watchlist-contract/);
assert.match(agents, /1200\+/);
assert.match(agents, /verify:release-worktree-clean/);
assert.match(governanceReadme, /engineering-guardrails\.md/);
assert.match(governanceStandard, /工程文件治理规则/);
assert.match(governanceStandard, /verify:file-hotspot-budgets/);
assert.match(governanceStandard, /verify:hotspot-watchlist-contract/);
assert.match(governanceStandard, /1200\+/);
assert.match(governanceStandard, /verify:release-worktree-clean/);
assert.match(governanceStandard, /docs\/logbooks\/releases\/current-release-index\.md/);
assert.match(docsIndex, /engineering-guardrails\.md/);
assert.match(docsIndex, /hotspot-superfile-decomposition-ledger\.md/);
assert.match(engineeringGuardrails, /apps\/api\/src\/server\.ts/);
assert.match(engineeringGuardrails, /apps\/worker\/src\/worker\.ts/);
assert.match(engineeringGuardrails, /verify:hotspot-watchlist-contract/);
assert.match(engineeringGuardrails, /1200\+/);
assert.match(gitignore, /^releases\/$/m);
assert.match(gitignore, /^!docs\/logbooks\/releases\/$/m);
assert.match(gitignore, /^!docs\/logbooks\/releases\/\*\*\/\*\.md$/m);
assert.match(releaseIndex, /20260624-hotspot-decomposition-gray-r1-v0416/);
assert.match(recordsReadme, /architecture\//);
assert.match(recordsReadme, /hotspot-superfile-decomposition-ledger\.md/);

console.log(JSON.stringify({
  ok: true,
  files: [
    ".gitignore",
    "package.json",
    "scripts/release/gray-prepare-presets.mjs",
    "scripts/release/deploy-gray-release.mjs",
    "scripts/verify-hotspot-watchlist-contract.mjs",
    "AGENTS.md",
    "docs/governance/README.md",
    "docs/governance/documentation-governance-standard.md",
    "docs/governance/engineering-guardrails.md",
    "docs/INDEX.md",
    "docs/logbooks/releases/current-release-index.md",
    "docs/records/README.md",
  ],
}, null, 2));
