import { useEffect, useState } from "react";
import { Plus, Save, Settings2, Trash2 } from "lucide-react";
import {
  durationOptionsFromRange,
  mergeAicopySdRequestContractDefaults,
  resolveAicopyRequestContractEnabled,
} from "@xinghuan/model-core";
import { type ProviderGenerationExecutionMode } from "@xinghuan/shared";
import { capabilityLabel, modelCapabilityTagLabel } from "./admin-view-model";
import {
  readVideoDurationSchema,
  syncVideoDurationSchema,
  normalizeVideoDurationTierList,
} from "./admin-model-editor-video-duration";
import {
  legacyMultiImageFromReferenceLimit,
  readVideoReferenceImageMax,
  syncVideoReferenceImageSchema,
} from "./admin-model-editor-video-reference";
import type { Capability, ModelCapabilityTag, ModelRecord, ProviderProtocol } from "./admin-types";

/* ── helpers ──────────────────────────────────────────────────────────── */

function capabilityHelp(c: Capability) {
  if (c === "image") return "在线生图和无限画布 API 生成使用。";
  if (c === "video") return "无限画布视频生成节点使用。";
  if (c === "audio") return "语音生成、音色克隆和音频生成节点使用。";
  return "GPT 对话和 LLM 节点使用。";
}

function modelCapabilityTips(c: Capability) {
  if (c === "image")
    return [
      "推荐把 aspectRatio 作为主控项，节点会按比例自动匹配适合的尺寸档位。",
      "只有当 size 代表质量档位或独立分辨率套餐时，再把 size 暴露给前端选择。",
      "如模型支持垫图或角色参考，可在 schema 中增加 referenceImages、imageCount、seed 等字段。",
    ];
  if (c === "video")
    return [
      "视频节点常见参数是 aspectRatio、duration、resolution、fps，尽量与上游真实能力保持一致。",
      "如果不同 provider 的时长或清晰度档位不同，应在各自模型 schema 内单独声明，不要写死在前端。",
      "参考图、首尾帧或镜头控制类输入，优先通过 inputProfile 和 schema 联合表达。",
    ];
  if (c === "audio")
    return [
      "语音生成模型建议声明 voice、audioFormat 和 referenceAudio，方便节点自动展示音色与音频样本输入。",
      "MiMo 语音合成可用 openai_audio_chat 模式，目标文本放 assistant message，风格指令放 user message。",
      "音色克隆模型需要开启音频参考能力，并使用 voice_clone 标签区分普通 TTS。",
    ];
  return [
    "聊天节点通常保留 temperature、maxTokens、topP 等推理参数，字段名尽量与上游协议一致。",
    "如果模型支持 systemPrompt、reasoningEffort 或 tools 开关，也应通过 schema 显式暴露。",
    "inputProfile 一般保持 prompt；只有确实需要额外输入口时再扩展。",
  ];
}

function modelSchemaExample(c: Capability) {
  if (c === "image")
    return `{
  "aspectRatio": {
    "type": "enum",
    "label": "画幅比例",
    "options": ["1:1", "3:4", "4:3", "9:16", "16:9"],
    "default": "1:1"
  },
  "size": {
    "type": "enum",
    "label": "尺寸档位",
    "options": ["1024x1024", "1024x1536", "1536x1024"]
  },
  "referenceImages": {
    "type": "number",
    "label": "参考图张数",
    "min": 0,
    "max": 4,
    "default": 0
  }
}`;
  if (c === "video")
    return `{
  "aspectRatio": {
    "type": "enum",
    "label": "画幅比例",
    "options": ["16:9", "9:16", "1:1"],
    "default": "16:9"
  },
  "duration": {
    "type": "enum",
    "label": "时长",
    "options": ["5", "10"],
    "default": "5"
  },
  "resolution": {
    "type": "enum",
    "label": "清晰度",
    "options": ["720p", "1080p"],
    "default": "720p"
  }
}`;
  if (c === "audio")
    return `{
  "audioFormat": {
    "type": "enum",
    "label": "音频格式",
    "options": ["wav", "mp3"],
    "default": "wav"
  },
  "voice": {
    "type": "enum",
    "label": "音色",
    "options": ["mimo_default", "冰糖", "茉莉", "苏打", "白桦"]
  },
  "referenceAudio": {
    "type": "audio[]",
    "label": "克隆样本",
    "max": 1,
    "formats": ["mp3", "wav"]
  }
}`;
  return `{
  "temperature": {
    "type": "number",
    "label": "采样温度",
    "min": 0,
    "max": 2,
    "step": 0.1,
    "default": 0.7
  },
  "maxTokens": {
    "type": "number",
    "label": "最大输出",
    "min": 256,
    "max": 8192,
    "step": 256,
    "default": 2048
  }
}`;
}

function normalizeInputCapabilities(model: ModelRecord) {
  return {
    prompt: model.inputCapabilities?.prompt !== false,
    imageReference:
      model.inputCapabilities?.imageReference ??
      (model.capability === "image" || model.capability === "video"),
    multiImage: Boolean(model.inputCapabilities?.multiImage),
    firstFrame: Boolean(model.inputCapabilities?.firstFrame),
    lastFrame: Boolean(model.inputCapabilities?.lastFrame),
    audioReference: Boolean(model.inputCapabilities?.audioReference) || model.capability === "audio",
    videoReference: Boolean(model.inputCapabilities?.videoReference),
  };
}

function deriveInputProfile(
  capability: Capability,
  inputCapabilities: ReturnType<typeof normalizeInputCapabilities>,
) {
  const parts: string[] = ["prompt"];
  if (inputCapabilities.imageReference) {
    parts.push("image_reference");
  }
  if (inputCapabilities.videoReference) parts.push("video_reference");
  if (inputCapabilities.audioReference || capability === "audio") parts.push("audio_reference");
  if (inputCapabilities.multiImage) parts.push("multi_image");
  if (inputCapabilities.firstFrame) parts.push("first_frame");
  if (inputCapabilities.lastFrame) parts.push("last_frame");
  return parts.join(",");
}

function inputCapabilityMeta(capability: Capability) {
  const items: Array<{
    key: keyof ReturnType<typeof normalizeInputCapabilities>;
    label: string;
    description: string;
    visible: boolean;
  }> = [
    {
      key: "imageReference",
      label: capability === "video" ? "参考图模式" : "参考图",
      description: capability === "video" ? "允许视频节点按模型上限接入有序参考图。" : "允许节点接入单张参考图。",
      visible: capability === "image" || capability === "video",
    },
    {
      key: "multiImage",
      label: "多参考图",
      description: "允许节点显示多图输入并按顺序分配。",
      visible: capability === "image",
    },
    {
      key: "firstFrame",
      label: "首帧",
      description: "允许视频节点单独指定开场画面。",
      visible: capability === "video",
    },
    {
      key: "lastFrame",
      label: "尾帧",
      description: "允许视频节点单独指定结束画面。",
      visible: capability === "video",
    },
    {
      key: "audioReference",
      label: "参考音频",
      description: capability === "video" ? "允许视频节点接入参考音频。" : "允许语音克隆、音频处理或理解节点接入音频样本。",
      visible: capability === "audio" || capability === "video" || capability === "chat",
    },
    {
      key: "videoReference",
      label: "视频理解",
      description: "允许 LLM 节点向该模型发送视频输入。",
      visible: capability === "chat",
    },
  ];
  return items.filter((item) => item.visible);
}

const TAG_GROUPS: Array<{ title: string; tags: ModelCapabilityTag[] }> = [
  { title: "理解", tags: ["image_understanding", "video_understanding", "audio_understanding", "reasoning", "long_context", "web_search"] },
  { title: "生成", tags: ["image_generation", "image_edit", "video_generation", "tts", "voice_design", "voice_clone", "music_generation", "audio_cover", "audio_extend"] },
];

function normalizeCapabilityTags(tags: unknown): ModelCapabilityTag[] {
  return Array.isArray(tags) ? tags.filter((tag): tag is ModelCapabilityTag => typeof tag === "string") : [];
}

function pollTimeoutSecondsValue(model: ModelRecord) {
  const value = Number(model.advancedConfig?.pollTimeoutMs);
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(Math.max(30, Math.min(600, Math.round(value / 1000))));
}

function safeJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

const AIFORK_VIDEO_REQUEST_CONTRACT_EXAMPLE = `{
  "requestContract": {
    "bindings": [
      { "path": "duration", "source": "duration", "type": "number" },
      { "path": "metadata.modeType", "source": "modeType", "type": "string" },
      { "path": "metadata.ratio", "source": "ratio", "type": "string" },
      { "path": "metadata.enableSound", "value": "on", "type": "string" },
      { "path": "images", "source": "images", "type": "string[]" },
      { "path": "audios", "source": "audios", "type": "string[]", "omitWhenEmpty": true }
    ],
    "resultPaths": ["result_url", "data.metadata.url", "data.output"]
  }
}`;

function validateAicopyRequestContract(value: Record<string, unknown>) {
  const contract = value.requestContract;
  if (contract === undefined) return "";
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) return "请求契约必须是 JSON 对象。";
  const row = contract as Record<string, unknown>;
  if (row.bindings !== undefined && !Array.isArray(row.bindings)) return "请求契约 bindings 必须是数组。";
  const allowedSources = new Set(["model", "prompt", "duration", "ratio", "resolution", "modeType", "images", "audios"]);
  const allowedTypes = new Set(["string", "number", "boolean", "string[]"]);
  for (const binding of Array.isArray(row.bindings) ? row.bindings : []) {
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) return "请求契约每个 binding 都必须是对象。";
    const item = binding as Record<string, unknown>;
    const path = String(item.path || "").trim();
    if (!/^([A-Za-z_][A-Za-z0-9_]{0,63})(\.[A-Za-z_][A-Za-z0-9_]{0,63}){0,4}$/.test(path)) {
      return "请求契约 path 只能使用最多五层的字母、数字与下划线路径。";
    }
    const hasValue = Object.prototype.hasOwnProperty.call(item, "value");
    const source = String(item.source || "").trim();
    if (!hasValue && !allowedSources.has(source)) return "请求契约 binding 必须填写允许的 source 或固定 value。";
    if (item.type !== undefined && !allowedTypes.has(String(item.type))) return "请求契约 type 只允许 string、number、boolean、string[]。";
    if (item.omitWhenEmpty !== undefined && typeof item.omitWhenEmpty !== "boolean") return "请求契约 omitWhenEmpty 必须为布尔值。";
  }
  if (row.resultPaths !== undefined && (!Array.isArray(row.resultPaths) || row.resultPaths.some((path) => !/^([A-Za-z_][A-Za-z0-9_]{0,63})(\.[A-Za-z_][A-Za-z0-9_]{0,63}){0,4}$/.test(String(path || "").trim())))) {
    return "请求契约 resultPaths 必须是安全字段路径数组。";
  }
  return "";
}

function normalizeVoicePresetList(value: string) {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter((item, index, list) => Boolean(item) && list.indexOf(item) === index);
}

function syncAudioVoicePresetSchema(
  schema: Record<string, unknown>,
  advancedConfig: Record<string, unknown>,
  defaultVoice: string,
  presetVoiceText: string,
) {
  const nextSchema = { ...schema };
  const nextAdvancedConfig = { ...advancedConfig };
  if (!defaultVoice && !presetVoiceText.trim()) return { schema: nextSchema, advancedConfig: nextAdvancedConfig };
  const voiceOptions = normalizeVoicePresetList(presetVoiceText);
  const existingVoice = nextSchema.voice && typeof nextSchema.voice === "object" && !Array.isArray(nextSchema.voice)
    ? nextSchema.voice as Record<string, unknown>
    : {};
  nextSchema.voice = {
    type: "enum",
    label: "音色",
    ...existingVoice,
    ...(voiceOptions.length ? { options: voiceOptions } : {}),
    ...(defaultVoice ? { default: defaultVoice } : {}),
  };
  if (defaultVoice) nextAdvancedConfig.voice = defaultVoice;
  if (voiceOptions.length) nextAdvancedConfig.presetVoices = voiceOptions;
  return { schema: nextSchema, advancedConfig: nextAdvancedConfig };
}

const EXECUTION_MODE_OPTIONS: Array<{
  value: ProviderGenerationExecutionMode;
  label: string;
  description: string;
}> = [
  { value: "worker_queue", label: "后台任务队列", description: "前端只拿 taskId，我方 Worker 负责执行与轮询。" },
  { value: "sync_inline", label: "同步直返", description: "适合真正低时延、同步返回结果的能力。" },
  { value: "async_poll", label: "异步轮询", description: "提交任务后由调用方轮询状态并读取结果。" },
  { value: "async_poll_then_final_lookup", label: "轮询后二段查询", description: "先轮询任务，再额外查询最终资源或成品。" },
];

function defaultExecutionModeForCapability(capability: Capability): ProviderGenerationExecutionMode {
  return capability === "chat" ? "sync_inline" : "worker_queue";
}

function normalizeExecutionMode(model: Pick<ModelRecord, "capability" | "executionMode" | "advancedConfig">): ProviderGenerationExecutionMode {
  const direct = typeof model.executionMode === "string" ? model.executionMode : "";
  if (EXECUTION_MODE_OPTIONS.some((item) => item.value === direct)) {
    return direct as ProviderGenerationExecutionMode;
  }
  const configValue = typeof model.advancedConfig?.executionMode === "string"
    ? model.advancedConfig.executionMode
    : typeof model.advancedConfig?.mode === "string"
      ? model.advancedConfig.mode
      : "";
  if (EXECUTION_MODE_OPTIONS.some((item) => item.value === configValue)) {
    return configValue as ProviderGenerationExecutionMode;
  }
  return defaultExecutionModeForCapability(model.capability);
}

/* ── ModelEditorRow ───────────────────────────────────────────────────── */

export function ModelEditorRow({
  model,
  providerProtocol,
  onUpdate,
  onDelete,
  onTest,
}: {
  model: ModelRecord;
  providerProtocol: ProviderProtocol;
  onUpdate: (model: ModelRecord, patch: Partial<ModelRecord>) => Promise<void>;
  onDelete: (model: ModelRecord) => void;
  onTest: (model: ModelRecord, kind: string, autoApply?: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(model);
  const [schemaError, setSchemaError] = useState("");
  const [configError, setConfigError] = useState("");
  const [advancedConfigText, setAdvancedConfigText] = useState("{}");
  const [pollTimeoutSeconds, setPollTimeoutSeconds] = useState("");
  const [defaultVoice, setDefaultVoice] = useState("");
  const [presetVoiceText, setPresetVoiceText] = useState("");
  const [videoDurationMode, setVideoDurationMode] = useState<"tiers" | "range">("tiers");
  const [videoDurationTiers, setVideoDurationTiers] = useState("4\n6\n8\n10\n15");
  const [videoDurationMin, setVideoDurationMin] = useState("4");
  const [videoDurationMax, setVideoDurationMax] = useState("20");
  const [videoDurationStep, setVideoDurationStep] = useState("1");
  const [videoDurationDefault, setVideoDurationDefault] = useState("8");
  const [videoReferenceImageMax, setVideoReferenceImageMax] = useState("1");
  const [aicopyRequestContractEnabled, setAicopyRequestContractEnabled] = useState(
    resolveAicopyRequestContractEnabled(model.advancedConfig),
  );
  const isAicopyVideoModel = providerProtocol === "aicopy" && draft.capability === "video";

  useEffect(() => {
    setDraft({
      ...model,
      executionMode: normalizeExecutionMode(model),
      inputCapabilities: normalizeInputCapabilities(model),
      capabilityTags: normalizeCapabilityTags(model.capabilityTags),
      advancedConfig: model.advancedConfig || {},
    });
    setSchemaError("");
    setConfigError("");
    setAdvancedConfigText(JSON.stringify(model.advancedConfig || {}, null, 2));
    setAicopyRequestContractEnabled(resolveAicopyRequestContractEnabled(model.advancedConfig));
    setPollTimeoutSeconds(pollTimeoutSecondsValue(model));
    const schemaObject = safeJsonObject(model.parameterSchema);
    const voiceSchema = schemaObject.voice && typeof schemaObject.voice === "object" && !Array.isArray(schemaObject.voice)
      ? schemaObject.voice as Record<string, unknown>
      : {};
    const voiceOptions = Array.isArray(voiceSchema.options)
      ? voiceSchema.options.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    setDefaultVoice(String(voiceSchema.default || model.advancedConfig?.voice || "").trim());
    setPresetVoiceText(voiceOptions.join("\n"));
    const videoDuration = readVideoDurationSchema(schemaObject);
    setVideoDurationMode(videoDuration.mode as "tiers" | "range");
    setVideoDurationTiers(videoDuration.tiers.length ? videoDuration.tiers.join("\n") : "4\n6\n8\n10\n15");
    setVideoDurationMin(String(videoDuration.range?.min || 4));
    setVideoDurationMax(String(videoDuration.range?.max || 20));
    setVideoDurationStep(String(videoDuration.range?.step || 1));
    setVideoDurationDefault(String(videoDuration.range?.default || 8));
    setVideoReferenceImageMax(String(readVideoReferenceImageMax(
      schemaObject,
      model.inputCapabilities?.multiImage ? 4 : 1,
    )));
  }, [model.id, model.updatedAt]);

  async function saveModel() {
    let parameterSchema = draft.parameterSchema.trim() || "{}";
    let advancedConfig: Record<string, unknown> = {};
    let parameterSchemaObject: Record<string, unknown> = {};
    try {
      parameterSchemaObject = JSON.parse(parameterSchema);
      parameterSchema = JSON.stringify(parameterSchemaObject, null, 2);
    } catch {
      setSchemaError("参数 schema 必须是有效 JSON。");
      return;
    }
    try {
      advancedConfig = JSON.parse(advancedConfigText || "{}");
    } catch {
      setConfigError("高级配置必须是有效 JSON。");
      return;
    }
    let inputCapabilities = normalizeInputCapabilities(draft);
    if (draft.capability === "video") {
      advancedConfig.aicopyRequestContractEnabled = isAicopyVideoModel && aicopyRequestContractEnabled;
      if (advancedConfig.aicopyRequestContractEnabled) {
        advancedConfig = mergeAicopySdRequestContractDefaults(advancedConfig);
        const requestContractError = validateAicopyRequestContract(advancedConfig);
        if (requestContractError) {
          setConfigError(requestContractError);
          return;
        }
      }
    }
    const executionMode = normalizeExecutionMode(draft);
    advancedConfig.executionMode = executionMode;
    if (draft.capability === "image" || draft.capability === "video") {
      const rawSeconds = pollTimeoutSeconds.trim();
      if (rawSeconds) {
        const seconds = Number(rawSeconds);
        if (!Number.isFinite(seconds) || seconds < 30 || seconds > 600) {
          setConfigError("最大轮询时长需要填写 30 到 600 秒。");
          return;
        }
        advancedConfig.pollTimeoutMs = Math.round(seconds) * 1000;
      } else {
        delete advancedConfig.pollTimeoutMs;
      }
    }
    if (draft.capability === "audio") {
      const synced = syncAudioVoicePresetSchema(parameterSchemaObject, advancedConfig, defaultVoice.trim(), presetVoiceText);
      parameterSchemaObject = synced.schema;
      advancedConfig = synced.advancedConfig;
      parameterSchema = JSON.stringify(parameterSchemaObject, null, 2);
    }
    if (draft.capability === "video") {
      parameterSchemaObject = syncVideoDurationSchema(
        parameterSchemaObject,
        videoDurationMode,
        videoDurationTiers,
        {
          minText: videoDurationMin,
          maxText: videoDurationMax,
          stepText: videoDurationStep,
          defaultText: videoDurationDefault,
        },
      );
      const syncedDuration = parameterSchemaObject.duration && typeof parameterSchemaObject.duration === "object" && !Array.isArray(parameterSchemaObject.duration)
        ? parameterSchemaObject.duration as Record<string, unknown>
        : {};
      if (videoDurationMode === "range") {
        setVideoDurationTiers(Array.isArray(syncedDuration.options) ? syncedDuration.options.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0).join("\n") : videoDurationTiers);
      } else {
        setVideoDurationDefault(String(syncedDuration.default || videoDurationDefault));
      }
      const maxReferenceImages = Math.max(1, Math.min(16, Math.floor(Number(videoReferenceImageMax) || 1)));
      parameterSchemaObject = syncVideoReferenceImageSchema(
        parameterSchemaObject,
        inputCapabilities.imageReference,
        maxReferenceImages,
      );
      inputCapabilities = {
        ...inputCapabilities,
        multiImage: legacyMultiImageFromReferenceLimit(inputCapabilities.imageReference, maxReferenceImages),
      };
      parameterSchema = JSON.stringify(parameterSchemaObject, null, 2);
    }
    setSchemaError("");
    setConfigError("");
    await onUpdate(model, {
      displayName: draft.displayName.trim() || draft.modelId.trim(),
      modelId: draft.modelId.trim(),
      capability: draft.capability,
      capabilityTags: normalizeCapabilityTags(draft.capabilityTags),
      executionMode,
      protocolOverride: draft.protocolOverride || "",
      inputProfile: deriveInputProfile(draft.capability, inputCapabilities),
      inputCapabilities,
      parameterSchema,
      advancedConfig,
    });
  }

  const tips = modelCapabilityTips(draft.capability);
  const example = modelSchemaExample(draft.capability);
  const normalizedCaps = normalizeInputCapabilities(draft);
  const capabilityItems = inputCapabilityMeta(draft.capability);
  const tags = normalizeCapabilityTags(model.capabilityTags);
  const presetVoices = normalizeVoicePresetList(presetVoiceText);
  const testButtons = [
    { kind: "chat", label: "测文本", visible: draft.capability === "chat" },
    { kind: "image_understanding", label: "测图像理解", visible: draft.capability === "chat" || tags.includes("image_understanding") },
    { kind: "video_understanding", label: "测视频理解", visible: draft.capability === "chat" || tags.includes("video_understanding") },
    { kind: "audio_generation", label: "测语音", visible: draft.capability === "audio" || tags.includes("tts") },
    { kind: "voice_clone", label: "测克隆", visible: draft.capability === "audio" || tags.includes("voice_clone") },
  ].filter((item) => item.visible);

  return (
    <div className={expanded ? "model-row-wrap expanded" : "model-row-wrap"}>
      <div className="model-row">
        <button
          type="button"
          className="model-identity"
          onClick={() => setExpanded((v) => !v)}
        >
          <strong>{model.displayName}</strong>
          <span>{model.modelId}</span>
          {normalizeCapabilityTags(model.capabilityTags).length ? (
            <span className="model-tag-strip">
              {normalizeCapabilityTags(model.capabilityTags).slice(0, 4).map((tag) => (
                <em key={tag}>{modelCapabilityTagLabel(tag)}</em>
              ))}
            </span>
          ) : null}
        </button>
        <select
          value={model.protocolOverride || ""}
          onChange={(e) =>
            onUpdate(model, { protocolOverride: e.target.value })
          }
          aria-label={`${model.displayName} 协议`}
        >
          <option value="">默认协议</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="volcengine">火山</option>
          <option value="runninghub">RH</option>
          <option value="apimart">APIMart</option>
          <option value="aicopy">AICopy</option>
          <option value="modelscope">ModelScope</option>
          <option value="grsai_draw">GRSAI Draw</option>
          <option value="custom">自定义</option>
        </select>
        <button
          type="button"
          className="icon-soft"
          onClick={() => onUpdate(model, { enabled: !model.enabled })}
        >
          {model.enabled ? "启用" : "停用"}
        </button>
        <button
          type="button"
          className="icon-soft"
          onClick={() => setExpanded((v) => !v)}
          title="模型高级设置"
        >
          <Settings2 aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-soft"
          onClick={() => onDelete(model)}
          title="删除"
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
      {expanded ? (
        <div className="model-advanced">
          <section className="schema-guide-card">
            <div className="schema-guide-grid">
              <div>
                <strong>协议来源</strong>
                <p>
                  Provider 或协议覆盖决定实际调用哪个上游协议，例如
                  OpenAI、Gemini、GRSAI Draw。
                </p>
              </div>
              <div>
                <strong>节点参数来源</strong>
                <p>
                  通用节点右侧看到的动态参数，直接来自当前模型的参数
                  Schema，而不是写死在前端里。
                </p>
              </div>
              <div>
                <strong>输入口来源</strong>
                <p>
                  输入能力开关决定节点暴露哪些输入口，例如参考图、多图、首帧、尾帧。
                </p>
              </div>
            </div>
            <div className="schema-guide-note">
              <strong>当前输入映射</strong>
              <span>
                <code>{deriveInputProfile(draft.capability, normalizeInputCapabilities(draft))}</code>
              </span>
            </div>
          </section>
          <div className="model-fields">
            <label>
              显示名称
              <input
                value={draft.displayName}
                onChange={(e) =>
                  setDraft({ ...draft, displayName: e.target.value })
                }
              />
            </label>
            <label>
              模型 ID
              <input
                value={draft.modelId}
                onChange={(e) =>
                  setDraft({ ...draft, modelId: e.target.value })
                }
              />
            </label>
            <label>
              能力分类
              <select
                value={draft.capability}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    capability: e.target.value as Capability,
                  })
                }
              >
                <option value="image">图像</option>
                <option value="chat">语言</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
              </select>
            </label>
            <label>
              输入 Profile（只读预览）
              <input value={deriveInputProfile(draft.capability, normalizeInputCapabilities(draft))} readOnly />
            </label>
            <label>
              执行模式
              <select
                value={normalizeExecutionMode(draft)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    executionMode: e.target.value as ProviderGenerationExecutionMode,
                  })
                }
              >
                {EXECUTION_MODE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <small>{EXECUTION_MODE_OPTIONS.find((item) => item.value === normalizeExecutionMode(draft))?.description}</small>
            </label>
          </div>
          <section className="schema-guide-card compact">
            <div className="schema-guide-head">
              <strong>能力标签</strong>
              <span>标签决定模型是否可用于图像理解、视频理解、思考推理、语音生成和音色克隆。</span>
            </div>
            <div className="model-tag-editor">
              {TAG_GROUPS.map((group) => (
                <div className="model-tag-group" key={group.title}>
                  <strong>{group.title}</strong>
                  <div className="model-tag-options">
                    {group.tags.map((tag) => {
                      const tags = normalizeCapabilityTags(draft.capabilityTags);
                      const checked = tags.includes(tag);
                      return (
                        <label className={checked ? "model-tag-option active" : "model-tag-option"} key={tag}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(tags);
                              if (e.target.checked) next.add(tag);
                              else next.delete(tag);
                              setDraft({ ...draft, capabilityTags: [...next] });
                            }}
                          />
                          <span>{modelCapabilityTagLabel(tag)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {draft.capability === "audio" ? (
            <section className="schema-guide-card compact audio-preset-card">
              <div className="schema-guide-head">
                <strong>音色预设</strong>
                <span>当模型支持固定音色时，这里填写的默认音色与音色列表会直接同步到画布音频节点。</span>
              </div>
              <div className="audio-preset-grid">
                <label className="audio-preset-field">
                  默认音色
                  <input
                    value={defaultVoice}
                    onChange={(e) => setDefaultVoice(e.target.value)}
                    placeholder="mimo_default"
                  />
                  <small>生成语音时默认选中的音色，也会回写到 `advancedConfig.voice`。</small>
                </label>
                <label className="audio-preset-field">
                  预设音色
                  <textarea
                    value={presetVoiceText}
                    onChange={(e) => setPresetVoiceText(e.target.value)}
                    placeholder={"mimo_default\n冰糖\n茉莉\n苏打"}
                    spellCheck={false}
                  />
                  <small>支持逗号或换行分隔，保存后写入 `parameterSchema.voice.options`。</small>
                </label>
              </div>
              {presetVoices.length ? (
                <div className="audio-preset-chip-row">
                  {presetVoices.map((voiceName) => (
                    <span key={voiceName} className={voiceName === defaultVoice.trim() ? "audio-preset-chip active" : "audio-preset-chip"}>
                      {voiceName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="schema-guide-note">
                  <strong>提示</strong>
                  <span>如果该模型没有固定音色，可以保留为空，前端会继续使用自由输入框。</span>
                </div>
              )}
            </section>
          ) : null}
          {draft.capability === "video" ? (
            <section className="schema-guide-card compact audio-preset-card">
              <div className="schema-guide-head">
                <strong>视频时长配置</strong>
                <span>可以保留档位列表，也可以切换为范围模式，让画布下拉显示每个整数秒。</span>
              </div>
              <div className="audio-preset-grid">
                <label className="audio-preset-field">
                  时长模式
                  <select
                    value={videoDurationMode}
                    onChange={(e) => setVideoDurationMode(e.target.value as "tiers" | "range")}
                  >
                    <option value="tiers">档位</option>
                    <option value="range">范围</option>
                  </select>
                  <small>档位模式保留 `duration.options`，范围模式写入 `duration.min/max/step/default`。</small>
                </label>
                {videoDurationMode === "tiers" ? (
                  <label className="audio-preset-field">
                    时长档位
                    <textarea
                      value={videoDurationTiers}
                      onChange={(e) => setVideoDurationTiers(e.target.value)}
                      placeholder={"4\n6\n8\n10\n15"}
                      spellCheck={false}
                    />
                    <small>支持换行或逗号分隔，保存后会写入 `duration.options`。</small>
                  </label>
                ) : (
                  <div className="audio-preset-grid">
                    <label className="audio-preset-field">
                      起始秒
                      <input value={videoDurationMin} onChange={(e) => setVideoDurationMin(e.target.value)} />
                    </label>
                    <label className="audio-preset-field">
                      结束秒
                      <input value={videoDurationMax} onChange={(e) => setVideoDurationMax(e.target.value)} />
                    </label>
                    <label className="audio-preset-field">
                      步长
                      <input value={videoDurationStep} onChange={(e) => setVideoDurationStep(e.target.value)} />
                    </label>
                    <label className="audio-preset-field">
                      默认秒数
                      <input value={videoDurationDefault} onChange={(e) => setVideoDurationDefault(e.target.value)} />
                    </label>
                  </div>
                )}
              </div>
              <div className="schema-guide-note">
                <strong>预览</strong>
                <span>
                  {videoDurationMode === "range"
                    ? durationOptionsFromRange({
                        min: Math.max(1, Number(videoDurationMin) || 1),
                        max: Math.max(Number(videoDurationMin) || 1, Number(videoDurationMax) || 1),
                        step: Math.max(1, Number(videoDurationStep) || 1),
                        default: Math.max(1, Number(videoDurationDefault) || 1),
                      }).join(", ")
                    : normalizeVideoDurationTierList(videoDurationTiers).join(", ")}
                </span>
              </div>
            </section>
          ) : null}
          <section className="schema-guide-card compact">
            <div className="schema-guide-head">
              <strong>模型连通性测试</strong>
              <span>测试结果会写入模型记录；“测试并修正”会把成功测试推断出的标签写回模型。</span>
            </div>
            <div className="model-test-actions">
              {testButtons.map((item) => (
                <span className="model-test-action" key={item.kind}>
                  <button type="button" className="ghost-action" onClick={() => onTest(model, item.kind, false)}>
                    {item.label}
                  </button>
                  <button type="button" className="icon-soft" onClick={() => onTest(model, item.kind, true)}>
                    测试并修正
                  </button>
                </span>
              ))}
            </div>
            <div className="model-test-state">
              {Object.entries(model.testState || {}).length ? (
                Object.entries(model.testState || {}).map(([key, value]) => {
                  const checkedAt = value?.checkedAt ? new Date(value.checkedAt).toLocaleString() : "";
                  const sampleOutput = value?.sampleOutput || "";
                  return (
                    <span className={value?.ok ? "success" : "danger"} key={key}>
                      {key}: {value?.message || "-"}
                      {typeof value?.status === "number" ? ` · HTTP ${value.status}` : ""}
                      {checkedAt ? ` · ${checkedAt}` : ""}
                      {sampleOutput ? ` · 样例：${sampleOutput}` : ""}
                    </span>
                  );
                })
              ) : (
                <span>暂无测试记录</span>
              )}
            </div>
          </section>
          <section className="schema-guide-card compact">
            <div className="schema-guide-head">
              <strong>输入能力</strong>
              <span>切换模型时，画布视频节点会按这里的能力动态显示输入方式。</span>
            </div>
            <div className="capability-toggle-grid">
              {capabilityItems.map((item) => (
                <label className={normalizedCaps[item.key] ? "capability-toggle active" : "capability-toggle"} key={item.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(normalizedCaps[item.key])}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        inputCapabilities: {
                          ...normalizedCaps,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="capability-toggle-copy">
                    <span className="capability-toggle-head">
                      <strong>{item.label}</strong>
                      <span
                        className={
                          normalizedCaps[item.key]
                            ? "capability-toggle-state active"
                            : "capability-toggle-state"
                        }
                      >
                        {normalizedCaps[item.key] ? "已开启" : "未开启"}
                      </span>
                    </span>
                    <small>{item.description}</small>
                    {draft.capability === "video" && item.key === "imageReference" && normalizedCaps.imageReference ? (
                      <span className="capability-reference-limit" onClick={(event) => event.preventDefault()}>
                        <span>最大参考图数量</span>
                        <input
                          type="number"
                          min={1}
                          max={16}
                          step={1}
                          value={videoReferenceImageMax}
                          aria-label="最大参考图数量"
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const value = Math.max(1, Math.min(16, Math.floor(Number(event.target.value) || 1)));
                            setVideoReferenceImageMax(String(value));
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="schema-guide-card compact">
            <div className="schema-guide-head">
              <strong>{capabilityLabel(draft.capability)}节点建议参数</strong>
              <span>
                下面这些字段会直接影响前端节点展示和任务 payload。
              </span>
            </div>
            <ul className="schema-bullet-list">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <pre className="schema-example-block">{example}</pre>
          </section>
          {draft.capability === "image" || draft.capability === "video" ? (
            <section className="schema-guide-card compact">
              <div className="schema-guide-head">
                <strong>运行时控制</strong>
                <span>默认留空，不启用轮询超时；只有手动填写后才会写入任务配置。</span>
              </div>
              <div className="model-runtime-grid">
                <label className="model-runtime-field">
                  最大轮询时长（秒）
                  <input
                    type="number"
                    min={30}
                    max={600}
                    step={10}
                    value={pollTimeoutSeconds}
                    placeholder="留空表示不设置"
                    onChange={(e) => {
                      setConfigError("");
                      setPollTimeoutSeconds(e.target.value);
                    }}
                  />
                  <small>留空时不会写入 `advancedConfig.pollTimeoutMs`。</small>
                </label>
              </div>
            </section>
          ) : null}
          {isAicopyVideoModel ? (
            <section className="schema-guide-card compact">
              <div className="schema-guide-head">
                <strong>SD 补充请求契约</strong>
                <span>仅当前模型启用；同一 Provider 下的其他视频模型不会继承。</span>
              </div>
              <label className={aicopyRequestContractEnabled ? "capability-toggle active" : "capability-toggle"}>
                <input
                  type="checkbox"
                  checked={aicopyRequestContractEnabled}
                  onChange={(event) => setAicopyRequestContractEnabled(event.target.checked)}
                />
                <span className="capability-toggle-copy">
                  <span className="capability-toggle-head">
                    <strong>启用 SD 补充请求契约</strong>
                    <span className={aicopyRequestContractEnabled ? "capability-toggle-state active" : "capability-toggle-state"}>
                      {aicopyRequestContractEnabled ? "已开启" : "未开启"}
                    </span>
                  </span>
                  <small>开启并保存后自动补齐官方 SD 请求字段；高级配置可继续追加模型专属字段。</small>
                </span>
              </label>
            </section>
          ) : null}
          <label>
            参数 Schema（JSON）
            <textarea
              value={draft.parameterSchema}
              onChange={(e) =>
                setDraft({ ...draft, parameterSchema: e.target.value })
              }
              spellCheck={false}
            />
          </label>
          {isAicopyVideoModel && aicopyRequestContractEnabled ? (
            <section className="schema-guide-card compact">
              <div className="schema-guide-head">
                <strong>AIFork 视频请求契约</strong>
                <span>把模型专属请求字段写入下方高级配置的 requestContract。允许来源只有 prompt、duration、ratio、resolution、modeType、images、audios；系统不会执行脚本或表达式。</span>
              </div>
              <pre className="schema-example-block">{AIFORK_VIDEO_REQUEST_CONTRACT_EXAMPLE}</pre>
            </section>
          ) : null}
          <label>
            高级配置（JSON）
            <textarea
              value={advancedConfigText}
              onChange={(e) => {
                setConfigError("");
                setAdvancedConfigText(e.target.value);
              }}
              spellCheck={false}
            />
          </label>
          <div className="model-advanced-footer">
            <span className={schemaError || configError ? "schema-note error" : "schema-note"}>
              {schemaError ||
                configError ||
                "保存后，模型分类、输入能力和动态参数会立即同步到画布通用节点。"}
            </span>
            <button
              type="button"
              className="primary-action"
              onClick={saveModel}
            >
              <Save aria-hidden="true" /> 保存模型设置
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── ModelSection ─────────────────────────────────────────────────────── */

export function ModelSection({
  providerProtocol,
  capability,
  models,
  onAdd,
  onUpdate,
  onDelete,
  onTest,
}: {
  providerProtocol: ProviderProtocol;
  capability: Capability;
  models: ModelRecord[];
  onAdd: () => void;
  onUpdate: (model: ModelRecord, patch: Partial<ModelRecord>) => Promise<void>;
  onDelete: (model: ModelRecord) => void;
  onTest: (model: ModelRecord, kind: string, autoApply?: boolean) => Promise<void>;
}) {
  return (
    <section className="api-card model-section">
      <div className="model-section-head">
        <div>
          <h3>{capabilityLabel(capability)}模型</h3>
          <p>{capabilityHelp(capability)}</p>
        </div>
        <button type="button" className="ghost-action" onClick={onAdd}>
          <Plus aria-hidden="true" /> 模型
        </button>
      </div>
      <div className="model-list">
        {models.length ? (
          models.map((m) => (
            <ModelEditorRow
              key={m.id}
              model={m}
              providerProtocol={providerProtocol}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onTest={onTest}
            />
          ))
        ) : (
          <div className="empty-models">暂无模型</div>
        )}
      </div>
    </section>
  );
}
