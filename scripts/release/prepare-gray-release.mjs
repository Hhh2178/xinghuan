import { readFile } from "node:fs/promises";
import {
  archiveOutputPath,
  arrayArg,
  helpRequested,
  parseArgs,
  printJson,
  requiredArg,
  rootDir,
  runCommand,
} from "./_shared.mjs";
import { listGrayPreparePresets, resolveGrayPrepareCommands } from "./gray-prepare-presets.mjs";

const args = parseArgs(process.argv.slice(2));

if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/prepare-gray-release.mjs --release=<release-id> [--preset=<name>] [--verify=<command>] [--skip-package=true]

Defaults:
  - Runs the base local verification chain
  - Builds the single-port bundle
  - Generates a release archive via package:release

Examples:
  node scripts/release/prepare-gray-release.mjs --release=20260623-demo-gray-r1-v049
  node scripts/release/prepare-gray-release.mjs --release=20260623-demo-gray-r1-v049 --preset=runninghub
  node scripts/release/prepare-gray-release.mjs --release=20260623-demo-gray-r1-v049 --preset=runninghub --verify="node scripts/verify-runninghub-upstream-error-contract.mjs"
`);
  console.log("\nAvailable presets:");
  for (const preset of listGrayPreparePresets()) {
    console.log(`  - ${preset.name}: ${preset.description}`);
  }
  process.exit(0);
}

const releaseId = requiredArg(args, "release");
const packageEnabled = String(args["skip-package"] || "").trim().toLowerCase() !== "true";
const rootPackage = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const selectedPresets = arrayArg(args.preset);
const extraVerifyCommands = arrayArg(args.verify);
const resolved = resolveGrayPrepareCommands({
  presets: selectedPresets,
  extraCommands: extraVerifyCommands,
});
const verifyCommands = resolved.commands;

const executed = [];
for (const commandText of verifyCommands) {
  executed.push(commandText);
  await runCommand(process.platform === "win32" ? "cmd" : "sh", process.platform === "win32" ? ["/d", "/s", "/c", commandText] : ["-lc", commandText], {
    cwd: rootDir,
  });
}

if (packageEnabled) {
  const packageCommand = `npm run package:release -- ${releaseId}`;
  executed.push(packageCommand);
  await runCommand(process.platform === "win32" ? "cmd" : "sh", process.platform === "win32" ? ["/d", "/s", "/c", packageCommand] : ["-lc", packageCommand], {
    cwd: rootDir,
  });
}

printJson({
  ok: true,
  stage: "prepare-gray-release",
  releaseId,
  version: String(rootPackage.version || "").trim(),
  archivePath: archiveOutputPath(releaseId),
  packageEnabled,
  presets: resolved.presets,
  verifyCommands,
  executed,
});
