import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const sameOriginHeaders = {
  origin: baseUrl,
  referer: `${baseUrl}/`,
};
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const videoBytes = Buffer.from("00000018667479706d703432000000006d703432", "hex");

let cookie = "";
let upstreamRequest = null;

async function main() {
  const upstream = await startMockVideoServer();
  const providerId = `verify-worker-video-${Date.now()}`;
  const modelId = "verify-worker-video-model";
  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    assert(login.data?.authenticated === true, "login failed");

    const system = await fetchJson("/api/admin/system");
    assert(system.data?.redis?.status === "connected", "redis is not connected");
    assert(system.data?.database?.status === "connected", "database is not connected");

    const provider = await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify Worker Video Provider",
        baseUrl: upstream.url,
        protocol: "openai",
        enabled: true,
        apiKey: "verify-worker-video-key",
      }),
    });
    assert(provider.data?.id === providerId, "provider was not created");

    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        models: [{ modelId, capability: "video", displayName: "Verify Worker Video Model" }],
      }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    assert(Boolean(modelRecord?.id), "model was not imported");

    const prompt = "worker video adapter prompt";
    const created = await fetchJson("/api/proxy/external/video/task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: modelId,
        model: modelId,
        prompt,
        aspect_ratio: "16:9",
        duration: 6,
        resolution: "720p",
        providerParams: {
          modelRecordId: modelRecord.id,
        },
      }),
    });
    const taskId = created.data?.taskId || created.data?.id;
    assert(Boolean(taskId), "task was not created");

    let task = null;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await sleep(1000);
      const status = await fetchJson(`/api/proxy/external/video/task/${encodeURIComponent(taskId)}`);
      task = status.data;
      if (task?.status === "succeeded") break;
      if (task?.status === "failed") throw new Error(`task failed: ${task.error || (task.logs || []).join(" | ")}`);
    }

    assert(task?.status === "succeeded", `task did not succeed, current status=${task?.status || "missing"}`);
    assert(task?.raw?.adapter === "openai-video", "worker did not use video adapter");
    assert(Array.isArray(task?.remoteVideoUrls) && task.remoteVideoUrls[0]?.startsWith("http://"), "worker video result missing remote url");
    assert(Array.isArray(task?.videoUrls) && task.videoUrls[0]?.startsWith("/files/output/"), "worker video result missing materialized local url");
    assert(upstreamRequest?.body?.model === modelId, "upstream model mismatch");
    assert(upstreamRequest?.body?.prompt === prompt, "upstream prompt mismatch");
    assert(upstreamRequest?.authorization === "Bearer verify-worker-video-key", "upstream auth mismatch");

    const savedAsset = await fetch(`${baseUrl}${task.videoUrls[0]}`, { headers: { ...sameOriginHeaders, cookie } });
    assert(savedAsset.ok && /^video\//i.test(savedAsset.headers.get("content-type") || ""), "materialized worker video is not readable");

    console.log(JSON.stringify({
      ok: true,
      taskId,
      status: task.status,
      adapter: task.raw.adapter,
      localVideoUrl: task.videoUrls[0],
      upstream: {
        model: upstreamRequest.body.model,
        prompt: upstreamRequest.body.prompt,
        authorization: upstreamRequest.authorization ? "present" : "missing",
      },
    }, null, 2));
  } finally {
    if (cookie) {
      await fetchText(`/api/admin/providers/${providerId}`, { method: "DELETE" }).catch(() => undefined);
    }
    upstream.server.close();
  }
}

function startMockVideoServer() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      if (request.url === "/asset.mp4") {
        response.writeHead(200, { "content-type": "video/mp4" });
        response.end(videoBytes);
        return;
      }
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => {
        upstreamRequest = {
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          body: text ? JSON.parse(text) : {},
        };
        const address = server.address();
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${address.port}/asset.mp4` }] }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      ...sameOriginHeaders,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return;
  cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
