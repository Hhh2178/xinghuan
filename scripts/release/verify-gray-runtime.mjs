import {
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
  loadEnvironmentConfig,
} from "./_shared.mjs";

const args = parseArgs(process.argv.slice(2));
if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/verify-gray-runtime.mjs --env=<gray|production> --ssh-key=<path> [--expected-version=<version>] [--expected-environment=<environment>] [--dry-run=true]

Examples:
  node scripts/release/verify-gray-runtime.mjs --ssh-key=../Tencent_Cloud_Server.pem --expected-version=0.4.9 --expected-environment=gray
`);
  process.exit(0);
}

const environment = String(firstArg(args.env) || "gray").trim();
const defaults = await loadEnvironmentConfig(environment);
const sshKeyPath = await ensureFileExists(requiredArg(args, "ssh-key"));
const host = String(firstArg(args.host) || defaults.host);
const port = String(firstArg(args.port) || defaults.sshPort);
const user = String(firstArg(args.user) || defaults.sshUser);
const remoteRoot = String(firstArg(args["remote-root"]) || defaults.remoteRoot);
const serviceName = String(firstArg(args.service) || defaults.serviceName);
const workerServiceName = String(firstArg(args["worker-service"]) || defaults.workerServiceName);
const internalStatusUrl = String(firstArg(args["internal-status-url"]) || defaults.internalStatusUrl);
const publicStatusUrl = String(firstArg(args["public-status-url"]) || defaults.publicStatusUrl);
const expectedVersion = String(firstArg(args["expected-version"]) || "").trim();
const expectedEnvironment = String(firstArg(args["expected-environment"]) || "").trim();
const expectedPermissionMode = String(firstArg(args["expected-permission-mode"]) || "").trim();
const expectedPermissionReady = String(firstArg(args["expected-permission-ready"]) || "").trim();
const sharedEnvFile = String(firstArg(args["shared-env-file"]) || defaults.sharedEnvFile);
const dryRun = flagEnabled(args["dry-run"]);
const target = sshTarget(user, host);

const commands = {
  currentRelease: ["ssh", ["-i", sshKeyPath, "-p", port, target, `readlink -f ${shellQuote(`${remoteRoot}/current`)}`]],
  appService: ["ssh", ["-i", sshKeyPath, "-p", port, target, `systemctl is-active ${shellQuote(serviceName)}`]],
  workerService: ["ssh", ["-i", sshKeyPath, "-p", port, target, `systemctl is-active ${shellQuote(workerServiceName)}`]],
  internalStatus: ["ssh", ["-i", sshKeyPath, "-p", port, target, `curl -fsS ${shellQuote(internalStatusUrl)}`]],
  permissionReadiness: ["ssh", ["-i", sshKeyPath, "-p", port, target, `bash -lc ${shellQuote(`set -a; . ${sharedEnvFile}; set +a; cd ${remoteRoot}/current; npx --no-install tsx scripts/verify-permission-readiness.ts --expect-ready=${expectedPermissionReady || "true"}`)}`]],
};

let currentRelease = "";
let appService = "";
let workerService = "";
let internalStatus = null;
let publicStatus = null;
let permissionReadiness = null;

if (!dryRun) {
  currentRelease = (await runCommand(commands.currentRelease[0], commands.currentRelease[1], { inherit: false, capture: true })).stdout.trim();
  appService = (await runCommand(commands.appService[0], commands.appService[1], { inherit: false, capture: true })).stdout.trim();
  workerService = (await runCommand(commands.workerService[0], commands.workerService[1], { inherit: false, capture: true })).stdout.trim();
  internalStatus = JSON.parse((await runCommand(commands.internalStatus[0], commands.internalStatus[1], { inherit: false, capture: true })).stdout.trim());
  const response = await fetch(publicStatusUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`PUBLIC_STATUS_HTTP_${response.status}`);
  publicStatus = await response.json();
  if (expectedPermissionReady) {
    permissionReadiness = JSON.parse((await runCommand(commands.permissionReadiness[0], commands.permissionReadiness[1], { inherit: false, capture: true })).stdout.trim());
  }
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
  expectedPermissionModeMatched:
    !dryRun && expectedPermissionMode
      ? internalStatus?.data?.permissionMode === expectedPermissionMode && publicStatus?.data?.permissionMode === expectedPermissionMode
      : null,
  expectedPermissionReadinessMatched:
    !dryRun && expectedPermissionReady
      ? permissionReadiness?.ready === (expectedPermissionReady === "true")
      : null,
};

const failedChecks = Object.entries(checks)
  .filter(([, value]) => value === false)
  .map(([name]) => name);

printJson({
  ok: failedChecks.length === 0,
  stage: "verify-runtime",
  environment,
  dryRun,
  target,
  publicStatusUrl,
  internalStatusUrl,
  expectedVersion: expectedVersion || null,
  expectedEnvironment: expectedEnvironment || null,
  expectedPermissionMode: expectedPermissionMode || null,
  expectedPermissionReady: expectedPermissionReady || null,
  currentRelease: dryRun ? null : currentRelease,
  appService: dryRun ? null : appService,
  workerService: dryRun ? null : workerService,
  internalStatus,
  publicStatus,
  permissionReadiness,
  checks,
  failedChecks,
});

if (failedChecks.length > 0) process.exitCode = 1;
