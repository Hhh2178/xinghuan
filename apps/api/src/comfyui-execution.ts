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

interface ComfyuiSubmitPromptResponse {
  prompt_id?: string;
  promptId?: string;
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

export function buildComfyuiExecutionPrompt(input: {
  workflowJson: Record<string, unknown>;
  inputSchema: ComfyuiWorkflowInputSchemaItem[];
  defaultValues: Record<string, unknown>;
  userParams?: Record<string, unknown>;
  mediaInputs?: ComfyuiExecutionMediaInputs;
}) {
  const workflowJson = cloneJson(input.workflowJson);
  const userParams = isRecord(input.userParams) ? input.userParams : {};
  const mediaInputs = input.mediaInputs || {};

  for (const field of input.inputSchema || []) {
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
  const preferred = requestedInstanceId
    ? instances.find((item) => item.id === requestedInstanceId)
    : instances.find((item) => item.id === workflow.instanceId);
  if (preferred && preferred.health !== "offline") return preferred;
  return instances.find((item) => item.health === "online")
    || instances.find((item) => item.health !== "offline")
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
