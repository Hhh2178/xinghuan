import { parseRunningHubPollJsonResponse } from "./worker-runninghub-response.js";

interface RunningHubClientOptions {
  apiKey: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}

interface RunningHubNodeInfoItem {
  nodeId: string;
  fieldName: string;
  fieldValue: unknown;
}

interface RunningHubRunInput {
  targetType: "app" | "workflow";
  runTargetId: string;
  webappId?: string;
  workflowId?: string;
  nodeInfoList: RunningHubNodeInfoItem[];
  instanceType?: string;
  pollIntervalMs: number;
  timeoutMs: number;
  onHeartbeat?: (patch: Record<string, unknown>) => void | Promise<void>;
}

interface RunningHubRunResult {
  adapter: "runninghub";
  upstreamTaskId: string;
  taskId: string;
  rhTargetType: "app" | "workflow";
  rhRunTargetId: string;
  raw: Record<string, unknown>;
  videoUrls: string[];
  imageUrls: string[];
  audioUrls: string[];
  remoteVideoUrls: string[];
  remoteImageUrls: string[];
  remoteAudioUrls: string[];
  videoCount: number;
  imageCount: number;
  audioCount: number;
}

export function createRunningHubClient(options: RunningHubClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? defaultWait;

  async function runTask(input: RunningHubRunInput): Promise<RunningHubRunResult> {
    const targetType = input.targetType;
    const runTargetId = safeText(input.runTargetId);
    const webappId = safeText(input.webappId || (targetType === "app" ? runTargetId : ""));
    const workflowId = safeText(input.workflowId || (targetType === "workflow" ? runTargetId : ""));
    if (!runTargetId) {
      throw new Error(targetType === "app" ? "RunningHub 任务缺少 webappId/runTargetId" : "RunningHub 任务缺少 workflowId/runTargetId");
    }

    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const submitUrl = targetType === "app"
      ? `${baseUrl}/openapi/v2/run/ai-app/${encodeURIComponent(webappId || runTargetId)}`
      : `${baseUrl}/openapi/v2/run/workflow/${encodeURIComponent(workflowId || runTargetId)}`;
    const queryUrl = `${baseUrl}/openapi/v2/query`;
    const submitRequestBody =
      targetType === "app"
        ? {
            nodeInfoList: input.nodeInfoList,
            ...(safeText(input.instanceType) ? { instanceType: safeText(input.instanceType) } : {}),
            usePersonalQueue: "false",
          }
        : {
            apiKey: options.apiKey,
            workflowId: workflowId || runTargetId,
            nodeInfoList: input.nodeInfoList,
            ...(safeText(input.instanceType) ? { instanceType: safeText(input.instanceType) } : {}),
          };
    const submitRequestBodyForLog = sanitizeRunningHubSubmitRequestBody(submitRequestBody);

    const submitResponse = await fetcher(submitUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(submitRequestBody),
      signal: AbortSignal.timeout(120000),
    });
    const submitText = await submitResponse.text();
    if (!submitResponse.ok) {
      throw createWorkerTaskError(
        `RunningHub 提交失败 ${submitResponse.status}: ${submitText.slice(0, 500)}`,
        buildRunningHubSubmitFailurePatch({
          submitUrl,
          targetType,
          runTargetId,
          workflowId,
          submitRequestBody: submitRequestBodyForLog,
          submitResponseStatus: submitResponse.status,
          submitResponseText: submitText,
        }),
      );
    }

    let submitRaw: Record<string, unknown> = {};
    try {
      submitRaw = submitText ? JSON.parse(submitText) : {};
    } catch {
      throw createWorkerTaskError(
        "RunningHub 提交返回非法 JSON",
        buildRunningHubSubmitFailurePatch({
          submitUrl,
          targetType,
          runTargetId,
          workflowId,
          submitRequestBody: submitRequestBodyForLog,
          submitResponseStatus: submitResponse.status,
          submitResponseText: submitText,
        }),
      );
    }

    const submitEnvelope = plainObject(submitRaw.data);
    const submitData = targetType === "app" ? submitEnvelope : submitRaw;
    const upstreamCode = Number(targetType === "app" ? submitRaw.code : submitRaw.code);
    const upstreamPayload = plainObject(targetType === "app" ? submitEnvelope : submitRaw.data);
    const upstreamTaskId = safeText(
      upstreamPayload.taskId
        || upstreamPayload.id
        || submitRaw.taskId
        || submitRaw.id,
    );

    if ((Number.isFinite(upstreamCode) && upstreamCode !== 0) || !upstreamTaskId) {
      const message = humanizeRunningHubUpstreamError(safeText(
        submitData.msg
        || submitRaw.errorMessage
        || submitRaw.message
        || submitRaw.msg,
        "RunningHub 未返回有效任务 ID",
      ), targetType);
      throw createWorkerTaskError(
        message,
        {
          ...buildRunningHubSubmitFailurePatch({
            submitUrl,
            targetType,
            runTargetId,
            workflowId,
            submitRequestBody: submitRequestBodyForLog,
            submitResponseStatus: submitResponse.status,
            submitResponseText: submitText,
          }),
          failureCategory: "upstream_business_failed",
          providerDiagnostic: message,
          upstreamHttpStatus: submitResponse.status,
          upstreamResponseSnippet: submitText.slice(0, 500),
        },
      );
    }

    await input.onHeartbeat?.({
      upstreamTaskId,
      taskId: upstreamTaskId,
      upstreamStatus: "submitted",
      progress: "5%",
      queueHint: "任务提交中",
      runtimeStage: "polling",
      rhTargetType: targetType,
      rhRunTargetId: runTargetId,
    });

    const startedAt = Date.now();
    for (;;) {
      if (Date.now() - startedAt > input.timeoutMs) {
        throw createWorkerTaskError(`RunningHub 轮询超时: ${upstreamTaskId}`, {
          failureCategory: "upstream_poll_timeout",
          providerDiagnostic: `RunningHub 轮询超时: ${upstreamTaskId}`,
        });
      }

      await wait(input.pollIntervalMs);

      const pollResponse = await fetcher(queryUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ taskId: upstreamTaskId }),
        signal: AbortSignal.timeout(120000),
      });
      const pollText = await pollResponse.text();
      if (!pollResponse.ok) {
        throw createWorkerTaskError(`RunningHub 轮询失败 ${pollResponse.status}: ${pollText.slice(0, 500)}`, {
          failureCategory: "upstream_poll_gateway_failed",
          providerDiagnostic: `RunningHub 轮询失败 ${pollResponse.status}`,
          upstreamHttpStatus: pollResponse.status,
          upstreamResponseSnippet: pollText.slice(0, 500),
        });
      }

      const parsedPoll = parseRunningHubPollJsonResponse(pollText, pollResponse.status);
      if (!parsedPoll.ok) {
        throw createWorkerTaskError(parsedPoll.errorMessage, parsedPoll.resultPatch);
      }
      const pollRaw = parsedPoll.raw;
      const pollMessage = safeText(
        pollRaw.errorMessage
        || pollRaw.msg
        || pollRaw.message
        || plainObject(pollRaw.data).errorMessage
        || plainObject(pollRaw.data).msg
        || plainObject(pollRaw.data).message,
      );
      const pollCode = Number(pollRaw.code);

      await input.onHeartbeat?.({
        upstreamTaskId,
        taskId: upstreamTaskId,
        upstreamStatus: safeText(pollRaw.status, String(Number.isFinite(pollCode) ? pollCode : "")),
        runtimeStage: "polling",
        upstreamMessage: pollMessage,
        progress: isRunningHubQueuedStatus(pollRaw.status) ? "5%" : "45%",
        queueHint: isRunningHubQueuedStatus(pollRaw.status) ? "任务队列排队中" : "任务已提交，正在生成",
        rhTargetType: targetType,
        rhRunTargetId: runTargetId,
      });

      if (targetType === "app") {
        const appStatus = safeText(pollRaw.status).toUpperCase();
        if (["RUNNING", "PENDING", "QUEUED", "WAITING"].includes(appStatus)) continue;
        if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(appStatus) || safeText(pollRaw.errorCode)) {
          throw createWorkerTaskError(pollMessage || `RunningHub AI 应用任务失败: ${upstreamTaskId}`, {
            failureCategory: "upstream_business_failed",
            providerDiagnostic: pollMessage || `RunningHub AI 应用任务失败: ${upstreamTaskId}`,
            upstreamResponseSnippet: pollText.slice(0, 500),
          });
        }
        if (Number.isFinite(pollCode) && pollCode !== 0 && !["SUCCESS"].includes(appStatus)) {
          throw createWorkerTaskError(pollMessage || `RunningHub AI 应用返回未知状态: ${pollCode}`, {
            failureCategory: "upstream_business_failed",
            providerDiagnostic: pollMessage || `RunningHub AI 应用返回未知状态: ${pollCode}`,
            upstreamResponseSnippet: pollText.slice(0, 500),
          });
        }
      }

      if (targetType === "workflow") {
        const workflowPayload = plainObject(pollRaw.data);
        const workflowStatus = safeText(pollRaw.status || pollRaw.taskStatus || workflowPayload.status).toUpperCase();
        if (["RUNNING", "PENDING", "QUEUED", "WAITING"].includes(workflowStatus)) continue;
        if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(workflowStatus) || safeText(pollRaw.errorCode)) {
          throw createWorkerTaskError(pollMessage || `RunningHub 工作流任务失败: ${upstreamTaskId}`, {
            failureCategory: "upstream_business_failed",
            providerDiagnostic: pollMessage || `RunningHub 工作流任务失败: ${upstreamTaskId}`,
            upstreamResponseSnippet: pollText.slice(0, 500),
          });
        }
      }

      const urls = extractRunningHubOutputUrls(targetType === "app" ? pollRaw.results || pollRaw.data || pollRaw : pollRaw.data || pollRaw);
      if (urls.imageUrls.length === 0 && urls.videoUrls.length === 0 && urls.audioUrls.length === 0) {
        throw createWorkerTaskError(pollMessage || "RunningHub 任务成功但未返回可用输出", {
          failureCategory: "upstream_business_failed",
          providerDiagnostic: pollMessage || "RunningHub 任务成功但未返回可用输出",
          upstreamResponseSnippet: pollText.slice(0, 500),
        });
      }

      return {
        adapter: "runninghub",
        taskId: upstreamTaskId,
        upstreamTaskId,
        rhTargetType: targetType,
        rhRunTargetId: runTargetId,
        raw: pollRaw,
        videoUrls: urls.videoUrls,
        imageUrls: urls.imageUrls,
        audioUrls: urls.audioUrls,
        remoteVideoUrls: urls.videoUrls,
        remoteImageUrls: urls.imageUrls,
        remoteAudioUrls: urls.audioUrls,
        videoCount: urls.videoUrls.length,
        imageCount: urls.imageUrls.length,
        audioCount: urls.audioUrls.length,
      };
    }
  }

  return {
    runTask,
  };
}

function isRunningHubQueuedStatus(value: unknown) {
  const status = safeText(value).toUpperCase();
  return ["QUEUED", "PENDING", "WAITING"].includes(status);
}

function defaultWait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function safeText(value: unknown, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sanitizeRunningHubSubmitRequestBody(body: Record<string, unknown>) {
  const next = plainObject(body);
  if (safeText(next.apiKey)) next.apiKey = "[redacted]";
  if (safeText(next.apiKeyOnly)) next.apiKeyOnly = "[redacted]";
  return next;
}

function humanizeRunningHubUpstreamError(message: string, targetType: "app" | "workflow") {
  const text = safeText(message);
  const mismatch = text.match(/NODE_INFO_MISMATCH\(nodeId=([^,]+),\s*fieldName=([^,]+),\s*reason=([^)]+)\)/i);
  if (!mismatch) return text;
  const [, rawNodeId, rawFieldName, rawReason] = mismatch;
  const nodeId = safeText(rawNodeId);
  const fieldName = safeText(rawFieldName);
  const reason = safeText(rawReason).toLowerCase();
  if (reason === "node_not_found_in_workflow") {
    return targetType === "app"
      ? `字段与 RunningHub 当前工作流不一致：${nodeId}.${fieldName} 在上游当前工作流中不存在。该 AI 应用公开文档或 apiCallDemo 中的输入定义可能已过期，请先在 RunningHub 页面重新核对真实可提交字段。原始错误：${text}`
      : `字段与 RunningHub 当前工作流不一致：${nodeId}.${fieldName} 在上游当前工作流中不存在。请重新核对 workflowId、nodeId 和 fieldName。原始错误：${text}`;
  }
  return `字段与 RunningHub 当前工作流不一致：${nodeId}.${fieldName} 校验失败（${reason || "unknown_reason"}）。原始错误：${text}`;
}

function buildRunningHubSubmitFailurePatch(input: {
  submitUrl: string;
  targetType: "app" | "workflow";
  runTargetId: string;
  workflowId: string;
  submitRequestBody: Record<string, unknown>;
  submitResponseStatus: number;
  submitResponseText: string;
}) {
  return {
    rhFailureStage: "submit",
    rhSubmitUrl: input.submitUrl,
    rhSubmitTargetType: input.targetType,
    rhRunTargetId: input.runTargetId,
    rhWorkflowId: input.workflowId,
    rhSubmitRequest: input.submitRequestBody,
    rhSubmitResponseStatus: input.submitResponseStatus,
    rhSubmitResponseText: input.submitResponseText.slice(0, 2000),
  };
}

function extractRunningHubOutputUrls(value: unknown) {
  const urls = collectRunningHubUrls(value);
  const imageUrls = urls.filter((url) => /\.(png|jpe?g|webp|gif|bmp|avif)(\?|$)/i.test(url));
  const videoUrls = urls.filter((url) => /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url));
  const audioUrls = urls.filter((url) => /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(url));
  const uncategorized = urls.filter((url) => !imageUrls.includes(url) && !videoUrls.includes(url) && !audioUrls.includes(url));
  if (videoUrls.length === 0 && imageUrls.length === 0 && audioUrls.length === 0 && uncategorized.length > 0) {
    videoUrls.push(...uncategorized);
  }
  return { imageUrls, videoUrls, audioUrls };
}

function collectRunningHubUrls(value: unknown, seen = new Set<string>()): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const text = value.trim();
    if (/^https?:\/\//i.test(text)) {
      if (seen.has(text)) return [];
      seen.add(text);
      return [text];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRunningHubUrls(item, seen));
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    const direct = [row.fileUrl, row.url, row.downloadUrl, row.previewUrl, row.src];
    const directUrls = direct.flatMap((item) => collectRunningHubUrls(item, seen));
    return [
      ...directUrls,
      ...collectRunningHubUrls(row.outputs, seen),
      ...collectRunningHubUrls(row.results, seen),
      ...collectRunningHubUrls(row.files, seen),
      ...collectRunningHubUrls(row.data, seen),
      ...collectRunningHubUrls(row.result, seen),
    ];
  }
  return [];
}

function createWorkerTaskError(message: string, resultPatch: Record<string, unknown> = {}) {
  const error = new Error(message) as Error & { resultPatch?: Record<string, unknown> };
  error.name = "WorkerTaskError";
  error.resultPatch = resultPatch;
  return error;
}
