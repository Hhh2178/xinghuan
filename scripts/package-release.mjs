import { copyFile, cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(rootDir, "dist-release");
const releaseName = safeName(process.argv[2] || `xinghuan-canvas-release-${timestamp()}`);
const archivePath = join(outDir, `${releaseName}.tar.gz`);

const requiredPaths = [
  "package.json",
  "package-lock.json",
  "scripts/start-single-port.mjs",
  "scripts/db-migrate.mjs",
  "scripts/prune-old-output-materials.mjs",
  "apps/api/package.json",
  "apps/api/dist/server.js",
  "apps/api/db",
  "apps/worker/package.json",
  "apps/worker/dist/worker.js",
  "apps/web/package.json",
  "apps/web/dist/index.html",
  "apps/admin/package.json",
  "apps/admin/dist/index.html",
  "packages/shared/package.json",
  "packages/shared/dist",
  "packages/canvas-core/package.json",
  "packages/canvas-core/dist",
  "packages/model-core/package.json",
  "packages/model-core/dist",
  "packages/ui/package.json",
  "packages/ui/dist",
];

const includedPaths = [
  "package.json",
  "package-lock.json",
  "scripts/start-single-port.mjs",
  "scripts/db-migrate.mjs",
  "scripts/prune-old-output-materials.mjs",
  "config",
  "ops/systemd",
  "ops/nginx",
  "apps/api/package.json",
  "apps/api/dist",
  "apps/api/db",
  "apps/worker/package.json",
  "apps/worker/dist",
  "apps/web/package.json",
  "apps/web/dist",
  "apps/admin/package.json",
  "apps/admin/dist",
  "packages/shared/package.json",
  "packages/shared/dist",
  "packages/canvas-core/package.json",
  "packages/canvas-core/dist",
  "packages/model-core/package.json",
  "packages/model-core/dist",
  "packages/ui/package.json",
  "packages/ui/dist",
  "AGENTS.md",
  "MEMORY.md",
  "DEVLOG.md",
];

const excludedLabels = [
  ".git",
  "node_modules",
  "apps/api/data",
  "output",
  "logs",
  "development/_archive",
  "dist-release",
  "local uploads and generated runtime files",
  "runtime secrets and .env files",
];

await assertRequiredPaths();
await mkdir(outDir, { recursive: true });

const stagingDir = await mkdtemp(join(tmpdir(), "xinghuan-release-"));
try {
  for (const item of includedPaths) {
    await copyRelative(item, stagingDir);
  }
  await writeManifest(stagingDir);
  await rm(archivePath, { force: true });
  await runTar(stagingDir, archivePath);
  const archive = await stat(archivePath);
  console.log(JSON.stringify({
    ok: true,
    archive: archivePath,
    sizeBytes: archive.size,
    sizeMB: Number((archive.size / 1024 / 1024).toFixed(2)),
    stagingDir,
    included: includedPaths,
    excluded: excludedLabels,
  }, null, 2));
} finally {
  console.log(`Release staging kept for manual cleanup: ${stagingDir}`);
}

async function assertRequiredPaths() {
  const missing = requiredPaths.filter((item) => !existsSync(join(rootDir, item)));
  if (missing.length > 0) {
    console.error("RELEASE_PACKAGE_MISSING_BUILD_OUTPUTS");
    for (const item of missing) console.error(`- ${item}`);
    console.error("Run npm run build:single-port before packaging.");
    process.exit(1);
  }
}

async function copyRelative(item, stagingDir) {
  const source = join(rootDir, item);
  if (!existsSync(source)) return;
  const target = join(stagingDir, item);
  await mkdir(dirname(target), { recursive: true });
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await cp(source, target, { recursive: true });
  } else {
    await copyFile(source, target);
  }
}

async function writeManifest(stagingDir) {
  const lines = [
    "# Xinghuan Canvas Release Package",
    "",
    "This archive is intentionally runtime-only.",
    "",
    "Included:",
    ...includedPaths.map((item) => `- ${item}`),
    "",
    "Excluded:",
    ...excludedLabels.map((item) => `- ${item}`),
    "",
    "Server runtime data must stay in the shared directory on the VPS.",
  ];
  await writeFile(join(stagingDir, "RELEASE_PACKAGE.md"), `${lines.join("\n")}\n`, "utf-8");
}

async function runTar(cwd, target) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("tar", ["-czf", target, "-C", cwd, "."], {
      cwd,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`tar exited with code ${code}`));
    });
    child.on("error", rejectPromise);
  });
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
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}
