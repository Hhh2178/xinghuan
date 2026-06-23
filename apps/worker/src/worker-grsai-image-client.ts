import { providerJsonHeaders as buildProviderJsonHeaders } from "./worker-provider-utils.js";

export interface GrsaiImageClientOptions {
  apiKey: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
  createTaskError?: (message: string, resultPatch?: Record<string, unknown>) => Error;
}

export interface GrsaiImageGenerateInput {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  size?: string;
  images?: string[];
  submitPath?: string;
  pollPath?: string;
  onHeartbeat?: (patch: Record<string, unknown>) => Promise<void> | void;
}

export interface GrsaiImageGenerateResult {
  imageUrls: string[];
  taskId?: string;
}

export function createGrsaiImageClient(options: GrsaiImageClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? 1500);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 120000);
  const delay = options.wait ?? wait;
  const createTaskError = options.createTaskError ?? defaultCreateTaskError;

  return {
    async generate(input: GrsaiImageGenerateInput): Promise<GrsaiImageGenerateResult> {
      const submitPath = resolveGrsaiSubmitPath(input.submitPath, input.modelId);
      const pollPath = resolveGrsaiPollPath(input.pollPath);
      const submit = await requestJson(fetcher, `${baseUrl}${submitPath}`, options.apiKey, {
        model: input.modelId,
        prompt: input.prompt,
        webHook: "-1",
        ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        ...(input.size ? { size: input.size } : {}),
        ...(input.images && input.images.length > 0 ? { urls: input.images } : {}),
      }, createTaskError);

      const submitUrls = extractGrsaiImageUrls(submit.payload);
      if (submitUrls.length > 0) {
        return {
          imageUrls: submitUrls,
          taskId: readString(readGrsaiTaskId(submit.payload)),
        };
      }

      const submitState = normalizeGrsaiState(submit.payload);
      if (submitState.kind === "failed") {
        throw createTaskError(submitState.errorMessage, {
          failureCategory: "upstream_business_failed",
          providerDiagnostic: submitState.errorMessage,
          upstreamResponseSnippet: JSON.stringify(submit.payload).slice(0, 500),
        });
      }
      if (submitState.kind === "success") {
        const message = buildMissingGrsaiImageResultError(submit.payload, submitState);
        throw createTaskError(message, {
          failureCategory: "upstream_business_failed",
          providerDiagnostic: message,
          upstreamResponseSnippet: JSON.stringify(submit.payload).slice(0, 500),
        });
      }
      if (!submitState.taskId) throw new Error("GRSAI 未返回任务 ID");
      await input.onHeartbeat?.({
        heartbeatAt: new Date().toISOString(),
        upstreamTaskId: submitState.taskId,
        taskId: submitState.taskId,
        upstreamStatus: submitState.rawStatus || "submitted",
        runtimeStage: "polling",
      });

      const startedAt = Date.now();
      let gatewayRetryCount = 0;
      const maxGatewayRetries = 4;
      for (;;) {
        if (Date.now() - startedAt > timeoutMs) throw new Error("GRSAI 图像生成轮询超时");
        if (pollIntervalMs > 0) await delay(pollIntervalMs);

        let polled: Awaited<ReturnType<typeof pollGrsaiJson>>;
        try {
          polled = await pollGrsaiJson(fetcher, baseUrl, options.apiKey, submitState.taskId, pollPath, createTaskError);
          gatewayRetryCount = 0;
        } catch (error) {
          if (isRetryablePollGatewayFailure(error) && gatewayRetryCount < maxGatewayRetries) {
            gatewayRetryCount += 1;
            await delay(1200 * gatewayRetryCount);
            continue;
          }
          throw error;
        }
        const imageUrls = extractGrsaiImageUrls(polled.payload);
        if (imageUrls.length > 0) {
          return {
            imageUrls,
            taskId: submitState.taskId,
          };
        }
        const state = normalizeGrsaiState(polled.payload);
        await input.onHeartbeat?.({
          heartbeatAt: new Date().toISOString(),
          upstreamTaskId: state.taskId || submitState.taskId,
          taskId: state.taskId || submitState.taskId,
          upstreamStatus: state.rawStatus || state.kind,
          runtimeStage: "polling",
        });
        if (state.kind === "failed") {
          throw createTaskError(state.errorMessage, {
            failureCategory: "upstream_business_failed",
            providerDiagnostic: state.errorMessage,
            upstreamResponseSnippet: JSON.stringify(polled.payload).slice(0, 500),
          });
        }
        if (state.kind === "success") {
          const message = buildMissingGrsaiImageResultError(polled.payload, state);
          throw createTaskError(message, {
            failureCategory: "upstream_business_failed",
            providerDiagnostic: message,
            upstreamResponseSnippet: JSON.stringify(polled.payload).slice(0, 500),
          });
        }
      }
    },
  };
}

function defaultCreateTaskError(message: string, resultPatch: Record<string, unknown> = {}) {
  const error = new Error(message) as Error & { resultPatch?: Record<string, unknown> };
  error.name = "WorkerTaskError";
  error.resultPatch = resultPatch;
  return error;
}

async function requestJson(
  fetcher: typeof fetch,
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  createTaskError: (message: string, resultPatch?: Record<string, unknown>) => Error,
) {
  const response = await fetcher(url, {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const parsed = await readJsonResponse(response);
  if (!response.ok) throw createGrsaiHttpError(response.status, parsed, createTaskError);
  return { response, payload: parsed.payload };
}

async function pollGrsaiJson(
  fetcher: typeof fetch,
  baseUrl: string,
  apiKey: string,
  taskId: string,
  pollPath: string,
  createTaskError: (message: string, resultPatch?: Record<string, unknown>) => Error,
) {
  const response = await fetcher(`${baseUrl}${pollPath}`, {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify({ taskId, id: taskId }),
  });
  if (response.status === 405) {
    const fallback = await fetcher(`${baseUrl}${pollPath}?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: buildProviderJsonHeaders(apiKey),
    });
    const parsed = await readJsonResponse(fallback);
    if (!fallback.ok) throw createGrsaiHttpError(fallback.status, parsed, createTaskError);
    return { response: fallback, payload: parsed.payload };
  }
  const parsed = await readJsonResponse(response);
  if (!response.ok) throw createGrsaiHttpError(response.status, parsed, createTaskError);
  return { response, payload: parsed.payload };
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
  const rawStatus = readString(
    envelope.status || envelope.state || envelope.progressState || payload.status || payload.state || payload.progressState,
  );
  const status = rawStatus.toLowerCase();
  const errorMessage = extractGrsaiErrorMessage(payload);
  const successSignal = ["success", "succeeded", "completed", "done", "ok"].includes(errorMessage.toLowerCase());

  if (code !== undefined && code !== 0) return { kind: "failed" as const, errorMessage: errorMessage || `Provider request failed with code ${code}`, taskId, rawStatus };
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return { kind: "failed" as const, errorMessage: errorMessage || "Provider request failed", taskId, rawStatus };
  if (["succeeded", "success", "completed", "done"].includes(status)) return { kind: "success" as const, taskId, rawStatus };
  if (errorMessage && !successSignal && !taskId) return { kind: "failed" as const, errorMessage, taskId, rawStatus };
  return { kind: "pending" as const, taskId, rawStatus };
}

function isRetryablePollGatewayFailure(error: unknown) {
  const status = toOptionalHttpStatus(error);
  if (status === 502 || status === 503 || status === 504) return true;
  const message = error instanceof Error ? error.message : String(error || "");
  return /502|503|504|bad gateway|fetch failed/i.test(message);
}

function toOptionalHttpStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const directStatus = Number((error as { status?: unknown }).status);
  if (Number.isInteger(directStatus) && directStatus >= 100 && directStatus <= 599) return directStatus;
  const resultPatch = readResultPatch(error);
  const patchStatus = Number(resultPatch.upstreamHttpStatus || resultPatch.responseStatus || resultPatch.status);
  if (Number.isInteger(patchStatus) && patchStatus >= 100 && patchStatus <= 599) return patchStatus;
  const responseStatus = Number((error as { response?: { status?: unknown } }).response?.status);
  if (Number.isInteger(responseStatus) && responseStatus >= 100 && responseStatus <= 599) return responseStatus;
  return undefined;
}

function readResultPatch(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const resultPatch = (error as { resultPatch?: unknown }).resultPatch;
  return resultPatch && typeof resultPatch === "object" && !Array.isArray(resultPatch)
    ? resultPatch as Record<string, unknown>
    : {};
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
    || readString(envelope.reason)
    || readString(envelope.detail)
    || readString(envelope.description)
    || readString(envelope.failure_reason)
    || readString(envelope.message)
    || readString(payload.error)
    || readString(payload.reason)
    || readString(payload.detail)
    || readString(payload.description)
    || readString(payload.failure_reason)
    || readString(payload.message)
    || readString(payload.msg);
}

function createGrsaiHttpError(
  status: number,
  responseBody: { payload: Record<string, unknown>; bodySnippet: string },
  createTaskError: (message: string, resultPatch?: Record<string, unknown>) => Error,
) {
  const error = createTaskError(extractGrsaiErrorMessage(responseBody.payload) || responseBody.bodySnippet || `HTTP ${status}`, {
    upstreamHttpStatus: status,
    upstreamResponseSnippet: responseBody.bodySnippet,
    responseStatus: status,
    status,
  }) as Error & {
    status?: number;
    responseStatus?: number;
    response?: { status: number };
    bodySnippet?: string;
  };
  error.status = status;
  error.responseStatus = status;
  error.response = { status };
  error.bodySnippet = responseBody.bodySnippet;
  return error;
}

function resolveGrsaiSubmitPath(path: string | undefined, modelId: string) {
  const override = normalizeApiPath(path);
  if (override) return override;
  return /nano-banana/i.test(modelId) ? "/v1/draw/nano-banana" : "/v1/draw/completions";
}

function resolveGrsaiPollPath(path: string | undefined) {
  return normalizeApiPath(path) || "/v1/draw/result";
}

function normalizeApiPath(path: string | undefined) {
  const value = readString(path);
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function buildMissingGrsaiImageResultError(
  payload: Record<string, unknown>,
  state: { taskId?: string; rawStatus?: string },
) {
  const status = readString(state.rawStatus) || "success";
  const taskId = readString(state.taskId);
  const providerMessage = extractGrsaiErrorMessage(payload);
  const detail =
    providerMessage && !["ok", "success", "succeeded", "completed", "done"].includes(providerMessage.toLowerCase())
      ? `: ${providerMessage}`
      : "";
  const taskSuffix = taskId ? ` (taskId=${taskId})` : "";
  return `GRSAI 任务状态 ${status} 但未返回图片${taskSuffix}${detail}`;
}

async function readJsonResponse(response: Response): Promise<{ payload: Record<string, unknown>; bodySnippet: string }> {
  const text = await response.text();
  if (!text) return { payload: {}, bodySnippet: "" };
  const normalized = text.startsWith("data: ") ? text.slice(6) : text;
  const bodySnippet = normalized.slice(0, 500);
  try {
    return {
      payload: JSON.parse(normalized) as Record<string, unknown>,
      bodySnippet,
    };
  } catch {
    return {
      payload: { message: bodySnippet, rawBody: bodySnippet },
      bodySnippet,
    };
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
