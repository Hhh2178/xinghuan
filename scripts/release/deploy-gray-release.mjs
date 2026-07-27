import {
  ensureFileExists,
  firstArg,
  flagEnabled,
  helpRequested,
  parseArgs,
  printJson,
  remoteReleaseDir,
  requiredArg,
  runCommand,
  shellQuote,
  sshTarget,
  tmpArchivePath,
} from "./_shared.mjs";
import { assertTargetOverridesMatch, loadReleaseTargetProfile, sanitizedTargetFingerprint } from "./target-profile.mjs";

const args = parseArgs(process.argv.slice(2));
if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/deploy-gray-release.mjs --target-profile=old-server --env=<gray|production> --release=<release-id> --archive=<archive-path> --ssh-key=<path> [--migrate-generation-artifacts=true] [--dry-run=true]

Examples:
  node scripts/release/deploy-gray-release.mjs --target-profile=old-server --release=20260623-demo-gray-r1-v049 --archive=dist-release/20260623-demo-gray-r1-v049.tar.gz --ssh-key=<local-key-path>
`);
  process.exit(0);
}

const environment = String(firstArg(args.env) || "gray").trim();
const targetProfile = requiredArg(args, "target-profile");
const defaults = await loadReleaseTargetProfile({ profile: targetProfile, environment });
assertTargetOverridesMatch(args, defaults);
const releaseId = requiredArg(args, "release");
const archivePath = await ensureFileExists(requiredArg(args, "archive"));
const sshKeyPath = await ensureFileExists(requiredArg(args, "ssh-key"));
const host = defaults.host;
const port = String(defaults.port);
const user = defaults.sshUser;
const remoteRoot = defaults.remoteRoot;
const remoteTmpDir = String(firstArg(args["remote-tmp"]) || "/tmp");
const serviceName = defaults.serviceName;
const workerServiceName = defaults.workerServiceName;
const sharedEnvFile = defaults.sharedEnvFile;
const dryRun = flagEnabled(args["dry-run"]);
const migrateGenerationArtifacts = flagEnabled(args["migrate-generation-artifacts"]);

const releaseDir = remoteReleaseDir(remoteRoot, releaseId);
const remoteArchive = tmpArchivePath(remoteTmpDir, archivePath);
const target = sshTarget(user, host);
const remoteScript = [
  "set -e",
  `mkdir -p ${shellQuote(`${remoteRoot}/releases`)}`,
  `mkdir -p ${shellQuote(`${remoteRoot}/shared/data`)}`,
  `mkdir -p ${shellQuote(`${remoteRoot}/shared/logs`)}`,
  `mkdir -p ${shellQuote(releaseDir)}`,
  `tar -xzf ${shellQuote(remoteArchive)} -C ${shellQuote(releaseDir)}`,
  `cd ${shellQuote(releaseDir)}`,
  "npm ci",
  `set -a && . ${shellQuote(sharedEnvFile)} && set +a && npm run db:migrate`,
  ...(migrateGenerationArtifacts
    ? [
        `set -a && . ${shellQuote(sharedEnvFile)} && set +a && npm run generation-artifacts:migrate:dry-run`,
        `set -a && . ${shellQuote(sharedEnvFile)} && set +a && npm run generation-artifacts:migrate`,
      ]
    : []),
  `ln -sfn ${shellQuote(releaseDir)} ${shellQuote(`${remoteRoot}/current`)}`,
  `sudo systemctl restart ${shellQuote(serviceName)}`,
  `sudo systemctl restart ${shellQuote(workerServiceName)}`,
].join("; ");

const steps = [
  {
    name: "verify-worktree-clean",
    command: process.platform === "win32" ? "cmd" : "sh",
    args: process.platform === "win32"
      ? ["/d", "/s", "/c", "npm run verify:release-worktree-clean"]
      : ["-lc", "npm run verify:release-worktree-clean"],
  },
  {
    name: "upload-archive",
    command: "scp",
    args: ["-i", sshKeyPath, "-P", port, archivePath, `${target}:${remoteArchive}`],
  },
  {
    name: "deploy-remote-release",
    command: "ssh",
    args: ["-i", sshKeyPath, "-p", port, target, remoteScript],
  },
];

if (!dryRun) {
  for (const step of steps) {
    await runCommand(step.command, step.args, { inherit: true });
  }
}

printJson({
  ok: true,
  stage: "deploy-release",
  environment,
  targetFingerprint: sanitizedTargetFingerprint(defaults),
  dryRun,
  migrateGenerationArtifacts,
  releaseId,
  archivePath,
  target,
  remoteArchive,
  releaseDir,
  sharedEnvFile,
  serviceName,
  workerServiceName,
  steps: steps.map((step) => ({ name: step.name, command: `${step.command} ${step.args.join(" ")}` })),
});
