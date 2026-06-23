import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rootPackage = JSON.parse(await readFile(resolve(rootDir, "package.json"), "utf8"));
const expectedVersion = String(rootPackage.version || "").trim();
const archivePath = readArchiveArg(process.argv.slice(2));

if (!expectedVersion) {
  throw new Error("Root package.json version is empty");
}

const localChecks = [
  {
    label: "packages/shared/dist/index.js",
    path: "packages/shared/dist/index.js",
    includesAny: [[`appVersion = "${expectedVersion}"`, `appVersion = '${expectedVersion}'`], [`export const appVersion = "${expectedVersion}"`, `export const appVersion = '${expectedVersion}'`]],
  },
  {
    label: "apps/api/dist/server.js",
    path: "apps/api/dist/server.js",
    includesAny: [[`version: "${expectedVersion}"`, `version:"${expectedVersion}"`, `version = "${expectedVersion}"`]],
  },
];

for (const check of localChecks) {
  const text = await readFile(resolve(rootDir, check.path), "utf8");
  assertIncludes(text, check.includesAny, check.label, expectedVersion);
}

if (archivePath) {
  for (const check of localChecks) {
    const text = await readArchiveEntry(archivePath, check.path);
    assertIncludes(text, check.includesAny, `${archivePath}:${check.path}`, expectedVersion);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      expectedVersion,
      localChecks: localChecks.map((item) => item.path),
      archivePath: archivePath || null,
    },
    null,
    2,
  ),
);

function readArchiveArg(args) {
  const matched = args.find((item) => item.startsWith("--archive="));
  return matched ? matched.slice("--archive=".length).trim() : "";
}

function assertIncludes(text, patternGroups, label, version) {
  const missingGroups = patternGroups.filter((group) => !group.some((item) => text.includes(item)));
  if (missingGroups.length > 0) {
    const rendered = missingGroups.map((group) => group.join(" | "));
    throw new Error(`${label} does not expose expected version ${version}. Missing: ${rendered.join(", ")}`);
  }
}

async function readArchiveEntry(archive, entryPath) {
  return await new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("tar", ["-xOf", archive, entryPath], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`tar -xOf ${archive} ${entryPath} failed with code ${code}: ${stderr.trim()}`));
    });
  });
}
