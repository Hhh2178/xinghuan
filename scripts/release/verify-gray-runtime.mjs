import {
  defaultGrayConfig,
  ensureFileExists,
  firstArg,
  flagEnabled,
  helpRequested,
  parseArgs,
  printJson,
  requiredArg,
  runCommand,
  shellQuote,
  sshTarget,
} from "./_shared.mjs";

const args = parseArgs(process.argv.slice(2));
if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/verify-gray-runtime.mjs --ssh-key=<path> [--expected-version=<version>] [--expected-environment=gray] [--dry-run=true]

Examples:
  node scripts/release/verify-gray-runtime.mjs --ssh-key=../Tencent_Cloud_Server.pem --expected-version=0.4.9 --expected-environment=gray
`);
  process.exit(0);
}

const defaults = defaultGrayConfig();
const sshKeyPath = await ensureFileExists(requiredArg(args, "ssh-key"));
const host = String(firstArg(args.host) || defaults.host);
const port = String(firstArg(args.port) || defaults.port);
const user = String(firstArg(args.user) || defaults.user);
const remoteRoot = String(firstArg(args["remote-root"]) || defaults.remoteRoot);
const serviceName = String(firstArg(args.service) || defaults.serviceName);
const workerServiceName = String(firstArg(args["worker-service"]) || defaults.workerServiceName);
const internalStatusUrl = String(firstArg(args["internal-status-url"]) || defaults.internalStatusUrl);
const publicStatusUrl = String(firstArg(args["public-status-url"]) || defaults.publicStatusUrl);
const expectedVersion = String(firstArg(args["expected-version"]) || "").trim();
const expectedEnvironment = String(firstArg(args["expected-environment"]) || "").trim();
const dryRun = flagEnabled(args["dry-run"]);
const target = sshTarget(user, host);

const commands = {
  currentRelease: ["ssh", ["-i", sshKeyPath, "-p", port, target, `readlink -f ${shellQuote(`${remoteRoot}/current`)}`]],
  appService: ["ssh", ["-i", sshKeyPath, "-p", port, target, `systemctl is-active ${shellQuote(serviceName)}`]],
  workerService: ["ssh", ["-i", sshKeyPath, "-p", port, target, `systemctl is-active ${shellQuote(workerServiceName)}`]],
  internalStatus: ["ssh", ["-i", sshKeyPath, "-p", port, target, `curl -fsS ${shellQuote(internalStatusUrl)}`]],
};

let currentRelease = "";
let appService = "";
let workerService = "";
let internalStatus = null;
let publicStatus = null;

if (!dryRun) {
  currentRelease = (await runCommand(commands.currentRelease[0], commands.currentRelease[1], { inherit: false, capture: true })).stdout.trim();
  appService = (await runCommand(commands.appService[0], commands.appService[1], { inherit: false, capture: true })).stdout.trim();
  workerService = (await runCommand(commands.workerService[0], commands.workerService[1], { inherit: false, capture: true })).stdout.trim();
  internalStatus = JSON.parse((await runCommand(commands.internalStatus[0], commands.internalStatus[1], { inherit: false, capture: true })).stdout.trim());
  const response = await fetch(publicStatusUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`PUBLIC_STATUS_HTTP_${response.status}`);
  publicStatus = await response.json();
}

const checks = {
  appServiceActive: !dryRun ? appService === "active" : null,
  workerServiceActive: !dryRun ? workerService === "active" : null,
  expectedVersionMatched:
    !dryRun && expectedVersion
      ? internalStatus?.data?.version === expectedVersion && publicStatus?.data?.version === expectedVersion
      : null,
  expectedEnvironmentMatched:
    !dryRun && expectedEnvironment
      ? internalStatus?.data?.environment === expectedEnvironment && publicStatus?.data?.environment === expectedEnvironment
      : null,
};

printJson({
  ok: true,
  stage: "verify-gray-runtime",
  dryRun,
  target,
  publicStatusUrl,
  internalStatusUrl,
  expectedVersion: expectedVersion || null,
  expectedEnvironment: expectedEnvironment || null,
  currentRelease: dryRun ? null : currentRelease,
  appService: dryRun ? null : appService,
  workerService: dryRun ? null : workerService,
  internalStatus,
  publicStatus,
  checks,
});
