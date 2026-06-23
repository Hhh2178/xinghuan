import { resolveGrayPrepareCommands } from "./release/gray-prepare-presets.mjs";
import { readFile } from "node:fs/promises";

const base = resolveGrayPrepareCommands({});
assertIncludes(base.commands, "npm install --package-lock-only", "base preset should include lockfile refresh");
assertIncludes(base.commands, "npm run build:single-port", "base preset should include single-port build");
assertIncludes(base.commands, "node scripts/verify-release-version-alignment.mjs", "base preset should include version alignment");
assertIncludes(base.commands, "npm run verify:release-package-contract", "base preset should include release package contract");

const runninghub = resolveGrayPrepareCommands({ presets: ["runninghub"] });
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-draft-and-summary-contract.mjs",
  "runninghub preset should include draft and summary contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-output-reset-contract.mjs",
  "runninghub preset should include output reset contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-worker-and-label-contract.mjs",
  "runninghub preset should include worker and label contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-admin-empty-input-contract.mjs",
  "runninghub preset should include empty input contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-key-pool-contract.mjs",
  "runninghub preset should include key pool contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-unified-protocol-runtime-contract.mjs",
  "runninghub preset should include unified protocol runtime contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-dynamic-key-selection-contract.mjs",
  "runninghub preset should include runninghub dynamic key selection contract",
);
assertIncludes(
  runninghub.commands,
  "node scripts/verify-runninghub-node-progress-contract.mjs",
  "runninghub preset should include node progress contract",
);

const merged = resolveGrayPrepareCommands({
  presets: ["runninghub"],
  extraCommands: ["echo custom-check"],
});
assertIncludes(merged.commands, "echo custom-check", "extra verify commands should be appended");

const deployScript = await readFile(new URL("./release/deploy-gray-release.mjs", import.meta.url), "utf8");
assertIncludesText(
  deployScript,
  "npm run db:migrate",
  "gray deploy should source shared env and run db:migrate before switching current",
);
assertIncludesText(
  deployScript,
  "shared/canvas-next.env",
  "gray deploy should source shared env before switching current",
);

console.log("PASS gray release prepare contract");

function assertIncludes(list, expected, message) {
  if (!Array.isArray(list) || !list.includes(expected)) {
    throw new Error(message);
  }
}

function assertIncludesText(text, expected, message) {
  if (!String(text).includes(expected)) {
    throw new Error(message);
  }
}
