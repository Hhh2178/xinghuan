import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rootPackage = JSON.parse(await readFile(resolve(rootDir, "package.json"), "utf8"));
const expectedVersion = String(rootPackage.version || "").trim();
const archivePath = readArchiveArg(process.argv.slice(2));

if (!expectedVersion) {
  fail("root package.json version is empty");
}

const localChecks = [
  {
    label: "packages/shared/dist/index.js",
    path: "packages/shared/dist/index.js",
    includesAny: [
      `appVersion = "${expectedVersion}"`,
      `appVersion = '${expectedVersion}'`,
      `export const appVersion = "${expectedVersion}"`,
      `export const appVersion = '${expectedVersion}'`,
      `export const appVersion="${expectedVersion}"`,
      `export const appVersion='${expectedVersion}'`,
      "rootPackage.version",
    ],
  },
  {
    label: "apps/api/dist/server.js",
    path: "apps/api/dist/server.js",
    includesAny: [
      `version: "${expectedVersion}"`,
      `version:"${expectedVersion}"`,
      `version = "${expectedVersion}"`,
      "version: appVersion",
      "version:appVersion",
      "version = appVersion",
    ],
  },
];

const webDistVersionCheck = await readWebDistVersionCheck(resolve(rootDir, "apps/web/dist"), expectedVersion);

for (const check of localChecks) {
  const text = await readFile(resolve(rootDir, check.path), "utf8");
  assertIncludesAny(text, check.includesAny, check.label);
}

let archiveManifestVersion = null;
if (archivePath) {
  const archiveEntries = await listArchiveEntries(archivePath);
  const manifestRawName = findArchiveEntry(archiveEntries, "BUILD-MANIFEST.json");
  const apiRawName = findArchiveEntry(archiveEntries, "apps/api/dist/server.js");
  const webIndexRawName = findArchiveEntry(archiveEntries, "apps/web/dist/index.html");
  if (!manifestRawName) fail(`${archivePath} is missing BUILD-MANIFEST.json`);
  if (!apiRawName) fail(`${archivePath} is missing apps/api/dist/server.js`);
  if (!webIndexRawName) fail(`${archivePath} is missing apps/web/dist/index.html`);

  let manifest;
  try {
    manifest = JSON.parse((await readArchiveEntry(archivePath, manifestRawName)).toString("utf8"));
  } catch (error) {
    fail(`${archivePath}:BUILD-MANIFEST.json is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  archiveManifestVersion = String(manifest?.version ?? "").trim();
  if (archiveManifestVersion !== expectedVersion) {
    fail(`archive manifest version ${archiveManifestVersion || "<empty>"} does not match ${expectedVersion}`);
  }

  const apiText = (await readArchiveEntry(archivePath, apiRawName)).toString("utf8");
  assertArchiveApiVersion(apiText, expectedVersion, `${archivePath}:apps/api/dist/server.js`);
  const webIndexText = (await readArchiveEntry(archivePath, webIndexRawName)).toString("utf8");
  const webAssetPath = extractWebAssetPath(webIndexText, `${archivePath}:apps/web/dist/index.html`);
  const webAssetRawName = findArchiveEntry(archiveEntries, `apps/web/dist/${webAssetPath}`);
  if (!webAssetRawName) fail(`${archivePath} is missing apps/web/dist/${webAssetPath}`);
  assertWebAssetVersion(
    (await readArchiveEntry(archivePath, webAssetRawName)).toString("utf8"),
    expectedVersion,
    `${archivePath}:apps/web/dist/${webAssetPath}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      expectedVersion,
      localChecks: localChecks.map((item) => item.path),
      webDistVersionCheck,
      archivePath: archivePath || null,
      archiveManifestVersion,
    },
    null,
    2,
  ),
);

function readArchiveArg(args) {
  const matched = args.find((item) => item.startsWith("--archive="));
  return matched ? resolve(rootDir, matched.slice("--archive=".length).trim()) : "";
}

async function readWebDistVersionCheck(webDistDir, expected) {
  const indexText = await readFile(resolve(webDistDir, "index.html"), "utf8");
  const assetPath = extractWebAssetPath(indexText, "apps/web/dist/index.html");
  const assetText = await readFile(resolve(webDistDir, assetPath), "utf8");
  assertWebAssetVersion(assetText, expected, `apps/web/dist/${assetPath}`);
  return { index: "apps/web/dist/index.html", asset: `apps/web/dist/${assetPath}` };
}

function extractWebAssetPath(indexText, label) {
  const match = /<script[^>]+src="\/assets\/([^\"]+\.js)"/i.exec(indexText);
  if (!match?.[1]) fail(`${label} does not reference a web entry asset`);
  return `assets/${match[1]}`;
}

function assertWebAssetVersion(text, version, label) {
  if (!text.includes(`\`${version}\``) && !text.includes(`"${version}"`) && !text.includes(`'${version}'`)) {
    fail(`${label} does not expose expected web app version ${version}`);
  }
}

function assertIncludesAny(text, candidates, label) {
  if (!candidates.some((item) => text.includes(item))) {
    fail(`${label} does not expose expected API status version ${expectedVersion}`);
  }
}

function assertArchiveApiVersion(text, version, label) {
  const hasVersionLiteral = text.includes(`"${version}"`) || text.includes(`'${version}'`);
  const hasStatusRoute = text.includes("/api/status");
  const hasVersionProperty = /\bversion\s*:/.test(text);
  if (!hasVersionLiteral || !hasStatusRoute || !hasVersionProperty) {
    fail(`${label} does not expose minified API status version ${version}`);
  }
}

async function listArchiveEntries(archive) {
  const output = await runTar(["-tzf", archive]);
  return output
    .toString("utf8")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function findArchiveEntry(entries, expected) {
  return entries.find((entry) => normalizeArchiveEntry(entry) === expected) ?? "";
}

async function readArchiveEntry(archive, entryPath) {
  return await runTar(["-xOf", archive, entryPath]);
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

function fail(message) {
  throw new Error(`RELEASE_VERSION_MISMATCH:${message}`);
}
