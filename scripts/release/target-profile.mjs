import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { rootDir } from "./_shared.mjs";

const profilePath = resolve(rootDir, "config/release-target-profiles.json");
const expectedTargets = {
  gray: {
    remoteRoot: "/opt/apps/xinghuan-canvas-next",
    sharedEnvFile: "/opt/apps/xinghuan-canvas-next/shared/canvas-next.env",
    serviceName: "xinghuan-canvas-next.service",
    workerServiceName: "xinghuan-canvas-next-worker.service",
    publicStatusUrl: "https://canvas-next.hhh2121.xyz/api/status",
    internalStatusUrl: "http://127.0.0.1:18200/api/status",
    expectedDatabaseName: "xinghuan_canvas_gray",
    queuePrefix: "xinghuan:tasks",
  },
  production: {
    remoteRoot: "/opt/apps/xinghuan-canvas",
    sharedEnvFile: "/opt/apps/xinghuan-canvas/shared/canvas.env",
    serviceName: "xinghuan-canvas.service",
    workerServiceName: "xinghuan-canvas-worker.service",
    publicStatusUrl: "https://canvas.hhh2121.xyz/api/status",
    internalStatusUrl: "http://127.0.0.1:18100/api/status",
    expectedDatabaseName: "xinghuan_canvas_next",
    queuePrefix: "xinghuan:tasks:prod",
  },
};

export async function loadReleaseTargetProfile({ profile, environment }) {
  if (profile !== "old-server") throw new Error(`OLD_SERVER_TARGET_MISMATCH:unsupported-profile:${profile}`);
  if (!(environment in expectedTargets)) throw new Error(`OLD_SERVER_TARGET_MISMATCH:unsupported-environment:${environment}`);

  const config = JSON.parse(await readFile(profilePath, "utf8"));
  const target = config?.profiles?.[profile]?.[environment];
  if (!target || typeof target !== "object") throw new Error(`OLD_SERVER_TARGET_MISMATCH:missing-profile:${profile}:${environment}`);
  assertOldServerTarget(target);
  return target;
}

export function assertOldServerTarget(target) {
  const expected = expectedTargets[target?.environment];
  const mismatches = [
    ["profile", target?.profile, "old-server"],
    ["host", target?.host, "101.33.75.38"],
    ["port", Number(target?.port), 728],
    ["sshUser", target?.sshUser, "ubuntu"],
    ...Object.entries(expected || {}).map(([field, value]) => [field, target?.[field], value]),
  ].filter(([, actual, value]) => actual !== value);
  if (!expected || mismatches.length > 0) {
    throw new Error(`OLD_SERVER_TARGET_MISMATCH:${mismatches.map(([field]) => field).join(",") || "environment"}`);
  }
}

export function assertTargetOverridesMatch(args, target) {
  const fields = {
    host: "host",
    port: "port",
    user: "sshUser",
    "remote-root": "remoteRoot",
    "shared-env-file": "sharedEnvFile",
    service: "serviceName",
    "worker-service": "workerServiceName",
    "public-status-url": "publicStatusUrl",
    "internal-status-url": "internalStatusUrl",
  };
  for (const [argName, field] of Object.entries(fields)) {
    for (const value of argValues(args[argName])) {
      if (String(value).trim() !== String(target[field])) {
        throw new Error(`OLD_SERVER_TARGET_MISMATCH:override:${argName}`);
      }
    }
  }
}

export function sanitizedTargetFingerprint(target) {
  return {
    profile: target.profile,
    environment: target.environment,
    host: target.host,
    port: target.port,
    remoteRoot: target.remoteRoot,
    serviceName: target.serviceName,
    workerServiceName: target.workerServiceName,
    publicStatusUrl: target.publicStatusUrl,
    internalStatusUrl: target.internalStatusUrl,
    expectedDatabaseName: target.expectedDatabaseName,
  };
}

function argValues(value) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
