import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL || process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL || "";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD || process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || "";
const providerId = process.env.XINGHUAN_AICOPY_PROVIDER_ID || "custom-api-1782805467175";
const modelId = "sd2-720p-mini";
const modelRecordId = `${providerId}-video-${modelId}`;
const duration = 6;
const prompt = "她跳桑巴舞";
const ratio = "9:16";
const imagePath = process.env.XINGHUAN_AICOPY_TEST_IMAGE || "";
const outputPath = process.env.XINGHUAN_AICOPY_TEST_OUTPUT || "/tmp/aicopy-sd2-mini-six-second.mp4";
const maxWaitMs = 20 * 60 * 1000;
const pollIntervalMs = 3_000;

let cookie = "";

async function main() {
  assert(process.env.XINGHUAN_ALLOW_PAID_AICOPY_TEST === "1", "PAID_TEST_NOT_EXPLICITLY_ENABLED");
  assert(loginEmail && loginPassword, "GRAY_LOGIN_CREDENTIALS_NOT_CONFIGURED");
  assert(imagePath, "XINGHUAN_AICOPY_TEST_IMAGE_REQUIRED");

  const imageBytes = await readFile(imagePath);
  assert(imageBytes.length > 0, "TEST_IMAGE_EMPTY");

  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(login.data?.authenticated === true, "GRAY_LOGIN_FAILED");

  const upload = new FormData();
  upload.set("file", new Blob([imageBytes], { type: "image/png" }), "aicopy-sd2-mini-first-frame.png");
  const uploaded = await fetchJson("/api/files/upload", { method: "POST", body: upload });
  const imageUrl = String(uploaded.data?.url || "");
  assert(imageUrl.startsWith("/files/input/"), "TEST_IMAGE_UPLOAD_FAILED");

  const submitted = await fetchJson("/api/proxy/external/video/task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerId,
      providerModel: modelId,
      model: modelId,
      prompt,
      aspect_ratio: ratio,
      ratio,
      duration,
      resolution: "720p",
      images: [imageUrl],
      first_frame: imageUrl,
      audios: [],
      providerParams: {
        modelRecordId,
        videoInputMode: "first",
        sourceNodeId: "validation-aicopy-sd2-mini-first-frame",
        sourceCanvasId: "validation-aicopy-sd2-mini-six-second",
      },
    }),
  });
  const taskId = String(submitted.data?.taskId || submitted.data?.id || "");
  assert(taskId, "PAID_TASK_ID_MISSING");
  process.stderr.write(`[paid-validation] submitted ${taskId}\n`);

  const startedAt = Date.now();
  let task = null;
  let lastState = "";
  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(pollIntervalMs);
    const response = await fetchJson(`/api/proxy/external/video/task/${encodeURIComponent(taskId)}`);
    task = response.data || {};
    const state = `${task.status || "unknown"}|${task.providerState || ""}|${task.progress || ""}`;
    if (state !== lastState) {
      lastState = state;
      process.stderr.write(`[paid-validation] ${state}\n`);
    }
    if (task.status === "succeeded") break;
    if (task.status === "failed" || task.status === "cancelled") {
      throw new Error(`PAID_TASK_${String(task.status).toUpperCase()}: ${task.error || task.failureReason || "unknown"}`);
    }
  }

  assert(task?.status === "succeeded", `PAID_TASK_TIMEOUT:${taskId}`);
  const videoUrl = String(task.videoUrls?.[0] || "");
  assert(videoUrl.startsWith("/files/output/"), "PAID_TASK_NOT_MATERIALIZED_LOCALLY");
  const mediaResponse = await fetch(`${baseUrl}${videoUrl}`, { headers: requestHeaders() });
  assert(mediaResponse.ok, `PAID_TASK_MEDIA_DOWNLOAD_FAILED:${mediaResponse.status}`);
  const mediaBytes = Buffer.from(await mediaResponse.arrayBuffer());
  assert(mediaBytes.length > 0, "PAID_TASK_MEDIA_EMPTY");
  await writeFile(outputPath, mediaBytes);

  console.log(JSON.stringify({
    ok: true,
    taskId,
    status: task.status,
    providerState: task.providerState,
    progress: task.progress,
    adapter: task.raw?.adapter,
    localVideoUrl: videoUrl,
    outputPath,
    sizeBytes: mediaBytes.length,
    sha256: createHash("sha256").update(mediaBytes).digest("hex"),
    request: {
      providerId,
      modelId,
      duration,
      ratio,
      videoInputMode: "first",
      imageCount: 1,
      audioCount: 0,
      prompt,
    },
  }, null, 2));
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/`,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

function requestHeaders() {
  return {
    origin: baseUrl,
    referer: `${baseUrl}/`,
    ...(cookie ? { cookie } : {}),
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
