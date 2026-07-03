export type ComfyuiWorkflowValueKind =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "image"
  | "video"
  | "audio";

export type ComfyuiWorkflowDisplayTier = "primary" | "secondary" | "advanced";
export type ComfyuiWorkflowExecutionMode = "fixed" | "selectable" | "pool";

export interface ComfyuiDetectedInput {
  key: string;
  nodeId: string;
  fieldName: string;
  source: string;
  label: string;
  classType: string;
  nodeTitle: string;
  kind: ComfyuiWorkflowValueKind;
  value?: unknown;
}

export interface ComfyuiDetectedOutput {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  sourceNodeId?: string;
  sourceFieldName?: string;
  classType?: string;
  nodeTitle?: string;
}

export interface ComfyuiParserWarning {
  code: string;
  message: string;
  nodeId?: string;
}

export interface ComfyuiWorkflowAnalysisResult {
  detectedInputs: ComfyuiDetectedInput[];
  detectedOutputs: ComfyuiDetectedOutput[];
  warnings: ComfyuiParserWarning[];
}

export interface ComfyuiWorkflowInputSchemaItem {
  key: string;
  nodeId: string;
  fieldName: string;
  source: string;
  label: string;
  mode: "hidden" | "param" | "upstream";
  kind: ComfyuiWorkflowValueKind;
  required: boolean;
  defaultValue?: unknown;
  displayTier?: ComfyuiWorkflowDisplayTier;
  upstreamSlot?: string;
  slotLabel?: string;
  multiple?: boolean;
  note?: string;
  order: number;
}

export interface ComfyuiWorkflowOutputSchemaItem {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  sourceNodeId?: string;
  sourceFieldName?: string;
  enabled: boolean;
  isPrimary?: boolean;
  note?: string;
  order: number;
}

export interface ComfyuiWorkflowInstanceBinding {
  instanceId: string;
  enabled: boolean;
  isDefault?: boolean;
  executionMode?: ComfyuiWorkflowExecutionMode;
  capabilityTags?: string[];
}

export interface LegacyComfyuiWorkflowFieldDraft {
  key?: string;
  nodeId?: string;
  fieldName?: string;
  label?: string;
  source?: string;
  kind?: ComfyuiWorkflowValueKind;
  required?: boolean;
  value?: unknown;
}

export interface LegacyComfyuiWorkflowOutputDraft {
  key?: string;
  label?: string;
  kind?: "text" | "image" | "video" | "audio";
  sourceNodeId?: string;
  sourceFieldName?: string;
}

const FIELD_LABELS: Record<string, string> = {
  prompt: "正向 Prompt",
  positive: "正向 Prompt",
  negative: "负向 Prompt",
  image1: "图片输入 1",
  image2: "图片输入 2",
  image3: "图片输入 3",
  video1: "视频输入 1",
  audio1: "音频输入 1",
  width: "宽度",
  height: "高度",
  batch_size: "批量数",
  seed: "Seed",
  steps: "Steps",
  cfg: "CFG",
  sampler_name: "Sampler",
  scheduler: "Scheduler",
  denoise: "Denoise",
  model_name: "模型名",
  ckpt_name: "Checkpoint",
  clip_name: "CLIP",
  vae_name: "VAE",
  lora_name: "LoRA",
  strength_model: "LoRA 模型强度",
  strength_clip: "LoRA CLIP 强度",
};

const EXPOSED_SOURCES = new Set([
  "prompt",
  "positive",
  "negative",
  "width",
  "height",
  "batch_size",
  "seed",
  "steps",
  "cfg",
  "sampler_name",
  "scheduler",
  "denoise",
  "model_name",
  "ckpt_name",
  "clip_name",
  "vae_name",
  "lora_name",
  "strength_model",
  "strength_clip",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value.trim()
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : fallback;
}

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function workflowEntries(workflowJson: Record<string, unknown>) {
  return Object.entries(workflowJson).filter((entry): entry is [string, Record<string, unknown>] => {
    const node = entry[1];
    return isRecord(node) && isRecord(node.inputs);
  });
}

function nodeTitle(nodeId: string, node: Record<string, unknown>) {
  const meta = isRecord(node._meta) ? node._meta : {};
  return safeText(meta.title, safeText(node.title, safeText(node.class_type, `#${nodeId}`)));
}

function classTypeOf(node: Record<string, unknown>) {
  return safeText(node.class_type).toLowerCase();
}

function workflowInputValue(workflowJson: Record<string, unknown>, nodeId: string, fieldName: string) {
  const node = workflowJson[nodeId];
  if (!isRecord(node) || !isRecord(node.inputs)) return undefined;
  return node.inputs[fieldName];
}

function fieldKey(nodeId: string, fieldName: string) {
  return `${nodeId}.${fieldName}`;
}

function linkedNodeId(value: unknown) {
  if (!Array.isArray(value)) return "";
  const first = value[0];
  return typeof first === "string" || typeof first === "number" ? String(first).trim() : "";
}

function buildClipTextRoleMap(entries: Array<[string, Record<string, unknown>]>) {
  const roles = new Map<string, "prompt" | "negative">();
  for (const [, node] of entries) {
    const inputs = isRecord(node.inputs) ? node.inputs : {};
    const positive = linkedNodeId(inputs.positive);
    const negative = linkedNodeId(inputs.negative);
    if (positive) roles.set(positive, "prompt");
    if (negative) roles.set(negative, "negative");
  }
  return roles;
}

function detectValueKind(source: string, value: unknown): ComfyuiWorkflowValueKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (/^(image|video|audio)\d+$/i.test(source)) {
    return source.startsWith("image")
      ? "image"
      : source.startsWith("video")
        ? "video"
        : "audio";
  }
  if (["prompt", "positive", "negative"].includes(source)) return "textarea";
  if (["width", "height", "batch_size", "seed", "steps", "cfg", "denoise", "strength_model", "strength_clip"].includes(source)) {
    return "number";
  }
  return "text";
}

function detectInputSource(
  nodeId: string,
  node: Record<string, unknown>,
  fieldName: string,
  clipTextRoles: Map<string, "prompt" | "negative">,
  promptSeen: boolean,
) {
  const classType = classTypeOf(node);
  if (classType.includes("cliptextencode") && fieldName === "text") {
    const role = clipTextRoles.get(nodeId);
    if (role) return role;
    const text = `${nodeTitle(nodeId, node)} ${classType}`.toLowerCase();
    return /negative|neg|反向|负向|不要|排除/.test(text) || promptSeen ? "negative" : "prompt";
  }
  if ((classType.includes("loadimage") || classType.includes("imageinput")) && fieldName === "image") return "image1";
  if ((classType.includes("loadvideo") || classType.includes("videoinput") || classType.includes("vhs")) && fieldName === "video") return "video1";
  if ((classType.includes("loadaudio") || classType.includes("audioinput")) && fieldName === "audio") return "audio1";
  if (classType.includes("emptylatent") || classType.includes("latentimage")) {
    if (fieldName === "width") return "width";
    if (fieldName === "height") return "height";
    if (fieldName === "batch_size") return "batch_size";
  }
  if (classType.includes("ksampler") || classType.includes("sampler")) {
    if (fieldName === "seed" || fieldName === "noise_seed") return "seed";
    if (["steps", "cfg", "sampler_name", "scheduler", "denoise"].includes(fieldName)) return fieldName;
  }
  if (["model_name", "ckpt_name", "clip_name", "vae_name", "lora_name", "strength_model", "strength_clip"].includes(fieldName)) {
    return fieldName;
  }
  return fieldName;
}

export function analyzeComfyuiWorkflow(workflowJson: Record<string, unknown>): ComfyuiWorkflowAnalysisResult {
  const detectedInputs: ComfyuiDetectedInput[] = [];
  const detectedOutputs: ComfyuiDetectedOutput[] = [];
  const warnings: ComfyuiParserWarning[] = [];
  const entries = workflowEntries(workflowJson);
  const seenInputs = new Set<string>();
  const clipTextRoles = buildClipTextRoleMap(entries);
  let promptSeen = false;
  let imageIndex = 0;
  let videoIndex = 0;
  let audioIndex = 0;

  if (!entries.length) {
    warnings.push({
      code: "NO_API_WORKFLOW_NODES",
      message: "未识别到 API Workflow 节点；请确认导入的是 ComfyUI API workflow JSON。",
    });
    return { detectedInputs, detectedOutputs, warnings };
  }

  for (const [nodeId, node] of entries) {
    const classType = classTypeOf(node);
    const title = nodeTitle(nodeId, node);
    const inputs = isRecord(node.inputs) ? node.inputs : {};

    if (!classType && Object.keys(inputs).length > 0) {
      warnings.push({
        code: "NODE_MISSING_CLASS_TYPE",
        message: `#${nodeId} 缺少 class_type，可能不是标准 API Workflow 节点。`,
        nodeId,
      });
    }

    for (const [fieldName, rawValue] of Object.entries(inputs)) {
      const source = detectInputSource(nodeId, node, fieldName, clipTextRoles, promptSeen);
      const key = fieldKey(nodeId, fieldName);
      if (seenInputs.has(key)) continue;
      seenInputs.add(key);
      const kind = detectValueKind(source, rawValue);
      const isMediaInput = kind === "image" || kind === "video" || kind === "audio";
      const isExposed = isMediaInput || source !== fieldName || EXPOSED_SOURCES.has(source);
      if (!isExposed) continue;
      if (source === "prompt") promptSeen = true;
      detectedInputs.push({
        key,
        nodeId,
        fieldName,
        source,
        label: FIELD_LABELS[source] || title || fieldName,
        classType,
        nodeTitle: title,
        kind,
        value: cloneJson(rawValue),
      });
    }

    if (classType.includes("saveimage") || classType.includes("previewimage")) {
      imageIndex += 1;
      detectedOutputs.push({
        key: `image-${imageIndex}`,
        label: `图片输出 ${imageIndex}`,
        kind: "image",
        sourceNodeId: nodeId,
        classType,
        nodeTitle: title,
      });
    }
    if (classType.includes("savevideo")) {
      videoIndex += 1;
      detectedOutputs.push({
        key: `video-${videoIndex}`,
        label: `视频输出 ${videoIndex}`,
        kind: "video",
        sourceNodeId: nodeId,
        classType,
        nodeTitle: title,
      });
    }
    if (classType.includes("saveaudio")) {
      audioIndex += 1;
      detectedOutputs.push({
        key: `audio-${audioIndex}`,
        label: `音频输出 ${audioIndex}`,
        kind: "audio",
        sourceNodeId: nodeId,
        classType,
        nodeTitle: title,
      });
    }
  }

  if (!detectedInputs.some((field) => field.source === "prompt" || field.source === "positive")) {
    warnings.push({
      code: "PROMPT_NOT_FOUND",
      message: "未自动找到正向 Prompt 字段；需要在后台映射治理中人工确认。",
    });
  }

  if (!detectedOutputs.length) {
    warnings.push({
      code: "OUTPUT_NOT_FOUND",
      message: "未识别到标准输出节点，系统会先提供一个默认图片输出占位。",
    });
  }

  return {
    detectedInputs,
    detectedOutputs,
    warnings,
  };
}

export function buildDefaultComfyuiInputSchema(
  analysis: ComfyuiWorkflowAnalysisResult,
): ComfyuiWorkflowInputSchemaItem[] {
  return analysis.detectedInputs.map((item, index) => {
    const isMedia = item.kind === "image" || item.kind === "video" || item.kind === "audio";
    return {
      key: item.key,
      nodeId: item.nodeId,
      fieldName: item.fieldName,
      source: item.source,
      label: item.label,
      mode: isMedia ? "upstream" : "param",
      kind: item.kind,
      required: item.source === "prompt" || item.source === "positive",
      defaultValue: cloneJson(item.value),
      upstreamSlot: isMedia ? item.source : undefined,
      slotLabel: isMedia ? item.label : undefined,
      displayTier: isMedia ? undefined : index < 4 ? "primary" : "secondary",
      multiple: false,
      order: index,
    };
  });
}

export function buildDefaultComfyuiOutputSchema(
  analysis: ComfyuiWorkflowAnalysisResult,
): ComfyuiWorkflowOutputSchemaItem[] {
  const outputs = analysis.detectedOutputs.length
    ? analysis.detectedOutputs
    : [{ key: "image-1", label: "输出图 1", kind: "image" as const }];

  return outputs.map((item, index) => ({
    key: item.key,
    label: item.label,
    kind: item.kind,
    sourceNodeId: item.sourceNodeId,
    sourceFieldName: item.sourceFieldName,
    enabled: true,
    isPrimary: index === 0,
    order: index,
  }));
}

export function migrateLegacyComfyuiWorkflowSchema(input: {
  workflowJson: Record<string, unknown>;
  exposedFields?: LegacyComfyuiWorkflowFieldDraft[] | unknown;
  defaultValues?: Record<string, unknown> | unknown;
  hiddenFields?: string[] | unknown;
  outputSchema?: LegacyComfyuiWorkflowOutputDraft[] | unknown;
}) {
  const workflowJson = isRecord(input.workflowJson) ? input.workflowJson : {};
  const analysis = analyzeComfyuiWorkflow(workflowJson);
  const hiddenKeys = Array.isArray(input.hiddenFields)
    ? input.hiddenFields.map((item) => safeText(item)).filter(Boolean)
    : [];
  const defaults = isRecord(input.defaultValues) ? input.defaultValues : {};
  const legacyFields = Array.isArray(input.exposedFields) ? input.exposedFields : [];

  const inputSchema = legacyFields.length
    ? legacyFields
        .map((field, index) => {
          if (!field || typeof field !== "object") return null;
          const nodeId = safeText(field.nodeId);
          const fieldName = safeText(field.fieldName);
          if (!nodeId || !fieldName) return null;
          const key = safeText(field.key, fieldKey(nodeId, fieldName));
          const source = safeText(field.source, fieldName);
          const kind = (field.kind || detectValueKind(source, field.value)) as ComfyuiWorkflowValueKind;
          const isMedia = kind === "image" || kind === "video" || kind === "audio";
          const mode = hiddenKeys.includes(key) ? "hidden" : isMedia ? "upstream" : "param";
          const defaultValue = Object.prototype.hasOwnProperty.call(defaults, key)
            ? cloneJson(defaults[key])
            : cloneJson(field.value);
          return {
            key,
            nodeId,
            fieldName,
            source,
            label: safeText(field.label, FIELD_LABELS[source] || fieldName),
            mode,
            kind,
            required: field.required === true,
            defaultValue,
            upstreamSlot: mode === "upstream" ? source : undefined,
            slotLabel: mode === "upstream" ? safeText(field.label, FIELD_LABELS[source] || fieldName) : undefined,
            displayTier: mode === "param" ? (index < 4 ? "primary" : "secondary") : undefined,
            multiple: false,
            order: index,
          } satisfies ComfyuiWorkflowInputSchemaItem;
        })
        .filter(Boolean) as ComfyuiWorkflowInputSchemaItem[]
    : buildDefaultComfyuiInputSchema(analysis);

  const outputSchema = Array.isArray(input.outputSchema) && input.outputSchema.length
    ? input.outputSchema.map((item, index) => ({
        key: safeText(item?.key, `output-${index + 1}`),
        label: safeText(item?.label, `输出 ${index + 1}`),
        kind: item?.kind === "video" || item?.kind === "audio" || item?.kind === "text" ? item.kind : "image",
        sourceNodeId: safeText(item?.sourceNodeId),
        sourceFieldName: safeText(item?.sourceFieldName),
        enabled: true,
        isPrimary: index === 0,
        order: index,
      }))
    : buildDefaultComfyuiOutputSchema(analysis);

  const normalizedDefaultValues = Object.fromEntries(
    inputSchema
      .filter((item) => item.defaultValue !== undefined)
      .map((item) => [item.key, cloneJson(item.defaultValue)]),
  );

  return {
    analysis,
    inputSchema,
    defaultValues: normalizedDefaultValues,
    outputSchema,
  };
}
