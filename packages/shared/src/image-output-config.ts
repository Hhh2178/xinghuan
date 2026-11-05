export interface ExactImagePixelConfig {
  step?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minTotalPixels?: number;
  maxTotalPixels?: number;
  maxAspectRatio?: number;
}

export interface ImageGifSizeConfig {
  step?: number;
  default?: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface ImageOutputConfig {
  size?: {
    allowExactPixels?: boolean;
    exactPixels?: ExactImagePixelConfig;
  };
  staticFormats?: string[];
  gif?: {
    enabled?: boolean;
    allowReferenceImages?: boolean;
    frameCount?: { min?: number; max?: number; step?: number; default?: number };
    frameDurationMs?: { min?: number; max?: number; step?: number; default?: number };
    size?: ImageGifSizeConfig;
  };
}

export interface ImageOutputRequestValues {
  sizeMode?: unknown;
  width?: unknown;
  height?: unknown;
  size?: unknown;
  output_format?: unknown;
  images?: unknown;
  frame_count?: unknown;
  frame_duration_ms?: unknown;
  gif_size?: unknown;
  mask_url?: unknown;
  markup_url?: unknown;
  markup?: unknown;
  output_compression?: unknown;
}

export interface ValidatedImageOutputRequest {
  size?: string;
  outputFormat: string;
  frameCount?: number;
  frameDurationMs?: number;
}

export function normalizeExactImageSize(
  input: { width: unknown; height: unknown },
  config: ExactImagePixelConfig,
): string {
  const width = positiveInteger(input.width, "宽度");
  const height = positiveInteger(input.height, "高度");
  const step = positiveInteger(config.step, "像素步进");
  if (width % step !== 0 || height % step !== 0) {
    throw new Error(`宽高必须是 ${step} 像素的整数倍`);
  }
  if (!within(width, config.minWidth, config.maxWidth) || !within(height, config.minHeight, config.maxHeight)) {
    throw new Error("图像尺寸超出该模型允许的宽高范围");
  }
  const totalPixels = width * height;
  if (!Number.isSafeInteger(totalPixels)
    || !within(totalPixels, config.minTotalPixels, config.maxTotalPixels)) {
    throw new Error("图像总像素数超出该模型允许的范围");
  }
  const maxAspectRatio = finitePositive(config.maxAspectRatio);
  const aspectRatio = Math.max(width / height, height / width);
  if (maxAspectRatio !== undefined && aspectRatio > maxAspectRatio) {
    throw new Error(`宽高比例不能超过 ${maxAspectRatio}:1`);
  }
  return `${width}x${height}`;
}

export function validateImageOutputRequest(
  input: ImageOutputRequestValues,
  config: ImageOutputConfig,
): ValidatedImageOutputRequest {
  const outputFormat = String(input.output_format ?? "png").trim().toLowerCase();
  const isGif = outputFormat === "gif";
  const hasStaticFormatConfig = Array.isArray(config.staticFormats);
  const imageOutputFormats = hasStaticFormatConfig
    ? (config.staticFormats ?? []).map((format) => String(format).trim().toLowerCase())
    : [];
  const imageUrls = Array.isArray(input.images) ? input.images.filter(Boolean) : [];

  if (isGif) {
    if (config.gif?.enabled !== true) throw new Error("当前模型未启用 GIF 生成");
    if (imageUrls.length > 16) throw new Error("参考图最多 16 张");
    if (imageUrls.length > 0 && config.gif.allowReferenceImages !== true) {
      throw new Error("当前 GIF 模式不支持参考图");
    }
    if (input.mask_url || input.markup_url || input.markup || input.output_compression !== undefined) {
      throw new Error("GIF 不支持蒙版、标注或输出压缩参数");
    }
    const frameCount = configuredInteger(
      input.frame_count,
      config.gif.frameCount,
      "GIF 帧数",
    );
    const frameDurationMs = configuredInteger(
      input.frame_duration_ms,
      config.gif.frameDurationMs,
      "GIF 帧时长",
    );
    const size = String(input.gif_size ?? config.gif.size?.default ?? "").trim();
    validateGifSize(size, config.gif.size);
    return { size, outputFormat, frameCount, frameDurationMs };
  }

  if (hasStaticFormatConfig && !imageOutputFormats.includes(outputFormat)) {
    throw new Error(`当前模型不支持 ${outputFormat} 输出格式`);
  }
  if (input.sizeMode === "exact_pixels") {
    const exactPixels = config.size?.exactPixels;
    if (config.size?.allowExactPixels !== true || !exactPixels) {
      throw new Error("当前模型未启用精确像素尺寸");
    }
    return {
      size: normalizeExactImageSize({ width: input.width, height: input.height }, exactPixels),
      outputFormat,
    };
  }
  return { size: String(input.size ?? "").trim() || undefined, outputFormat };
}

function configuredInteger(
  value: unknown,
  range: { min?: number; max?: number; step?: number; default?: number } | undefined,
  label: string,
) {
  const parsed = value === undefined || value === "" ? range?.default : value;
  const number = positiveInteger(parsed, label);
  const min = finitePositive(range?.min);
  const max = finitePositive(range?.max);
  const step = finitePositive(range?.step);
  if (min !== undefined && number < min || max !== undefined && number > max) {
    throw new Error(`${label}超出该模型允许的范围`);
  }
  if (step !== undefined && min !== undefined && (number - min) % step !== 0) {
    throw new Error(`${label}必须按 ${step} 递增`);
  }
  return number;
}

function validateGifSize(
  value: string,
  config: ImageGifSizeConfig | undefined,
) {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) throw new Error("GIF 尺寸必须为宽x高像素值");
  const width = Number(match[1]);
  const height = Number(match[2]);
  const step = finitePositive(config?.step);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || step !== undefined && (width % step !== 0 || height % step !== 0)
    || !within(width, config?.minWidth, config?.maxWidth)
    || !within(height, config?.minHeight, config?.maxHeight)) {
    throw new Error("GIF 单帧尺寸不符合该模型的像素步进或宽高范围");
  }
}

function positiveInteger(value: unknown, label: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label}必须是正整数`);
  return number;
}

function finitePositive(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function within(value: number, minValue: unknown, maxValue: unknown) {
  const min = minValue === undefined ? undefined : Number(minValue);
  const max = maxValue === undefined ? undefined : Number(maxValue);
  return (min === undefined || !Number.isFinite(min) || value >= min)
    && (max === undefined || !Number.isFinite(max) || value <= max);
}
