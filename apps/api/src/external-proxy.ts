import {
  mergeModelParameterSchema,
  parseAdvancedConfig,
  parseInputCapabilities,
  uiMetadataFromSchema,
  createAicopyVideoAdapterPayload,
  extractAicopyTask,
  extractAicopyVideoResult,
  resolveAicopyRequestContractEnabled,
  shouldUseAicopyVideoAdapter,
  type ProviderProtocol as CatalogProtocol,
} from "@xinghuan/model-core";
import { createGrsaiImageClient } from "./grsai-image-adapter.js";
import { prepareGrsaiReferenceImages, prepareProviderReferenceImages } from "./grsai-reference-images.js";
import {
  normalizeProviderReferenceUrl as normalizeProviderReferenceUrlForAccess,
  normalizeProviderReferenceUrls as normalizeProviderReferenceUrlsForAccess,
} from "./provider-file-access.js";
import type {
  ExternalProxyProvider as ProviderLike,
  ExternalProxyUser as CurrentUserLike,
  GenerateExternalProxyDependencies,
} from "./external-proxy-types.js";
import {
  extractChatContent,
  extractImageOutputs,
  extractVideoUrls,
  toImageDataUrl,
} from "./provider-response-parser.js";
import {
  createApimartVideoAdapterPayload,
  extractApimartFinalTaskId,
  extractApimartTask,
  extractApimartVideoResult,
  resolveApimartVideoMultipartFieldNames,
  shouldUseApimartVideoAdapter,
} from "./apimart-video-adapter.js";
import {
  createOpenAiAudioChatPayload,
  extractAudioProviderResult,
} from "./audio-provider-adapter.js";
import {
  buildProviderMultipartRequestBody,
  isMultipartRequestBodyMode,
} from "./provider-request-body.js";
import {
  normalizeVideoInputMode,
  validateVideoInputs,
  VideoInputValidationError,
} from "./video-input-validation.js";

export function createExternalProxyHandlers(deps: GenerateExternalProxyDependencies) {
  function enforceVideoInputs(input: Parameters<typeof validateVideoInputs>[0]) {
    try {
      return validateVideoInputs(input);
    } catch (error) {
      if (error instanceof VideoInputValidationError && deps.invalidRequest) {
        throw deps.invalidRequest(error.message);
      }
      throw error;
    }
  }

  function clampOptionalInteger(value: unknown, min: number, max: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
    return Math.round(Math.max(min, Math.min(max, numeric)));
  }

  function isModelScopeImageProvider(protocol: string, provider: ProviderLike) {
    const baseUrl = deps.safeText(provider.baseUrl).toLowerCase();
    return protocol === "modelscope" || baseUrl.includes("api-inference.modelscope.cn");
  }

  function applyImageReferencePayload(payload: Record<string, unknown>, imageUrls: string[], isModelScope: boolean) {
    if (imageUrls.length === 0) return;
    payload.image = isModelScope && imageUrls.length === 1 ? imageUrls[0] : imageUrls;
    if (!isModelScope) return;
    payload.images = imageUrls;
    payload.image_url = imageUrls[0];
    payload.image_urls = imageUrls;
  }

  function modelScopeHeaders(apiKey: string, mode: "submit" | "poll") {
    return {
      ...deps.providerModelHeaders(apiKey, "modelscope"),
      ...(mode === "submit" ? { "X-ModelScope-Async-Mode": "true" } : {}),
      ...(mode === "poll" ? { "X-ModelScope-Task-Type": "image_generation" } : {}),
    };
  }

  function extractModelScopeImageTask(raw: unknown, advancedConfig: ReturnType<typeof parseAdvancedConfig>) {
    const root = deps.plainObject(raw);
    const data = deps.plainObject(root.data);
    return {
      taskId:
        deps.safeText(root[deps.safeText(advancedConfig.taskIdPath || "task_id")] as unknown)
        || deps.safeText(root.task_id)
        || deps.safeText(data.task_id)
        || deps.safeText(root.id),
      status:
        deps.safeText(root[deps.safeText(advancedConfig.taskStatusPath || "task_status")] as unknown)
        || deps.safeText(root.task_status)
        || deps.safeText(data.task_status)
        || deps.safeText(root.status),
    };
  }

  function isCompletedAsyncStatus(status: string) {
    return ["completed", "succeeded", "success", "done", "succeed"].includes(status);
  }

  function isFailedAsyncStatus(status: string) {
    return ["failed", "failure", "error", "cancelled", "canceled", "fail"].includes(status);
  }

  function summarizeUpstreamBody(text: string) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 320);
  }

  function parseUpstreamJson(text: string, label: string, contentType?: string) {
    const normalized = String(text || "").trim();
    if (!normalized) return {};
    try {
      return JSON.parse(normalized);
    } catch {
      const type = deps.safeText(contentType);
      if (
        deps.looksLikeHtml(normalized)
        || /text\/html|application\/xhtml\+xml/i.test(type)
        || /just a moment|cf-browser-verification|attention required/i.test(normalized.toLowerCase())
      ) {
        throw new Error(`${label}返回网页 HTML，请检查 Base URL、Cloudflare/WAF 或上游鉴权`);
      }
      throw new Error(`${label}返回非 JSON 响应${type ? ` (${type})` : ""}: ${summarizeUpstreamBody(normalized)}`);
    }
  }

  const findEnabledImageModel = async (providerId: string, requestedModelId: string, modelRecordId: string) =>
    findEnabledModel("image", providerId, requestedModelId, modelRecordId);

  async function findEnabledModel(capability: "chat" | "image" | "video" | "audio", providerId: string, requestedModelId: string, modelRecordId: string) {
    const db = await deps.readAdminDb();
    const provider = db.providers.find((item) => item.id === providerId);
    if (!provider || !provider.enabled) throw new Error("Provider 不存在或未启用");
    const model = db.models.find((item) => {
      if (!item.enabled || item.providerId !== provider.id || deps.normalizeCapability(item.capability) !== capability) return false;
      if (modelRecordId && item.id === modelRecordId) return true;
      return Boolean(requestedModelId) && item.modelId === requestedModelId;
    });
    if (!model) throw new Error(`模型不存在、未启用或不是 ${capability} 模型`);
    return { provider, model };
  }

  function openAiEndpoint(baseUrlValue: unknown, pathname: string) {
    const baseUrl = deps.safeText(baseUrlValue).replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Provider 请求地址必须以 http:// 或 https:// 开头");
    const normalizedPathname = deps.safeText(pathname);
    if (/^https?:\/\//i.test(normalizedPathname)) return normalizedPathname;
    if (normalizedPathname.startsWith("../") || normalizedPathname.startsWith("./")) {
      return new URL(normalizedPathname, `${baseUrl}/`).toString();
    }
    return baseUrl.endsWith("/v1") ? `${baseUrl}/${normalizedPathname}` : `${baseUrl}/v1/${normalizedPathname}`;
  }

  function openAiImageGenerationUrl(baseUrlValue: unknown) {
    return openAiEndpoint(baseUrlValue, "images/generations");
  }

  function normalizeProviderReferenceUrls(values: string[], publicOrigin: string, user?: CurrentUserLike) {
    return normalizeProviderReferenceUrlsForAccess(values, publicOrigin, user, {
      secret: deps.secretKey(),
      scope: deps.providerFileScope,
    });
  }

  function normalizeProviderReferenceUrl(value: string, publicOrigin: string, user?: CurrentUserLike) {
    return normalizeProviderReferenceUrlForAccess(value, publicOrigin, user, {
      secret: deps.secretKey(),
      scope: deps.providerFileScope,
    });
  }

  function normalizeChatContentPart(value: unknown, publicOrigin?: string, user?: CurrentUserLike) {
    const part = deps.plainObject(value);
    const imageUrl = part.image_url;
    if (publicOrigin && user && imageUrl && typeof imageUrl === "object" && !Array.isArray(imageUrl)) {
      const image = deps.plainObject(imageUrl);
      if (typeof image.url === "string") {
        return { ...part, image_url: { ...image, url: normalizeProviderReferenceUrl(image.url, publicOrigin, user) } };
      }
    }
    return part;
  }

  function normalizeChatMessages(value: unknown, publicOrigin?: string, user?: CurrentUserLike) {
    if (!Array.isArray(value)) return [];
    return value.slice(-100).map((item) => {
      const row = deps.plainObject(item);
      const role = ["system", "user", "assistant", "tool"].includes(String(row.role)) ? String(row.role) : "user";
      const content = Array.isArray(row.content)
        ? row.content.slice(0, 64).map((part) => normalizeChatContentPart(part, publicOrigin, user)).filter((part) => Object.keys(part).length > 0)
        : String(row.content || "").slice(0, 100000);
      return { role, content };
    }).filter((item) => Array.isArray(item.content) ? item.content.length > 0 : Boolean(item.content));
  }

  function readAudioSampleDataUrl(...values: unknown[]) {
    for (const value of values) {
      const text = typeof value === "string" ? value.trim() : "";
      if (text) return text.slice(0, 20_000_000);
    }
    return "";
  }

  async function pollApimartVideoTask(input: {
    provider: ProviderLike;
    apiKey: string;
    taskId: string;
    protocol: string;
    advancedConfig: ReturnType<typeof parseAdvancedConfig>;
  }) {
    const pollIntervalMs = deps.clampInteger(input.advancedConfig.pollIntervalMs, 1500, 30000, 2500);
    const pollTimeoutMs = clampOptionalInteger(input.advancedConfig.pollTimeoutMs, 30000, 600000);
    const startedAt = Date.now();
    let deadline = typeof pollTimeoutMs === "number" ? startedAt + pollTimeoutMs : Number.POSITIVE_INFINITY;
    const pollPathTemplate = deps.safeText(input.advancedConfig.pollPathTemplate, "tasks/{task_id}");
    while (Date.now() < deadline) {
      const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(input.taskId));
      const upstream = await fetch(openAiEndpoint(input.provider.baseUrl, statusPath), {
        method: "GET",
        headers: deps.providerModelHeaders(input.apiKey, input.protocol),
        signal: AbortSignal.timeout(60000),
      });
      const text = await upstream.text();
      if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
      if (!upstream.ok) throw new Error(`查询视频任务失败 ${upstream.status}: ${text.slice(0, 500)}`);
      const raw = parseUpstreamJson(text, "视频任务轮询接口", upstream.headers.get("content-type") || "");
      const data = raw && typeof raw === "object" && !Array.isArray(raw)
        ? deps.plainObject((raw as Record<string, unknown>).data)
        : {};
      const estimatedTimeSec = Number(data.estimated_time);
      if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
        const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
        deadline = Math.max(deadline, adaptiveDeadline);
      }
      const result = extractApimartVideoResult(raw, {
        statusPath: deps.safeText(input.advancedConfig.taskStatusPath, "data.status"),
        resultVideoPath: deps.safeText(input.advancedConfig.resultVideoPath, "data.result.videos"),
      });
      const normalizedStatus = String(result.status || "").trim().toLowerCase();
      if (result.videoUrls.length > 0 && (!normalizedStatus || isCompletedAsyncStatus(normalizedStatus))) {
        return result;
      }
      const finalResultPathTemplate = deps.safeText(input.advancedConfig.finalResultPathTemplate);
      if (finalResultPathTemplate) {
        const finalTaskId = extractApimartFinalTaskId(raw, {
          taskIdPath: deps.safeText(input.advancedConfig.finalResultTaskIdPath),
        });
        if (finalTaskId) {
          const finalResult = await fetchFinalApimartVideoResult({
            provider: input.provider,
            apiKey: input.apiKey,
            protocol: input.protocol,
            advancedConfig: input.advancedConfig,
            taskId: finalTaskId,
          });
          const finalStatus = String(finalResult.status || "").trim().toLowerCase();
          if (finalResult.videoUrls.length > 0 && (!finalStatus || isCompletedAsyncStatus(finalStatus))) {
            return finalResult;
          }
          if (isFailedAsyncStatus(finalStatus)) {
            const reason = deps.safeText(finalResult.failureReason, finalResult.status || "failed");
            throw new Error(`视频任务失败: ${reason}`);
          }
        }
      }
      if (isFailedAsyncStatus(normalizedStatus)) {
        const reason = deps.safeText(result.failureReason, result.status || "failed");
        throw new Error(`视频任务失败: ${reason}`);
      }
      await sleep(pollIntervalMs);
    }
    throw new Error("视频任务轮询超时");
  }

  async function pollAicopyVideoTask(input: {
    provider: ProviderLike;
    apiKey: string;
    taskId: string;
    protocol: string;
    advancedConfig: ReturnType<typeof parseAdvancedConfig>;
  }) {
    const pollIntervalMs = deps.clampInteger(input.advancedConfig.pollIntervalMs, 1500, 30000, 2500);
    const pollTimeoutMs = clampOptionalInteger(input.advancedConfig.pollTimeoutMs, 30000, 600000);
    const startedAt = Date.now();
    let deadline = typeof pollTimeoutMs === "number" ? startedAt + pollTimeoutMs : Number.POSITIVE_INFINITY;
    const pollPathTemplate = deps.safeText(input.advancedConfig.pollPathTemplate, "videos/{task_id}");
    while (Date.now() < deadline) {
      const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(input.taskId));
      const upstream = await fetch(openAiEndpoint(input.provider.baseUrl, statusPath), {
        method: "GET",
        headers: deps.providerModelHeaders(input.apiKey, input.protocol),
        signal: AbortSignal.timeout(60000),
      });
      const text = await upstream.text();
      if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
      if (!upstream.ok) throw new Error(`查询视频任务失败 ${upstream.status}: ${text.slice(0, 500)}`);
      const raw = parseUpstreamJson(text, "视频任务轮询接口", upstream.headers.get("content-type") || "");
      const result = extractAicopyVideoResult(raw, {
        statusPath: deps.safeText(input.advancedConfig.taskStatusPath, "status"),
        resultVideoPath: deps.safeText(input.advancedConfig.resultVideoPath, "data.output"),
      });
      const normalizedStatus = String(result.status || "").trim().toLowerCase();
      if (result.videoUrls.length > 0 && (!normalizedStatus || isCompletedAsyncStatus(normalizedStatus))) {
        return result;
      }
      if (isFailedAsyncStatus(normalizedStatus)) {
        const reason = deps.safeText(result.failureReason, result.status || "failed");
        throw new Error(`视频任务失败: ${reason}`);
      }
      await sleep(pollIntervalMs);
    }
    throw new Error("视频任务轮询超时");
  }

  async function fetchFinalApimartVideoResult(input: {
    provider: ProviderLike;
    apiKey: string;
    taskId: string;
    protocol: string;
    advancedConfig: ReturnType<typeof parseAdvancedConfig>;
  }) {
    const finalResultPathTemplate = deps.safeText(input.advancedConfig.finalResultPathTemplate);
    if (!finalResultPathTemplate) return { status: "", failureReason: "", videoUrls: [], raw: {} };
    const finalPath = finalResultPathTemplate.replace("{task_id}", encodeURIComponent(input.taskId));
    const upstream = await fetch(openAiEndpoint(input.provider.baseUrl, finalPath), {
      method: "GET",
      headers: deps.providerModelHeaders(input.apiKey, input.protocol),
      signal: AbortSignal.timeout(60000),
    });
    const text = await upstream.text();
    if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`查询最终视频结果失败 ${upstream.status}: ${text.slice(0, 500)}`);
    const raw = parseUpstreamJson(text, "视频最终结果接口", upstream.headers.get("content-type") || "");
    return extractApimartVideoResult(raw, {
      statusPath: deps.safeText(input.advancedConfig.taskStatusPath, "data.status"),
      resultVideoPath: deps.safeText(input.advancedConfig.finalResultVideoPath || input.advancedConfig.resultVideoPath, "data.result.videos"),
    });
  }

  async function pollAsyncImageTask(input: {
    provider: ProviderLike;
    apiKey: string;
    taskId: string;
    protocol: string;
    advancedConfig: ReturnType<typeof parseAdvancedConfig>;
  }) {
    const pollIntervalMs = deps.clampInteger(input.advancedConfig.pollIntervalMs, 1500, 30000, 2500);
    const pollTimeoutMs = clampOptionalInteger(input.advancedConfig.pollTimeoutMs, 30000, 600000);
    const startedAt = Date.now();
    let deadline = typeof pollTimeoutMs === "number" ? startedAt + pollTimeoutMs : Number.POSITIVE_INFINITY;
    const pollPathTemplate = deps.safeText(input.advancedConfig.pollPathTemplate, "tasks/{task_id}");
    while (Date.now() < deadline) {
      const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(input.taskId));
      const isModelScope = isModelScopeImageProvider(input.protocol, input.provider);
      const upstream = await fetch(openAiEndpoint(input.provider.baseUrl, statusPath), {
        method: "GET",
        headers: isModelScope ? modelScopeHeaders(input.apiKey, "poll") : deps.providerModelHeaders(input.apiKey, input.protocol),
        signal: AbortSignal.timeout(60000),
      });
      const text = await upstream.text();
      if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
      if (!upstream.ok) throw new Error(`查询图像任务失败 ${upstream.status}: ${text.slice(0, 500)}`);
      const raw = parseUpstreamJson(text, "图像任务轮询接口", upstream.headers.get("content-type") || "");
      const data = raw && typeof raw === "object" && !Array.isArray(raw)
        ? deps.plainObject((raw as Record<string, unknown>).data)
        : {};
      const estimatedTimeSec = Number(data.estimated_time);
      if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
        const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
        deadline = Math.max(deadline, adaptiveDeadline);
      }
      const extracted = extractImageOutputs(raw);
      const task = isModelScope
        ? extractModelScopeImageTask(raw, input.advancedConfig)
        : extractApimartTask(raw, {
            statusPath: deps.safeText(input.advancedConfig.taskStatusPath, "data.status"),
          });
      const normalizedStatus = String(task.status || "").trim().toLowerCase();
      if (
        (extracted.urls.length > 0 || extracted.base64.length > 0) &&
        (!normalizedStatus || isCompletedAsyncStatus(normalizedStatus))
      ) {
        return extracted;
      }
      if (isFailedAsyncStatus(normalizedStatus)) {
        throw new Error(`图像任务失败: ${task.status || "failed"}`);
      }
      await sleep(pollIntervalMs);
    }
    throw new Error("图像任务轮询超时");
  }

  async function generateOpenAiLikeImage(input: {
    provider: ProviderLike;
    apiKey: string;
    protocol: string;
    payload: Record<string, unknown>;
    advancedConfig: ReturnType<typeof parseAdvancedConfig>;
  }) {
    const isModelScope = isModelScopeImageProvider(input.protocol, input.provider);
    const upstream = await fetch(openAiImageGenerationUrl(input.provider.baseUrl), {
      method: "POST",
      headers: {
        ...(isModelScope ? modelScopeHeaders(input.apiKey, "submit") : deps.providerModelHeaders(input.apiKey, input.protocol)),
        "content-type": "application/json",
      },
      body: JSON.stringify(input.payload),
      signal: AbortSignal.timeout(120000),
    });
    const text = await upstream.text();
    if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`上游图像生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
    const raw = parseUpstreamJson(text, "图像生成接口", upstream.headers.get("content-type") || "");
    const extracted = extractImageOutputs(raw);
    if (extracted.urls.length > 0 || extracted.base64.length > 0) return extracted;
    const task = isModelScope
      ? extractModelScopeImageTask(raw, input.advancedConfig)
      : extractApimartTask(raw, {
          taskIdPath: deps.safeText(input.advancedConfig.taskIdPath, "data.0.task_id"),
          statusPath: deps.safeText(input.advancedConfig.taskStatusPath, "data.0.status"),
        });
    if (!task.taskId) return extracted;
    return pollAsyncImageTask({
      provider: input.provider,
      apiKey: input.apiKey,
      taskId: task.taskId,
      protocol: input.protocol,
      advancedConfig: input.advancedConfig,
    });
  }

  async function generateGrsaiImage(
    baseUrl: string,
    apiKey: string,
    modelId: string,
    prompt: string,
    aspectRatio: string,
    size: string,
    images: string[],
    advancedConfig: Record<string, unknown> = {},
  ) {
    const client = createGrsaiImageClient({
      apiKey,
      baseUrl: deps.safeText(baseUrl),
      pollIntervalMs: 1500,
      timeoutMs: 120000,
    });
    const result = await client.generate({
      modelId,
      prompt,
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(size && size !== "auto" ? { size } : {}),
      ...(images.length > 0 ? { images } : {}),
      submitPath: deps.safeText(advancedConfig.submitPath),
      pollPath: deps.safeText(advancedConfig.pollPath || advancedConfig.pollPathTemplate),
    });
    return {
      urls: result.imageUrls,
      base64: [],
      raw: result.raw,
    };
  }

  async function generateExternalImageProxy(rawBody: unknown, user: CurrentUserLike, publicOrigin: string) {
    const body = deps.plainObject(rawBody);
    const prompt = deps.safePromptText(body.prompt, "", 8000);
    if (!prompt) throw new Error("缺少 prompt");

    const providerId = deps.safeSlug(body.providerId, "");
    const requestedModelId = deps.safeText(body.providerModel || body.model);
    const params = deps.plainObject(body.providerParams);
    const modelRecordId = deps.safeText(params.modelRecordId);
    const { provider, model } = await findEnabledImageModel(providerId, requestedModelId, modelRecordId);
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "modelscope", "custom", "grsai_draw"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入图像生成 Adapter: ${protocol}`);
    }

    const apiKey = deps.providerPlainApiKey(provider);
    if (!apiKey) throw new Error("Provider 未配置 API Key");

    const parameterSchema = mergeModelParameterSchema("image", model.modelId, protocol as CatalogProtocol, model.parameterSchema);
    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    const ui = uiMetadataFromSchema(parameterSchema, "image");
    const requestedSize = deps.safeText(body.size || params.size || params.image_size);
    const size = ui.sizes.includes(requestedSize) ? requestedSize : ui.sizes[0] || "1024x1024";
    const count = Math.max(1, Math.min(4, Number(body.n) || 1));
    const images = normalizeProviderReferenceUrls(
      Array.isArray(body.images) ? body.images.map((item) => deps.safeText(item)).filter(Boolean).slice(0, ui.maxReferenceImages || 4) : [],
      publicOrigin,
      user,
    );
    const payload: Record<string, unknown> = { model: model.modelId, prompt, n: count, size };
    const aspectRatio = deps.safeText(params.aspectRatio || body.aspect_ratio);
    if (aspectRatio) payload.aspect_ratio = aspectRatio;
    applyImageReferencePayload(payload, images, isModelScopeImageProvider(protocol, provider));

    const grsaiImages = protocol === "grsai_draw"
      ? await prepareGrsaiReferenceImages({
          dataDir: deps.dataDir,
          ownerId: user.id,
          values: Array.isArray(body.images) ? body.images.map((item) => deps.safeText(item)).filter(Boolean) : [],
          limit: ui.maxReferenceImages || 4,
        })
      : [];
    const extracted = protocol === "grsai_draw"
      ? await generateGrsaiImage(provider.baseUrl, apiKey, model.modelId, prompt, aspectRatio, size, grsaiImages, advancedConfig)
      : await generateOpenAiLikeImage({ provider, apiKey, protocol, payload, advancedConfig });
    if (extracted.urls.length === 0 && extracted.base64.length === 0) throw new Error("上游未返回可用图像");

    const localUrls: string[] = [];
    const remoteImageUrls: string[] = [];
    for (const item of extracted.base64) {
      const saved = await deps.saveBase64File({ dataUrl: toImageDataUrl(item), prefix: "external_image" }, user);
      localUrls.push(saved.url);
    }
    for (const sourceUrl of extracted.urls) {
      const saved = await deps.saveRemoteImageToOutput(sourceUrl, user);
      localUrls.push(saved.url);
      remoteImageUrls.push(sourceUrl);
    }

    return {
      imageUrls: localUrls,
      remoteImageUrls,
      raw: { providerId: provider.id, modelId: model.modelId, count: localUrls.length },
      provider: { id: provider.id, name: provider.name, protocol },
    };
  }

  async function generateExternalChatProxy(rawBody: unknown, user: CurrentUserLike, publicOrigin: string) {
    const body = deps.plainObject(rawBody);
    const params = deps.plainObject(body.providerParams);
    const { provider, model } = await findEnabledModel(
      "chat",
      deps.safeSlug(body.providerId, ""),
      deps.safeText(body.providerModel || body.model),
      deps.safeText(params.modelRecordId),
    );
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入语言模型 Adapter: ${protocol}`);
    }
    const apiKey = deps.providerPlainApiKey(provider);
    if (!apiKey) throw new Error("Provider 未配置 API Key");
    const messages = normalizeChatMessages(body.messages, publicOrigin, user);
    if (messages.length === 0) throw new Error("缺少 messages");
    const payload: Record<string, unknown> = { model: model.modelId, messages, stream: false };
    const temperature = Number(body.temperature);
    if (Number.isFinite(temperature)) payload.temperature = Math.max(0, Math.min(2, temperature));
    const maxTokens = Number(body.max_tokens || body.maxTokens);
    if (Number.isFinite(maxTokens) && maxTokens > 0) payload.max_tokens = Math.min(200000, Math.floor(maxTokens));

    const upstream = await fetch(openAiEndpoint(provider.baseUrl, "chat/completions"), {
      method: "POST",
      headers: { ...deps.providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
    const text = await upstream.text();
    if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`上游语言模型请求失败 ${upstream.status}: ${text.slice(0, 500)}`);
    const raw = parseUpstreamJson(text, "扩展对话接口", upstream.headers.get("content-type") || "");
    const content = extractChatContent(raw);
    return {
      content,
      text: content,
      raw: {
        providerId: provider.id,
        providerName: provider.name,
        modelId: model.modelId,
        modelRecordId: model.id,
        modelDisplayName: model.displayName,
        finishReason: (raw as any)?.choices?.[0]?.finish_reason || "",
      },
      provider: { id: provider.id, name: provider.name, protocol },
    };
  }

  async function generateExternalVideoProxy(rawBody: unknown, user: CurrentUserLike, publicOrigin: string) {
    const body = deps.plainObject(rawBody);
    const prompt = deps.safePromptText(body.prompt, "", 16000);
    if (!prompt) throw new Error("缺少 prompt");
    const params = deps.plainObject(body.providerParams);
    const { provider, model } = await findEnabledModel(
      "video",
      deps.safeSlug(body.providerId, ""),
      deps.safeText(body.providerModel || body.model),
      deps.safeText(params.modelRecordId),
    );
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "aicopy", "modelscope", "custom"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入视频生成 Adapter: ${protocol}`);
    }
    const apiKey = deps.providerPlainApiKey(provider);
    if (!apiKey) throw new Error("Provider 未配置 API Key");
    const schema = mergeModelParameterSchema("video", model.modelId, protocol as CatalogProtocol, model.parameterSchema);
    const inputCapabilities = parseInputCapabilities(model.inputCapabilities, "video");
    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    const ui = uiMetadataFromSchema(schema, "video", inputCapabilities);
    const requestedRatio = deps.safeText(body.aspect_ratio || body.ratio || params.aspectRatio);
  const requestedDurationRaw = body.duration ?? params.duration;
  const requestedDuration = normalizeVideoDurationValue(requestedDurationRaw);
    const requestedResolution = deps.safeText(body.resolution || params.resolution);
    const submittedImages = Array.isArray(body.images)
      ? body.images.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const submittedAudios = Array.isArray(body.audios)
      ? body.audios.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const submittedFirstFrame = deps.safeText(body.first_frame || params.first_frame);
    const submittedLastFrame = deps.safeText(body.last_frame || params.last_frame);
    const explicitMode = normalizeVideoInputMode(params.videoInputMode || body.videoInputMode);
    const videoInputMode = explicitMode
      || (submittedFirstFrame && submittedLastFrame ? "firstlast" : submittedFirstFrame ? "first" : submittedLastFrame ? "last" : "reference");
    const orderedSubmittedImages = explicitMode
      ? (submittedImages.length > 0
          ? submittedImages
          : videoInputMode === "firstlast"
            ? [submittedFirstFrame, submittedLastFrame].filter(Boolean)
            : videoInputMode === "first"
              ? [submittedFirstFrame].filter(Boolean)
              : videoInputMode === "last"
                ? [submittedLastFrame].filter(Boolean)
                : [])
      : videoInputMode === "firstlast"
        ? [submittedFirstFrame, submittedLastFrame].filter(Boolean)
        : videoInputMode === "first"
          ? [submittedFirstFrame].filter(Boolean)
          : videoInputMode === "last"
            ? [submittedLastFrame].filter(Boolean)
          : submittedImages;
    enforceVideoInputs({
      mode: videoInputMode,
      images: orderedSubmittedImages,
      audios: submittedAudios,
      capabilities: inputCapabilities,
      maxReferenceImages: ui.maxReferenceImages,
      maxReferenceAudios: ui.maxReferenceAudios,
    });
    const requestImageValues = await prepareProviderReferenceImages({ advancedConfig, dataDir: deps.dataDir, ownerId: user.id, values: orderedSubmittedImages });
    const images = normalizeProviderReferenceUrls(
      requestImageValues,
      publicOrigin,
      user,
    );
    const audios = normalizeProviderReferenceUrls(
      submittedAudios,
      publicOrigin,
      user,
    );
    const validatedInputs = enforceVideoInputs({
      mode: videoInputMode,
      images,
      audios,
      capabilities: inputCapabilities,
      maxReferenceImages: ui.maxReferenceImages,
      maxReferenceAudios: ui.maxReferenceAudios,
    });
    const resolvedFirstFrame = validatedInputs.firstFrame || "";
    const resolvedLastFrame = validatedInputs.lastFrame || "";
    const ratio = ui.aspectRatios.length > 0 ? (ui.aspectRatios.includes(requestedRatio) ? requestedRatio : ui.defaultAspectRatio) : "";
  const duration = ui.durationOptions.length > 0
    ? (ui.durationOptions.includes(requestedDuration as string | number) ? requestedDuration : ui.defaultDuration)
    : undefined;
    const resolution = ui.resolutionOptions.length > 0
      ? (ui.resolutionOptions.includes(requestedResolution) ? requestedResolution : ui.defaultResolution)
      : "";
    const modeType = validatedInputs.modeType;

    const useAicopyAsyncVideo = shouldUseAicopyVideoAdapter({
      protocol,
      advancedMode: deps.safeText(advancedConfig.mode),
      modelId: model.modelId,
      providerBaseUrl: provider.baseUrl,
    });
    const useApimartAsyncVideo = !useAicopyAsyncVideo && shouldUseApimartVideoAdapter({
      protocol,
      advancedMode: deps.safeText(advancedConfig.mode),
      modelId: model.modelId,
      providerBaseUrl: provider.baseUrl,
    });
    const submitPath = deps.safeText(advancedConfig.submitPath, "videos/generations");

    if (useAicopyAsyncVideo) {
      const payload = createAicopyVideoAdapterPayload({
        modelId: model.modelId,
        prompt,
        ratio,
        duration: typeof duration === "string" || typeof duration === "number" ? duration : undefined,
        resolution,
        modeType,
        images: validatedInputs.images,
        audios: validatedInputs.audios,
        requestMapping: deps.stringMap(advancedConfig.requestMapping),
        requestValueTypes: deps.stringMap(advancedConfig.requestValueTypes),
        requestValueTemplates: deps.stringMap(advancedConfig.requestValueTemplates),
        requestContractEnabled: resolveAicopyRequestContractEnabled(advancedConfig),
        requestContract: deps.plainObject(advancedConfig.requestContract),
        fixedBody: deps.plainObject(advancedConfig.fixedBody),
      });
      const submitResponse = await fetch(openAiEndpoint(provider.baseUrl, deps.safeText(advancedConfig.submitPath, "videos")), {
        method: "POST",
        headers: { ...deps.providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(180000),
      });
      const submitText = await submitResponse.text();
      if (deps.looksLikeHtml(submitText)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
      if (!submitResponse.ok) throw new Error(`上游视频生成失败 ${submitResponse.status}: ${submitText.slice(0, 500)}`);
      const submitRaw = parseUpstreamJson(submitText, "扩展视频提交接口", submitResponse.headers.get("content-type") || "");
      const task = extractAicopyTask(submitRaw, {
        taskIdPath: deps.safeText(advancedConfig.taskIdPath, "task_id"),
        statusPath: deps.safeText(advancedConfig.taskStatusPath, "status"),
      });
      if (!task.taskId) throw new Error("异步视频任务未返回 task_id/id");
      const result = await pollAicopyVideoTask({
        provider,
        apiKey,
        taskId: task.taskId,
        protocol,
        advancedConfig,
      });
      if (result.videoUrls.length === 0) throw new Error("异步视频任务未返回可用视频 URL");
      const videoUrls: string[] = [];
      for (const sourceUrl of result.videoUrls) {
        const saved = await deps.saveRemoteVideoToOutput(sourceUrl, user);
        videoUrls.push(saved.url);
      }
      return {
        videoUrls,
        remoteVideoUrls: result.videoUrls,
        taskId: task.taskId,
        raw: {
          providerId: provider.id,
          modelId: model.modelId,
          count: videoUrls.length,
          mode: "async_video_task",
          inferredBy: "explicit",
        },
        provider: { id: provider.id, name: provider.name, protocol },
      };
    }

    if (useApimartAsyncVideo) {
      const requestMapping = deps.stringMap(advancedConfig.requestMapping);
      const payload = createApimartVideoAdapterPayload({
        modelId: model.modelId,
        prompt,
        ratio,
        duration: typeof duration === "string" || typeof duration === "number" ? duration : undefined,
        resolution,
        images,
        firstFrame: resolvedFirstFrame || undefined,
        lastFrame: resolvedLastFrame || undefined,
        requestMapping,
        requestValueTypes: deps.stringMap(advancedConfig.requestValueTypes),
        requestValueTemplates: deps.stringMap(advancedConfig.requestValueTemplates),
        fixedBody: deps.plainObject(advancedConfig.fixedBody),
      });
      const requestBodyMode = deps.safeText(advancedConfig.requestBodyMode || advancedConfig.requestContentType);
      const submitBody = isMultipartRequestBodyMode(requestBodyMode)
        ? await buildProviderMultipartRequestBody(
            payload,
            resolveApimartVideoMultipartFieldNames({
              requestMapping,
              requestFileFields: Array.isArray(advancedConfig.requestFileFields)
                ? advancedConfig.requestFileFields.map((item) => deps.safeText(item)).filter(Boolean)
                : [],
            }),
          )
        : JSON.stringify(payload);
      const submitResponse = await fetch(openAiEndpoint(provider.baseUrl, submitPath), {
        method: "POST",
        headers: isMultipartRequestBodyMode(requestBodyMode)
          ? deps.providerModelHeaders(apiKey, protocol)
          : { ...deps.providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
        body: submitBody,
        signal: AbortSignal.timeout(180000),
      });
      const submitText = await submitResponse.text();
      if (deps.looksLikeHtml(submitText)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
      if (!submitResponse.ok) throw new Error(`上游视频生成失败 ${submitResponse.status}: ${submitText.slice(0, 500)}`);
      const submitRaw = parseUpstreamJson(submitText, "扩展视频提交接口", submitResponse.headers.get("content-type") || "");
      const task = extractApimartTask(submitRaw, {
        taskIdPath: deps.safeText(advancedConfig.taskIdPath, "data.0.task_id"),
        statusPath: deps.safeText(advancedConfig.taskStatusPath, "data.0.status"),
      });
      if (!task.taskId) throw new Error("异步视频任务未返回 task_id/id");
      const result = await pollApimartVideoTask({ provider, apiKey, taskId: task.taskId, protocol, advancedConfig });
      if (result.videoUrls.length === 0) throw new Error("异步视频任务未返回可用视频 URL");
      const videoUrls: string[] = [];
      for (const sourceUrl of result.videoUrls) {
        const saved = await deps.saveRemoteVideoToOutput(sourceUrl, user);
        videoUrls.push(saved.url);
      }
      return {
        videoUrls,
        remoteVideoUrls: result.videoUrls,
        taskId: task.taskId,
        raw: {
          providerId: provider.id,
          modelId: model.modelId,
          count: videoUrls.length,
          mode: "async_video_task",
          inferredBy:
            protocol === "apimart" ||
            ["async_video_task", "apimart_async_video"].includes(deps.safeText(advancedConfig.mode))
              ? "explicit"
              : "fallback",
        },
        provider: { id: provider.id, name: provider.name, protocol },
      };
    }

    const payload: Record<string, unknown> = { model: model.modelId, prompt };
    if (ratio) payload.aspect_ratio = ratio;
    if (duration !== undefined) payload.duration = duration;
    if (resolution) payload.resolution = resolution;
    if (images.length > 0) payload.image = images;
    if (resolvedFirstFrame) payload.first_frame = resolvedFirstFrame;
    if (resolvedLastFrame) payload.last_frame = resolvedLastFrame;

    const upstream = await fetch(openAiEndpoint(provider.baseUrl, submitPath), {
      method: "POST",
      headers: { ...deps.providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000),
    });
    const text = await upstream.text();
    if (deps.looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`上游视频生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
    const raw = parseUpstreamJson(text, "扩展视频生成接口", upstream.headers.get("content-type") || "");
    const remoteVideoUrls = extractVideoUrls(raw);
    if (remoteVideoUrls.length === 0) throw new Error("上游未返回可用视频 URL");
    const videoUrls: string[] = [];
    for (const sourceUrl of remoteVideoUrls) {
      const saved = await deps.saveRemoteVideoToOutput(sourceUrl, user);
      videoUrls.push(saved.url);
    }
    return {
      videoUrls,
      remoteVideoUrls,
      raw: { providerId: provider.id, modelId: model.modelId, count: videoUrls.length },
      provider: { id: provider.id, name: provider.name, protocol },
    };
  }

  async function generateExternalAudioProxy(rawBody: unknown, user: CurrentUserLike) {
    const body = deps.plainObject(rawBody);
    const text = deps.safeLongText(body.text || body.prompt, "", 16000);
    if (!text) throw new Error("缺少要合成的文本");
    const params = deps.plainObject(body.providerParams);
    const { provider, model } = await findEnabledModel(
      "audio",
      deps.safeSlug(body.providerId, ""),
      deps.safeText(body.providerModel || body.model),
      deps.safeText(params.modelRecordId),
    );
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入音频模型 Adapter: ${protocol}`);
    }
    const apiKey = deps.providerPlainApiKey(provider);
    if (!apiKey) throw new Error("Provider 未配置 API Key");
    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    const mode = deps.safeText(body.mode || params.mode || advancedConfig.mode, "tts");
    const capabilityTags = Array.isArray(model.capabilityTags)
      ? model.capabilityTags.filter((item): item is string => typeof item === "string")
      : [];
    if (mode === "voice_clone" && !capabilityTags.includes("voice_clone")) {
      throw new Error("当前模型未标记为音色克隆模型，请在后台开启 voice_clone 标签后再试");
    }
    const sampleDataUrl = mode === "voice_clone"
      ? readAudioSampleDataUrl(body.sampleDataUrl, params.sampleDataUrl, body.voiceSampleDataUrl)
      : "";
    const payload = createOpenAiAudioChatPayload({
      modelId: model.modelId,
      text,
      stylePrompt: deps.safeLongText(body.stylePrompt || params.stylePrompt, "", 8000),
      voice: deps.safeText(body.voice || params.voice || "mimo_default"),
      audioFormat: deps.safeText(body.audioFormat || params.audioFormat || advancedConfig.audioFormat || "wav"),
      mode,
      sampleDataUrl,
    });
    const submitPath = deps.safeText(advancedConfig.submitPath, "chat/completions");
    const upstream = await fetch(openAiEndpoint(provider.baseUrl, submitPath), {
      method: "POST",
      headers: { ...deps.providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
    const responseText = await upstream.text();
    if (deps.looksLikeHtml(responseText)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`上游音频模型请求失败 ${upstream.status}: ${responseText.slice(0, 500)}`);
    const raw = parseUpstreamJson(responseText, "扩展音频接口", upstream.headers.get("content-type") || "");
    const result = extractAudioProviderResult(raw);
    const audioUrls: string[] = [];
    for (const dataUrl of result.audioDataUrls) {
      audioUrls.push((await deps.saveBase64AudioFile({ dataUrl, prefix: "external_audio" }, user)).url);
    }
    for (const sourceUrl of result.audioUrls) {
      audioUrls.push((await deps.saveRemoteAudioToOutput(sourceUrl, user)).url);
    }
    if (audioUrls.length === 0) throw new Error("音频模型未返回可用音频");
    return {
      audioUrls,
      text: result.text,
      raw: { providerId: provider.id, modelId: model.modelId, count: audioUrls.length },
      provider: { id: provider.id, name: provider.name, protocol },
    };
  }

  return {
    generateExternalImageProxy,
    generateExternalChatProxy,
    generateExternalVideoProxy,
    generateExternalAudioProxy,
  };
}

function normalizeVideoDurationValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
    return value.trim();
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
