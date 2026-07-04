import { extname } from "node:path";
import type { ComfyuiWorkflowInputSchemaItem, ComfyuiWorkflowOutputSchemaItem } from "@xinghuan/shared";
import type {
  ComfyuiInstanceRecord,
  ComfyuiWorkflowDraft,
  ComfyuiRegistryState,
} from "./comfyui-workflow-registry.js";

export interface ComfyuiExecutionMediaInputs {
  texts?: string[];
  images?: string[];
  videos?: string[];
  audios?: string[];
}

export interface ComfyuiExecutionAsset {
  filename: string;
  subfolder?: string;
  type?: string;
  format?: string;
}

export interface ComfyuiExecutionAssets {
  images: ComfyuiExecutionAsset[];
  videos: ComfyuiExecutionAsset[];
  audios: ComfyuiExecutionAsset[];
  texts: string[];
}

export type ComfyuiExecutionStage =
  | "image_upload"
  | "prompt_submit"
  | "history_poll"
  | "asset_persist";

function extractStatusCode(message: string) {
  const match = message.match(/\b(\d{3})\b/);
  return match ? match[1] : "";
}

function stageLabel(stage: ComfyuiExecutionStage) {
  if (stage === "image_upload") return "上传输入素材";
  if (stage === "prompt_submit") return "提交工作流";
  if (stage === "history_poll") return "拉取执行结果";
  return "保存输出结果";
}

export function formatComfyuiExecutionError(
  error: unknown,
  context: {
    stage: ComfyuiExecutionStage;
    instanceName?: string;
    workflowTitle?: string;
  },
) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "").trim();
  const machineLabel = context.instanceName || "所选 ComfyUI 机器";
  const workflowLabel = context.workflowTitle || "当前工作流";
  const statusCode = extractStatusCode(rawMessage);
  const suffix = statusCode ? `（HTTP ${statusCode}）` : "";

  if (/fetch failed/i.test(rawMessage)) {
    return `${machineLabel} 连接失败，无法为工作流「${workflowLabel}」${stageLabel(context.stage)}。请检查机器在线状态、Tailscale 连通性和 ComfyUI baseUrl 配置。`;
  }
  if (/图片上传失败/i.test(rawMessage)) {
    return `${machineLabel} 为工作流「${workflowLabel}」上传输入图片失败${suffix}。请检查该实例的上传接口与磁盘权限。`;
  }
  if (/prompt 提交失败/i.test(rawMessage) || /prompt_id/i.test(rawMessage)) {
    return `${machineLabel} 未能成功提交工作流「${workflowLabel}」${suffix}。请检查该实例的 ComfyUI /prompt 接口是否正常。`;
  }
  if (/history 查询失败/i.test(rawMessage) || /执行超时/i.test(rawMessage)) {
    return `${machineLabel} 已接收工作流「${workflowLabel}」，但在拉取结果时失败${suffix}。请检查实例执行日志、队列状态和 history 输出。`;
  }
  return `${machineLabel} 运行工作流「${workflowLabel}」失败：${rawMessage || "未知错误"}`;
}

interface ComfyuiSubmitPromptResponse {
  prompt_id?: string;
  promptId?: string;
}

interface LegacyComfyuiExecutionField {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  source: string;
  kind: ComfyuiWorkflowInputSchemaItem["kind"];
  required?: boolean;
  value?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function textArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function fieldOwnValue(
  field: ComfyuiWorkflowInputSchemaItem,
  userParams: Record<string, unknown>,
  defaultValues: Record<string, unknown>,
  mediaInputs: ComfyuiExecutionMediaInputs,
) {
  if (Object.prototype.hasOwnProperty.call(userParams, field.key)) {
    return cloneJson(userParams[field.key]);
  }

  if ((field.source === "prompt" || field.source === "positive") && (mediaInputs.texts || []).length) {
    return mediaInputs.texts!.join("\n").trim();
  }

  const sourceMatch = String(field.upstreamSlot || field.source || "").match(/^(image|video|audio)(\d+)$/i);
  if (sourceMatch) {
    const kind = sourceMatch[1].toLowerCase();
    const index = Math.max(0, Number(sourceMatch[2]) - 1);
    if (kind === "image") return mediaInputs.images?.[index];
    if (kind === "video") return mediaInputs.videos?.[index];
    if (kind === "audio") return mediaInputs.audios?.[index];
  }

  if (Object.prototype.hasOwnProperty.call(defaultValues, field.key)) {
    return cloneJson(defaultValues[field.key]);
  }

  return cloneJson(field.defaultValue);
}

function normalizeLegacyExecutionSchema(fields: LegacyComfyuiExecutionField[] | undefined) {
  if (!Array.isArray(fields) || !fields.length) return [];
  return fields.map((field, index) => {
    const isMedia = field.kind === "image" || field.kind === "video" || field.kind === "audio";
    return {
      key: field.key,
      nodeId: field.nodeId,
      fieldName: field.fieldName,
      source: field.source,
      label: field.label,
      mode: isMedia ? "upstream" : "param",
      kind: field.kind,
      required: Boolean(field.required),
      defaultValue: cloneJson(field.value),
      upstreamSlot: isMedia ? field.source : undefined,
      order: index,
    } satisfies ComfyuiWorkflowInputSchemaItem;
  });
}

export function buildComfyuiExecutionPrompt(input: {
  workflowJson: Record<string, unknown>;
  inputSchema?: ComfyuiWorkflowInputSchemaItem[];
  exposedFields?: LegacyComfyuiExecutionField[];
  defaultValues: Record<string, unknown>;
  userParams?: Record<string, unknown>;
  mediaInputs?: ComfyuiExecutionMediaInputs;
}) {
  const workflowJson = cloneJson(input.workflowJson);
  const userParams = isRecord(input.userParams) ? input.userParams : {};
  const mediaInputs = input.mediaInputs || {};
  const inputSchema = Array.isArray(input.inputSchema) && input.inputSchema.length
    ? input.inputSchema
    : normalizeLegacyExecutionSchema(input.exposedFields);

  for (const field of inputSchema) {
    if (field.mode === "hidden") continue;
    const value = fieldOwnValue(field, userParams, input.defaultValues || {}, mediaInputs);
    if (value === undefined) continue;
    const node = isRecord(workflowJson[field.nodeId]) ? workflowJson[field.nodeId] as Record<string, unknown> : {};
    const inputs = isRecord(node.inputs) ? node.inputs as Record<string, unknown> : {};
    inputs[field.fieldName] = value;
    workflowJson[field.nodeId] = {
      ...node,
      inputs,
    };
  }

  return workflowJson;
}

export function collectComfyuiNamedOutputs(input: {
  outputSchema: ComfyuiWorkflowOutputSchemaItem[];
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  text: string;
}) {
  const imageQueue = [...input.imageUrls];
  const videoQueue = [...input.videoUrls];
  const audioQueue = [...input.audioUrls];
  const defaultSchema: ComfyuiWorkflowOutputSchemaItem[] = [{
    key: "image-1",
    label: "输出图 1",
    kind: "image",
    enabled: true,
    order: 0,
  }];
  const outputSchema = input.outputSchema.length ? input.outputSchema : defaultSchema;

  return outputSchema
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      key: item.key,
      label: item.label,
      kind: item.kind,
      value: item.kind === "image"
        ? imageQueue.shift() || ""
        : item.kind === "video"
          ? videoQueue.shift() || ""
          : item.kind === "audio"
            ? audioQueue.shift() || ""
            : input.text,
    }));
}

function normalizeAsset(value: unknown): ComfyuiExecutionAsset | null {
  if (!isRecord(value)) return null;
  const filename = String(value.filename || value.name || "").trim();
  if (!filename) return null;
  const subfolder = String(value.subfolder || "").trim();
  const type = String(value.type || "output").trim() || "output";
  const format = String(value.format || "").trim();
  return { filename, subfolder, type, ...(format ? { format } : {}) };
}

function pushAssets(target: ComfyuiExecutionAsset[], value: unknown) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    const asset = normalizeAsset(item);
    if (asset) target.push(asset);
  }
}

export function extractComfyuiResultAssets(historyEntry: unknown): ComfyuiExecutionAssets {
  const result: ComfyuiExecutionAssets = {
    images: [],
    videos: [],
    audios: [],
    texts: [],
  };

  const entry = isRecord(historyEntry) ? historyEntry : {};
  const outputs = isRecord(entry.outputs) ? entry.outputs : {};
  for (const value of Object.values(outputs)) {
    if (!isRecord(value)) continue;
    pushAssets(result.images, value.images);
    pushAssets(result.videos, value.gifs);
    pushAssets(result.videos, value.videos);
    pushAssets(result.audios, value.audio);
    pushAssets(result.audios, value.audios);
    if (Array.isArray(value.text)) {
      result.texts.push(...value.text.map((item) => String(item ?? "").trim()).filter(Boolean));
    }
    if (Array.isArray(value.texts)) {
      result.texts.push(...value.texts.map((item) => String(item ?? "").trim()).filter(Boolean));
    }
  }

  return result;
}

export function buildComfyuiViewAssetUrl(baseUrl: string, asset: ComfyuiExecutionAsset) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL("view", normalizedBase);
  url.searchParams.set("filename", asset.filename);
  if (asset.subfolder) url.searchParams.set("subfolder", asset.subfolder);
  if (asset.type) url.searchParams.set("type", asset.type);
  if (asset.format) url.searchParams.set("format", asset.format);
  return url.toString();
}

export function selectComfyuiExecutionInstance(input: {
  state: ComfyuiRegistryState;
  workflow: ComfyuiWorkflowDraft;
  requestedInstanceId?: string;
}) {
  const { state, workflow, requestedInstanceId } = input;
  const instances = Array.isArray(state.instances) ? state.instances : [];
  const allowedBindings = Array.isArray(workflow.instanceBindings) && workflow.instanceBindings.length
    ? workflow.instanceBindings.filter((item) => item.enabled !== false)
    : [{ instanceId: workflow.instanceId, enabled: true, isDefault: true }];
  const allowedIds = new Set(allowedBindings.map((item) => item.instanceId).filter(Boolean));
  const candidates = instances.filter((item) => allowedIds.has(item.id));
  const defaultInstanceId = allowedBindings.find((item) => item.isDefault)?.instanceId || workflow.instanceId;
  const preferred = requestedInstanceId
    ? candidates.find((item) => item.id === requestedInstanceId)
    : candidates.find((item) => item.id === defaultInstanceId);
  if (preferred && preferred.health !== "offline") return preferred;
  return candidates.find((item) => item.health === "online")
    || candidates.find((item) => item.health !== "offline")
    || null;
}

export async function submitComfyuiPrompt(baseUrl: string, prompt: Record<string, unknown>) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const response = await fetch(new URL("prompt", normalizedBase), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    throw new Error(`ComfyUI prompt 提交失败: ${response.status}`);
  }
  const payload = await response.json() as ComfyuiSubmitPromptResponse;
  const promptId = String(payload.prompt_id || payload.promptId || "").trim();
  if (!promptId) throw new Error("ComfyUI 未返回 prompt_id");
  return promptId;
}

export async function waitForComfyuiHistory(baseUrl: string, promptId: string, options?: {
  pollIntervalMs?: number;
  timeoutMs?: number;
}) {
  const pollIntervalMs = Math.max(500, Number(options?.pollIntervalMs) || 1500);
  const timeoutMs = Math.max(5_000, Number(options?.timeoutMs) || 120_000);
  const deadline = Date.now() + timeoutMs;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  while (Date.now() < deadline) {
    const response = await fetch(new URL(`history/${encodeURIComponent(promptId)}`, normalizedBase));
    if (!response.ok) {
      throw new Error(`ComfyUI history 查询失败: ${response.status}`);
    }
    const payload = await response.json() as Record<string, unknown>;
    const entry = isRecord(payload[promptId]) ? payload[promptId] : (isRecord(payload) && isRecord(payload.outputs) ? payload : null);
    if (entry) {
      const assets = extractComfyuiResultAssets(entry);
      if (assets.images.length || assets.videos.length || assets.audios.length || assets.texts.length) {
        return entry;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("ComfyUI 执行超时，未拿到 history 输出");
}

function guessUploadFilename(sourceUrl: string, fallbackExt = ".png") {
  const pathname = (() => {
    try {
      return new URL(sourceUrl).pathname;
    } catch {
      return sourceUrl;
    }
  })();
  const ext = extname(pathname) || fallbackExt;
  return `comfyui-input-${Date.now().toString(36)}${ext}`;
}

export async function uploadComfyuiImageInput(baseUrl: string, sourceUrl: string) {
  const source = await fetch(sourceUrl);
  if (!source.ok) throw new Error(`拉取图片输入失败: ${source.status}`);
  const contentType = source.headers.get("content-type") || "image/png";
  const blob = new Blob([await source.arrayBuffer()], { type: contentType });
  const form = new FormData();
  form.append("image", blob, guessUploadFilename(sourceUrl, ".png"));
  form.append("type", "input");
  form.append("overwrite", "true");

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const response = await fetch(new URL("upload/image", normalizedBase), {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(`ComfyUI 图片上传失败: ${response.status}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const filename = String(payload.name || payload.filename || "").trim();
  const subfolder = String(payload.subfolder || "").trim();
  if (!filename) throw new Error("ComfyUI 图片上传未返回文件名");
  return subfolder ? `${subfolder}/${filename}` : filename;
}

export function normalizeComfyuiExecutionMediaInputs(input: unknown): ComfyuiExecutionMediaInputs {
  const payload = isRecord(input) ? input : {};
  return {
    texts: textArray(payload.texts),
    images: textArray(payload.images),
    videos: textArray(payload.videos),
    audios: textArray(payload.audios),
  };
}

export function normalizeComfyuiUserParams(input: unknown) {
  return isRecord(input) ? input : {};
}

export function canRunComfyuiWorkflowOnInstance(
  instance: ComfyuiInstanceRecord | null | undefined,
): instance is ComfyuiInstanceRecord {
  return Boolean(instance && instance.health !== "offline");
}
