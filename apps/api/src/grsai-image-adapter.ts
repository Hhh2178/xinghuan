export interface GrsaiImageClientOptions {
  apiKey: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface GrsaiImageGenerateInput {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  size?: string;
  images?: string[];
}

export interface GrsaiImageGenerateResult {
  imageUrls: string[];
  taskId?: string;
  raw: Record<string, unknown>;
}

interface GrsaiEnvelope {
  code?: number;
  data?: Record<string, unknown>;
  error?: unknown;
  message?: unknown;
  msg?: unknown;
  status?: unknown;
  state?: unknown;
  progressState?: unknown;
  id?: unknown;
  taskId?: unknown;
  task_id?: unknown;
  results?: unknown;
}

export function createGrsaiImageClient(options: GrsaiImageClientOptions) {
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

      const submitUrls = extractImageUrls(submit.payload);
      if (submitUrls.length > 0) {
        return {
          imageUrls: submitUrls,
          taskId: readString(readTaskId(submit.payload)),
          raw: submit.payload,
        };
      }

      const submitState = normalizeState(submit.payload);
      if (submitState.kind === "failed") throw new Error(submitState.errorMessage);
      if (submitState.kind === "success") {
        return {
          imageUrls: submitUrls,
          taskId: submitState.taskId,
          raw: submit.payload,
        };
      }
      if (!submitState.taskId) throw new Error("GRSAI 未返回任务 ID");

      const startedAt = Date.now();
      for (;;) {
        if (Date.now() - startedAt > timeoutMs) throw new Error("GRSAI 图像生成轮询超时");
        if (pollIntervalMs > 0) await sleep(pollIntervalMs);

        const polled = await pollJson(fetcher, baseUrl, options.apiKey, submitState.taskId);
        const imageUrls = extractImageUrls(polled.payload);
        if (imageUrls.length > 0) {
          return {
            imageUrls,
            taskId: submitState.taskId,
            raw: polled.payload,
          };
        }
        const state = normalizeState(polled.payload);
        if (state.kind === "failed") throw new Error(state.errorMessage);
        if (state.kind === "success") {
          return {
            imageUrls,
            taskId: state.taskId || submitState.taskId,
            raw: polled.payload,
          };
        }
      }
    },
  };
}

async function requestJson(fetcher: typeof fetch, url: string, apiKey: string, body: Record<string, unknown>) {
  const response = await fetcher(url, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(extractErrorMessage(payload) || `HTTP ${response.status}`);
  return { response, payload };
}

async function pollJson(fetcher: typeof fetch, baseUrl: string, apiKey: string, taskId: string) {
  const postResponse = await fetcher(`${baseUrl}/v1/draw/result`, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({ taskId, id: taskId }),
  });
  if (postResponse.status === 405) {
    const fallback = await fetcher(`${baseUrl}/v1/draw/result?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: jsonHeaders(apiKey),
    });
    const payload = await readJson(fallback);
    if (!fallback.ok) throw new Error(extractErrorMessage(payload) || `HTTP ${fallback.status}`);
    return { response: fallback, payload };
  }
  const payload = await readJson(postResponse);
  if (!postResponse.ok) throw new Error(extractErrorMessage(payload) || `HTTP ${postResponse.status}`);
  return { response: postResponse, payload };
}

function normalizeState(payload: Record<string, unknown>) {
  const envelope = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload;
  const code = typeof payload.code === "number"
    ? payload.code
    : typeof envelope.code === "number"
      ? envelope.code
      : undefined;
  const taskId = readString(readTaskId(payload));
  const status = readString(
    envelope.status || envelope.state || envelope.progressState || payload.status || payload.state || payload.progressState,
  ).toLowerCase();
  const errorMessage = extractErrorMessage(payload);
  const successSignal = ["success", "succeeded", "completed", "done", "ok"].includes(errorMessage.toLowerCase());

  if (code !== undefined && code !== 0) return { kind: "failed" as const, errorMessage: errorMessage || `Provider request failed with code ${code}` };
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return { kind: "failed" as const, errorMessage: errorMessage || "Provider request failed" };
  if (["succeeded", "success", "completed", "done"].includes(status)) return { kind: "success" as const, taskId };
  if (errorMessage && !successSignal && !taskId) return { kind: "failed" as const, errorMessage };
  return { kind: "pending" as const, taskId };
}

function readTaskId(payload: Record<string, unknown>) {
  const envelope = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : payload;
  return envelope.id || envelope.taskId || envelope.task_id || payload.id || payload.taskId || payload.task_id;
}

function extractImageUrls(payload: Record<string, unknown>) {
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

function extractErrorMessage(payload: Record<string, unknown>) {
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

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  const normalized = text.startsWith("data: ") ? text.slice(6) : text;
  return JSON.parse(normalized) as Record<string, unknown>;
}

function jsonHeaders(apiKey: string) {
  return {
    authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
