import type { UnifiedFailureCategory } from "@xinghuan/shared";

export interface WorkerFailurePatch {
  failureCategory: UnifiedFailureCategory;
  providerDiagnostic: string;
  upstreamHttpStatus?: number;
  upstreamResponseSnippet?: string;
}

export function buildWorkerFailureWritebackPatch(input: {
  workerId: string;
  error: unknown;
  baseResultPatch?: Record<string, unknown>;
}) {
  const normalized = normalizeUnifiedFailure(input.error);
  return {
    ...readWorkerTaskResultPatch(input.error),
    ...(input.baseResultPatch || {}),
    workerId: input.workerId,
    failedAt: new Date().toISOString(),
    failureReason: normalized.failureReason,
    failureCategory: normalized.failureCategory,
    providerDiagnostic: normalized.providerDiagnostic,
    upstreamHttpStatus: normalized.upstreamHttpStatus,
    upstreamResponseSnippet: normalized.upstreamResponseSnippet,
  };
}

export function normalizeUnifiedFailure(error: unknown): {
  failureReason: string;
  failureCategory: WorkerFailurePatch["failureCategory"];
  providerDiagnostic: WorkerFailurePatch["providerDiagnostic"];
  upstreamHttpStatus?: WorkerFailurePatch["upstreamHttpStatus"];
  upstreamResponseSnippet?: WorkerFailurePatch["upstreamResponseSnippet"];
} {
  const resultPatch = readWorkerTaskResultPatch(error);
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  const httpStatus = toOptionalHttpStatus(error);
  const responseSnippet = toOptionalResponseSnippet(error);
  const patchCategory = safeText(resultPatch.failureCategory) as UnifiedFailureCategory;
  const patchDiagnostic = safeText(resultPatch.providerDiagnostic);

  if (patchCategory) {
    return {
      failureReason: message,
      failureCategory: patchCategory,
      providerDiagnostic: patchDiagnostic || message,
      upstreamHttpStatus: httpStatus,
      upstreamResponseSnippet: responseSnippet,
    };
  }
  if (/apikey|unauthorized|forbidden|auth/i.test(message)) {
    return { failureReason: message, failureCategory: "auth", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/credits|quota|balance|consume/i.test(message)) {
    return { failureReason: message, failureCategory: "quota_or_credits", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/fail_to_fetch_task|no available (?:platform|channel)|no usable platform|no fallbacks configured/i.test(message)) {
    return { failureReason: message, failureCategory: "upstream_poll_gateway_failed", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/model not found|workflow not found|app not found|invalid|请求参数有误|参数(?:格式)?(?:有误|错误)/i.test(message)) {
    return { failureReason: message, failureCategory: "model_config", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/timeout|超时/i.test(message)) {
    return { failureReason: message, failureCategory: "upstream_poll_timeout", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  if (/502|503|504|bad gateway|fetch failed/i.test(message)) {
    return { failureReason: message, failureCategory: "upstream_poll_gateway_failed", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
  }
  return { failureReason: message, failureCategory: "unknown", providerDiagnostic: message, upstreamHttpStatus: httpStatus, upstreamResponseSnippet: responseSnippet };
}

export function readWorkerTaskResultPatch(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return {};
  const resultPatch = (error as { resultPatch?: unknown }).resultPatch;
  return resultPatch && typeof resultPatch === "object" && !Array.isArray(resultPatch)
    ? plainObject(resultPatch)
    : {};
}

export function toOptionalHttpStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const directStatus = Number((error as { status?: unknown }).status);
  if (Number.isInteger(directStatus) && directStatus >= 100 && directStatus <= 599) return directStatus;
  const resultPatch = readWorkerTaskResultPatch(error);
  const patchStatus = Number(
    resultPatch.upstreamHttpStatus
      || resultPatch.submitResponseStatus
      || resultPatch.rhSubmitResponseStatus,
  );
  if (Number.isInteger(patchStatus) && patchStatus >= 100 && patchStatus <= 599) return patchStatus;
  const responseStatus = Number((error as { response?: { status?: unknown } }).response?.status);
  if (Number.isInteger(responseStatus) && responseStatus >= 100 && responseStatus <= 599) return responseStatus;
  return undefined;
}

export function toOptionalResponseSnippet(error: unknown) {
  const resultPatch = readWorkerTaskResultPatch(error);
  const snippet = safeText(
    resultPatch.upstreamResponseSnippet
      || resultPatch.rhSubmitResponseText
      || resultPatch.submitResponseText
      || resultPatch.providerDiagnostic,
  );
  if (snippet) return snippet.slice(0, 500);
  const message = error instanceof Error ? safeText(error.message) : safeText(error);
  const matched = message.match(/:\s*([\s\S]{1,500})$/);
  return matched ? matched[1].slice(0, 500) : undefined;
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
