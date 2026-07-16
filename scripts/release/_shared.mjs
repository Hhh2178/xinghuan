import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function parseArgs(argv) {
  const result = { _: [] };
  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      result._.push(raw);
      continue;
    }
    const pair = raw.slice(2);
    const eqIndex = pair.indexOf("=");
    const key = eqIndex >= 0 ? pair.slice(0, eqIndex) : pair;
    const value = eqIndex >= 0 ? pair.slice(eqIndex + 1) : "true";
    if (key in result) {
      result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function flagEnabled(value) {
  if (value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(normalized);
}

export function requiredArg(args, name, helpText) {
  const value = firstArg(args[name]);
  if (!value) {
    if (helpText) console.error(helpText);
    throw new Error(`MISSING_REQUIRED_ARG:${name}`);
  }
  return String(value).trim();
}

export function firstArg(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function arrayArg(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
}

export function shellQuote(value) {
  const text = String(value);
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

export async function ensureFileExists(pathValue) {
  const path = resolve(pathValue);
  await access(path, constants.F_OK);
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new Error(`NOT_A_FILE:${path}`);
  return path;
}

export async function runCommand(command, args = [], options = {}) {
  const {
    cwd = rootDir,
    env,
    inherit = true,
    capture = false,
  } = options;
  return await new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      shell: false,
      stdio: inherit && !capture ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
        if (inherit && capture) process.stdout.write(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
        if (inherit && capture) process.stderr.write(chunk);
      });
    }
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise({ code, stdout, stderr });
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

export function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

export function helpRequested(args) {
  return flagEnabled(args.help) || flagEnabled(args.h);
}

export function defaultGrayConfig() {
  return {
    host: "101.33.75.38",
    port: "728",
    user: "ubuntu",
    remoteRoot: "/opt/apps/xinghuan-canvas-next",
    internalStatusUrl: "http://127.0.0.1:18200/api/status",
    publicStatusUrl: "https://canvas-next.hhh2121.xyz/api/status",
    serviceName: "xinghuan-canvas-next.service",
    workerServiceName: "xinghuan-canvas-next-worker.service",
  };
}

export async function loadEnvironmentConfig(environment = "gray") {
  const configPath = resolve(rootDir, "config/environments.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const entry = config?.environments?.[environment];
  if (!entry) throw new Error(`UNKNOWN_RELEASE_ENVIRONMENT:${environment}`);
  return { environment, ...entry };
}

export function archiveOutputPath(releaseId) {
  return resolve(rootDir, "dist-release", `${releaseId}.tar.gz`);
}

export function sshTarget(user, host) {
  return `${user}@${host}`;
}

export function remoteReleaseDir(remoteRoot, releaseId) {
  return `${remoteRoot}/releases/${releaseId}`;
}

export function tmpArchivePath(remoteTmpDir, localArchivePath) {
  return `${remoteTmpDir}/${basename(localArchivePath)}`;
}
