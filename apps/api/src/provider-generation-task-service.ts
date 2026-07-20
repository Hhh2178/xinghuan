import { type TaskStatus } from "@xinghuan/shared";
import {
  mergeModelParameterSchema,
  parseAdvancedConfig,
  parseInputCapabilities,
  resolveAicopyRequestContractEnabled,
  uiMetadataFromSchema,
  type ProviderProtocol as CatalogProtocol,
} from "@xinghuan/model-core";
import { createOpenAiAudioChatPayload } from "./audio-provider-adapter.js";
import { projectTaskRuntimeDisplayState } from "./task-runtime-projection.js";
import {
  normalizeVideoInputMode,
  resolveVideoPromptByteLimit,
  validateVideoPromptBytes,
  validateVideoInputs,
  VideoInputValidationError,
} from "./video-input-validation.js";

type GenerationCapability = "image" | "video" | "audio";

interface CurrentUserLike {
  id: string;
  role: "admin" | "member";
  groupId?: string;
}

interface ProviderLike {
  id: string;
  name: string;
  baseUrl: string;
  protocol?: unknown;
  enabled: boolean;
  apiKey?: string;
}

interface ModelLike {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: GenerationCapability | "chat";
  enabled: boolean;
  inputCapabilities?: Record<string, unknown>;
  capabilityTags?: unknown[];
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
}

interface AdminTaskRecordLike {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt: number;
  updatedAt: number;
}

interface ProviderGenerationTaskServiceDependencies {
  supportedTaskCapabilities?: readonly GenerationCapability[];
  normalizeProviderProtocol: (value: unknown) => string;
  providerPlainApiKey: (provider: ProviderLike) => string;
  findEnabledProviderModel: (
    capability: GenerationCapability,
    providerId: string,
    requestedModelId: string,
    modelRecordId: string,
  ) => Promise<{ provider: ProviderLike; model: ModelLike }>;
  authorizeModelExecution?: (
    user: CurrentUserLike,
    model: ModelLike,
  ) => Promise<void>;
  normalizeProviderReferenceUrls: (values: string[], publicOrigin: string, user: CurrentUserLike) => string[];
  normalizeProviderReferenceUrl: (value: string, publicOrigin: string, user: CurrentUserLike) => string;
  readTaskRecord: (taskId: string) => Promise<AdminTaskRecordLike | null>;
  insertTaskRecord: (task: AdminTaskRecordLike) => Promise<void>;
  writeTaskRecord: (task: AdminTaskRecordLike) => Promise<void>;
  appendTaskLog: (taskId: string, line: string) => Promise<void>;
  enqueueTask: (
    taskId: string,
    capability: GenerationCapability,
  ) => Promise<{ queued: boolean; reason: string; queueName: string }>;
  safeText: (value: unknown, fallback?: string) => string;
  safeLongText: (value: unknown, fallback?: string, maxLength?: number) => string;
  safePromptText: (value: unknown, fallback?: string, maxLength?: number) => string;
  safeSlug: (value: unknown, fallback?: string) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
  invalidRequest?: (message: string) => Error;
  now?: () => number;
  taskIdFactory?: () => string;
}

interface SubmitProviderGenerationTaskInput {
  capability: GenerationCapability;
  rawBody: unknown;
  user: CurrentUserLike;
  publicOrigin: string;
  requestContext?: {
    requestId?: string;
    userId?: string;
  };
}

interface ReadProviderGenerationTaskStatusInput {
  capability: GenerationCapability;
  taskId: string;
  user: CurrentUserLike;
}

export function createProviderGenerationTaskService(deps: ProviderGenerationTaskServiceDependencies) {
  const supportedTaskCapabilities = new Set<GenerationCapability>(deps.supportedTaskCapabilities ?? ["image", "video", "audio"]);

  async function submitProviderGenerationTask(input: SubmitProviderGenerationTaskInput) {
    if (input.capability === "image") {
      return submitImageTask(input.rawBody, input.user, input.publicOrigin, input.requestContext);
    }
    if (input.capability === "video") {
      return submitVideoTask(input.rawBody, input.user, input.publicOrigin, input.requestContext);
    }
    if (input.capability === "audio") {
      return submitAudioTask(input.rawBody, input.user, input.requestContext);
    }
    throw new Error(`当前任务 service 暂不支持能力: ${input.capability}`);
  }

  async function readProviderGenerationTaskStatus(input: ReadProviderGenerationTaskStatusInput) {
    const task = await deps.readTaskRecord(input.taskId);
    if (!task) throw new Error("任务不存在");
    if (task.ownerId && task.ownerId !== input.user.id && input.user.role !== "admin") {
      throw new Error("无权查看该任务");
    }

    const taskPayload = deps.plainObject(task.payload);
    const storedCapability = normalizeGenerationCapability(taskPayload.taskCapability);
    const effectiveCapability = storedCapability || input.capability;
    const result = deps.plainObject(task.result);
    const imageUrls = readStringArray(result.materializedImageUrls).length > 0
      ? readStringArray(result.materializedImageUrls)
      : readStringArray(result.imageUrls);
    const remoteImageUrls = readStringArray(result.remoteImageUrls);
    const videoUrls = readStringArray(result.materializedVideoUrls).length > 0
      ? readStringArray(result.materializedVideoUrls)
      : readStringArray(result.videoUrls);
    const remoteVideoUrls = readStringArray(result.remoteVideoUrls);
    const audioUrls = readStringArray(result.materializedAudioUrls).length > 0
      ? readStringArray(result.materializedAudioUrls)
      : readStringArray(result.audioUrls);
    const remoteAudioUrls = readStringArray(result.remoteAudioUrls);
    const error = deps.safeText(result.error || result.failureReason || result.failReason)
      || (task.status === "failed" ? lastTaskFailureLog(task.logs) : "");
    const cancellationMessage = deps.safeText(result.cancellationMessage);
    const waitReason = deps.safeText(result.waitReason);
    const waitDetail = deps.safeText(result.waitDetail);
    const queueHint = deps.safeText(result.queueHint);
    const runtimeStage = deps.safeText(result.runtimeStage);
    const providerState = deps.safeText(result.providerState || result.upstreamStatus || result.status);
    const displayState = projectTaskRuntimeDisplayState({
      status: task.status,
      waitReason,
      waitDetail,
      queueHint,
      runtimeStage,
      providerState,
      failureReason: deps.safeText(result.failureReason),
      error,
      cancellationMessage,
      logs: task.logs,
    });
    const runtimeDiagnostic = {
      failureCategory: deps.safeText(result.failureCategory),
      providerDiagnostic: deps.safeText(result.providerDiagnostic),
      upstreamHttpStatus: toOptionalNumber(result.upstreamHttpStatus),
      upstreamResponseSnippet: deps.safeText(result.upstreamResponseSnippet),
      submitDiagnostic: deps.safeText(result.submitDiagnostic),
      pollDiagnostic: deps.safeText(result.pollDiagnostic),
      cancelState: deps.safeText(result.cancelState),
    };
    const response = {
      taskId: task.id,
      status: task.status,
      progress: progressText(task.status),
      error,
      failureReason: deps.safeText(result.failureReason),
      waitReason,
      waitDetail,
      queueHint,
      runtimeStage: displayState.runtimeStage,
      providerState: displayState.providerState,
      displayStatus: displayState.displayStatus,
      displayMessage: displayState.displayMessage,
      displayTone: displayState.displayTone,
      ...runtimeDiagnostic,
      message: task.status === "cancelled" ? cancellationMessage : "",
      logs: task.logs.slice(-8),
      cancelScope: deps.safeText(result.cancelScope),
      upstreamSupported: Boolean(result.upstreamSupported),
      upstreamAttempted: Boolean(result.upstreamAttempted),
      raw: {
        providerId: task.providerId,
        modelRecordId: task.modelId,
        workerId: deps.safeText(result.workerId),
        adapter: deps.safeText(result.adapter),
        capability: effectiveCapability,
        heartbeatAt: deps.safeText(result.heartbeatAt),
        upstreamTaskId: deps.safeText(result.upstreamTaskId || result.taskId),
        upstreamCancelledAt: deps.safeText(result.upstreamCancelledAt),
      },
      imageUrls,
      remoteImageUrls,
      videoUrls,
      remoteVideoUrls,
      audioUrls,
      remoteAudioUrls,
    };

    if (effectiveCapability === "image") {
      return {
        ...response,
        imageUrls,
        remoteImageUrls,
        raw: {
          ...response.raw,
          imageCount: Number(result.imageCount || imageUrls.length) || imageUrls.length,
        },
      };
    }

    if (effectiveCapability === "video") {
      return {
        ...response,
        videoUrls,
        remoteVideoUrls,
        raw: {
          ...response.raw,
          videoCount: Number(result.videoCount || videoUrls.length) || videoUrls.length,
        },
      };
    }

    return {
      ...response,
      audioUrls,
      remoteAudioUrls,
      raw: {
        ...response.raw,
        audioCount: Number(result.audioCount || audioUrls.length) || audioUrls.length,
      },
    };
  }

  async function submitImageTask(rawBody: unknown, user: CurrentUserLike, publicOrigin: string, requestContext?: SubmitProviderGenerationTaskInput["requestContext"]) {
    if (!supportedTaskCapabilities.has("image")) {
      throw new Error("当前版本未启用图像后台任务执行链路");
    }
    const body = deps.plainObject(rawBody);
    const prompt = deps.safePromptText(body.prompt, "", 8000);
    if (!prompt) throw new Error("缺少 prompt");

    const params = deps.plainObject(body.providerParams);
    const { provider, model } = await deps.findEnabledProviderModel(
      "image",
      deps.safeSlug(body.providerId, ""),
      deps.safeText(body.providerModel || body.model),
      deps.safeText(params.modelRecordId),
    );
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "modelscope", "custom", "grsai_draw"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入图像任务 Adapter: ${protocol}`);
    }
    if (!deps.providerPlainApiKey(provider)) throw new Error("Provider 未配置 API Key");

    const parameterSchema = mergeModelParameterSchema("image", model.modelId, protocol as CatalogProtocol, model.parameterSchema);
    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    const ui = uiMetadataFromSchema(parameterSchema, "image");
    const requestedSize = deps.safeText(body.size || params.size || params.image_size);
    const size = ui.sizes.includes(requestedSize) ? requestedSize : ui.sizes[0] || "1024x1024";
    const count = clampInteger(body.n, 1, 4, 1);
    const images = deps.normalizeProviderReferenceUrls(
      Array.isArray(body.images)
        ? body.images.map((item) => deps.safeText(item)).filter(Boolean).slice(0, ui.maxReferenceImages || 4)
        : [],
      publicOrigin,
      user,
    );
    const aspectRatio = deps.safeText(params.aspectRatio || body.aspect_ratio);
    const payload: Record<string, unknown> = {
      ...advancedConfig,
      ...params,
      prompt,
      n: count,
      size,
      images,
      taskCapability: "image",
      executionMode: "worker_queue",
      sourceNodeId: deps.safeText(params.sourceNodeId || body.sourceNodeId),
      sourceCanvasId: deps.safeText(params.sourceCanvasId || body.sourceCanvasId),
    };
    if (aspectRatio) {
      payload.aspectRatio = aspectRatio;
      payload.aspect_ratio = aspectRatio;
    }
    return createQueuedTask({
      capability: "image",
      provider,
      model,
      protocol,
      ownerId: user.id,
      payload,
      requestContext,
    });
  }

  async function submitVideoTask(rawBody: unknown, user: CurrentUserLike, publicOrigin: string, requestContext?: SubmitProviderGenerationTaskInput["requestContext"]) {
    if (!supportedTaskCapabilities.has("video")) {
      throw new Error("当前版本未启用视频后台任务执行链路");
    }
    const body = deps.plainObject(rawBody);
    const prompt = deps.safePromptText(body.prompt, "", 16000);
    if (!prompt) throw new Error("缺少 prompt");

    const params = deps.plainObject(body.providerParams);
    const { provider, model } = await deps.findEnabledProviderModel(
      "video",
      deps.safeSlug(body.providerId, ""),
      deps.safeText(body.providerModel || body.model),
      deps.safeText(params.modelRecordId),
    );
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "aicopy", "modelscope", "custom"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入视频任务 Adapter: ${protocol}`);
    }
    if (!deps.providerPlainApiKey(provider)) throw new Error("Provider 未配置 API Key");

    const schema = mergeModelParameterSchema("video", model.modelId, protocol as CatalogProtocol, model.parameterSchema);
    const inputCapabilities = parseInputCapabilities(model.inputCapabilities, "video");
    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    validateVideoPromptBytes(prompt, resolveVideoPromptByteLimit(protocol, advancedConfig.maxPromptBytes));
    const ui = uiMetadataFromSchema(schema, "video", inputCapabilities);
    const requestedRatio = deps.safeText(body.aspect_ratio || body.ratio || params.aspectRatio);
    const requestedDuration = normalizeVideoDurationValue(body.duration ?? params.duration);
    const requestedResolution = deps.safeText(body.resolution || params.resolution);
    const submittedImages = Array.isArray(body.images)
      ? body.images.map((item) => deps.safeText(item)).filter(Boolean)
      : [];
    const submittedVideos = Array.isArray(body.videos)
      ? body.videos.map((item) => deps.safeText(item)).filter(Boolean)
      : [];
    const submittedAudios = Array.isArray(body.audios)
      ? body.audios.map((item) => deps.safeText(item)).filter(Boolean)
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
      videos: submittedVideos,
      audios: submittedAudios,
      capabilities: inputCapabilities,
      maxReferenceImages: ui.maxReferenceImages,
      maxReferenceVideos: ui.maxReferenceVideos,
      maxReferenceAudios: ui.maxReferenceAudios,
    });
    const images = deps.normalizeProviderReferenceUrls(
      orderedSubmittedImages,
      publicOrigin,
      user,
    );
    const videos = deps.normalizeProviderReferenceUrls(submittedVideos, publicOrigin, user);
    const audios = deps.normalizeProviderReferenceUrls(submittedAudios, publicOrigin, user);
    const validatedInputs = enforceVideoInputs({
      mode: videoInputMode,
      images,
      videos,
      audios,
      capabilities: inputCapabilities,
      maxReferenceImages: ui.maxReferenceImages,
      maxReferenceVideos: ui.maxReferenceVideos,
      maxReferenceAudios: ui.maxReferenceAudios,
    });
    const ratio = ui.aspectRatios.length > 0 ? (ui.aspectRatios.includes(requestedRatio) ? requestedRatio : ui.defaultAspectRatio) : "";
    const duration = ui.durationOptions.length > 0
      ? (ui.durationOptions.includes(requestedDuration as string | number) ? requestedDuration : ui.defaultDuration)
      : undefined;
    const resolution = ui.resolutionOptions.length > 0
      ? (ui.resolutionOptions.includes(requestedResolution) ? requestedResolution : ui.defaultResolution)
      : "";
    const payload: Record<string, unknown> = {
      ...advancedConfig,
      ...params,
      prompt,
      aspect_ratio: ratio,
      ratio,
      duration,
      resolution,
      images: validatedInputs.images,
      videos: validatedInputs.videos,
      first_frame: validatedInputs.firstFrame || "",
      last_frame: validatedInputs.lastFrame || "",
      audios: validatedInputs.audios,
      videoInputMode: validatedInputs.mode,
      modeType: validatedInputs.modeType,
      requestContractEnabled: resolveAicopyRequestContractEnabled(advancedConfig),
      aicopyRequestContractEnabled: advancedConfig.aicopyRequestContractEnabled === true,
      requestContract: deps.plainObject(advancedConfig.requestContract),
      referenceImageTransport: advancedConfig.referenceImageTransport === "data_url" ? "data_url" : "url",
      fixedBody: deps.plainObject(advancedConfig.fixedBody),
      advancedMode: deps.safeText(advancedConfig.mode || params.mode),
      taskCapability: "video",
      executionMode: "worker_queue",
      sourceNodeId: deps.safeText(params.sourceNodeId || body.sourceNodeId),
      sourceCanvasId: deps.safeText(params.sourceCanvasId || body.sourceCanvasId),
    };
    return createQueuedTask({
      capability: "video",
      provider,
      model,
      protocol,
      ownerId: user.id,
      payload,
      requestContext,
    });
  }

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

  async function submitAudioTask(rawBody: unknown, user: CurrentUserLike, requestContext?: SubmitProviderGenerationTaskInput["requestContext"]) {
    if (!supportedTaskCapabilities.has("audio")) {
      throw new Error("当前版本未启用音频后台任务执行链路");
    }
    const body = deps.plainObject(rawBody);
    const text = deps.safeLongText(body.text || body.prompt, "", 16000);
    if (!text) throw new Error("缺少要合成的文本");

    const params = deps.plainObject(body.providerParams);
    const { provider, model } = await deps.findEnabledProviderModel(
      "audio",
      deps.safeSlug(body.providerId, ""),
      deps.safeText(body.providerModel || body.model),
      deps.safeText(params.modelRecordId),
    );
    await deps.authorizeModelExecution?.(user, model);
    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
      throw new Error(`当前 Provider 协议暂未接入音频任务 Adapter: ${protocol}`);
    }
    if (!deps.providerPlainApiKey(provider)) throw new Error("Provider 未配置 API Key");

    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    const mode = deps.safeText(body.mode || params.mode || advancedConfig.mode, "tts");
    const capabilityTags = Array.isArray(model.capabilityTags)
      ? model.capabilityTags.filter((item): item is string => typeof item === "string")
      : [];
    if (mode === "voice_clone" && !capabilityTags.includes("voice_clone")) {
      throw new Error("当前模型未标记为音色克隆模型，请在后台开启 voice_clone 标签后再试");
    }

    const payload: Record<string, unknown> = {
      ...advancedConfig,
      ...params,
      prompt: text,
      text,
      mode,
      stylePrompt: deps.safeLongText(body.stylePrompt || params.stylePrompt, "", 8000),
      voice: deps.safeText(body.voice || params.voice || "mimo_default"),
      audioFormat: deps.safeText(body.audioFormat || params.audioFormat || advancedConfig.audioFormat || "wav"),
      sampleDataUrl: mode === "voice_clone"
        ? readAudioSampleDataUrl(body.sampleDataUrl, params.sampleDataUrl, body.voiceSampleDataUrl)
        : "",
      taskCapability: "audio",
      executionMode: "worker_queue",
      sourceNodeId: deps.safeText(params.sourceNodeId || body.sourceNodeId),
      sourceCanvasId: deps.safeText(params.sourceCanvasId || body.sourceCanvasId),
    };
    createOpenAiAudioChatPayload({
      modelId: model.modelId,
      text,
      stylePrompt: deps.safeText(payload.stylePrompt),
      voice: deps.safeText(payload.voice),
      audioFormat: deps.safeText(payload.audioFormat),
      mode,
      sampleDataUrl: deps.safeLongText(payload.sampleDataUrl, "", 20_000_000),
    });
    return createQueuedTask({
      capability: "audio",
      provider,
      model,
      protocol,
      ownerId: user.id,
      payload,
      requestContext,
    });
  }

  async function createQueuedTask(input: {
    capability: GenerationCapability;
    provider: ProviderLike;
    model: ModelLike;
    protocol: string;
    ownerId: string;
    payload: Record<string, unknown>;
    requestContext?: SubmitProviderGenerationTaskInput["requestContext"];
  }) {
    const taskId = deps.taskIdFactory ? deps.taskIdFactory() : `task-${timestamp()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = timestamp();
    const requestId = deps.safeText(input.requestContext?.requestId);
    const userId = deps.safeText(input.requestContext?.userId || input.ownerId);
    const task: AdminTaskRecordLike = {
      id: taskId,
      title: `${taskCapabilityLabel(input.capability)} · ${input.provider.name} · ${input.model.displayName || input.model.modelId}`,
      status: "queued",
      ownerId: input.ownerId,
      providerId: input.provider.id,
      modelId: input.model.id,
      payload: {
        ...input.payload,
        requestId,
        userId,
      },
      result: {
        requestId,
        userId,
      },
      logs: [`画布提交后台${taskCapabilityLabel(input.capability)}任务`],
      createdAt: now,
      updatedAt: now,
    };
    await deps.insertTaskRecord(task);
    const queueResult = await deps.enqueueTask(task.id, input.capability);
    const queueLog = queueResult.queued
      ? `已进入 Redis 队列 ${queueResult.queueName}`
      : `未进入 Redis 队列: ${queueResult.reason}`;
    await deps.appendTaskLog(task.id, queueLog);
    if (!queueResult.queued) {
      await deps.writeTaskRecord({
        ...task,
        status: "failed",
        result: {
          ...task.result,
          error: queueLog,
        },
        logs: [...task.logs, queueLog],
        updatedAt: timestamp(),
      });
      throw new Error(`${taskCapabilityLabel(input.capability)}任务队列不可用：${queueResult.reason}`);
    }
    return {
      taskId: task.id,
      status: "queued",
      progress: "0%",
      provider: { id: input.provider.id, name: input.provider.name, protocol: input.protocol },
      raw: {
        providerId: input.provider.id,
        modelId: input.model.modelId,
        modelRecordId: input.model.id,
        capability: input.capability,
        queued: true,
      },
    };
  }

  function timestamp() {
    return deps.now ? deps.now() : Date.now();
  }

  return {
    submitProviderGenerationTask,
    readProviderGenerationTaskStatus,
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

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function taskCapabilityLabel(capability: GenerationCapability) {
  if (capability === "image") return "图像生成";
  if (capability === "video") return "视频生成";
  return "音频生成";
}

function progressText(status: TaskStatus) {
  if (status === "succeeded") return "100%";
  if (status === "running") return "45%";
  if (status === "queued") return "5%";
  return "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function lastTaskFailureLog(logs: string[]) {
  return [...logs].reverse().find((line) => /失败|error|failed/i.test(line)) || "";
}

function normalizeGenerationCapability(value: unknown): GenerationCapability | "" {
  const capability = String(value || "").trim().toLowerCase();
  return ["image", "video", "audio"].includes(capability) ? (capability as GenerationCapability) : "";
}

function toOptionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function readAudioSampleDataUrl(...values: unknown[]) {
  for (const value of values) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text) return text.slice(0, 20_000_000);
  }
  return "";
}
