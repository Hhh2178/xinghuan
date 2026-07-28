import { readFile } from "node:fs/promises";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL || "https://canvas-next.hhh2121.xyz";
const authStatePath = process.env.XINGHUAN_VERIFY_AUTH_STATE || ".playwright-cli/gray-auth.json";
const imagePath = process.env.XINGHUAN_VIDEO_TEST_IMAGE || "";
const providerId = process.env.XINGHUAN_VIDEO_PROVIDER_ID || "";
const modelId = process.env.XINGHUAN_VIDEO_MODEL_ID || "";
const modelRecordId = process.env.XINGHUAN_VIDEO_MODEL_RECORD_ID || "";
const count = integerEnv("XINGHUAN_VIDEO_TEST_COUNT", 1);
const duration = integerEnv("XINGHUAN_VIDEO_DURATION", 6);
const ratio = process.env.XINGHUAN_VIDEO_RATIO || "9:16";
const resolution = process.env.XINGHUAN_VIDEO_RESOLUTION || "720p";
const prompt = process.env.XINGHUAN_VIDEO_PROMPT || "板球运动员完成挥棒后继续冲刺，镜头保持人物主体与体育场环境，动作连贯自然";
const pollIntervalMs = integerEnv("XINGHUAN_VIDEO_POLL_INTERVAL_MS", 5_000);
const maxWaitMs = integerEnv("XINGHUAN_VIDEO_MAX_WAIT_MS", 20 * 60 * 1_000);
const submitStaggerMs = integerEnv("XINGHUAN_VIDEO_SUBMIT_STAGGER_MS", 1_500);
const videoInputMode = process.env.XINGHUAN_VIDEO_INPUT_MODE || "first";

let cookie = "";

async function main() {
  assert(process.env.XINGHUAN_ALLOW_PAID_VIDEO_TEST === "1", "PAID_VIDEO_TEST_NOT_EXPLICITLY_ENABLED");
  const parsedBaseUrl = new URL(baseUrl);
  assert(parsedBaseUrl.hostname === "canvas-next.hhh2121.xyz" || parsedBaseUrl.hostname === "127.0.0.1", "PAID_VIDEO_TEST_GRAY_ONLY");
  assert(count >= 1 && count <= 5, "PAID_VIDEO_TEST_COUNT_MUST_BE_1_TO_5");
  assert(providerId && modelId && modelRecordId, "PAID_VIDEO_MODEL_CONFIGURATION_REQUIRED");
  assert(videoInputMode === "first" || videoInputMode === "reference", "PAID_VIDEO_INPUT_MODE_MUST_BE_FIRST_OR_REFERENCE");
  assert(imagePath, "XINGHUAN_VIDEO_TEST_IMAGE_REQUIRED");

  cookie = await loadSessionCookie(authStatePath, parsedBaseUrl.hostname);
  assert(cookie, "GRAY_AUTH_STATE_HAS_NO_SESSION_COOKIE");

  const imageBytes = await readFile(imagePath);
  assert(imageBytes.length > 0, "VIDEO_TEST_IMAGE_EMPTY");
  const imageUrl = await uploadReference(imageBytes);

  const submitted = [];
  for (let index = 0; index < count; index += 1) {
    if (index > 0) await sleep(submitStaggerMs);
    const taskId = await submitTask(imageUrl, index + 1);
    submitted.push({ index: index + 1, taskId, status: "queued", transitions: [] });
    process.stderr.write(`[paid-video] submitted ${index + 1}/${count} ${taskId}\n`);
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs && submitted.some((task) => !isTerminal(task.status))) {
    await sleep(pollIntervalMs);
    await Promise.all(submitted.filter((task) => !isTerminal(task.status)).map(refreshTask));
  }

  const results = await Promise.all(submitted.map(verifyTask));
  const summary = {
    ok: results.every((task) => task.status === "succeeded" && task.localMedia?.ok === true),
    request: {
      providerId,
      modelId,
      modelRecordId,
      count,
      duration,
      ratio,
      resolution,
      referenceMode: videoInputMode === "first" ? "explicit_first_frame" : "single_image_reference",
    },
    totals: countByStatus(results),
    tasks: results,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 2;
}

async function loadSessionCookie(path, hostname) {
  const state = JSON.parse(await readFile(path, "utf8"));
  const cookies = Array.isArray(state.cookies) ? state.cookies : [];
  return cookies
    .filter((item) => item?.name && item?.value && cookieMatchesHost(item, hostname))
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
}

function cookieMatchesHost(cookieEntry, hostname) {
  const domain = String(cookieEntry.domain || "").replace(/^\./, "");
  return !domain || hostname === domain || hostname.endsWith(`.${domain}`);
}

async function uploadReference(imageBytes) {
  const form = new FormData();
  form.set("file", new Blob([imageBytes], { type: "image/png" }), "paid-video-first-reference.png");
  const uploaded = await fetchJson("/api/files/upload", { method: "POST", body: form });
  const imageUrl = String(uploaded.data?.url || "");
  assert(imageUrl.startsWith("/files/input/"), "VIDEO_TEST_IMAGE_UPLOAD_FAILED");
  return imageUrl;
}

async function submitTask(imageUrl, index) {
  const suffix = `${Date.now()}-${index}`;
  const response = await fetchJson("/api/proxy/external/video/task", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerId,
      providerModel: modelId,
      model: modelId,
      prompt: `${prompt}（灰度链路验证 ${index}/${count}）`,
      aspect_ratio: ratio,
      ratio,
      duration,
      resolution,
      images: [imageUrl],
      ...(videoInputMode === "first" ? { first_frame: imageUrl } : {}),
      audios: [],
      providerParams: {
        modelRecordId,
        videoInputMode,
        sourceNodeId: `validation-paid-video-${suffix}`,
        sourceCanvasId: `validation-paid-video-chain-${suffix}`,
      },
    }),
  });
  const taskId = String(response.data?.taskId || response.data?.id || "");
  assert(taskId, "PAID_VIDEO_TASK_ID_MISSING");
  return taskId;
}

async function refreshTask(task) {
  try {
    const response = await fetchJson(`/api/proxy/external/video/task/${encodeURIComponent(task.taskId)}`);
    const detail = response.data || {};
    const nextStatus = String(detail.status || "unknown");
    const transition = `${nextStatus}|${detail.providerState || ""}|${detail.progress ?? ""}|${detail.runtimeStage || ""}`;
    if (task.transitions.at(-1) !== transition) {
      task.transitions.push(transition);
      process.stderr.write(`[paid-video] ${task.index}/${count} ${transition}\n`);
    }
    Object.assign(task, summarizeTaskDetail(detail), { status: nextStatus });
  } catch (error) {
    task.pollErrors = (task.pollErrors || 0) + 1;
    task.lastPollError = safeError(error);
    process.stderr.write(`[paid-video] ${task.index}/${count} poll-error ${task.pollErrors}\n`);
  }
}

async function verifyTask(task) {
  if (!isTerminal(task.status)) {
    task.status = "timeout";
    task.failureCategory ||= "local_poll_timeout";
  }
  const localVideoUrl = String(task.localVideoUrl || "");
  const localMedia = localVideoUrl.startsWith("/files/output/")
    ? await verifyLocalMedia(localVideoUrl)
    : { ok: false, reason: "local_output_url_missing" };
  return {
    index: task.index,
    taskId: task.taskId,
    status: task.status,
    providerState: task.providerState,
    progress: task.progress,
    runtimeStage: task.runtimeStage,
    upstreamTaskId: task.upstreamTaskId,
    adapter: task.adapter,
    failureCategory: task.failureCategory,
    failureReason: task.failureReason,
    localVideoUrl,
    remoteVideoCount: task.remoteVideoCount,
    artifactCount: task.artifactCount,
    pollErrors: task.pollErrors || 0,
    lastPollError: task.lastPollError || "",
    transitions: task.transitions,
    localMedia,
  };
}

function summarizeTaskDetail(detail) {
  const raw = object(detail.raw);
  const result = object(detail.result);
  const videoUrls = array(detail.videoUrls || result.videoUrls);
  const remoteVideoUrls = array(detail.remoteVideoUrls || result.remoteVideoUrls);
  const artifacts = array(detail.artifacts || result.artifacts || raw.artifacts);
  return {
    providerState: text(detail.providerState || raw.providerState || raw.upstreamStatus),
    progress: detail.progress ?? raw.progress ?? "",
    runtimeStage: text(detail.runtimeStage || raw.runtimeStage),
    upstreamTaskId: text(detail.upstreamTaskId || raw.upstreamTaskId || result.upstreamTaskId),
    adapter: text(raw.adapter || result.adapter),
    failureCategory: text(detail.failureCategory || raw.failureCategory || result.failureCategory),
    failureReason: text(detail.failureReason || detail.error || raw.failureReason || result.failureReason).slice(0, 240),
    localVideoUrl: text(videoUrls[0]),
    remoteVideoCount: remoteVideoUrls.length,
    artifactCount: artifacts.length,
  };
}

async function verifyLocalMedia(pathname) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: requestHeaders({ range: "bytes=0-65535" }),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    const contentRange = response.headers.get("content-range") || "";
    return {
      ok: (response.status === 200 || response.status === 206) && /^video\//i.test(contentType) && bytes.length > 0,
      status: response.status,
      contentType,
      contentRange,
      sampledBytes: bytes.length,
    };
  } catch (error) {
    return { ok: false, reason: safeError(error) };
  }
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: requestHeaders(options.headers),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

function requestHeaders(extra = {}) {
  return {
    origin: baseUrl,
    referer: `${baseUrl}/`,
    cookie,
    ...extra,
  };
}

function countByStatus(tasks) {
  return tasks.reduce((totals, task) => {
    totals[task.status] = (totals[task.status] || 0) + 1;
    return totals;
  }, {});
}

function isTerminal(status) {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "timeout";
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function integerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(error) {
  return String(error instanceof Error ? error.message : error).replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 240);
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
