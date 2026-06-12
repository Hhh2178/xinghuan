import { createHealthPayload, type AppEnvironment, type TaskStatus } from "@xinghuan/shared";
import { createDecipheriv, createHash } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";
import { createClient } from "redis";
import { prepareGrsaiReferenceImages } from "./grsai-reference-images.js";
import { materializeTaskOutputs } from "./output-materials.js";
import {
  createOpenAiAudioChatPayload,
  extractAudioProviderResult,
} from "./worker-audio-provider-adapter.js";
import {
  createApimartVideoAdapterPayload,
  extractApimartFinalTaskId,
  extractApimartTask,
  extractApimartVideoResult,
  shouldUseApimartVideoAdapter,
} from "./worker-apimart-video-adapter.js";
import {
  extractChatContent,
  extractImageOutputs,
  extractVideoUrls,
  openAiEndpoint,
  openAiImageGenerationUrl,
  providerHeaders,
  providerJsonHeaders as buildProviderJsonHeaders,
} from "./worker-provider-utils.js";

const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const dataDir = process.env.XINGHUAN_DATA_DIR ?? join(process.cwd(), "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const queueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const pollTimeoutSeconds = Number.parseInt(process.env.XINGHUAN_WORKER_POLL_TIMEOUT_SECONDS || "5", 10);
const workerId = process.env.XINGHUAN_WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

if (!databaseUrl) {
  console.error("DATABASE_NOT_CONFIGURED");
  process.exit(2);
}

if (!redisUrl) {
  console.error("REDIS_NOT_CONFIGURED");
  process.exit(3);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 3000,
  max: 3,
});

const redis = createClient({ url: redisUrl });
redis.on("error", (error) => {
  console.error("xinghuan-worker redis error", error instanceof Error ? error.message : String(error));
});

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

await redis.connect();
console.log(JSON.stringify({ ...createHealthPayload("xinghuan-worker", environment), workerId, queueName }));

while (!stopping) {
  const item = await redis.brPop(queueName, pollTimeoutSeconds).catch((error) => {
    console.error("xinghuan-worker queue read failed", error instanceof Error ? error.message : String(error));
    return null;
  });
  if (!item) continue;
  await processTask(item.element).catch((error) => {
    console.error("xinghuan-worker task processing crashed", item.element, error instanceof Error ? error.message : String(error));
  });
}

await redis.quit().catch(() => undefined);
await pool.end().catch(() => undefined);
console.log("xinghuan-worker stopped");

async function processTask(taskId: string) {
  console.log(`xinghuan-worker received ${taskId}`);
  const task = await readTask(taskId);
  if (!task) {
    console.warn(`xinghuan-worker skipped missing task ${taskId}`);
    return;
  }
  if (task.status !== "queued") {
    console.log(`xinghuan-worker skipped ${taskId}: status=${task.status}`);
    return;
  }

  const claimResult = await updateTask(taskId, "running", [`${workerId} 已领取任务`]);
  if (claimResult === "cancelled") {
    console.log(`xinghuan-worker skipped ${taskId}: cancelled before claim`);
    return;
  }
  if (claimResult === "missing") {
    console.warn(`xinghuan-worker skipped missing task during claim ${taskId}`);
    return;
  }
  try {
    const result = await executeTask(task);
    if (await isTaskCancelled(taskId)) {
      await appendTaskLog(taskId, `${workerId} 检测到任务已取消，丢弃执行结果`);
      return;
    }
    const materialized = await materializeTaskOutputs({ dataDir, task, result });
    const completionLogs =
      materialized.resourceItems.length > 0
        ? [`${workerId} 执行完成`, `${workerId} 已写入 ${materialized.resourceItems.length} 条输出素材`]
        : [`${workerId} 执行完成`];
    const completionResult = await updateTask(taskId, "succeeded", completionLogs, {
      ...result,
      ...materialized.resultPatch,
      workerId,
      completedAt: new Date().toISOString(),
    });
    if (completionResult === "cancelled") {
      await appendTaskLog(taskId, `${workerId} 检测到任务已取消，保留取消状态`);
    }
  } catch (error) {
    if (await isTaskCancelled(taskId)) {
      await appendTaskLog(taskId, `${workerId} 检测到任务已取消，丢弃执行错误`);
      return;
    }
    const failedResult = await updateTask(taskId, "failed", [`${workerId} 执行失败: ${error instanceof Error ? error.message : String(error)}`], {
      workerId,
      failedAt: new Date().toISOString(),
    });
    if (failedResult === "cancelled") {
      await appendTaskLog(taskId, `${workerId} 检测到任务已取消，保留取消状态`);
    }
  }
}

async function executeTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerId && !task.modelRecordId) {
    return { adapter: "noop", note: "未绑定 Provider/Model，按后台队列健康检查任务完成" };
  }
  if (task.capability === "image") return executeImageTask(task);
  if (task.capability === "video") return executeVideoTask(task);
  if (task.capability === "audio") return executeAudioTask(task);
  if (task.capability === "chat") return executeChatTask(task);
  throw new Error(`当前 Worker Adapter 暂不支持能力: ${task.capability || "unknown"}`);
}

async function readTask(taskId: string): Promise<TaskRow | null> {
  const result = await pool.query(
    `select
       t.id,
       t.title,
       t.status,
       t.owner_id,
       t.provider_id as task_provider_id,
       t.model_id as task_model_id,
       t.payload,
       t.result,
       t.logs,
       p.id as provider_id,
       p.name as provider_name,
       p.base_url as provider_base_url,
       p.protocol as provider_protocol,
       p.enabled as provider_enabled,
       p.api_key_cipher,
       m.id as model_record_id,
       m.model_id as provider_model_id,
       m.display_name as model_display_name,
       m.capability,
       m.enabled as model_enabled,
       m.protocol_override
     from xh_tasks t
     left join xh_providers p on p.id = t.provider_id
     left join xh_models m on m.id = t.model_id
     where t.id = $1`,
    [taskId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: normalizeStatus(row.status),
    ownerId: row.owner_id || "",
    providerId: row.provider_id || row.task_provider_id || "",
    providerName: row.provider_name || "",
    providerBaseUrl: row.provider_base_url || "",
    providerProtocol: normalizeProtocol(row.protocol_override || row.provider_protocol),
    providerEnabled: row.provider_enabled === null || row.provider_enabled === undefined ? false : Boolean(row.provider_enabled),
    apiKeyCipher: row.api_key_cipher || "",
    modelRecordId: row.model_record_id || row.task_model_id || "",
    providerModelId: row.provider_model_id || "",
    modelDisplayName: row.model_display_name || "",
    capability: normalizeCapability(row.capability),
    modelEnabled: row.model_enabled === null || row.model_enabled === undefined ? false : Boolean(row.model_enabled),
    payload: plainObject(row.payload),
    result: plainObject(row.result),
    logs: Array.isArray(row.logs) ? row.logs.map((line: unknown) => String(line)).filter(Boolean) : [],
  };
}

async function updateTask(
  taskId: string,
  status: TaskStatus,
  newLogs: string[],
  resultPatch?: Record<string, unknown>,
): Promise<"updated" | "cancelled" | "missing"> {
  const task = await readTask(taskId);
  if (!task) return "missing";
  if (task.status === "cancelled" && status !== "cancelled") return "cancelled";
  const logs = [...(task?.logs || []), ...newLogs];
  const result = await pool.query(
    `update xh_tasks
     set status = $2,
         logs = $3::jsonb,
         result = coalesce(result, '{}'::jsonb) || $4::jsonb,
         updated_at = now()
     where id = $1
       and status <> 'cancelled'`,
    [taskId, status, JSON.stringify(logs), JSON.stringify(resultPatch || {})],
  );
  if (result.rowCount && result.rowCount > 0) return "updated";
  const latestTask = await readTask(taskId);
  if (!latestTask) return "missing";
  return latestTask.status === "cancelled" ? "cancelled" : "updated";
}

async function appendTaskLog(taskId: string, line: string) {
  await pool.query(
    `update xh_tasks
     set logs = coalesce(logs, '[]'::jsonb) || $2::jsonb,
         updated_at = now()
     where id = $1`,
    [taskId, JSON.stringify([line])],
  );
}

async function isTaskCancelled(taskId: string) {
  const task = await readTask(taskId);
  return task?.status === "cancelled";
}

async function executeImageTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "grsai_draw") {
    return executeGrsaiImageTask(task);
  }
  if (!["openai", "apimart", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 图像 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("图像任务缺少 prompt");
  const imageUrls = Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean).slice(0, 16) : [];
  const requestBody: Record<string, unknown> = {
    model: task.providerModelId,
    prompt,
    n: clampNumber(task.payload.n, 1, 1, 4),
    size: safeText(task.payload.size || task.payload.image_size, "1024x1024"),
  };
  const aspectRatio = safeText(task.payload.aspectRatio || task.payload.aspect_ratio);
  if (aspectRatio) requestBody.aspect_ratio = aspectRatio;
  if (imageUrls.length > 0) requestBody.image = imageUrls;

  const upstream = await fetch(openAiImageGenerationUrl(task.providerBaseUrl), {
    method: "POST",
    headers: {
      ...providerHeaders(apiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000),
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`上游图像生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  const extracted = extractImageOutputs(raw);
  if (extracted.imageUrls.length === 0) {
    const taskMeta = extractApimartTask(raw, {
      taskIdPath: safeText(task.payload.taskIdPath, "data.0.task_id"),
      statusPath: safeText(task.payload.taskStatusPath, "data.0.status"),
    });
    if (!taskMeta.taskId) throw new Error("上游未返回可用图像");
    const polled = await pollApimartImageTask({
      baseUrl: task.providerBaseUrl,
      apiKey,
      taskId: taskMeta.taskId,
      statusPath: safeText(task.payload.pollStatusPath, "data.status"),
      pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2500, 500, 30000),
      timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs, 360000, 5000, 1800000),
    });
    if (polled.imageUrls.length === 0) throw new Error("APIMart 未返回可用图像");
    return {
      adapter: "apimart-image",
      providerId: task.providerId,
      modelId: task.providerModelId,
      taskId: taskMeta.taskId,
      imageUrls: polled.imageUrls,
      remoteImageUrls: polled.remoteImageUrls,
      imageCount: polled.imageUrls.length,
    };
  }
  return {
    adapter: "openai-image",
    providerId: task.providerId,
    modelId: task.providerModelId,
    imageUrls: extracted.imageUrls,
    remoteImageUrls: extracted.remoteImageUrls,
    imageCount: extracted.imageUrls.length,
  };
}

async function executeVideoTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  const protocol = normalizeProtocol(task.providerProtocol);
  if (!["openai", "apimart", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 视频 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("视频任务缺少 prompt");
  const images = Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean).slice(0, 16) : [];
  const ratio = safeText(task.payload.aspectRatio || task.payload.aspect_ratio || task.payload.ratio);
  const duration = task.payload.duration;
  const resolution = safeText(task.payload.resolution);
  const firstFrame = safeText(task.payload.first_frame || task.payload.firstFrame);
  const lastFrame = safeText(task.payload.last_frame || task.payload.lastFrame);
  const advancedMode = safeText(task.payload.advancedMode || task.payload.mode);
  const submitPath = safeText(task.payload.submitPath, "videos/generations");

  if (shouldUseApimartVideoAdapter({
    protocol,
    advancedMode,
    modelId: task.providerModelId,
    providerBaseUrl: task.providerBaseUrl,
  })) {
    const submitPayload = createApimartVideoAdapterPayload({
      modelId: task.providerModelId,
      prompt,
      ratio,
      duration: typeof duration === "string" || typeof duration === "number" ? duration : undefined,
      resolution,
      images,
      firstFrame: firstFrame || undefined,
      lastFrame: lastFrame || undefined,
      requestMapping: plainObject(task.payload.requestMapping) as Record<string, string>,
      requestValueTypes: plainObject(task.payload.requestValueTypes) as Record<string, string>,
      fixedBody: plainObject(task.payload.fixedBody),
    });
    const submitResponse = await fetch(openAiEndpoint(task.providerBaseUrl, submitPath), {
      method: "POST",
      headers: buildProviderJsonHeaders(apiKey),
      body: JSON.stringify(submitPayload),
      signal: AbortSignal.timeout(180000),
    });
    const submitText = await submitResponse.text();
    if (!submitResponse.ok) throw new Error(`上游视频生成失败 ${submitResponse.status}: ${submitText.slice(0, 500)}`);
    const submitRaw = submitText ? JSON.parse(submitText) : {};
    const taskMeta = extractApimartTask(submitRaw, {
      taskIdPath: safeText(task.payload.taskIdPath, "data.0.task_id"),
      statusPath: safeText(task.payload.taskStatusPath, "data.0.status"),
    });
    if (!taskMeta.taskId) throw new Error("异步视频任务未返回 task_id/id");
    const polled = await pollApimartVideoTask({
      baseUrl: task.providerBaseUrl,
      apiKey,
      taskId: taskMeta.taskId,
      statusPath: safeText(task.payload.taskStatusPath || task.payload.pollStatusPath, "data.status"),
      resultVideoPath: safeText(task.payload.resultVideoPath, "data.result.videos"),
      pollPathTemplate: safeText(task.payload.pollPathTemplate, "tasks/{task_id}"),
      finalResultTaskIdPath: safeText(task.payload.finalResultTaskIdPath),
      finalResultPathTemplate: safeText(task.payload.finalResultPathTemplate),
      finalResultVideoPath: safeText(task.payload.finalResultVideoPath),
      pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2000, 500, 10000),
      timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs, 360000, 5000, 1800000),
    });
    if (polled.videoUrls.length === 0) throw new Error("异步视频任务未返回可用视频 URL");
    return {
      adapter: "apimart-video",
      providerId: task.providerId,
      modelId: task.providerModelId,
      taskId: taskMeta.taskId,
      videoUrls: polled.videoUrls,
      remoteVideoUrls: polled.videoUrls,
      videoCount: polled.videoUrls.length,
    };
  }

  const payload: Record<string, unknown> = { model: task.providerModelId, prompt };
  if (ratio) payload.aspect_ratio = ratio;
  if (typeof duration === "string" || typeof duration === "number") payload.duration = duration;
  if (resolution) payload.resolution = resolution;
  if (images.length > 0) payload.image = images;
  if (firstFrame) payload.first_frame = firstFrame;
  if (lastFrame) payload.last_frame = lastFrame;

  const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, submitPath), {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`上游视频生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  const videoUrls = extractVideoUrls(raw);
  if (videoUrls.length === 0) throw new Error("上游未返回可用视频 URL");
  return {
    adapter: "openai-video",
    providerId: task.providerId,
    modelId: task.providerModelId,
    videoUrls,
    remoteVideoUrls: videoUrls,
    videoCount: videoUrls.length,
  };
}

async function executeChatTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  const protocol = normalizeProtocol(task.providerProtocol);
  if (!["openai", "apimart", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 语言模型 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const messages = Array.isArray(task.payload.messages)
    ? task.payload.messages
    : safeText(task.payload.prompt)
      ? [{ role: "user", content: safeText(task.payload.prompt) }]
      : [];
  if (messages.length === 0) throw new Error("语言模型任务缺少 messages");

  const payload: Record<string, unknown> = {
    model: task.providerModelId,
    messages,
    stream: false,
  };
  const temperature = Number(task.payload.temperature);
  if (Number.isFinite(temperature)) payload.temperature = Math.max(0, Math.min(2, temperature));
  const maxTokens = Number(task.payload.max_tokens || task.payload.maxTokens);
  if (Number.isFinite(maxTokens) && maxTokens > 0) payload.max_tokens = Math.min(200000, Math.floor(maxTokens));

  const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, "chat/completions"), {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`上游语言模型请求失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  const content = extractChatContent(raw);
  return {
    adapter: "openai-chat",
    providerId: task.providerId,
    modelId: task.providerModelId,
    content,
    text: content,
    finishReason: plainObject(raw.choices?.[0]).finish_reason || "",
  };
}

async function executeAudioTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  const protocol = normalizeProtocol(task.providerProtocol);
  if (!["openai", "apimart", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 音频 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const text = safeText(task.payload.text || task.payload.prompt);
  if (!text) throw new Error("音频任务缺少 text/prompt");
  const payload = createOpenAiAudioChatPayload({
    modelId: task.providerModelId,
    text,
    stylePrompt: safeText(task.payload.stylePrompt),
    voice: safeText(task.payload.voice || "mimo_default"),
    audioFormat: safeText(task.payload.audioFormat || "wav"),
    mode: safeText(task.payload.mode || "tts"),
    sampleDataUrl: safeText(task.payload.sampleDataUrl),
  });
  const submitPath = safeText(task.payload.submitPath, "chat/completions");

  const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, submitPath), {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const responseText = await upstream.text();
  if (!upstream.ok) throw new Error(`上游音频模型请求失败 ${upstream.status}: ${responseText.slice(0, 500)}`);
  const raw = responseText ? JSON.parse(responseText) : {};
  const result = extractAudioProviderResult(raw);
  const audioUrls = [...result.audioDataUrls, ...result.audioUrls];
  if (audioUrls.length === 0) throw new Error("音频模型未返回可用音频");
  return {
    adapter: "openai-audio",
    providerId: task.providerId,
    modelId: task.providerModelId,
    text: result.text,
    audioUrls,
    remoteAudioUrls: result.audioUrls,
    audioCount: audioUrls.length,
  };
}

async function executeGrsaiImageTask(task: TaskRow): Promise<Record<string, unknown>> {
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("图像任务缺少 prompt");

  const client = createGrsaiImageClient({
    apiKey,
    baseUrl: task.providerBaseUrl,
  });
  const imageUrls = await prepareGrsaiReferenceImages({
    dataDir,
    ownerId: task.ownerId,
    values: Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean) : [],
    limit: 16,
  });
  const result = await client.generate({
    modelId: task.providerModelId,
    prompt,
    aspectRatio: safeText(task.payload.aspectRatio || task.payload.aspect_ratio),
    size: safeText(task.payload.size || task.payload.image_size),
    images: imageUrls,
  });

  return {
    adapter: "grsai-image",
    providerId: task.providerId,
    modelId: task.providerModelId,
    taskId: result.taskId || "",
    imageUrls: result.imageUrls,
    remoteImageUrls: result.imageUrls.filter((url) => /^https?:\/\//i.test(url)),
    imageCount: result.imageUrls.length,
  };
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = String(value || "");
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? (status as TaskStatus) : "queued";
}

function normalizeCapability(value: unknown) {
  const capability = String(value || "").toLowerCase();
  if (capability === "text" || capability === "llm") return "chat";
  return ["chat", "image", "video", "audio"].includes(capability) ? capability : "";
}

function normalizeProtocol(value: unknown) {
  const protocol = String(value || "").toLowerCase();
  return ["openai", "gemini", "runninghub", "volcengine", "apimart", "custom", "grsai_draw"].includes(protocol) ? protocol : "openai";
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function decryptSecret(value: string) {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  try {
    const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf-8");
  } catch {
    return "";
  }
}

function secretKey() {
  const source =
    process.env.XINGHUAN_SECRET_KEY ||
    process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ||
    (environment === "local" ? "xinghuan-local-admin-secret" : "");
  return createHash("sha256").update(source || "xinghuan-fallback-secret").digest();
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId: string;
  providerId: string;
  providerName: string;
  providerBaseUrl: string;
  providerProtocol: string;
  providerEnabled: boolean;
  apiKeyCipher: string;
  modelRecordId: string;
  providerModelId: string;
  modelDisplayName: string;
  capability: string;
  modelEnabled: boolean;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  logs: string[];
}

interface GrsaiImageClientOptions {
  apiKey: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface GrsaiImageGenerateInput {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  size?: string;
  images?: string[];
}

interface GrsaiImageGenerateResult {
  imageUrls: string[];
  taskId?: string;
}

function createGrsaiImageClient(options: GrsaiImageClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? 1500);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 120000);

  return {
    async generate(input: GrsaiImageGenerateInput): Promise<GrsaiImageGenerateResult> {
      const submit = await requestJson(fetcher, `${baseUrl}/v1/draw/completions`, options.apiKey, {
        model: input.modelId,
        prompt: input.prompt,
        webHook: "-1",
        ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        ...(input.size ? { size: input.size } : {}),
        ...(input.images && input.images.length > 0 ? { urls: input.images } : {}),
      });

      const submitUrls = extractGrsaiImageUrls(submit.payload);
      if (submitUrls.length > 0) {
        return {
          imageUrls: submitUrls,
          taskId: readString(readGrsaiTaskId(submit.payload)),
        };
      }

      const submitState = normalizeGrsaiState(submit.payload);
      if (submitState.kind === "failed") throw new Error(submitState.errorMessage);
      if (submitState.kind === "success") {
        return {
          imageUrls: submitUrls,
          taskId: submitState.taskId,
        };
      }
      if (!submitState.taskId) throw new Error("GRSAI 未返回任务 ID");

      const startedAt = Date.now();
      for (;;) {
        if (Date.now() - startedAt > timeoutMs) throw new Error("GRSAI 图像生成轮询超时");
        if (pollIntervalMs > 0) await wait(pollIntervalMs);

        const polled = await pollGrsaiJson(fetcher, baseUrl, options.apiKey, submitState.taskId);
        const imageUrls = extractGrsaiImageUrls(polled.payload);
        if (imageUrls.length > 0) {
          return {
            imageUrls,
            taskId: submitState.taskId,
          };
        }
        const state = normalizeGrsaiState(polled.payload);
        if (state.kind === "failed") throw new Error(state.errorMessage);
        if (state.kind === "success") {
          return {
            imageUrls,
            taskId: state.taskId || submitState.taskId,
          };
        }
      }
    },
  };
}

async function requestJson(fetcher: typeof fetch, url: string, apiKey: string, body: Record<string, unknown>) {
  const response = await fetcher(url, {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) throw new Error(extractGrsaiErrorMessage(payload) || `HTTP ${response.status}`);
  return { response, payload };
}

async function pollGrsaiJson(fetcher: typeof fetch, baseUrl: string, apiKey: string, taskId: string) {
  const response = await fetcher(`${baseUrl}/v1/draw/result`, {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify({ taskId, id: taskId }),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) throw new Error(extractGrsaiErrorMessage(payload) || `HTTP ${response.status}`);
  return { response, payload };
}

function normalizeGrsaiState(payload: Record<string, unknown>) {
  const envelope = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload;
  const code = typeof payload.code === "number"
    ? payload.code
    : typeof envelope.code === "number"
      ? envelope.code
      : undefined;
  const taskId = readString(readGrsaiTaskId(payload));
  const status = readString(
    envelope.status || envelope.state || envelope.progressState || payload.status || payload.state || payload.progressState,
  ).toLowerCase();
  const errorMessage = extractGrsaiErrorMessage(payload);
  const successSignal = ["success", "succeeded", "completed", "done", "ok"].includes(errorMessage.toLowerCase());

  if (code !== undefined && code !== 0) return { kind: "failed" as const, errorMessage: errorMessage || `Provider request failed with code ${code}` };
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return { kind: "failed" as const, errorMessage: errorMessage || "Provider request failed" };
  if (["succeeded", "success", "completed", "done"].includes(status)) return { kind: "success" as const, taskId };
  if (errorMessage && !successSignal && !taskId) return { kind: "failed" as const, errorMessage };
  return { kind: "pending" as const, taskId };
}

function readGrsaiTaskId(payload: Record<string, unknown>) {
  const envelope = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload;
  return envelope.id || envelope.taskId || envelope.task_id || payload.id || payload.taskId || payload.task_id;
}

function extractGrsaiImageUrls(payload: Record<string, unknown>) {
  const pool = [
    payload,
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data as Record<string, unknown> : null,
  ].filter(Boolean) as Record<string, unknown>[];
  const urls: string[] = [];
  for (const source of pool) {
    const items = Array.isArray(source.results) ? source.results : Array.isArray(source.data) ? source.data : [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const url = readString((item as Record<string, unknown>).url || (item as Record<string, unknown>).imageUrl);
      if (url && !urls.includes(url)) urls.push(url);
    }
    const single = readString(source.url || source.imageUrl);
    if (single && !urls.includes(single)) urls.push(single);
  }
  return urls;
}

function extractGrsaiErrorMessage(payload: Record<string, unknown>) {
  const envelope = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload;
  return readString(envelope.error)
    || readString(envelope.failure_reason)
    || readString(envelope.message)
    || readString(payload.error)
    || readString(payload.failure_reason)
    || readString(payload.message)
    || readString(payload.msg);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  const normalized = text.startsWith("data: ") ? text.slice(6) : text;
  return JSON.parse(normalized) as Record<string, unknown>;
}

async function pollApimartVideoTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  pollPathTemplate: string;
  finalResultTaskIdPath: string;
  finalResultPathTemplate: string;
  finalResultVideoPath: string;
  pollIntervalMs: number;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > options.timeoutMs) throw new Error("视频生成轮询超时");
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const pollPath = safeText(options.pollPathTemplate, "tasks/{task_id}").replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, pollPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`视频任务轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const result = extractApimartVideoResult(raw, {
      statusPath: options.statusPath,
      resultVideoPath: options.resultVideoPath,
    });
    const status = safeText(result.status).toLowerCase();
    if (result.videoUrls.length > 0 && (!status || ["completed", "succeeded", "success", "done"].includes(status))) return result;
    if (options.finalResultPathTemplate) {
      const finalTaskId = extractApimartFinalTaskId(raw, { taskIdPath: options.finalResultTaskIdPath });
      if (finalTaskId) {
        const finalResult = await fetchFinalApimartVideoResult({
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          taskId: finalTaskId,
          statusPath: options.statusPath,
          resultVideoPath: options.finalResultVideoPath || options.resultVideoPath,
          finalResultPathTemplate: options.finalResultPathTemplate,
        });
        const finalStatus = safeText(finalResult.status).toLowerCase();
        if (finalResult.videoUrls.length > 0 && (!finalStatus || ["completed", "succeeded", "success", "done"].includes(finalStatus))) return finalResult;
        if (["failed", "error", "cancelled", "canceled"].includes(finalStatus)) {
          throw new Error(`视频任务失败: ${safeText(finalResult.failureReason, finalStatus || "unknown")}`);
        }
      }
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(`视频任务失败: ${safeText(result.failureReason, status || "unknown")}`);
    }
  }
}

async function fetchFinalApimartVideoResult(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  finalResultPathTemplate: string;
}) {
  const finalPath = safeText(options.finalResultPathTemplate).replace("{task_id}", encodeURIComponent(options.taskId));
  const response = await fetch(openAiEndpoint(options.baseUrl, finalPath), {
    method: "GET",
    headers: providerHeaders(options.apiKey),
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`最终视频结果查询失败 ${response.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  return extractApimartVideoResult(raw, {
    statusPath: options.statusPath,
    resultVideoPath: options.resultVideoPath,
  });
}

async function pollApimartImageTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  pollIntervalMs: number;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  let deadline = startedAt + options.timeoutMs;
  const pollPathTemplate = "tasks/{task_id}";
  for (;;) {
    if (Date.now() > deadline) throw new Error("APIMart 图像生成轮询超时");
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, statusPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`APIMart 图像轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const data = raw && typeof raw === "object" && !Array.isArray(raw)
      ? plainObject((raw as Record<string, unknown>).data)
      : {};
    const estimatedTimeSec = Number(data.estimated_time);
    if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
      const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
      deadline = Math.max(deadline, adaptiveDeadline);
    }
    const extracted = extractImageOutputs(raw);
    const taskState = extractApimartTask(raw, { statusPath: options.statusPath || "data.status" });
    const status = safeText(taskState.status).toLowerCase();
    if (extracted.imageUrls.length > 0) return extracted;
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(`APIMart 图像任务失败: ${status || "unknown"}`);
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
