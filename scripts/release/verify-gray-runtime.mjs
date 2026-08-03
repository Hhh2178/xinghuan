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
} from "./_shared.mjs";
import { assertTargetOverridesMatch, loadReleaseTargetProfile, sanitizedTargetFingerprint } from "./target-profile.mjs";

const args = parseArgs(process.argv.slice(2));
if (helpRequested(args)) {
  console.log(`Usage:
  node scripts/release/verify-gray-runtime.mjs --target-profile=old-server --env=<gray|production> --ssh-key=<path> [--expected-version=<version>] [--expected-environment=<environment>] [--dry-run=true]

Examples:
  node scripts/release/verify-gray-runtime.mjs --target-profile=old-server --ssh-key=<local-key-path> --expected-version=0.8.3 --expected-environment=gray
`);
  process.exit(0);
}

const environment = String(firstArg(args.env) || "gray").trim();
const targetProfile = requiredArg(args, "target-profile");
const defaults = await loadReleaseTargetProfile({ profile: targetProfile, environment });
assertTargetOverridesMatch(args, defaults);
const sshKeyPath = await ensureFileExists(requiredArg(args, "ssh-key"));
const host = defaults.host;
const port = String(defaults.port);
const user = defaults.sshUser;
const remoteRoot = defaults.remoteRoot;
const serviceName = defaults.serviceName;
const workerServiceName = defaults.workerServiceName;
const internalStatusUrl = defaults.internalStatusUrl;
const publicStatusUrl = defaults.publicStatusUrl;
const expectedVersion = String(firstArg(args["expected-version"]) || "").trim();
const expectedEnvironment = String(firstArg(args["expected-environment"]) || "").trim();
const expectedPermissionMode = String(firstArg(args["expected-permission-mode"]) || "").trim();
const expectedPermissionReady = String(firstArg(args["expected-permission-ready"]) || "").trim();
const sharedEnvFile = defaults.sharedEnvFile;
const dryRun = flagEnabled(args["dry-run"]);
const target = sshTarget(user, host);
const permissionReadinessCommand = `set -a; . ${shellQuote(sharedEnvFile)}; set +a; cd ${shellQuote(`${remoteRoot}/current`)}; node apps/api/dist/cli/permission-readiness.js --expect-ready=${expectedPermissionReady || "true"}`;

const commands = {
  currentRelease: ["ssh", ["-i", sshKeyPath, "-p", port, target, `readlink -f ${shellQuote(`${remoteRoot}/current`)}`]],
  appService: ["ssh", ["-i", sshKeyPath, "-p", port, target, `systemctl is-active ${shellQuote(serviceName)}`]],
  workerService: ["ssh", ["-i", sshKeyPath, "-p", port, target, `systemctl is-active ${shellQuote(workerServiceName)}`]],
  internalStatus: ["ssh", ["-i", sshKeyPath, "-p", port, target, `curl -fsS ${shellQuote(internalStatusUrl)}`]],
  permissionReadiness: ["ssh", ["-i", sshKeyPath, "-p", port, target, `bash -lc ${shellQuote(permissionReadinessCommand)}`]],
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
  targetFingerprint: sanitizedTargetFingerprint(defaults),
  dryRun,
  target,
  publicStatusUrl,
  internalStatusUrl,
  expectedVersion: expectedVersion || null,
  expectedEnvironment: expectedEnvironment || null,
  expectedPermissionMode: expectedPermissionMode || null,
  expectedPermissionReady: expectedPermissionReady || null,
  permissionReadinessCommand,
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
