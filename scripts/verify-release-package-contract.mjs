import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  forbiddenArchivePatterns,
  runtimeFiles,
  validateArchiveEntries,
  workspaceManifests,
} from "./package-release.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageScriptPath = resolve(rootDir, "scripts/package-release.mjs");
const packageJsonPath = resolve(rootDir, "package.json");
const archivePath = readArchiveArg(process.argv.slice(2));

const requiredRuntimeFiles = [
  "package.json",
  "package-lock.json",
  "scripts/start-single-port.mjs",
  "scripts/db-migrate.mjs",
  "scripts/reconcile-generation-artifacts.mjs",
  "apps/api/db",
  "apps/web/dist",
  "apps/admin/dist",
  "config/environments.json",
  "config/release-target-profiles.json",
  "ops/systemd",
  "ops/nginx",
];

const requiredWorkspaceManifests = [
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

const requiredArchiveFiles = [
  "package.json",
  "package-lock.json",
  "scripts/start-single-port.mjs",
  "scripts/db-migrate.mjs",
  "scripts/reconcile-generation-artifacts.mjs",
  "apps/api/dist/server.js",
  "apps/api/dist/cli/permission-readiness.js",
  "apps/api/dist/cli/shared-resource-assets.js",
  "apps/worker/dist/worker.js",
  "config/environments.json",
  "config/release-target-profiles.json",
  "BUILD-MANIFEST.json",
  ...requiredWorkspaceManifests,
];

const requiredArchivePrefixes = [
  "apps/api/db/",
  "apps/web/dist/",
  "apps/admin/dist/",
  "ops/systemd/",
  "ops/nginx/",
];

const forbiddenExamples = [
  "apps/api/src/server.ts",
  "apps/web/src/App.tsx",
  "docs/adr/0004-workflow-scoped-deterministic-supervision.md",
  "AGENTS.md",
  "apps/api/dist/server.js.map",
  ".git/config",
  "apps/api/data/auth/auth.json",
  ".env",
  "apps/worker/dist/worker.test.js",
  "logs/api.log",
  "uploads/reference.png",
  "server.pem",
];

await verifySourceContract();
const archiveReport = archivePath ? await verifyArchiveContract(archivePath) : null;

console.log(
  JSON.stringify(
    {
      ok: true,
      verifiedFile: packageScriptPath,
      mode: archiveReport ? "archive" : "source",
      archivePath: archivePath || null,
      archiveEntries: archiveReport?.entries ?? null,
      manifestEntries: archiveReport?.manifestEntries ?? null,
    },
    null,
    2,
  ),
);

async function verifySourceContract() {
  const [source, packageJsonText] = await Promise.all([
    readFile(packageScriptPath, "utf8"),
    readFile(packageJsonPath, "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  assert.deepEqual(runtimeFiles, requiredRuntimeFiles, "release packager runtime allowlist changed");
  assert.deepEqual(
    workspaceManifests,
    requiredWorkspaceManifests,
    "release packager workspace manifest allowlist changed",
  );
  assert.ok(
    Array.isArray(forbiddenArchivePatterns) && forbiddenArchivePatterns.length > 0,
    "release packager must export forbidden archive patterns",
  );
  for (const entry of forbiddenExamples) {
    assert.throws(
      () => validateArchiveEntries([entry]),
      (error) => error instanceof Error && error.message === `RELEASE_ARCHIVE_FORBIDDEN_ENTRY:${entry}`,
      `release packager must reject ${entry}`,
    );
  }
  assert.doesNotThrow(() => validateArchiveEntries(requiredArchiveFiles));

  assert.match(
    source,
    /await\s+buildProductionRuntime\(\{\s*outDir:\s*stagingDir\s*\}\)/,
    "release packager must build the bundled production runtime into staging",
  );
  assert.match(
    source,
    /scripts\/verify-release-package-contract\.mjs["'],\s*`--archive=\$\{archivePath\}`/,
    "release packager must verify the real archive inventory after tar creation",
  );
  assert.match(
    source,
    /scripts\/verify-release-version-alignment\.mjs["'],\s*`--archive=\$\{archivePath\}`/,
    "release packager must verify archive version alignment after tar creation",
  );
  assert.equal(
    packageJson.scripts?.["verify:release-package-contract"],
    "node scripts/verify-release-package-contract.mjs",
    "package.json must preserve the release package contract command",
  );
}

async function verifyArchiveContract(archive) {
  const rawEntries = await listArchiveEntries(archive);
  const normalizedEntries = rawEntries.map(normalizeArchiveEntry).filter(Boolean);
  const fileEntries = rawEntries
    .filter((entry) => !entry.endsWith("/"))
    .map(normalizeArchiveEntry)
    .filter(Boolean);
  const rawNameByNormalized = new Map(
    rawEntries.map((entry) => [normalizeArchiveEntry(entry), entry]),
  );

  validateArchiveEntries(fileEntries);
  for (const rawEntry of rawEntries.filter((entry) => entry.endsWith("/"))) {
    const directoryEntry = `${normalizeArchiveEntry(rawEntry)}/`;
    if (forbiddenArchivePatterns.some((pattern) => pattern.test(directoryEntry))) {
      throw new Error(`RELEASE_ARCHIVE_FORBIDDEN_ENTRY:${normalizeArchiveEntry(rawEntry)}`);
    }
  }
  for (const required of requiredArchiveFiles) {
    assert.ok(fileEntries.includes(required), `RELEASE_ARCHIVE_MISSING_ENTRY:${required}`);
  }
  for (const prefix of requiredArchivePrefixes) {
    assert.ok(
      fileEntries.some((entry) => entry.startsWith(prefix)),
      `RELEASE_ARCHIVE_MISSING_PREFIX:${prefix}`,
    );
  }

  const manifestBuffer = await readArchiveEntry(
    archive,
    rawNameByNormalized.get("BUILD-MANIFEST.json") ?? "BUILD-MANIFEST.json",
  );
  const manifest = JSON.parse(manifestBuffer.toString("utf8"));
  assert.equal(manifest.schemaVersion, 1, "RELEASE_BUILD_MANIFEST_SCHEMA_INVALID");
  assert.equal(manifest.artifactType, "production-runtime", "RELEASE_BUILD_MANIFEST_TYPE_INVALID");
  assert.equal(manifest.sourceMaps, false, "RELEASE_BUILD_MANIFEST_SOURCEMAPS_INVALID");
  assert.match(String(manifest.version ?? ""), /^\d+\.\d+\.\d+$/, "RELEASE_BUILD_MANIFEST_VERSION_INVALID");
  assert.match(String(manifest.sourceCommit ?? ""), /^[0-9a-f]{40}$/i, "RELEASE_BUILD_MANIFEST_COMMIT_INVALID");
  assert.ok(!Number.isNaN(Date.parse(String(manifest.builtAt ?? ""))), "RELEASE_BUILD_MANIFEST_TIME_INVALID");
  assert.ok(Array.isArray(manifest.entries), "RELEASE_BUILD_MANIFEST_ENTRIES_INVALID");

  const manifestPaths = manifest.entries.map((entry) => entry.path);
  const expectedManifestPaths = fileEntries
    .filter((entry) => entry !== "BUILD-MANIFEST.json")
    .sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(manifestPaths, expectedManifestPaths, "RELEASE_BUILD_MANIFEST_INVENTORY_MISMATCH");
  assert.equal(
    manifest.contentManifestSha256,
    sha256(JSON.stringify(manifest.entries)),
    "RELEASE_BUILD_MANIFEST_CONTENT_HASH_MISMATCH",
  );

  for (const entry of manifest.entries) {
    assert.match(entry.path, /\S/, "RELEASE_BUILD_MANIFEST_PATH_INVALID");
    assert.ok(Number.isSafeInteger(entry.sizeBytes) && entry.sizeBytes >= 0, `RELEASE_BUILD_MANIFEST_SIZE_INVALID:${entry.path}`);
    assert.match(String(entry.sha256 ?? ""), /^[0-9a-f]{64}$/, `RELEASE_BUILD_MANIFEST_SHA_INVALID:${entry.path}`);
    const contents = await readArchiveEntry(
      archive,
      rawNameByNormalized.get(entry.path) ?? entry.path,
    );
    assert.equal(contents.byteLength, entry.sizeBytes, `RELEASE_BUILD_MANIFEST_SIZE_MISMATCH:${entry.path}`);
    assert.equal(sha256(contents), entry.sha256, `RELEASE_BUILD_MANIFEST_SHA_MISMATCH:${entry.path}`);
  }

  return { entries: normalizedEntries.length, manifestEntries: manifest.entries.length };
}

function readArchiveArg(args) {
  const matched = args.find((item) => item.startsWith("--archive="));
  return matched ? resolve(rootDir, matched.slice("--archive=".length).trim()) : "";
}

async function listArchiveEntries(archive) {
  const output = await runTar(["-tzf", archive]);
  return output
    .toString("utf8")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function readArchiveEntry(archive, entry) {
  return await runTar(["-xOf", archive, entry]);
}

async function runTar(args) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const stdout = [];
    let stderr = "";
    const child = spawn("tar", args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout));
      else rejectPromise(new Error(`tar ${args.join(" ")} failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

function normalizeArchiveEntry(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/\/+$/, "");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
