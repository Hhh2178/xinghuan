import type {
  Capability,
  AssistantAnalysisResult,
  AssistantChatAttachment,
  FetchModelsResult,
  ModelRecord,
  ProviderProtocol,
  ProviderRecord,
} from "./admin-types";

export type ProviderDraft = ReturnType<typeof providerDraft>;

export function providerDraft(provider?: ProviderRecord) {
  return {
    id: provider?.id || "",
    name: provider?.name || "",
    baseUrl: provider?.baseUrl || "",
    protocol: (provider?.protocol || "openai") as ProviderProtocol,
    rhApps: provider?.rhApps || [],
    rhWorkflows: provider?.rhWorkflows || [],
    msLoras: provider?.msLoras || [],
    note: provider?.note || "",
  };
}

export function isRunningHubProvider(p: ProviderDraft) {
  return p.id === "runninghub" || p.protocol === "runninghub";
}

export function isModelScopeProvider(p: ProviderDraft) {
  return (
    p.id === "modelscope" ||
    /modelscope/i.test(p.name) ||
    /modelscope/i.test(p.baseUrl)
  );
}

export function inferProviderProtocol(p: ProviderDraft) {
  if (/grsai|grsai\.dakka\.com\.cn/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "grsai_draw" as ProviderProtocol;
  if (/runninghub/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "runninghub" as ProviderProtocol;
  if (/modelscope|api-inference\.modelscope\.cn/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "modelscope" as ProviderProtocol;
  if (/gemini/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "gemini" as ProviderProtocol;
  if (/apimart/i.test(`${p.id}\n${p.name}\n${p.baseUrl}`)) return "apimart" as ProviderProtocol;
  return p.protocol;
}

export function buildProviderAssistantAttachments(
  draft: ProviderDraft,
  selectedModels: ModelRecord[],
  fetched: FetchModelsResult | null,
): AssistantChatAttachment[] {
  const attachments: AssistantChatAttachment[] = [
    {
      id: `provider-draft-${draft.id || "new"}`,
      kind: "provider",
      title: draft.name || "当前 Provider 草稿",
      summary: draft.baseUrl || "未填写 Base URL",
      payload: {
        id: draft.id,
        baseUrl: draft.baseUrl,
        protocol: draft.protocol,
        note: draft.note,
        enabled: true,
      },
    },
  ];
  selectedModels.slice(0, 4).forEach((model) => {
    attachments.push({
      id: `provider-model-${model.id}`,
      kind: "model",
      title: model.displayName || model.modelId,
      summary: `${model.capability} / ${model.modelId}`,
      payload: {
        id: model.id,
        modelId: model.modelId,
        capability: model.capability,
        protocol: model.protocolOverride,
        inputProfile: model.inputProfile,
        enabled: model.enabled,
      },
    });
  });
  if (fetched) {
    attachments.push({
      id: `provider-fetch-${draft.id || "new"}`,
      kind: "audit",
      title: "最近模型拉取结果",
      summary: fetched.message || `${fetched.total || fetched.modelCount || 0} 个模型`,
      payload: {
        status: fetched.ok ? "success" : "warning",
        total: fetched.total || fetched.modelCount || 0,
        chatModels: fetched.chatModels?.slice(0, 6),
        imageModels: fetched.imageModels?.slice(0, 6),
        videoModels: fetched.videoModels?.slice(0, 6),
      },
    });
  }
  return attachments;
}

export function assistantValue(value: unknown, fallback = "未建议") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function assistantAdvancedValue(result: AssistantAnalysisResult | null, key: string) {
  return assistantValue(result?.drafts?.model?.advancedConfig?.[key], "未建议");
}

export function assistantAdvancedJsonValue(result: AssistantAnalysisResult | null, key: string) {
  const value = result?.drafts?.model?.advancedConfig?.[key];
  if (!value || typeof value !== "object") return "未建议";
  return JSON.stringify(value, null, 2);
}

function isAbsoluteEndpoint(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function assistantPlanRow(label: string, value: string) {
  return { label, value: value.trim() || "未建议" };
}

export function buildAssistantIntegrationPlan(result: AssistantAnalysisResult | null) {
  if (!result) return [];
  const submitPath = assistantAdvancedValue(result, "submitPath");
  const pollPath = assistantAdvancedValue(result, "pollPathTemplate");
  const finalPath = assistantAdvancedValue(result, "finalResultPathTemplate");
  const requestMapping = result.drafts.model.advancedConfig?.requestMapping;
  const requestFileFields = Array.isArray(result.drafts.model.advancedConfig?.requestFileFields)
    ? result.drafts.model.advancedConfig?.requestFileFields?.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const requestValueTemplates = result.drafts.model.advancedConfig?.requestValueTemplates;
  const inputCaps = result.drafts.model.inputCapabilities || {};
  const requestContentType =
    String(result.drafts.model.advancedConfig?.requestContentType || "").trim() || "application/json";
  const imageRequirement =
    inputCaps.imageReference || /image_reference|images/i.test(result.drafts.model.inputProfile || "")
      ? "需要图片输入"
      : "可纯文本提交";
  const referenceMode =
    typeof requestMapping === "object" && requestMapping && "images" in requestMapping
      ? `字段 ${(requestMapping as Record<string, unknown>).images || "images"}`
      : "未明确字段";
  return [
    assistantPlanRow("端点模式", isAbsoluteEndpoint(submitPath) || isAbsoluteEndpoint(pollPath) || isAbsoluteEndpoint(finalPath) ? "完整 URL" : "基于 Base URL 的相对路径"),
    assistantPlanRow("请求格式", requestContentType),
    assistantPlanRow("素材输入", `${imageRequirement} / ${referenceMode}${requestFileFields.length ? ` / 文件字段 ${requestFileFields.join(", ")}` : ""}`),
    assistantPlanRow(
      "派生字段",
      requestValueTemplates && typeof requestValueTemplates === "object"
        ? JSON.stringify(requestValueTemplates)
        : "无",
    ),
    assistantPlanRow("结果解析", assistantAdvancedValue(result, "resultVideoPath")),
  ];
}

export function formatAssistantRawOutput(value: unknown) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return "";
    if (text === "[object Object]") return JSON.stringify({ raw: value }, null, 2);
    return text;
  }
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function defaultInputProfileForCapability(capability: Capability) {
  if (capability === "audio") return "prompt,audio_reference";
  if (capability === "image" || capability === "video") return "prompt,image_reference";
  return "prompt";
}

export function defaultInputCapabilitiesForCapability(capability: Capability, capabilityTags: string[] = []) {
  if (capability === "audio") return { prompt: true, audioReference: capabilityTags.includes("voice_clone") };
  if (capability === "video") return { prompt: true, imageReference: true, multiImage: false, firstFrame: false, lastFrame: false };
  if (capability === "image") return { prompt: true, imageReference: true, multiImage: false, firstFrame: false, lastFrame: false };
  return {
    prompt: true,
    imageReference: capabilityTags.includes("image_understanding"),
    videoReference: capabilityTags.includes("video_understanding"),
    audioReference: capabilityTags.includes("audio_understanding"),
    multiImage: false,
    firstFrame: false,
    lastFrame: false,
  };
}

export function safeAssistantSchemaText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "{}";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return "{}";
  }
}

export function parseAssistantDocUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item, index, list) => /^https?:\/\//i.test(item) && list.indexOf(item) === index);
}
