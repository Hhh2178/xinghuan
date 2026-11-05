import { buildApimartImageRequest, validateImageOutputRequest, type ImageOutputConfig } from "@xinghuan/shared";

export function providerHeaders(apiKey: string) {
  return {
    authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`,
    accept: "application/json",
  };
}

export function providerJsonHeaders(apiKey: string) {
  return {
    ...providerHeaders(apiKey),
    "content-type": "application/json",
  };
}

export function openAiEndpoint(baseUrlValue: unknown, pathname: string) {
  const baseUrl = safeText(baseUrlValue).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Provider 请求地址必须以 http:// 或 https:// 开头");
  const normalizedPathname = safeText(pathname);
  if (/^https?:\/\//i.test(normalizedPathname)) return normalizedPathname;
  if (normalizedPathname.startsWith("../") || normalizedPathname.startsWith("./")) {
    return new URL(normalizedPathname, `${baseUrl}/`).toString();
  }
  return baseUrl.endsWith("/v1") ? `${baseUrl}/${normalizedPathname}` : `${baseUrl}/v1/${normalizedPathname}`;
}

export function openAiImageGenerationUrl(baseUrlValue: unknown) {
  return openAiEndpoint(baseUrlValue, "images/generations");
}

export { buildApimartImageRequest };

export function applyImageReferencePayload(
  requestBody: Record<string, unknown>,
  imageUrls: string[],
  isModelScope: boolean,
  protocol: string,
  providerParams: Record<string, unknown>,
  imageOutputConfigValue?: ImageOutputConfig,
) {
  const imageOutputConfig = imageOutputConfigValue
    ?? (providerParams.imageOutputConfig && typeof providerParams.imageOutputConfig === "object"
      ? providerParams.imageOutputConfig as ImageOutputConfig
      : undefined);
  if (imageOutputConfig) {
    const format = safeText(providerParams.output_format, "png").toLowerCase();
    const validated = validateImageOutputRequest({
      ...providerParams,
      sizeMode: providerParams.sizeMode ?? (providerParams.imageSizeMode === "exact" ? "exact_pixels" : providerParams.imageSizeMode),
      width: providerParams.width ?? providerParams.imageWidth,
      height: providerParams.height ?? providerParams.imageHeight,
      size: providerParams.size ?? requestBody.size,
      output_format: format,
      images: imageUrls,
    }, imageOutputConfig);
    requestBody.output_format = validated.outputFormat;
    if (validated.size) requestBody.size = validated.size;
    if (validated.frameCount !== undefined) requestBody.frame_count = validated.frameCount;
    if (validated.frameDurationMs !== undefined) requestBody.frame_duration_ms = validated.frameDurationMs;
  }
  if (protocol === "apimart") {
    if (imageUrls.length) requestBody.image_urls = imageUrls;
    Object.assign(requestBody, buildApimartImageRequest(requestBody, providerParams, imageOutputConfig));
    return;
  }
  if (!imageUrls.length) return;
  requestBody.image = isModelScope && imageUrls.length === 1 ? imageUrls[0] : imageUrls;
  if (isModelScope) {
    requestBody.images = imageUrls;
    requestBody.image_url = imageUrls[0];
    requestBody.image_urls = imageUrls;
  }
}

export function extractChatContent(raw: unknown) {
  const row = plainObject(raw);
  const content = row?.choices && Array.isArray(row.choices)
    ? plainObject(row.choices[0]).message && typeof plainObject(plainObject(row.choices[0]).message).content !== "undefined"
      ? plainObject(plainObject(row.choices[0]).message).content
      : plainObject(row.choices[0]).text
    : row.output_text ?? row.text ?? row.content ?? "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => typeof item === "string" ? item : safeText(plainObject(item).text || plainObject(item).content))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function extractVideoUrls(raw: unknown) {
  const urls: string[] = [];
  collectVideoUrl(raw, urls);
  return [...new Set(urls)];
}

export function extractImageOutputs(raw: unknown) {
  const root = plainObject(raw);
  const imageUrls: string[] = [];
  const remoteImageUrls: string[] = [];
  for (const value of [root.data, root.images, root.output, root.outputs, root.result, root.results, root]) {
    collectImageOutput(value, imageUrls, remoteImageUrls);
  }
  return {
    imageUrls: [...new Set(imageUrls)],
    remoteImageUrls: [...new Set(remoteImageUrls)],
  };
}

function collectVideoUrl(value: unknown, urls: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(value)) urls.push(value);
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

function collectImageOutput(value: unknown, imageUrls: string[], remoteImageUrls: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      imageUrls.push(value);
      remoteImageUrls.push(value);
    } else if (/^data:image\//i.test(value)) {
      imageUrls.push(value);
    } else if (/^[A-Za-z0-9+/=\s]{80,}$/.test(value.trim())) {
      imageUrls.push(`data:image/png;base64,${value.replace(/\s+/g, "")}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageOutput(item, imageUrls, remoteImageUrls);
    return;
  }
  if (typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  for (const key of ["url", "image_url", "imageUrl", "output_url", "outputUrl"]) collectImageOutput(row[key], imageUrls, remoteImageUrls);
  for (const key of ["b64_json", "base64", "image_base64", "imageBase64"]) collectImageOutput(row[key], imageUrls, remoteImageUrls);
  for (const key of ["data", "images", "output", "outputs", "result", "results", "output_images", "outputImages"]) {
    collectImageOutput(row[key], imageUrls, remoteImageUrls);
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}
