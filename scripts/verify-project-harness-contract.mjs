import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootPackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const systemsReadme = await readFile(
  new URL("../docs/systems/README.md", import.meta.url),
  "utf8",
);
const harnessReadme = await readFile(
  new URL("../docs/systems/harness/README.md", import.meta.url),
  "utf8",
);
const harnessMap = await readFile(
  new URL(
    "../docs/systems/harness/workspace-verify-release-map.md",
    import.meta.url,
  ),
  "utf8",
);
const subharnessConvention = await readFile(
  new URL("../docs/systems/harness/subharness-convention.md", import.meta.url),
  "utf8",
);

const scripts = rootPackage.scripts ?? {};

assert.equal(
  scripts["verify:project-harness-contract"],
  "node scripts/verify-project-harness-contract.mjs",
  "root package should expose project harness contract verification",
);
assert.equal(
  scripts["harness:verify:quick"],
  "npm run verify:quick",
  "project harness should expose quick verification alias",
);
assert.equal(
  scripts["harness:verify:workspace"],
  "npm run codegraph:sync && npm run type-check && npm run verify:package-exports",
  "project harness should expose workspace verification chain",
);
assert.equal(
  scripts["harness:verify:release"],
  "npm run verify:release-preflight-contract && npm run verify:release-gate-docs-contract && npm run verify:release-package-contract && npm run verify:current-release-entry-consistency",
  "project harness should expose release verification chain",
);
assert.equal(
  scripts["harness:verify:comfyui"],
  "npm run verify:comfyui-connector-harness && npm run verify:comfyui-workflow-parser-contract && npm run verify:admin-comfyui-governance-contract && npm run verify:comfyui-canvas-schema-contract && npm run verify:comfyui-unified-node-contract && npm run verify:comfyui-legacy-node-migration-contract && npm run verify:comfyui-execution-helpers && npm run verify:comfyui-public-route-errors && npx tsx scripts/verify-comfyui-instance-address-semantics.ts && node scripts/verify-admin-comfyui-instance-address-ui-contract.mjs && node scripts/verify-comfyui-instance-pool-contract.mjs",
  "project harness should expose ComfyUI subharness verification chain",
);
assert.equal(
  scripts["harness:verify:project"],
  "npm run verify:project-harness-contract && npm run harness:verify:quick",
  "project harness should expose project verification chain",
);

assert.match(
  systemsReadme,
  /harness\//,
  "systems README should list harness as a system knowledge entry",
);
assert.match(
  harnessReadme,
  /Workspace harness/,
  "harness README should document workspace harness layer",
);
assert.match(
  harnessReadme,
  /Verification harness/,
  "harness README should document verification harness layer",
);
assert.match(
  harnessReadme,
  /Release harness/,
  "harness README should document release harness layer",
);
assert.match(
  harnessReadme,
  /Integration harness/,
  "harness README should document integration harness layer",
);
assert.match(
  harnessMap,
  /npm run harness:verify:workspace/,
  "harness map should document workspace aggregate command",
);
assert.match(
  harnessMap,
  /npm run harness:verify:release/,
  "harness map should document release aggregate command",
);
assert.match(
  subharnessConvention,
  /ComfyUI 当前样板/,
  "subharness convention should register the current ComfyUI sample",
);
assert.match(
  subharnessConvention,
  /\.agent\//,
  "subharness convention should record the local .agent boundary decision",
);

console.log("project harness contract: ok");
