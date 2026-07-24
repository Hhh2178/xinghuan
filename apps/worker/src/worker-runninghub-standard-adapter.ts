const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1_000;

type RunningHubStandardCapability = "image" | "video";

export class RunningHubStandardModelError extends Error {
  readonly errorCode: string;
  readonly providerState: string;
  readonly taskId: string;

  constructor(input: { errorCode?: unknown; errorMessage?: unknown; providerState?: unknown; taskId?: unknown }) {
    const errorCode = safeText(input.errorCode, "RUNNINGHUB_STANDARD_FAILED");
    const errorMessage = safeDiagnostic(input.errorMessage, "RunningHub 标准模型执行失败");
    super(`${errorCode}: ${errorMessage}`);
    this.name = "RunningHubStandardModelError";
    this.errorCode = errorCode;
    this.providerState = safeText(input.providerState, "FAILED").toUpperCase();
    this.taskId = safeText(input.taskId);
  }
}

export async function executeRunningHubStandardModel(input: {
  capability: RunningHubStandardCapability;
  baseUrl: string;
  apiKey: string;
  modelPath: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  onHeartbeat: (patch: Record<string, unknown>) => Promise<void>;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl || fetch;
  const adapter = `runninghub-standard-${input.capability}`;
  const headers = {
    Authorization: `Bearer ${input.apiKey}`,
    "content-type": "application/json",
  };
  const submit = await requestJson(fetchImpl, standardSubmitUrl(input.baseUrl, input.modelPath), {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(180_000),
  });
  let taskId = safeText(submit.taskId);
  let status = normalizedStatus(submit.status);
  if (!taskId && (safeText(submit.errorCode) || safeText(submit.errorMessage))) {
    throw new RunningHubStandardModelError({ ...submit, providerState: "FAILED", taskId });
  }
  if (!taskId && status !== "SUCCESS") {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_TASK_ID_MISSING", errorMessage: submit.errorMessage, providerState: status });
  }
  await input.onHeartbeat({ adapter, runtimeStage: "submitted", providerState: status || "RUNNING", upstreamTaskId: taskId });
  if (status === "FAILED") throw failureFrom(submit, taskId);

  let result = submit;
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (status !== "SUCCESS") {
    if (Date.now() >= deadline) {
      throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_STANDARD_TIMEOUT", errorMessage: "RunningHub 标准模型轮询超时", providerState: status, taskId });
    }
    await wait(DEFAULT_POLL_INTERVAL_MS);
    result = await requestJson(fetchImpl, standardQueryUrl(input.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId }),
      signal: AbortSignal.timeout(120_000),
    });
    taskId = safeText(result.taskId, taskId);
    status = normalizedStatus(result.status);
    await input.onHeartbeat({ adapter, runtimeStage: "polling", providerState: status || "RUNNING", upstreamTaskId: taskId });
    if (status === "FAILED") throw failureFrom(result, taskId);
  }

  const outputs = normalizeResults(result.results);
  const providerUsage = normalizeUsage(result.usage);
  const imageUrls = outputs.filter((item) => imageOutputTypes.has(item.outputType)).map((item) => item.url).filter(Boolean);
  const videoUrls = outputs.filter((item) => videoOutputTypes.has(item.outputType)).map((item) => item.url).filter(Boolean);
  if (input.capability === "image" && imageUrls.length === 0) {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_STANDARD_IMAGE_MISSING", errorMessage: "RunningHub 成功但未返回图片", providerState: status, taskId });
  }
  if (input.capability === "video" && videoUrls.length === 0) {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_STANDARD_VIDEO_MISSING", errorMessage: "RunningHub 成功但未返回视频", providerState: status, taskId });
  }
  return {
    adapter,
    taskId,
    upstreamTaskId: taskId,
    providerState: status,
    providerUsage,
    imageUrls,
    remoteImageUrls: imageUrls,
    imageCount: imageUrls.length,
    videoUrls,
    remoteVideoUrls: videoUrls,
    videoCount: videoUrls.length,
  };
}

async function requestJson(fetchImpl: typeof fetch, url: string, init: RequestInit) {
  const response = await fetchImpl(url, init);
  const rawText = await response.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = rawText ? record(JSON.parse(rawText)) : {};
  } catch {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_STANDARD_INVALID_RESPONSE", errorMessage: `RunningHub 返回非法 JSON (${response.status})` });
  }
  if (!response.ok) {
    throw new RunningHubStandardModelError({
      errorCode: parsed.errorCode || `HTTP_${response.status}`,
      errorMessage: parsed.errorMessage || parsed.message || `RunningHub 请求失败 (${response.status})`,
      providerState: parsed.status,
      taskId: parsed.taskId,
    });
  }
  return parsed;
}

function standardSubmitUrl(baseUrl: string, modelPath: string) {
  const base = normalizedBaseUrl(baseUrl);
  const path = safeText(modelPath)
    .replace(/^\/+/, "")
    .replace(/^openapi\/v2\//i, "")
    .replace(/\?.*$/, "");
  const segments = path.split("/").map((part) => part.trim()).filter(Boolean);
  if (!segments.length || segments.some((part) => part === "." || part === "..")) {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_STANDARD_MODEL_PATH_INVALID", errorMessage: "RunningHub 标准模型路径无效" });
  }
  return `${base}/openapi/v2/${segments.map(encodeURIComponent).join("/")}`;
}

function standardQueryUrl(baseUrl: string) {
  return `${normalizedBaseUrl(baseUrl)}/openapi/v2/query`;
}

function normalizedBaseUrl(value: string) {
  const raw = safeText(value).replace(/\/+$/, "").replace(/\/openapi\/v2$/i, "");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_BASE_URL_INVALID", errorMessage: "RunningHub Base URL 无效" });
  }
  if (parsed.protocol !== "https:") {
    throw new RunningHubStandardModelError({ errorCode: "RUNNINGHUB_BASE_URL_INVALID", errorMessage: "RunningHub Base URL 必须使用 HTTPS" });
  }
  return parsed.toString().replace(/\/+$/, "");
}

function failureFrom(value: Record<string, unknown>, taskId: string) {
  return new RunningHubStandardModelError({
    errorCode: value.errorCode,
    errorMessage: value.errorMessage || value.message,
    providerState: value.status,
    taskId,
  });
}

function normalizeResults(value: unknown) {
  return Array.isArray(value) ? value.map((item) => {
    const row = record(item);
    return { url: safeText(row.url), outputType: safeText(row.outputType).toLowerCase() };
  }) : [];
}

function normalizeUsage(value: unknown) {
  const source = record(value);
  const result: Record<string, string | number | null> = {};
  for (const key of ["consumeMoney", "consumeCoins", "taskCostTime", "thirdPartyConsumeMoney"] as const) {
    const field = source[key];
    if (typeof field === "string" || typeof field === "number" || field === null) result[key] = field;
  }
  return result;
}

function normalizedStatus(value: unknown) {
  const status = safeText(value).toUpperCase();
  if (["QUEUED", "RUNNING", "SUCCESS", "FAILED"].includes(status)) return status;
  return status || "RUNNING";
}

function safeDiagnostic(value: unknown, fallback: string) {
  return safeText(value, fallback)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [已隐藏]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[已隐藏临时链接]")
    .slice(0, 500);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const imageOutputTypes = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const videoOutputTypes = new Set(["mp4", "webm", "mov", "m4v"]);
