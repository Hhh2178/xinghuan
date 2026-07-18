import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { join, resolve } from "node:path";

const port = Number(process.env.XINGHUAN_VERIFY_PORT || 18334);
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = resolve(".tmp", `verify-api-aborted-response-${port}`);
let output = "";

await mkdir(dataDir, { recursive: true });
const server = spawn("node", ["apps/api/dist/server.js"], {
  env: {
    ...process.env,
    XINGHUAN_APP_ENV: "local",
    XINGHUAN_API_HOST: "127.0.0.1",
    XINGHUAN_API_PORT: String(port),
    XINGHUAN_DATA_DIR: dataDir,
    XINGHUAN_WEB_DIST_DIR: resolve("apps/web/dist"),
    XINGHUAN_ADMIN_DIST_DIR: resolve("apps/admin/dist"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

try {
  await waitForHealth();
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@xinghuan.local", password: "admin123456" }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] || "";
  const userId = (await login.json()).data?.user?.id;
  if (!cookie || !userId) throw new Error("local login did not produce an authenticated user");
  const filename = "aborted-artifact.bin";
  await mkdir(join(dataDir, "users", userId, "output"), { recursive: true });
  await writeFile(join(dataDir, "users", userId, "output", filename), Buffer.alloc(8 * 1024 * 1024, 7));
  const registered = await fetch(`${baseUrl}/api/generation-library/items`, {
    method: "POST",
    headers: { origin: baseUrl, referer: `${baseUrl}/`, cookie, "content-type": "application/json" },
    body: JSON.stringify({ kind: "image", url: `/files/output/${filename}`, title: "Abort stream test" }),
  }).then((response) => response.json());
  const artifactId = registered.data?.id;
  if (!artifactId) throw new Error("artifact registration failed");

  for (let round = 0; round < 5; round += 1) {
    await Promise.all(Array.from({ length: 20 }, () => abortAssetRequest(`/api/materials/generation-library/${encodeURIComponent(artifactId)}/content`, cookie)));
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));

  if (server.exitCode !== null) throw new Error(`API exited after aborted responses (code=${server.exitCode})\n${output}`);
  const status = await fetch(`${baseUrl}/api/status`);
  if (!status.ok) throw new Error(`API health returned ${status.status} after aborted responses`);
  console.log(JSON.stringify({ ok: true, abortedRequests: 100, artifactId, serverAlive: true }, null, 2));
} finally {
  if (server.exitCode === null) server.kill();
}

function abortAssetRequest(path, cookie) {
  return new Promise((resolveRequest) => {
    const socket = connect(port, "127.0.0.1");
    const finish = () => {
      socket.destroy();
      resolveRequest();
    };
    socket.once("connect", () => socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nCookie: ${cookie}\r\nConnection: close\r\n\r\n`));
    socket.once("data", finish);
    socket.once("error", finish);
    socket.setTimeout(5000, finish);
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`API exited before health check\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/status`);
      if (response.ok) return;
    } catch {
      // Keep polling while the child starts.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`API did not become healthy\n${output}`);
}
