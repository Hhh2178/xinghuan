import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiEntry = join(rootDir, "apps", "api", "dist", "server.js");
const webDistDir = join(rootDir, "apps", "web", "dist");
const adminDistDir = join(rootDir, "apps", "admin", "dist");
const dataDir = join(rootDir, "apps", "api", "data");

if (!existsSync(apiEntry)) {
  console.error("Missing apps/api/dist/server.js. Run npm run build:single-port first.");
  process.exit(1);
}

if (!existsSync(join(webDistDir, "index.html"))) {
  console.error("Missing apps/web/dist/index.html. Run npm run build:single-port first.");
  process.exit(1);
}

if (!existsSync(join(adminDistDir, "index.html"))) {
  console.error("Missing apps/admin/dist/index.html. Run npm run build:single-port first.");
  process.exit(1);
}

const env = {
  ...process.env,
  XINGHUAN_APP_ENV: process.env.XINGHUAN_APP_ENV ?? "local",
  XINGHUAN_API_HOST: process.env.XINGHUAN_API_HOST ?? "127.0.0.1",
  XINGHUAN_API_PORT: process.env.XINGHUAN_API_PORT ?? "18200",
  XINGHUAN_WEB_DIST_DIR: process.env.XINGHUAN_WEB_DIST_DIR ?? webDistDir,
  XINGHUAN_ADMIN_DIST_DIR: process.env.XINGHUAN_ADMIN_DIST_DIR ?? adminDistDir,
  XINGHUAN_DATA_DIR: process.env.XINGHUAN_DATA_DIR ?? dataDir,
};

const child = spawn(process.execPath, [apiEntry], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
