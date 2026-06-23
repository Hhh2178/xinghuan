import {
  defaultGrayConfig,
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

const args = parseArgs(process.argv.slice(2));
if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/deploy-gray-release.mjs --release=<release-id> --archive=<archive-path> --ssh-key=<path> [--dry-run=true]

Examples:
  node scripts/release/deploy-gray-release.mjs --release=20260623-demo-gray-r1-v049 --archive=dist-release/20260623-demo-gray-r1-v049.tar.gz --ssh-key=../Tencent_Cloud_Server.pem
`);
  process.exit(0);
}

const defaults = defaultGrayConfig();
const releaseId = requiredArg(args, "release");
const archivePath = await ensureFileExists(requiredArg(args, "archive"));
const sshKeyPath = await ensureFileExists(requiredArg(args, "ssh-key"));
const host = String(firstArg(args.host) || defaults.host);
const port = String(firstArg(args.port) || defaults.port);
const user = String(firstArg(args.user) || defaults.user);
const remoteRoot = String(firstArg(args["remote-root"]) || defaults.remoteRoot);
const remoteTmpDir = String(firstArg(args["remote-tmp"]) || "/tmp");
const serviceName = String(firstArg(args.service) || defaults.serviceName);
const workerServiceName = String(firstArg(args["worker-service"]) || defaults.workerServiceName);
const dryRun = flagEnabled(args["dry-run"]);

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
  `ln -sfn ${shellQuote(releaseDir)} ${shellQuote(`${remoteRoot}/current`)}`,
  `sudo systemctl restart ${shellQuote(serviceName)}`,
  `sudo systemctl restart ${shellQuote(workerServiceName)}`,
].join("; ");

const steps = [
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
  stage: "deploy-gray-release",
  dryRun,
  releaseId,
  archivePath,
  target,
  remoteArchive,
  releaseDir,
  serviceName,
  workerServiceName,
  steps: steps.map((step) => ({ name: step.name, command: `${step.command} ${step.args.join(" ")}` })),
});
