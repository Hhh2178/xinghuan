import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  analyzeComfyuiWorkflow,
  buildDefaultComfyuiInputSchema,
  buildDefaultComfyuiOutputSchema,
  migrateLegacyComfyuiWorkflowSchema,
  type ComfyuiWorkflowAnalysisResult,
  type ComfyuiWorkflowInstanceBinding,
  type ComfyuiWorkflowInputSchemaItem,
  type ComfyuiWorkflowOutputSchemaItem,
} from "@xinghuan/shared";
import { safeSlug, safeText } from "./api-sanitizers.js";
import {
  normalizeComfyuiWorkflowDraft,
  normalizeComfyuiWorkflowDraftList,
} from "./comfyui-workflow-normalizer.js";

export interface ComfyuiInstanceRecord {
  id: string;
  name: string;
  tailscaleAddress: string;
  baseUrl: string;
  reportedBaseUrl?: string;
  baseUrlSource: "manual" | "connector";
  health: "online" | "offline" | "degraded";
  concurrency: number;
  capabilities: string[];
  lastSeenAt: number;
  createdAt: number;
  updatedAt: number;
  note?: string;
  connectorVersion?: string;
}

export interface ComfyuiWorkflowFieldDraft {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  source: string;
  kind: "text" | "textarea" | "number" | "boolean" | "select" | "image" | "video" | "audio";
  required?: boolean;
  value?: unknown;
}

export interface ComfyuiWorkflowOutputDraft {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  sourceNodeId?: string;
  sourceFieldName?: string;
}

type LegacyComfyuiWorkflowFieldDraft = Partial<ComfyuiWorkflowFieldDraft> & {
  nodeId?: string;
  fieldName?: string;
};

type LegacyComfyuiWorkflowOutputDraft = Partial<ComfyuiWorkflowOutputDraft>;

export interface ComfyuiWorkflowDraft {
  id: string;
  instanceId: string;
  title: string;
  description?: string;
  workflowJson: Record<string, unknown>;
  analysis: ComfyuiWorkflowAnalysisResult;
  inputSchema: ComfyuiWorkflowInputSchemaItem[];
  exposedFields: ComfyuiWorkflowFieldDraft[];
  defaultValues: Record<string, unknown>;
  hiddenFields: string[];
  outputSchema: ComfyuiWorkflowOutputSchemaItem[];
  instanceBindings: ComfyuiWorkflowInstanceBinding[];
  sharedWorkflowId?: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  publishedBy?: string;
}

export interface ComfyuiRegistryState {
  revision: number;
  updatedAt: number;
  instances: ComfyuiInstanceRecord[];
  workflows: ComfyuiWorkflowDraft[];
  sharedWorkflows: ComfyuiWorkflowDraft[];
}

const REGISTRY_FILENAME = "comfyui-instance-pool.json";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordAt(value: Record<string, unknown>, key: string) {
  const next = value[key];
  return isRecord(next) ? next : undefined;
}

function recordText(value: Record<string, unknown>, key: string) {
  return safeText(value[key]);
}

function workflowInputValue(workflowJson: Record<string, unknown>, nodeId: string, fieldName: string) {
  const node = recordAt(workflowJson, nodeId);
  const inputs = node ? recordAt(node, "inputs") : undefined;
  return inputs ? inputs[fieldName] : undefined;
}

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function registryPath(adminDir: string) {
  return join(adminDir, REGISTRY_FILENAME);
}

function nowOr(value: unknown, fallback = Date.now()) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function nonEmptyStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item)).filter(Boolean);
}

function normalizePositiveInteger(value: unknown, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeBaseUrlSource(value: unknown, fallback: ComfyuiInstanceRecord["baseUrlSource"] = "manual") {
  return value === "connector" ? "connector" : fallback;
}

function fieldKey(nodeId: string, fieldName: string) {
  return `${nodeId}.${fieldName}`;
}

function workflowEntries(workflowJson: Record<string, unknown>): Array<[string, Record<string, unknown>]> {
  return Object.entries(workflowJson).filter((entry): entry is [string, Record<string, unknown>] => {
    const node = entry[1];
    return isRecord(node) && isRecord((node as Record<string, unknown>).inputs);
  });
}

function isNegativeNode(nodeId: string, node: Record<string, unknown>) {
  const meta = recordAt(node, "_meta") || {};
  const text = `${recordText(meta, "title")} ${recordText(node, "title")} ${recordText(node, "class_type")}`.toLowerCase();
  if (/negative|neg|反向|负向|排除/.test(text)) return true;
  return nodeId.toLowerCase().includes("neg");
}

function detectFieldSource(nodeId: string, node: Record<string, unknown>, fieldName: string, promptSeen: boolean) {
  const classType = recordText(node, "class_type").toLowerCase();
  if (classType.includes("cliptextencode") && fieldName === "text") {
    return isNegativeNode(nodeId, node) || promptSeen ? "negative" : "prompt";
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
  if (["model_name", "ckpt_name", "clip_name", "vae_name", "lora_name", "strength_model", "strength_clip"].includes(fieldName)) return fieldName;
  return fieldName;
}

function detectFieldKind(source: string, value: unknown) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (/^(image|video|audio)\d+$/.test(source)) return source.startsWith("image") ? "image" : source.startsWith("video") ? "video" : "audio";
  if (["prompt", "positive", "negative"].includes(source)) return "textarea";
  if (["width", "height", "batch_size", "seed", "steps", "cfg", "denoise", "strength_model", "strength_clip"].includes(source)) return "number";
  return "text";
}

function detectWorkflowOutputs(workflowJson: Record<string, unknown>): ComfyuiWorkflowOutputDraft[] {
  const outputs: ComfyuiWorkflowOutputDraft[] = [];
  let imageCount = 0;
  let videoCount = 0;
  let audioCount = 0;

  for (const [nodeId, nodeRaw] of workflowEntries(workflowJson)) {
    const node = nodeRaw as Record<string, unknown>;
    const classType = recordText(node, "class_type").toLowerCase();
    if (classType.includes("saveimage") || classType.includes("previewimage")) {
      imageCount += 1;
      outputs.push({ key: `image-${imageCount}`, label: `图片输出 ${imageCount}`, kind: "image", sourceNodeId: nodeId });
    }
    if (classType.includes("savevideo")) {
      videoCount += 1;
      outputs.push({ key: `video-${videoCount}`, label: `视频输出 ${videoCount}`, kind: "video", sourceNodeId: nodeId });
    }
    if (classType.includes("saveaudio")) {
      audioCount += 1;
      outputs.push({ key: `audio-${audioCount}`, label: `音频输出 ${audioCount}`, kind: "audio", sourceNodeId: nodeId });
    }
  }

  if (!outputs.length) {
    outputs.push({ key: "image-1", label: "输出图 1", kind: "image" });
  }
  return outputs;
}

function detectWorkflowFields(workflowJson: Record<string, unknown>) {
  const exposedFields: ComfyuiWorkflowFieldDraft[] = [];
  const defaultValues: Record<string, unknown> = {};
  const hiddenFields: string[] = [];
  const seen = new Set<string>();
  let promptSeen = false;

  for (const [nodeId, nodeRaw] of workflowEntries(workflowJson)) {
    const node = nodeRaw as Record<string, unknown>;
    const inputs = recordAt(node, "inputs") || {};
    for (const [fieldName, value] of Object.entries(inputs)) {
      const source = detectFieldSource(nodeId, node, fieldName, promptSeen);
      const key = fieldKey(nodeId, fieldName);
      if (seen.has(key)) continue;
      seen.add(key);
      const isExposed = source !== fieldName || ["prompt", "positive", "negative", "width", "height", "batch_size", "seed", "steps", "cfg", "sampler_name", "scheduler", "denoise", "model_name", "ckpt_name", "clip_name", "vae_name", "lora_name", "strength_model", "strength_clip"].includes(source);
      if (isExposed) {
        const fieldValue = value;
        if (source === "prompt") promptSeen = true;
        exposedFields.push({
          key,
          nodeId,
          fieldName,
          label: FIELD_LABELS[source] || recordText(recordAt(node, "_meta") || {}, "title") || safeText(fieldName),
          source,
          kind: detectFieldKind(source, fieldValue),
          value: fieldValue,
        });
        if (fieldValue !== undefined) defaultValues[key] = cloneJson(fieldValue);
      } else {
        hiddenFields.push(key);
      }
    }
  }

  if (!exposedFields.some((field) => field.source === "prompt")) {
    const fallback = exposedFields.find((field) => field.kind === "textarea" || field.fieldName === "text");
    if (fallback) {
      fallback.source = "prompt";
      fallback.label = FIELD_LABELS.prompt;
      fallback.kind = "textarea";
    }
  }

  return { exposedFields, defaultValues, hiddenFields };
}

function normalizeField(input: unknown, workflowJson: Record<string, unknown>) {
  if (!isRecord(input)) return null;
  const nodeId = safeText(input.nodeId);
  const fieldName = safeText(input.fieldName);
  if (!nodeId || !fieldName) return null;
  const key = safeText(input.key, fieldKey(nodeId, fieldName));
  const source = safeText(input.source, fieldName);
  const value = Object.prototype.hasOwnProperty.call(input, "value") ? cloneJson(input.value) : workflowInputValue(workflowJson, nodeId, fieldName);
  return {
    key,
    nodeId,
    fieldName,
    label: safeText(input.label, FIELD_LABELS[source] || fieldName),
    source,
    kind: ["text", "textarea", "number", "boolean", "select", "image", "video", "audio"].includes(String(input.kind)) ? String(input.kind) as ComfyuiWorkflowFieldDraft["kind"] : detectFieldKind(source, value),
    required: Boolean(input.required),
    value,
  } satisfies ComfyuiWorkflowFieldDraft;
}

function normalizeOutput(input: unknown, index: number): ComfyuiWorkflowOutputDraft | null {
  if (!isRecord(input)) return null;
  const kind = String(input.kind);
  const safeKind = kind === "video" || kind === "audio" || kind === "text" ? kind : "image";
  return {
    key: safeText(input.key, `output-${index + 1}`),
    label: safeText(input.label, `输出 ${index + 1}`),
    kind: safeKind,
    sourceNodeId: safeText(input.sourceNodeId),
    sourceFieldName: safeText(input.sourceFieldName),
  };
}

function normalizeDefaultValues(defaultValues: unknown, exposedFields: ComfyuiWorkflowFieldDraft[], workflowJson: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const raw = isRecord(defaultValues) ? defaultValues : {};
  for (const field of exposedFields) {
    const fallback = workflowInputValue(workflowJson, field.nodeId, field.fieldName);
    const value = Object.prototype.hasOwnProperty.call(raw, field.key) ? raw[field.key] : field.value ?? fallback;
    if (value !== undefined) out[field.key] = cloneJson(value);
  }
  return out;
}

function normalizeHiddenFields(hiddenFields: unknown, defaultHiddenFields: string[]) {
  const values = [...nonEmptyStrings(hiddenFields), ...defaultHiddenFields].map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(values));
}

function normalizeInstanceBindings(
  bindings: unknown,
  fallbackInstanceId: string,
  fallbackCapabilities: string[] = [],
): ComfyuiWorkflowInstanceBinding[] {
  const raw = Array.isArray(bindings) ? bindings : [];
  const seen = new Set<string>();
  const rows = raw
    .map((item) => {
      if (!isRecord(item)) return null;
      const instanceId = safeSlug(item.instanceId, "");
      if (!instanceId || seen.has(instanceId)) return null;
      seen.add(instanceId);
      return {
        instanceId,
        enabled: item.enabled !== false,
        isDefault: item.isDefault === true,
        executionMode: item.executionMode === "fixed" || item.executionMode === "pool" ? item.executionMode : "selectable",
        capabilityTags: nonEmptyStrings(item.capabilityTags),
      } satisfies ComfyuiWorkflowInstanceBinding;
    })
    .filter(Boolean) as ComfyuiWorkflowInstanceBinding[];
  if (!rows.length) {
    return [{
      instanceId: fallbackInstanceId,
      enabled: true,
      isDefault: true,
      executionMode: "selectable",
      capabilityTags: fallbackCapabilities,
    }];
  }
  if (!rows.some((item) => item.isDefault)) {
    rows[0] = { ...rows[0], isDefault: true };
  }
  return rows;
}

function normalizeInputSchema(
  inputSchema: unknown,
  fallbackSchema: ComfyuiWorkflowInputSchemaItem[],
  defaultValues: Record<string, unknown>,
) {
  if (!Array.isArray(inputSchema) || !inputSchema.length) return fallbackSchema;
  const rows = inputSchema
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const nodeId = safeText(item.nodeId);
      const fieldName = safeText(item.fieldName);
      if (!nodeId || !fieldName) return null;
      const key = safeText(item.key, fieldKey(nodeId, fieldName));
      const source = safeText(item.source, fieldName);
      const fallback = fallbackSchema.find((row) => row.key === key || (row.nodeId === nodeId && row.fieldName === fieldName));
      const rawKind = String(item.kind);
      const kind = ["text", "textarea", "number", "boolean", "select", "image", "video", "audio"].includes(rawKind)
        ? rawKind as ComfyuiWorkflowInputSchemaItem["kind"]
        : fallback?.kind || detectFieldKind(source, defaultValues[key]);
      const mode = item.mode === "hidden" || item.mode === "upstream" ? item.mode : "param";
      return {
        key,
        nodeId,
        fieldName,
        source,
        label: safeText(item.label, fallback?.label || FIELD_LABELS[source] || fieldName),
        mode,
        kind,
        required: Boolean(item.required ?? fallback?.required),
        defaultValue: Object.prototype.hasOwnProperty.call(defaultValues, key)
          ? cloneJson(defaultValues[key])
          : Object.prototype.hasOwnProperty.call(item, "defaultValue")
            ? cloneJson(item.defaultValue)
            : fallback?.defaultValue,
        displayTier: mode === "param"
          ? item.displayTier === "secondary" || item.displayTier === "advanced"
            ? item.displayTier
            : fallback?.displayTier || "primary"
          : undefined,
        upstreamSlot: safeText(item.upstreamSlot, fallback?.upstreamSlot || (mode === "upstream" ? source : "")) || undefined,
        slotLabel: mode === "upstream"
          ? safeText(item.slotLabel, fallback?.slotLabel || safeText(item.label, fallback?.label || FIELD_LABELS[source] || fieldName)) || undefined
          : undefined,
        multiple: mode === "upstream" ? Boolean(item.multiple ?? fallback?.multiple) : undefined,
        note: safeText(item.note, fallback?.note || "") || undefined,
        order: Number.isFinite(Number(item.order)) ? Math.max(0, Math.floor(Number(item.order))) : fallback?.order ?? index,
      } satisfies ComfyuiWorkflowInputSchemaItem;
    })
    .filter(Boolean) as ComfyuiWorkflowInputSchemaItem[];
  return rows.length ? rows.sort((a, b) => a.order - b.order) : fallbackSchema;
}

function normalizeOutputSchema(
  outputSchema: unknown,
  fallbackSchema: ComfyuiWorkflowOutputSchemaItem[],
) {
  if (!Array.isArray(outputSchema) || !outputSchema.length) return fallbackSchema;
  const rows = outputSchema
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const kind = String(item.kind);
      const fallback = fallbackSchema[index];
      return {
        key: safeText(item.key, fallback?.key || `output-${index + 1}`),
        label: safeText(item.label, fallback?.label || `输出 ${index + 1}`),
        kind: (kind === "video" || kind === "audio" || kind === "text" ? kind : "image") as ComfyuiWorkflowOutputSchemaItem["kind"],
        sourceNodeId: safeText(item.sourceNodeId, fallback?.sourceNodeId || ""),
        sourceFieldName: safeText(item.sourceFieldName, fallback?.sourceFieldName || ""),
        enabled: item.enabled === undefined ? fallback?.enabled ?? true : Boolean(item.enabled),
        isPrimary: item.isPrimary === undefined ? fallback?.isPrimary === true : Boolean(item.isPrimary),
        note: safeText(item.note, fallback?.note || "") || undefined,
        order: Number.isFinite(Number(item.order)) ? Math.max(0, Math.floor(Number(item.order))) : fallback?.order ?? index,
      } satisfies ComfyuiWorkflowOutputSchemaItem;
    })
    .filter(Boolean) as ComfyuiWorkflowOutputSchemaItem[];
  return rows.length ? rows.sort((a, b) => a.order - b.order) : fallbackSchema;
}

function buildLegacyExposedFields(inputSchema: ComfyuiWorkflowInputSchemaItem[]): ComfyuiWorkflowFieldDraft[] {
  return inputSchema
    .filter((field) => field.mode !== "hidden")
    .map((field) => ({
      key: field.key,
      nodeId: field.nodeId,
      fieldName: field.fieldName,
      label: field.label,
      source: field.source,
      kind: field.kind,
      required: field.required,
      value: cloneJson(field.defaultValue),
    }));
}

function buildLegacyHiddenFields(inputSchema: ComfyuiWorkflowInputSchemaItem[]) {
  return inputSchema.filter((field) => field.mode === "hidden").map((field) => field.key);
}

export function normalizeComfyuiWorkflowSchema(input: unknown): ComfyuiWorkflowDraft {
  const payload = isRecord(input) ? input : {};
  const workflowJson = isRecord(payload.workflowJson) ? cloneJson(payload.workflowJson) : isRecord(payload.workflow) ? cloneJson(payload.workflow) : {};
  const analysis = analyzeComfyuiWorkflow(workflowJson);
  const title = safeText(payload.title, "ComfyUI 工作流");
  const instanceId = safeSlug(payload.instanceId, "instance");
  const id = safeSlug(payload.id, `${instanceId || "instance"}-${title || "workflow"}`);
  const migrated = migrateLegacyComfyuiWorkflowSchema({
    workflowJson,
    exposedFields: Array.isArray(payload.exposedFields) ? payload.exposedFields as LegacyComfyuiWorkflowFieldDraft[] : undefined,
    defaultValues: isRecord(payload.defaultValues) ? payload.defaultValues : undefined,
    hiddenFields: Array.isArray(payload.hiddenFields) ? payload.hiddenFields as string[] : undefined,
    outputSchema: Array.isArray(payload.outputSchema) ? payload.outputSchema as LegacyComfyuiWorkflowOutputDraft[] : undefined,
  });
  const defaultValues = isRecord(payload.defaultValues) ? cloneJson(payload.defaultValues) : migrated.defaultValues;
  const inputSchema = normalizeInputSchema(
    payload.inputSchema,
    migrated.inputSchema.length ? migrated.inputSchema : buildDefaultComfyuiInputSchema(analysis),
    defaultValues,
  );
  const outputSchema = normalizeOutputSchema(
    payload.outputSchema,
    migrated.outputSchema.length ? migrated.outputSchema : buildDefaultComfyuiOutputSchema(analysis),
  );
  const exposedFields = buildLegacyExposedFields(inputSchema);
  const hiddenFields = buildLegacyHiddenFields(inputSchema);
  const instanceBindings = normalizeInstanceBindings(payload.instanceBindings, instanceId);
  const createdAt = nowOr(payload.createdAt);
  const updatedAt = nowOr(payload.updatedAt);

  return {
    id,
    instanceId,
    title,
    description: safeText(payload.description),
    workflowJson,
    analysis,
    inputSchema,
    exposedFields,
    defaultValues,
    hiddenFields,
    outputSchema,
    instanceBindings,
    sharedWorkflowId: safeText(payload.sharedWorkflowId),
    createdAt,
    updatedAt,
    publishedAt: payload.publishedAt === undefined ? undefined : nowOr(payload.publishedAt),
    publishedBy: safeText(payload.publishedBy),
  };
}

export function buildComfyuiWorkflowDraft(input: {
  instanceId: string;
  workflowJson: Record<string, unknown>;
  title?: string;
  description?: string;
  inputSchema?: ComfyuiWorkflowInputSchemaItem[];
  exposedFields?: Array<Partial<ComfyuiWorkflowFieldDraft> & { nodeId?: string; fieldName?: string }>;
  defaultValues?: Record<string, unknown>;
  hiddenFields?: string[];
  outputSchema?: Array<Partial<ComfyuiWorkflowOutputSchemaItem>>;
  instanceBindings?: ComfyuiWorkflowInstanceBinding[];
  sharedWorkflowId?: string;
}) {
  return normalizeComfyuiWorkflowSchema({
    ...input,
    title: safeText(input.title, "ComfyUI 工作流"),
    workflowJson: cloneJson(input.workflowJson),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export function normalizeComfyuiInstanceRecord(input: unknown): ComfyuiInstanceRecord {
  const payload = isRecord(input) ? input : {};
  const now = Date.now();
  const lastSeenAt = nowOr(payload.lastSeenAt, now);
  const health: ComfyuiInstanceRecord["health"] = payload.health === "offline" || payload.health === "degraded" ? payload.health : "online";
  return {
    id: safeSlug(payload.id, `comfyui-${now.toString(36)}`),
    name: safeText(payload.name, "ComfyUI 实例"),
    tailscaleAddress: safeText(payload.tailscaleAddress),
    baseUrl: safeText(payload.baseUrl, "http://127.0.0.1:8188"),
    reportedBaseUrl: safeText(payload.reportedBaseUrl),
    baseUrlSource: normalizeBaseUrlSource(payload.baseUrlSource),
    health,
    concurrency: normalizePositiveInteger(payload.concurrency, 1),
    capabilities: nonEmptyStrings(payload.capabilities),
    lastSeenAt,
    createdAt: nowOr(payload.createdAt, now),
    updatedAt: nowOr(payload.updatedAt, now),
    note: safeText(payload.note),
    connectorVersion: safeText(payload.connectorVersion),
  };
}

export function getEffectiveComfyuiInstanceHealth(
  instance: Pick<ComfyuiInstanceRecord, "health" | "lastSeenAt">,
  options?: {
    now?: number;
    staleAfterMs?: number;
    lastConnectionOk?: boolean;
  },
): ComfyuiInstanceRecord["health"] {
  const now = Number.isFinite(Number(options?.now)) ? Number(options?.now) : Date.now();
  const staleAfterMs = Number.isFinite(Number(options?.staleAfterMs)) ? Math.max(5_000, Number(options?.staleAfterMs)) : 45_000;
  if (now - instance.lastSeenAt > staleAfterMs) return "offline";
  if (options?.lastConnectionOk === false && instance.health === "online") return "degraded";
  return instance.health;
}

export function defaultComfyuiRegistryState(): ComfyuiRegistryState {
  const now = Date.now();
  return {
    revision: 1,
    updatedAt: now,
    instances: [],
    workflows: [],
    sharedWorkflows: [],
  };
}

export async function readComfyuiRegistry(adminDir: string): Promise<ComfyuiRegistryState> {
  await mkdir(adminDir, { recursive: true });
  try {
    const raw = JSON.parse(await readFile(registryPath(adminDir), "utf-8")) as Partial<ComfyuiRegistryState>;
    return {
      revision: normalizePositiveInteger(raw.revision, 1),
      updatedAt: nowOr(raw.updatedAt),
      instances: Array.isArray(raw.instances) ? raw.instances.map(normalizeComfyuiInstanceRecord) : [],
      workflows: Array.isArray(raw.workflows)
        ? normalizeComfyuiWorkflowDraftList(raw.workflows.map((workflow) => normalizeComfyuiWorkflowSchema(workflow)))
        : [],
      sharedWorkflows: Array.isArray(raw.sharedWorkflows)
        ? normalizeComfyuiWorkflowDraftList(raw.sharedWorkflows.map((workflow) => normalizeComfyuiWorkflowSchema(workflow)))
        : [],
    };
  } catch {
    return defaultComfyuiRegistryState();
  }
}

export async function writeComfyuiRegistry(adminDir: string, state: ComfyuiRegistryState) {
  await mkdir(adminDir, { recursive: true });
  const next: ComfyuiRegistryState = {
    revision: normalizePositiveInteger(state.revision, 1),
    updatedAt: nowOr(state.updatedAt),
    instances: Array.isArray(state.instances) ? state.instances.map(normalizeComfyuiInstanceRecord) : [],
    workflows: Array.isArray(state.workflows)
      ? normalizeComfyuiWorkflowDraftList(state.workflows.map((workflow) => normalizeComfyuiWorkflowSchema(workflow)))
      : [],
    sharedWorkflows: Array.isArray(state.sharedWorkflows)
      ? normalizeComfyuiWorkflowDraftList(state.sharedWorkflows.map((workflow) => normalizeComfyuiWorkflowSchema(workflow)))
      : [],
  };
  await writeFile(registryPath(adminDir), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function createComfyuiWorkflowRegistry(adminDir: string) {
  async function updateRegistry(mutator: (state: ComfyuiRegistryState) => ComfyuiRegistryState | Promise<ComfyuiRegistryState>) {
    const current = await readComfyuiRegistry(adminDir);
    const next = await mutator(current);
    return writeComfyuiRegistry(adminDir, {
      ...next,
      revision: current.revision + 1,
      updatedAt: Date.now(),
    });
  }

  return {
    readRegistry: () => readComfyuiRegistry(adminDir),
    updateRegistry,
    listInstances: async () => (await readComfyuiRegistry(adminDir)).instances,
    upsertInstance: async (input: unknown) => {
      const instance = normalizeComfyuiInstanceRecord(input);
      return updateRegistry((state) => {
        const instances = state.instances.filter((item) => item.id !== instance.id);
        instances.unshift(instance);
        return { ...state, instances };
      });
    },
    touchHeartbeat: async (instanceId: string, input: unknown) => {
      const payload = isRecord(input) ? input : {};
      return updateRegistry((state) => {
        const now = Date.now();
        const instances = state.instances.map((instance) => (
          instance.id !== instanceId
            ? instance
            : {
                ...instance,
                name: safeText(payload.name, instance.name),
                tailscaleAddress: safeText(payload.tailscaleAddress, instance.tailscaleAddress),
                baseUrl: instance.baseUrlSource === "connector"
                  ? safeText(payload.baseUrl, instance.baseUrl)
                  : instance.baseUrl,
                reportedBaseUrl: safeText(payload.reportedBaseUrl, instance.reportedBaseUrl || ""),
                baseUrlSource: normalizeBaseUrlSource(payload.baseUrlSource, instance.baseUrlSource),
                health: (payload.health === "offline" || payload.health === "degraded" ? payload.health : "online") as ComfyuiInstanceRecord["health"],
                concurrency: normalizePositiveInteger(payload.concurrency, instance.concurrency),
                capabilities: payload.capabilities ? nonEmptyStrings(payload.capabilities) : instance.capabilities,
                lastSeenAt: now,
                updatedAt: now,
                note: safeText(payload.note, instance.note || ""),
                connectorVersion: safeText(payload.connectorVersion, instance.connectorVersion || ""),
              }
        ));
        return { ...state, instances };
      });
    },
    updateCapabilities: async (instanceId: string, capabilities: unknown) => {
      return updateRegistry((state) => {
        const now = Date.now();
        const instances = state.instances.map((instance) => (
          instance.id === instanceId
            ? { ...instance, capabilities: nonEmptyStrings(capabilities), updatedAt: now, lastSeenAt: now }
            : instance
        ));
        return { ...state, instances };
      });
    },
    listWorkflows: async (instanceId?: string) => {
      const state = await readComfyuiRegistry(adminDir);
      return instanceId ? state.workflows.filter((workflow) => workflow.instanceId === instanceId) : state.workflows;
    },
    upsertWorkflow: async (input: unknown) => {
      const workflow = normalizeComfyuiWorkflowDraft(normalizeComfyuiWorkflowSchema(input));
      return updateRegistry((state) => {
        const workflows = state.workflows.filter((item) => item.id !== workflow.id);
        workflows.unshift(workflow);
        return { ...state, workflows };
      });
    },
    deleteWorkflow: async (instanceId: string, workflowId: string) => {
      return updateRegistry((state) => {
        const workflows = state.workflows.filter((workflow) => !(workflow.instanceId === instanceId && workflow.id === workflowId));
        const sharedWorkflows = state.sharedWorkflows.filter((workflow) => workflow.sharedWorkflowId !== workflowId && workflow.id !== workflowId);
        return { ...state, workflows, sharedWorkflows };
      });
    },
    pushWorkflowToShared: async (instanceId: string, workflowId: string, publishedBy: string) => {
      return updateRegistry((state) => {
        const now = Date.now();
        const workflow = state.workflows.find((item) => item.instanceId === instanceId && item.id === workflowId);
        if (!workflow) return state;
        const sharedWorkflowId = workflow.sharedWorkflowId || safeSlug(`shared-${workflow.id}`, `shared-${now.toString(36)}`);
        const sharedWorkflow = {
          ...workflow,
          id: sharedWorkflowId,
          sharedWorkflowId,
          publishedAt: now,
          publishedBy,
          updatedAt: now,
        };
        const workflows = state.workflows.map((item) => (
          item.id === workflowId && item.instanceId === instanceId
            ? { ...item, sharedWorkflowId, publishedAt: now, publishedBy, updatedAt: now }
            : item
        ));
        const sharedWorkflows = [
          sharedWorkflow,
          ...state.sharedWorkflows.filter((item) => item.sharedWorkflowId !== workflowId && item.id !== sharedWorkflowId),
        ];
        return { ...state, workflows, sharedWorkflows };
      });
    },
  };
}
