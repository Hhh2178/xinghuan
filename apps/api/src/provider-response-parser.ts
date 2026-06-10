export interface ImageOutputs {
  urls: string[];
  base64: string[];
}

export function extractChatContent(raw: any) {
  const content = raw?.choices?.[0]?.message?.content ?? raw?.choices?.[0]?.text ?? raw?.output_text ?? raw?.text ?? raw?.content ?? "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => typeof item === "string" ? item : safeText(item?.text || item?.content)).filter(Boolean).join("\n");
  }
  return "";
}

export function extractVideoUrls(raw: unknown) {
  const urls: string[] = [];
  collectVideoUrl(raw, urls);
  return [...new Set(urls)];
}

export function extractImageOutputs(raw: unknown): ImageOutputs {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const candidates = [
    root.data,
    root.images,
    root.output,
    root.outputs,
    root.result,
    root.results,
  ];
  const urls: string[] = [];
  const base64: string[] = [];
  for (const candidate of candidates) collectImageOutput(candidate, urls, base64);
  collectImageOutput(root, urls, base64);
  return {
    urls: [...new Set(urls)],
    base64: [...new Set(base64)],
  };
}

export function looksLikeBase64Image(value: string) {
  return /^[A-Za-z0-9+/=\s]{80,}$/.test(value.trim());
}

export function toImageDataUrl(value: string) {
  if (/^data:image\//i.test(value)) return value;
  return `data:image/png;base64,${value.replace(/\s+/g, "")}`;
}

function collectVideoUrl(value: unknown, urls: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && /\.(mp4|webm|mov)(?:[?#]|$)/i.test(value)) urls.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVideoUrl(item, urls);
    return;
  }
  if (typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  for (const key of ["url", "video_url", "videoUrl", "output_url", "outputUrl", "data", "videos", "output", "outputs", "result", "results"]) {
    collectVideoUrl(row[key], urls);
  }
}

function collectImageOutput(value: unknown, urls: string[], base64: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) urls.push(value);
    else if (/^data:image\//i.test(value) || looksLikeBase64Image(value)) base64.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageOutput(item, urls, base64);
    return;
  }
  if (typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  for (const key of ["url", "image_url", "imageUrl", "output_url", "outputUrl"]) collectImageOutput(row[key], urls, base64);
  for (const key of ["b64_json", "base64", "image_base64", "imageBase64"]) collectImageOutput(row[key], urls, base64);
  for (const key of ["data", "images", "output", "outputs", "result", "results"]) collectImageOutput(row[key], urls, base64);
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}
