import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const external = ["busboy", "pg", "redis", "sharp"];

export function parseProductionRuntimeOutDir(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("PRODUCTION_RUNTIME_OUT_REQUIRED");
  }
  return value;
}

export async function buildProductionRuntime({ outDir }) {
  const targetRoot = resolve(rootDir, parseProductionRuntimeOutDir(outDir));
  const apiEntry = resolve(targetRoot, "apps/api/dist/server.js");
  const workerEntry = resolve(targetRoot, "apps/worker/dist/worker.js");
  const permissionReadinessEntry = resolve(
    targetRoot,
    "apps/api/dist/cli/permission-readiness.js",
  );
  await mkdir(dirname(apiEntry), { recursive: true });
  await mkdir(dirname(workerEntry), { recursive: true });
  await mkdir(dirname(permissionReadinessEntry), { recursive: true });

  const common = {
    bundle: true,
    minify: true,
    sourcemap: false,
    platform: "node",
    format: "esm",
    target: "node22",
    external,
    legalComments: "none",
    treeShaking: true,
  };

  await build({
    ...common,
    entryPoints: [resolve(rootDir, "apps/api/src/server.ts")],
    outfile: apiEntry,
  });
  await build({
    ...common,
    entryPoints: [resolve(rootDir, "apps/worker/src/worker.ts")],
    outfile: workerEntry,
  });
  await build({
    ...common,
    entryPoints: [resolve(rootDir, "apps/api/src/cli/permission-readiness.ts")],
    outfile: permissionReadinessEntry,
  });

  return { apiEntry, workerEntry, permissionReadinessEntry };
}

function argument(name) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return match?.slice(prefix.length);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await buildProductionRuntime({ outDir: argument("out") });
}
