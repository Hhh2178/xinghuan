import { validateImageOutputRequest, type ImageOutputConfig } from "./image-output-config.js";

const supportedApimartImageRatios = new Set([
  "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16",
  "2:1", "1:2", "21:9", "9:21", "3:1", "1:3",
]);

export function buildApimartImageRequest(
  base: Record<string, unknown>,
  payload: Record<string, unknown>,
  imageOutputConfig?: ImageOutputConfig,
) {
  const body = { ...base };
  delete body.imageOutputConfig;
  delete body.imageSizeMode;
  delete body.imageWidth;
  delete body.imageHeight;
  const images = Array.isArray(payload.images)
    ? payload.images.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  if (images.length) body.image_urls = images;
  const allowed = [
    "resolution", "quality", "output_format", "output_compression", "background", "moderation",
    "mask_url", "complexity", "safety_identifier", "markup_url", "markup", "frame_count",
    "frame_duration_ms", "svg",
  ];
  for (const key of allowed) {
    if (payload[key] !== undefined && payload[key] !== "") body[key] = payload[key];
  }
  if (!/^gpt-image-2\.6-(flare|sunburst)$/i.test(text(base.model))) return body;

  const requestedSize = text(payload.size || base.size);
  const requestedAspectRatio = text(payload.aspectRatio || payload.aspect_ratio || base.aspectRatio || base.aspect_ratio);
  if (requestedSize) body.size = requestedSize;
  if ((!requestedSize || requestedSize === "auto") && requestedAspectRatio) body.size = requestedAspectRatio;
  // APIMart GPT-Image-2.6 uses `size`; its OpenAI-compatible `aspect_ratio` alias is unsupported.
  delete body.aspect_ratio;
  delete body.aspectRatio;

  const format = text(body.output_format || "png").toLowerCase();
  body.output_format = format;
  if (imageOutputConfig) {
    const validated = validateImageOutputRequest({
      ...payload,
      sizeMode: payload.sizeMode ?? (payload.imageSizeMode === "exact" ? "exact_pixels" : payload.imageSizeMode),
      width: payload.width ?? payload.imageWidth,
      height: payload.height ?? payload.imageHeight,
      size: payload.size ?? base.size,
      output_format: format,
    }, imageOutputConfig);
    if (validated.size) body.size = validated.size;
    if (validated.outputFormat) body.output_format = validated.outputFormat;
    if (validated.frameCount !== undefined) body.frame_count = validated.frameCount;
    if (validated.frameDurationMs !== undefined) body.frame_duration_ms = validated.frameDurationMs;
  }
  if (format === "gif") {
    body.size = text(payload.gif_size || payload.size || body.size)
      || imageOutputConfig?.gif?.size?.default
      || "512x512";
    delete body.resolution;
  }
  const hasMarkup = Boolean(body.markup_url || body.markup);
  const count = Number(body.n);
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error("生成数量必须为 1–4 的整数");
  if (images.length > 16) throw new Error("参考图最多 16 张");
  if (images.some((image) => !isHttpUrl(image))) throw new Error("参考图必须是公网可访问的 HTTP(S) 图片链接");
  if (!["png", "jpeg", "webp", "gif", "svg"].includes(format)) throw new Error("不支持的图片格式");
  for (const [key, values] of Object.entries({
    quality: ["low", "medium", "high", "xhigh", "max", "auto"],
    resolution: ["1k", "2k", "4k"],
    moderation: ["low", "auto"],
    complexity: ["low", "medium", "high"],
    background: ["transparent", "opaque", "auto"],
  })) {
    if (body[key] !== undefined && !values.includes(text(body[key]))) throw new Error(`无效的 ${key}`);
  }
  if (body.output_compression !== undefined && (
    !["jpeg", "webp"].includes(format)
    || !Number.isInteger(body.output_compression)
    || Number(body.output_compression) < 0
    || Number(body.output_compression) > 100
  )) throw new Error("压缩参数仅支持 JPEG/WebP，范围为 0–100");
  if (body.background === "transparent" && !["png", "webp"].includes(format)) throw new Error("透明背景仅支持 PNG/WebP");
  if (body.safety_identifier !== undefined
    && (typeof body.safety_identifier !== "string" || body.safety_identifier.length > 128)) {
    throw new Error("safety_identifier 必须为不超过 128 个字符的字符串");
  }
  if (body.mask_url !== undefined && body.mask_url !== ""
    && (typeof body.mask_url !== "string" || (!isHttpUrl(body.mask_url) && !isPngDataUrl(body.mask_url)))) {
    throw new Error("mask_url 必须为 HTTP(S) 图片链接或 PNG Data URL");
  }
  if (body.markup_url !== undefined && body.markup_url !== ""
    && (typeof body.markup_url !== "string" || (!isHttpsUrl(body.markup_url) && !isBase64PngDataUrl(body.markup_url)))) {
    throw new Error("markup_url 必须为 HTTPS 图片链接或 Base64 Data URL");
  }
  if ((body.mask_url || hasMarkup) && !images.length) throw new Error("蒙版或标注需要参考图");
  if (body.mask_url && hasMarkup) throw new Error("蒙版与标注不能同时使用");
  if (body.markup && typeof body.markup === "object" && body.markup !== null && !Array.isArray(body.markup)
    && "file_id" in body.markup) throw new Error("标注层不支持 file_id");
  if (body.markup) {
    const markupReference = typeof body.markup === "string" ? body.markup : text(object(body.markup).image_url);
    if (!markupReference || (!isHttpsUrl(markupReference) && !isBase64PngDataUrl(markupReference))) {
      throw new Error("markup 必须是 HTTPS 图片链接或 Base64 Data URL");
    }
  }
  const gifReferencesEnabled = imageOutputConfig?.gif?.enabled === true
    && imageOutputConfig.gif.allowReferenceImages === true;
  if ((format === "svg" && images.length)
    || (format === "gif" && images.length && !gifReferencesEnabled)
    || (["gif", "svg"].includes(format) && (body.mask_url || hasMarkup || body.output_compression !== undefined))) {
    throw new Error(format === "gif" ? "GIF 不支持蒙版、标注或输出压缩参数" : "SVG 仅支持文生图且不支持蒙版、标注或输出压缩参数");
  }
  if (format === "svg" && (count !== 1 || !text(object(body.svg).model))) {
    throw new Error("SVG 需要文本模型且数量必须为 1");
  }
  if (format === "gif") {
    const frameCount = body.frame_count === undefined ? 9 : body.frame_count;
    const frameDuration = body.frame_duration_ms === undefined ? 200 : body.frame_duration_ms;
    if (typeof frameCount !== "number" || !Number.isInteger(frameCount) || frameCount < 2 || frameCount > 16) {
      throw new Error("GIF 帧数必须为 2–16");
    }
    if (typeof frameDuration !== "number" || !Number.isInteger(frameDuration) || frameDuration < 20) {
      throw new Error("GIF 帧时长必须为至少 20 毫秒的整数");
    }
    body.frame_duration_ms = Math.max(20, Math.round(frameDuration / 10) * 10);
    const size = text(body.size || "512x512");
    const match = size === "auto" ? ["", "512", "512"] : /^(\d+)x(\d+)$/i.exec(size);
    if (!match) throw new Error("GIF 尺寸必须为像素尺寸或 auto");
    const width = Number(match[1]);
    const height = Number(match[2]);
    const [columns, rows] = frameCount <= 8 ? [4, 2] : frameCount === 9 ? [3, 3] : frameCount <= 12 ? [4, 3] : [4, 4];
    const validSheet = (w: number, h: number) => Math.max(w, h) <= 3840
      && w * h <= 8_294_400
      && Math.max(w, h) <= 3 * Math.min(w, h);
    if (!width || !height || width % 16 || height % 16
      || (!validSheet(width * columns, height * rows) && !validSheet(width * rows, height * columns))) {
      throw new Error("GIF 帧数与尺寸超出拼图限制");
    }
    return body;
  }

  const size = text(body.size || "auto");
  if (size !== "auto" && !supportedApimartImageRatios.has(size)) {
    const match = /^(\d+)x(\d+)$/i.exec(size);
    if (!match) throw new Error("静态图片尺寸必须为支持的比例、像素尺寸或 auto");
    const width = Number(match[1]);
    const height = Number(match[2]);
    const pixels = width * height;
    if (!Number.isSafeInteger(pixels) || width % 16 || height % 16
      || Math.max(width, height) > 3840
      || Math.max(width, height) > 3 * Math.min(width, height)
      || pixels < 655_360 || pixels > 8_294_400) {
      throw new Error("静态图片像素尺寸超出 APIMart GPT-Image-2.6 限制");
    }
  }
  return body;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isPngDataUrl(value: string) {
  return /^data:image\/png(?:;[^,]*)?,/i.test(value);
}

function isBase64PngDataUrl(value: string) {
  return /^data:image\/png;base64,/i.test(value);
}
