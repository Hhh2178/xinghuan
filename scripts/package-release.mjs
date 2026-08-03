import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildProductionRuntime } from "./build-production-runtime.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const runtimeFiles = [
  "package.json",
  "package-lock.json",
  "scripts/start-single-port.mjs",
  "scripts/db-migrate.mjs",
  "apps/api/db",
  "apps/web/dist",
  "apps/admin/dist",
  "config/environments.json",
  "config/release-target-profiles.json",
  "ops/systemd",
  "ops/nginx",
];

export const workspaceManifests = [
  "apps/admin/package.json",
  "apps/api/package.json",
  "apps/comfyui-connector/package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/agent-core/package.json",
  "packages/canvas-core/package.json",
  "packages/model-core/package.json",
  "packages/shared/package.json",
  "packages/ui/package.json",
];

const allowedFiles = new Set([
  ...runtimeFiles.filter((path) => !isDirectoryAllowlistEntry(path)),
  ...workspaceManifests,
  "BUILD-MANIFEST.json",
]);
const allowedPrefixes = [
  "apps/api/db/",
  "apps/api/dist/",
  "apps/worker/dist/",
  "apps/web/dist/",
  "apps/admin/dist/",
  "ops/systemd/",
  "ops/nginx/",
];

export const forbiddenArchivePatterns = [
  /(^|\/)src\//i,
  /(^|\/)docs\//i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules\//i,
  /^apps\/(?:api|worker)\/data\//i,
  /(^|\/)(?:output|logs?|uploads?)(\/|$)/i,
  /(^|\/)__tests__(\/|$)/i,
  /(?:^|\/)\.env(?:\.|$)/i,
  /(?:^|\/)(?:AGENTS|MEMORY|DEVLOG)\.md$/i,
  /\.(?:ts|tsx|map)$/i,
  /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/i,
  /\.(?:pem|key|p12|pfx)$/i,
  /(?:^|\/)(?:secrets?|credentials?)(?:\.[^/]*)?$/i,
];

export function validateArchiveEntries(entries) {
  for (const originalEntry of entries) {
    const entry = normalizeArchiveEntry(originalEntry);
    if (
      !entry ||
      entry.startsWith("/") ||
      /^[a-z]:\//i.test(entry) ||
      entry.split("/").includes("..") ||
      forbiddenArchivePatterns.some((pattern) => pattern.test(entry)) ||
      (!allowedFiles.has(entry) && !allowedPrefixes.some((prefix) => entry.startsWith(prefix)))
    ) {
      throw new Error(`RELEASE_ARCHIVE_FORBIDDEN_ENTRY:${String(originalEntry)}`);
    }
  }
  return true;
}

export async function packageRelease({
  releaseName = `xinghuan-canvas-release-${timestamp()}`,
  projectRoot = rootDir,
} = {}) {
  const safeReleaseName = safeName(releaseName);
  const outDir = resolve(projectRoot, "dist-release");
  const archivePath = join(outDir, `${safeReleaseName}.tar.gz`);
  const sidecarPath = `${archivePath}.sha256`;

  await assertRequiredPaths(projectRoot);
  await runNodeScript(projectRoot, ["scripts/verify-release-version-alignment.mjs"]);
  await mkdir(outDir, { recursive: true });

  const stagingDir = await mkdtemp(join(tmpdir(), "xinghuan-sealed-release-"));
  for (const item of [...runtimeFiles, ...workspaceManifests]) {
    await copyRelative(projectRoot, item, stagingDir);
  }

  await buildProductionRuntime({ outDir: stagingDir });

  const entries = await buildContentEntries(stagingDir);
  validateArchiveEntries(entries.map((entry) => entry.path));
  const rootPackage = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  const sourceCommit = await readCommandOutput(projectRoot, "git", ["rev-parse", "HEAD"]);
  const canonicalEntries = JSON.stringify(entries);
  const manifest = {
    schemaVersion: 1,
    version: String(rootPackage.version),
    sourceCommit: sourceCommit.trim(),
    builtAt: new Date().toISOString(),
    artifactType: "production-runtime",
    sourceMaps: false,
    entries,
    contentManifestSha256: sha256(canonicalEntries),
  };
  await writeFile(
    join(stagingDir, "BUILD-MANIFEST.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  validateArchiveEntries([
    ...entries.map((entry) => entry.path),
    "BUILD-MANIFEST.json",
  ]);
  await runTar(stagingDir, archivePath);
  const archiveDigest = sha256(await readFile(archivePath));
  await writeFile(sidecarPath, `${archiveDigest}  ${safeReleaseName}.tar.gz\n`, "utf8");
  const archive = await stat(archivePath);

  const result = {
    ok: true,
    archive: archivePath,
    sidecar: sidecarPath,
    sha256: archiveDigest,
    sizeBytes: archive.size,
    sizeMB: Number((archive.size / 1024 / 1024).toFixed(2)),
    stagingDir,
    entries: entries.length + 1,
  };
  console.log(JSON.stringify(result, null, 2));
  console.log(`Release staging kept for manual cleanup: ${stagingDir}`);
  return result;
}

async function assertRequiredPaths(projectRoot) {
  const missing = [...runtimeFiles, ...workspaceManifests].filter(
    (item) => !existsSync(join(projectRoot, item)),
  );
  if (missing.length > 0) {
    throw new Error(
      `RELEASE_PACKAGE_MISSING_BUILD_OUTPUTS:${missing.join(",")}\nRun npm run build:single-port before packaging.`,
    );
  }
}

async function copyRelative(projectRoot, item, stagingDir) {
  const source = join(projectRoot, item);
  const target = join(stagingDir, item);
  await mkdir(dirname(target), { recursive: true });
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await cp(source, target, { recursive: true });
  } else {
    await copyFile(source, target);
  }
}

async function buildContentEntries(stagingDir) {
  const files = await listRegularFiles(stagingDir);
  const entries = await Promise.all(
    files.map(async (absolutePath) => {
      const contents = await readFile(absolutePath);
      return {
        path: normalizeArchiveEntry(relative(stagingDir, absolutePath)),
        sizeBytes: contents.byteLength,
        sha256: sha256(contents),
      };
    }),
  );
  return entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function listRegularFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listRegularFiles(absolutePath)));
    } else if (entry.isFile()) {
      result.push(absolutePath);
    }
  }
  return result;
}

async function runTar(stagingDir, archivePath) {
  await runCommand(stagingDir, "tar", ["-czf", archivePath, "-C", stagingDir, "."], true);
}

async function runNodeScript(projectRoot, args) {
  await runCommand(projectRoot, process.execPath, args, true);
}

async function readCommandOutput(cwd, command, args) {
  return await runCommand(cwd, command, args, false);
}

async function runCommand(cwd, command, args, inheritOutput) {
  return await new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd,
      stdio: inheritOutput ? "inherit" : ["ignore", "pipe", "pipe"],
      shell: false,
    });
    if (!inheritOutput) {
      child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    }
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function normalizeArchiveEntry(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/\/+$/, "");
}

function isDirectoryAllowlistEntry(value) {
  return [
    "apps/api/db",
    "apps/web/dist",
    "apps/admin/dist",
    "ops/systemd",
    "ops/nginx",
  ].includes(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeName(value) {
  return String(value || "release")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "release";
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await packageRelease({ releaseName: process.argv[2] });
}
