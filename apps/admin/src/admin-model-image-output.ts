export type ImageStaticFormat = "png" | "jpeg" | "webp" | "svg";

export interface ImageOutputFormValue {
  configured: boolean;
  aspectRatios: string[];
  sizes: string[];
  allowExactPixels: boolean;
  exactPixels: {
    step: string;
    minWidth: string;
    maxWidth: string;
    minHeight: string;
    maxHeight: string;
    minTotalPixels: string;
    maxTotalPixels: string;
    maxAspectRatio: string;
  };
  staticFormats: ImageStaticFormat[];
  gif: {
    enabled: boolean;
    allowReferenceImages: boolean;
    frameCountMin: string;
    frameCountMax: string;
    frameCountStep: string;
    frameCountDefault: string;
    durationMin: string;
    durationMax: string;
    durationStep: string;
    durationDefault: string;
    sizeStep: string;
    sizeDefault: string;
  };
}

const DEFAULT_FORM: ImageOutputFormValue = {
  configured: false,
  aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
  sizes: ["1024x1024", "1536x1024", "1024x1536"],
  allowExactPixels: false,
  exactPixels: {
    step: "16", minWidth: "16", maxWidth: "3840", minHeight: "16", maxHeight: "3840",
    minTotalPixels: "655360", maxTotalPixels: "8294400", maxAspectRatio: "3",
  },
  staticFormats: ["png"],
  gif: {
    enabled: false, allowReferenceImages: false, frameCountMin: "2", frameCountMax: "16",
    frameCountStep: "1", frameCountDefault: "9", durationMin: "20", durationMax: "2000",
    durationStep: "10", durationDefault: "200", sizeStep: "16", sizeDefault: "512x512",
  },
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback: string): string {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function list(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function parseSchema(parameterSchema: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(parameterSchema || "{}");
    return object(parsed);
  } catch {
    return {};
  }
}

export function readImageOutputConfig(parameterSchema: string): ImageOutputFormValue {
  const schema = parseSchema(parameterSchema);
  const output = object(schema.imageOutput);
  const size = object(output.size);
  const exact = object(size.exactPixels);
  const gif = object(output.gif);
  const frameCount = object(gif.frameCount);
  const frameDuration = object(gif.frameDurationMs);
  const gifSize = object(gif.size);
  const rawFormats = Array.isArray(output.staticFormats) ? output.staticFormats : [];
  const formats = rawFormats.filter((item): item is ImageStaticFormat =>
    item === "png" || item === "jpeg" || item === "webp" || item === "svg");

  return {
    ...DEFAULT_FORM,
    configured: Object.keys(output).length > 0,
    aspectRatios: list(object(schema.aspectRatio).options, DEFAULT_FORM.aspectRatios),
    sizes: list(object(schema.size).options, DEFAULT_FORM.sizes),
    allowExactPixels: size.allowExactPixels === true,
    exactPixels: {
      step: text(exact.step, DEFAULT_FORM.exactPixels.step),
      minWidth: text(exact.minWidth, DEFAULT_FORM.exactPixels.minWidth),
      maxWidth: text(exact.maxWidth, DEFAULT_FORM.exactPixels.maxWidth),
      minHeight: text(exact.minHeight, DEFAULT_FORM.exactPixels.minHeight),
      maxHeight: text(exact.maxHeight, DEFAULT_FORM.exactPixels.maxHeight),
      minTotalPixels: text(exact.minTotalPixels, DEFAULT_FORM.exactPixels.minTotalPixels),
      maxTotalPixels: text(exact.maxTotalPixels, DEFAULT_FORM.exactPixels.maxTotalPixels),
      maxAspectRatio: text(exact.maxAspectRatio, DEFAULT_FORM.exactPixels.maxAspectRatio),
    },
    staticFormats: formats.length ? formats : [...DEFAULT_FORM.staticFormats],
    gif: {
      enabled: gif.enabled === true,
      allowReferenceImages: gif.allowReferenceImages === true,
      frameCountMin: text(frameCount.min, DEFAULT_FORM.gif.frameCountMin),
      frameCountMax: text(frameCount.max, DEFAULT_FORM.gif.frameCountMax),
      frameCountStep: text(frameCount.step, DEFAULT_FORM.gif.frameCountStep),
      frameCountDefault: text(frameCount.default, DEFAULT_FORM.gif.frameCountDefault),
      durationMin: text(frameDuration.min, DEFAULT_FORM.gif.durationMin),
      durationMax: text(frameDuration.max, DEFAULT_FORM.gif.durationMax),
      durationStep: text(frameDuration.step, DEFAULT_FORM.gif.durationStep),
      durationDefault: text(frameDuration.default, DEFAULT_FORM.gif.durationDefault),
      sizeStep: text(gifSize.step, DEFAULT_FORM.gif.sizeStep),
      sizeDefault: text(gifSize.default, DEFAULT_FORM.gif.sizeDefault),
    },
  };
}

export function parseImageOutputList(value: string): string[] {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter((item, index, all) => Boolean(item) && all.indexOf(item) === index);
}

export function validateImageOutputConfig(value: ImageOutputFormValue): string {
  const ratios = value.aspectRatios;
  if (!ratios.length || ratios.some((item) => {
    const match = /^(\d{1,3}):(\d{1,3})$/.exec(item);
    return !match || Number(match[1]) <= 0 || Number(match[2]) <= 0;
  })) return "画幅比例需填写有效的宽:高比例，例如 16:9。";
  if (!value.sizes.length || value.sizes.some((item) => !/^[A-Za-z0-9._-]{1,32}$/.test(item))) return "尺寸档位不能为空且只能使用字母、数字、点、下划线或连字符。";

  if (!value.configured) return "";
  if (!value.staticFormats.length) return "至少选择一种静态图片格式。";
  const exact = value.exactPixels;
  const positiveIntegers = [exact.step, exact.minWidth, exact.maxWidth, exact.minHeight, exact.maxHeight, exact.minTotalPixels, exact.maxTotalPixels];
  if (value.allowExactPixels && positiveIntegers.some((item) => !Number.isSafeInteger(Number(item)) || Number(item) <= 0)) {
    return "精确像素步长、边界和像素总量必须是正整数。";
  }
  if (value.allowExactPixels && (Number(exact.minWidth) > Number(exact.maxWidth) || Number(exact.minHeight) > Number(exact.maxHeight) || Number(exact.minTotalPixels) > Number(exact.maxTotalPixels))) {
    return "精确像素最小值不能大于最大值。";
  }
  if (value.allowExactPixels && (!Number.isFinite(Number(exact.maxAspectRatio)) || Number(exact.maxAspectRatio) <= 0)) return "最大长宽比必须是正数。";
  const gif = value.gif;
  if (gif.enabled) {
    const nums = [gif.frameCountMin, gif.frameCountMax, gif.frameCountStep, gif.frameCountDefault, gif.durationMin, gif.durationMax, gif.durationStep, gif.durationDefault, gif.sizeStep];
    if (nums.some((item) => !Number.isSafeInteger(Number(item)) || Number(item) <= 0)) return "GIF 帧数、时长和尺寸步长必须是正整数。";
    if (Number(gif.frameCountMin) > Number(gif.frameCountMax) || Number(gif.frameCountDefault) < Number(gif.frameCountMin) || Number(gif.frameCountDefault) > Number(gif.frameCountMax)) return "GIF 默认帧数必须在配置的帧数范围内。";
    if (Number(gif.durationMin) > Number(gif.durationMax) || Number(gif.durationDefault) < Number(gif.durationMin) || Number(gif.durationDefault) > Number(gif.durationMax)) return "GIF 默认帧时长必须在配置的时长范围内。";
    if ((Number(gif.frameCountDefault) - Number(gif.frameCountMin)) % Number(gif.frameCountStep) !== 0 || (Number(gif.durationDefault) - Number(gif.durationMin)) % Number(gif.durationStep) !== 0) return "GIF 默认帧数和时长必须符合各自配置的步长。";
    const match = /^(\d+)x(\d+)$/i.exec(gif.sizeDefault.trim());
    if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0 || Number(match[1]) % Number(gif.sizeStep) !== 0 || Number(match[2]) % Number(gif.sizeStep) !== 0) return "GIF 默认单帧尺寸需为宽x高格式，且宽高都符合像素步长。";
  }
  return "";
}

export function writeImageOutputConfig(parameterSchema: string, formValue: ImageOutputFormValue): string {
  const schema = parseSchema(parameterSchema);
  const oldOutput = object(schema.imageOutput);
  const oldSize = object(oldOutput.size);
  const oldExact = object(oldSize.exactPixels);
  const oldGif = object(oldOutput.gif);
  const oldFrameCount = object(oldGif.frameCount);
  const oldFrameDuration = object(oldGif.frameDurationMs);
  const oldGifSize = object(oldGif.size);
  const next = { ...schema };
  if (!formValue.configured) {
    delete next.imageOutput;
    return JSON.stringify(next, null, 2);
  }
  next.imageOutput = {
    ...oldOutput,
    size: {
      ...oldSize,
      allowExactPixels: formValue.allowExactPixels,
      ...(formValue.allowExactPixels ? { exactPixels: {
        ...oldExact,
        step: Number(formValue.exactPixels.step), minWidth: Number(formValue.exactPixels.minWidth),
        maxWidth: Number(formValue.exactPixels.maxWidth), minHeight: Number(formValue.exactPixels.minHeight),
        maxHeight: Number(formValue.exactPixels.maxHeight), minTotalPixels: Number(formValue.exactPixels.minTotalPixels),
        maxTotalPixels: Number(formValue.exactPixels.maxTotalPixels), maxAspectRatio: Number(formValue.exactPixels.maxAspectRatio),
      } } : {}),
    },
    staticFormats: [...formValue.staticFormats],
    gif: {
      ...oldGif,
      enabled: formValue.gif.enabled,
      allowReferenceImages: formValue.gif.allowReferenceImages,
      frameCount: { ...oldFrameCount, min: Number(formValue.gif.frameCountMin), max: Number(formValue.gif.frameCountMax), step: Number(formValue.gif.frameCountStep), default: Number(formValue.gif.frameCountDefault) },
      frameDurationMs: { ...oldFrameDuration, min: Number(formValue.gif.durationMin), max: Number(formValue.gif.durationMax), step: Number(formValue.gif.durationStep), default: Number(formValue.gif.durationDefault) },
      size: { ...oldGifSize, step: Number(formValue.gif.sizeStep), default: formValue.gif.sizeDefault.trim() },
    },
  };
  return JSON.stringify(next, null, 2);
}

export function syncImagePresetOptions(parameterSchema: string, formValue: ImageOutputFormValue): string {
  const schema = parseSchema(parameterSchema);
  return JSON.stringify({
    ...schema,
    aspectRatio: { ...object(schema.aspectRatio), options: [...formValue.aspectRatios] },
    size: { ...object(schema.size), options: [...formValue.sizes] },
  }, null, 2);
}
