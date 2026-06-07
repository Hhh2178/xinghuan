import type { ModelCapability, ProviderProtocol } from "@xinghuan/model-core";

export interface ParsedUpstreamModels {
  total: number;
  all: string[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
}

export function normalizeCapability(value: unknown): ModelCapability {
  const capability = String(value || "").toLowerCase();
  if (capability === "text" || capability === "llm") return "chat";
  return ["chat", "image", "video"].includes(capability) ? (capability as ModelCapability) : "image";
}

export function normalizeProviderProtocol(value: unknown): ProviderProtocol {
  const protocol = String(value || "").toLowerCase();
  return ["openai", "gemini", "runninghub", "volcengine", "apimart", "custom", "grsai_draw"].includes(protocol)
    ? (protocol as ProviderProtocol)
    : "openai";
}

export function normalizeOptionalProtocol(value: unknown) {
  const protocol = String(value || "").toLowerCase();
  return ["openai", "gemini", "runninghub", "volcengine", "apimart", "custom", "grsai_draw"].includes(protocol) ? protocol : "";
}

export function providerModelsUrl(baseUrlValue: unknown, protocolValue: unknown) {
  const baseUrl = safeText(baseUrlValue).replace(/\/+$/, "");
  const protocol = normalizeProviderProtocol(protocolValue);
  if (!baseUrl) return "";
  if (protocol === "grsai_draw") return "";
  if (protocol === "gemini") return baseUrl.endsWith("/v1beta") ? `${baseUrl}/models` : `${baseUrl}/v1beta/models`;
  if (protocol === "volcengine") return baseUrl.endsWith("/api/v3") ? `${baseUrl}/models` : `${baseUrl}/api/v3/models`;
  if (protocol === "runninghub") return `${baseUrl}/openapi/v2/models`;
  return baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
}

export function providerModelHeaders(apiKey: string, protocolValue: unknown): Record<string, string> {
  const protocol = normalizeProviderProtocol(protocolValue);
  if (protocol === "gemini") return { "x-goog-api-key": apiKey, accept: "application/json" };
  if (protocol === "runninghub") return { authorization: apiKey.replace(/^Bearer\s+/i, ""), accept: "application/json" };
  return { authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`, accept: "application/json" };
}

export function classifyUpstreamModel(modelId: unknown): ModelCapability {
  const value = String(modelId || "").toLowerCase();
  const videoKeys = ["veo", "sora", "wan2", "wanx", "seedance", "kling", "hailuo", "video", "t2v-", "i2v-", "s2v"];
  if (videoKeys.some((key) => value.includes(key))) return "video";
  const imageKeys = ["banana", "image", "dalle", "dall-e", "imagen", "flux", "stable", "sdxl", "midjourney", "nano-banana", "ideogram", "fal-ai", "z-image", "qwen-image", "klein", "seedream", "text-to-image", "image-to-image"];
  if (imageKeys.some((key) => value.includes(key))) return "image";
  return "chat";
}

export function parseUpstreamModels(raw: unknown, protocolValue: unknown): ParsedUpstreamModels {
  const protocol = normalizeProviderProtocol(protocolValue);
  const object = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawItems = Array.isArray(object.data)
    ? object.data
    : Array.isArray(object.models)
      ? object.models
      : Array.isArray(object.list)
        ? object.list
        : [];
  const ids = new Set<string>();
  for (const item of rawItems) {
    let modelId = "";
    if (typeof item === "string") modelId = item;
    else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      modelId = safeText(row.id || row.name || row.model);
    }
    if (protocol === "gemini" && modelId.startsWith("models/")) modelId = modelId.slice("models/".length);
    if (modelId) ids.add(modelId);
  }
  const all = [...ids].sort();
  const grouped: Record<ModelCapability, string[]> = { chat: [], image: [], video: [] };
  for (const modelId of all) grouped[classifyUpstreamModel(modelId)].push(modelId);
  return { total: all.length, all, chatModels: grouped.chat, imageModels: grouped.image, videoModels: grouped.video };
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}
