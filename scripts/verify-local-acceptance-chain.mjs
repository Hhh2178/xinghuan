import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.XINGHUAN_VERIFY_PORT || "18333";
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = resolve(rootDir, ".tmp", `verify-local-acceptance-${port}`);

const serverEnv = {
  ...process.env,
  XINGHUAN_APP_ENV: "local",
  XINGHUAN_API_HOST: "127.0.0.1",
  XINGHUAN_API_PORT: port,
  XINGHUAN_DATA_DIR: dataDir,
  XINGHUAN_WEB_DIST_DIR: resolve(rootDir, "apps", "web", "dist"),
  XINGHUAN_ADMIN_DIST_DIR: resolve(rootDir, "apps", "admin", "dist"),
};

const verifyEnv = {
  ...process.env,
  XINGHUAN_VERIFY_BASE_URL: baseUrl,
  XINGHUAN_DATA_DIR: dataDir,
};

const commands = [
  ["build:single-port", ["npm", ["run", "build:single-port"], {}]],
  ["verify:single-port", ["npm", ["run", "verify:single-port"], { env: verifyEnv }]],
  ["verify:node-acceptance-matrix", ["npm", ["run", "verify:node-acceptance-matrix"], {}]],
  ["verify:canvas-node-render-smoke", ["npm", ["run", "verify:canvas-node-render-smoke"], { env: verifyEnv }]],
  ["verify:generic-node-catalog", ["npm", ["run", "verify:generic-node-catalog"], {}]],
  ["verify:model-catalog", ["npm", ["run", "verify:model-catalog"], { env: verifyEnv }]],
  ["verify:ai-watermark-api", ["npm", ["run", "verify:ai-watermark-api"], { env: verifyEnv }]],
  ["verify:external-image-proxy", ["npm", ["run", "verify:external-image-proxy"], { env: verifyEnv }]],
  ["verify:external-video-proxy", ["npm", ["run", "verify:external-video-proxy"], { env: verifyEnv }]],
  ["verify:external-chat-proxy", ["npm", ["run", "verify:external-chat-proxy"], { env: verifyEnv }]],
  ["verify:task-payload-api", ["npm", ["run", "verify:task-payload-api"], { env: verifyEnv }]],
  ["verify:task-lifecycle", ["npm", ["run", "verify:task-lifecycle"], { env: verifyEnv }]],
  ["verify:canvas-resource-api", ["npm", ["run", "verify:canvas-resource-api"], { env: verifyEnv }]],
  ["verify:output-node-preview-layout", ["npm", ["run", "verify:output-node-preview-layout"], {}]],
  ["verify:runninghub-workflow-contract", ["npm", ["run", "verify:runninghub-workflow-contract"], {}]],
  ["verify:runninghub-workflow-api", ["npm", ["run", "verify:runninghub-workflow-api"], { env: verifyEnv }]],
  ["verify:runninghub-worker-submit-contract", ["node", ["scripts/verify-runninghub-worker-submit-contract.mjs"], {}]],
  ["verify:worker-adapter-contract", ["npm", ["run", "verify:worker-adapter-contract"], {}]],
  ["verify:worker-grsai-contract", ["npm", ["run", "verify:worker-grsai-contract"], {}]],
  ["verify:worker-output-materializer", ["npm", ["run", "verify:worker-output-materializer"], {}]],
  ["verify:output-material-prune", ["npm", ["run", "verify:output-material-prune"], {}]],
];

let server = null;

try {
  await mkdir(dataDir, { recursive: true });
  await run("build:single-port", "npm", ["run", "build:single-port"]);
  server = spawn("node", ["apps/api/dist/server.js"], {
    cwd: rootDir,
    env: serverEnv,
    stdio: "inherit",
  });
  await waitForHealth(baseUrl);

  for (const [label, [command, args, options]] of commands.slice(1)) {
    await run(label, command, args, options);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    dataDir,
    checks: commands.map(([label]) => label),
  }, null, 2));
} finally {
  if (server && !server.killed) server.kill();
}

async function run(label, command, args, options = {}) {
  console.log(`\n== ${label} ==`);
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: options.env || process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

async function waitForHealth(origin) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const pidHint = server?.pid ? ` pid=${server.pid}` : "";
  const logsHint = await readFile(join(dataDir, "server.log"), "utf8").catch(() => "");
  throw new Error(`server did not become healthy${pidHint}${logsHint ? `\n${logsHint}` : ""}`);
}
