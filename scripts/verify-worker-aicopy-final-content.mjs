import { createServer } from "node:http";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const videoBytes = Buffer.from("00000018667479706d703432000000006d703432", "hex");
const png1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==", "base64");

let cookie = "";
let verified = false;

async function main() {
  const upstream = await startMockAicopyServer();
  const providerId = `verify-aicopy-final-${Date.now()}`;
  const modelId = "grok-imagine-video-1.5-fast";
  try {
    const login = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    assert(login.data?.authenticated === true, "login failed");

    await fetchJson("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        name: "Verify AICopy Final Content",
        baseUrl: upstream.origin,
        protocol: "aicopy",
        enabled: true,
        apiKey: "verify-aicopy-key",
      }),
    });
    const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: [{ modelId, capability: "video", displayName: "Verify AICopy Final Content" }] }),
    });
    const modelRecord = imported.data?.models?.find((model) => model.modelId === modelId);
    assert(modelRecord?.id, "model import failed");
    const updatedModel = await fetchJson(`/api/admin/models/${encodeURIComponent(modelRecord.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        protocolOverride: "aicopy",
        inputProfile: "prompt,image_reference,multi_image",
        inputCapabilities: { prompt: true, imageReference: true, multiImage: true },
        parameterSchema: JSON.stringify({
          aspectRatios: ["9:16"],
          defaultAspectRatio: "9:16",
          duration: { type: "select", options: [6, 10], default: 6 },
          resolutions: ["720p"],
          defaultResolution: "720p",
          referenceImages: { type: "image[]", max: 6 },
        }),
        advancedConfig: {
          submitPath: "videos",
          pollPathTemplate: "videos/{task_id}",
          contentPathTemplate: "videos/{task_id}/content",
          taskIdPath: "id",
          taskStatusPath: "status",
          aicopyRequestContractEnabled: false,
          referenceImageTransport: "data_url",
          requestMapping: { ratio: "size", duration: "seconds", images: "images", resolution: "" },
          requestValueTypes: { duration: "string" },
          requestValueTemplates: { size: "{preview_video_size}" },
        },
      }),
    });
    assert(updatedModel.data?.protocolOverride === "aicopy", `protocol override mismatch: ${updatedModel.data?.protocolOverride || "empty"}`);

    const imageUrls = [];
    for (const index of [1, 2, 3]) {
      const upload = new FormData();
      upload.set("file", new Blob([png1x1], { type: "image/png" }), `aifork-reference-${index}.png`);
      const uploaded = await fetchJson("/api/files/upload", { method: "POST", body: upload });
      const imageUrl = String(uploaded.data?.url || "");
      assert(imageUrl.startsWith("/files/input/"), `reference upload ${index} failed`);
      imageUrls.push(imageUrl);
    }

    const created = await fetchJson("/api/proxy/external/video/task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        providerModel: modelId,
        model: modelId,
        prompt: "她跳桑巴舞",
        aspect_ratio: "9:16",
        ratio: "9:16",
        duration: 6,
        resolution: "720p",
        images: imageUrls,
        providerParams: { modelRecordId: modelRecord.id, videoInputMode: "reference" },
      }),
    });
    const taskId = String(created.data?.taskId || created.data?.id || "");
    assert(taskId, "task creation failed");

    let task = null;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await sleep(1_000);
      task = (await fetchJson(`/api/proxy/external/video/task/${encodeURIComponent(taskId)}`)).data;
      if (task?.status === "succeeded") break;
      if (task?.status === "failed") throw new Error(`task failed: ${task.error || task.failureReason || "unknown"}`);
    }
    assert(task?.status === "succeeded", `task did not succeed: ${task?.status || "missing"}`);
    assert(task.raw?.adapter === "aicopy-video", "AICopy adapter was not used");
    assert(task.videoUrls?.[0]?.startsWith("/files/output/"), "final content was not materialized");
    assert(upstream.submitCount === 1, "unexpected AICopy submit count");
    assert(upstream.pollCount === 2, "AICopy transient 502 should recover on the second poll");
    assert(upstream.contentCount === 1, "AICopy content endpoint was not fetched once");
    assert(upstream.submitAuthorization === "Bearer verify-aicopy-key", "submit authorization mismatch");
    assert(upstream.contentAuthorization === "Bearer verify-aicopy-key", "content authorization mismatch");
    assert(upstream.body?.seconds === "6", "duration was not serialized as seconds");
    assert(upstream.body?.size === "720x1280", "ratio was not serialized as preview size");
    assert(Array.isArray(upstream.body?.images) && upstream.body.images.length === 3, "three images were not serialized");
    assert(upstream.body.images.every((value) => /^data:image\/png;base64,/.test(value)), "images were not inlined as Data URLs");
    verified = true;

    console.log(JSON.stringify({
      ok: true,
      taskId,
      status: task.status,
      adapter: task.raw.adapter,
      localVideoUrl: task.videoUrls[0],
      upstream: {
        submitCount: upstream.submitCount,
        pollCount: upstream.pollCount,
        contentCount: upstream.contentCount,
        seconds: upstream.body.seconds,
        size: upstream.body.size,
        imageCount: upstream.body.images.length,
        imageTransport: "data_url",
      },
    }, null, 2));
  } finally {
    if (cookie && verified) await fetchText(`/api/admin/providers/${encodeURIComponent(providerId)}`, { method: "DELETE" }).catch(() => undefined);
    upstream.server.close();
  }
}

function startMockAicopyServer() {
  return new Promise((resolve) => {
    const state = {
      server: null,
      origin: "",
      body: null,
      submitCount: 0,
      pollCount: 0,
      contentCount: 0,
      submitAuthorization: "",
      contentAuthorization: "",
    };
    const server = createServer((request, response) => {
      if (request.method === "POST" && request.url === "/v1/videos") {
        let text = "";
        request.on("data", (chunk) => { text += chunk; });
        request.on("end", () => {
          state.submitCount += 1;
          state.submitAuthorization = String(request.headers.authorization || "");
          state.body = text ? JSON.parse(text) : {};
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ id: "task_mock_final_content", status: "queued", progress: 0 }));
        });
        return;
      }
      if (request.method === "GET" && request.url === "/v1/videos/task_mock_final_content") {
        state.pollCount += 1;
        if (state.pollCount === 1) {
          response.writeHead(502, { "content-type": "text/html" });
          response.end("<html><body><h1>502 Bad Gateway</h1></body></html>");
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ id: "task_mock_final_content", status: "completed", progress: 100 }));
        return;
      }
      if (request.method === "GET" && request.url?.startsWith("/v1/videos/task_mock_final_content/content")) {
        state.contentCount += 1;
        state.contentAuthorization = String(request.headers.authorization || "");
        if (state.contentAuthorization !== "Bearer verify-aicopy-key") {
          response.writeHead(401, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        response.writeHead(200, { "content-type": "video/mp4", "content-length": videoBytes.length });
        response.end(videoBytes);
        return;
      }
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("mock server failed to start");
      Object.assign(state, { server, origin: `http://127.0.0.1:${address.port}` });
      resolve(state);
    });
  });
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function fetchText(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
}

function withCookie(options) {
  return {
    ...options,
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/`,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (raw) cookie = raw.split(";")[0];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
