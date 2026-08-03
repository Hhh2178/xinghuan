import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

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
const sidecarPath = await ensureFileExists(`${archivePath}.sha256`);
const archiveSha256 = await verifyArchiveSidecar({ archivePath, sidecarPath });
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
const remoteSidecar = tmpArchivePath(remoteTmpDir, sidecarPath);
const target = sshTarget(user, host);
const remoteCommands = [
  "set -e",
  `cd ${shellQuote(remoteTmpDir)} && sha256sum -c ${shellQuote(basename(remoteSidecar))}`,
  `mkdir -p ${shellQuote(`${remoteRoot}/releases`)}`,
  `mkdir -p ${shellQuote(`${remoteRoot}/shared/data`)}`,
  `mkdir -p ${shellQuote(`${remoteRoot}/shared/logs`)}`,
  `mkdir -p ${shellQuote(releaseDir)}`,
  `tar -xzf ${shellQuote(remoteArchive)} -C ${shellQuote(releaseDir)}`,
  `cd ${shellQuote(releaseDir)}`,
  "npm ci --omit=dev",
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
];
const remoteScript = remoteCommands.join("; ");

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
    name: "upload-sidecar",
    command: "scp",
    args: ["-i", sshKeyPath, "-P", port, sidecarPath, `${target}:${remoteSidecar}`],
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
  sidecarPath,
  archiveSha256,
  target,
  remoteArchive,
  remoteSidecar,
  releaseDir,
  sharedEnvFile,
  serviceName,
  workerServiceName,
  remoteCommands,
  steps: steps.map((step) => ({ name: step.name, command: step.command })),
});

async function verifyArchiveSidecar({ archivePath, sidecarPath }) {
  const sidecar = (await readFile(sidecarPath, "utf8")).trim();
  const match = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(sidecar);
  const expectedDigest = match?.[1]?.toLowerCase();
  const expectedFilename = match?.[2]?.trim();
  const actualDigest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
  if (!expectedDigest || expectedFilename !== basename(archivePath) || expectedDigest !== actualDigest) {
    throw new Error("RELEASE_ARCHIVE_SHA256_MISMATCH");
  }
  return actualDigest;
}
