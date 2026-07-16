import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (relativePath) => JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
const rootPackage = await readJson("package.json");
const environments = await readJson("config/environments.json");
const releaseState = await readJson("ops/current/release-state.json");
const failures = [];

const requiredEnvironments = ["gray", "production"];
for (const environment of requiredEnvironments) {
  const config = environments.environments?.[environment];
  const state = releaseState.environments?.[environment];
  if (!config) failures.push(`MISSING_ENVIRONMENT_CONFIG:${environment}`);
  if (!state) failures.push(`MISSING_RELEASE_STATE:${environment}`);
  if (!config || !state) continue;
  for (const field of ["host", "sshPort", "sshUser", "remoteRoot", "sharedEnvFile", "publicStatusUrl", "internalStatusUrl", "serviceName", "workerServiceName", "expectedDatabaseName"]) {
    if (config[field] === undefined || config[field] === "") failures.push(`MISSING_ENVIRONMENT_FIELD:${environment}:${field}`);
  }
  for (const field of ["version", "releaseId", "deployedAt", "permissionMode", "releaseRecord", "validationRecord", "rollbackReleaseId"]) {
    if (state[field] === undefined || state[field] === "") failures.push(`MISSING_RELEASE_STATE_FIELD:${environment}:${field}`);
  }
  if (state.version !== rootPackage.version) failures.push(`VERSION_DRIFT:${environment}:${state.version}:${rootPackage.version}`);
  if (!/^[0-9a-f]{40}$/.test(releaseState.sourceCommit || "")) failures.push("INVALID_SOURCE_COMMIT");
  for (const evidencePath of [state.releaseRecord, state.validationRecord]) {
    try { await readFile(resolve(root, evidencePath), "utf8"); }
    catch { failures.push(`MISSING_EVIDENCE:${environment}:${evidencePath}`); }
  }
  if (state.readiness?.failures !== 0) failures.push(`READINESS_FAILURES:${environment}`);
}

if (environments.schemaVersion !== 1 || releaseState.schemaVersion !== 1) failures.push("UNSUPPORTED_STATE_SCHEMA");

console.log(JSON.stringify({
  ok: failures.length === 0,
  productVersion: rootPackage.version,
  environments: requiredEnvironments,
  sourceCommit: releaseState.sourceCommit,
  failures,
}, null, 2));

if (failures.length > 0) process.exitCode = 1;
