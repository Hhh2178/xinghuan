import type { ModelInputCapabilities, VideoInputMode } from "@xinghuan/model-core";

export class VideoInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoInputValidationError";
  }
}

export function validateVideoPromptBytes(prompt: string, maxBytes: number) {
  const byteLength = new TextEncoder().encode(String(prompt || "")).byteLength;
  const limit = nonNegativeInteger(maxBytes);
  if (limit > 0 && byteLength > limit) {
    throw new VideoInputValidationError(`提示词共 ${byteLength} 字节，超过当前模型 ${limit} 字节限制，请缩短后重试`);
  }
  return byteLength;
}

export function resolveVideoPromptByteLimit(protocol: string, configuredValue: unknown) {
  const configured = Number(configuredValue);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  return String(protocol || "").trim().toLowerCase() === "aicopy" ? 4096 : 0;
}

export interface ValidatedVideoInputs {
  mode: VideoInputMode;
  modeType: "text2video" | "image2video" | "frames2video";
  images: string[];
  videos: string[];
  firstFrame?: string;
  lastFrame?: string;
  audios: string[];
}

export function normalizeVideoInputMode(value: unknown): VideoInputMode | undefined {
  return value === "reference" || value === "first" || value === "last" || value === "firstlast" ? value : undefined;
}

export function validateVideoInputs(input: {
  mode: VideoInputMode;
  images: string[];
  videos?: string[];
  audios?: string[];
  capabilities: ModelInputCapabilities;
  maxReferenceImages: number;
  maxReferenceVideos?: number;
  maxReferenceAudios: number;
}): ValidatedVideoInputs {
  const images = cleanValues(input.images);
  const videos = cleanValues(input.videos || []);
  const audios = cleanValues(input.audios || []);
  const { mode, capabilities } = input;

  if (mode === "reference" && images.length > 0 && !capabilities.imageReference) {
    throw new VideoInputValidationError("当前模型未开启参考图能力");
  }
  if (mode === "first" && !capabilities.firstFrame) {
    throw new VideoInputValidationError("当前模型未开启首帧能力");
  }
  if (mode === "last" && !capabilities.lastFrame) {
    throw new VideoInputValidationError("当前模型未开启尾帧能力");
  }
  if (mode === "firstlast" && (!capabilities.firstFrame || !capabilities.lastFrame)) {
    throw new VideoInputValidationError("当前模型未开启首尾帧能力");
  }
  if (mode === "first" && images.length !== 1) {
    throw new VideoInputValidationError("首帧模式需要且只能使用 1 张图片");
  }
  if (mode === "last" && images.length !== 1) {
    throw new VideoInputValidationError("尾帧模式需要且只能使用 1 张图片");
  }
  if (mode === "firstlast" && images.length !== 2) {
    throw new VideoInputValidationError("首尾帧模式需要且只能使用 2 张图片");
  }

  const maxReferenceImages = nonNegativeInteger(input.maxReferenceImages);
  if (mode === "reference" && images.length > maxReferenceImages) {
    throw new VideoInputValidationError(`参考图最多允许 ${maxReferenceImages} 张`);
  }
  if (audios.length > 0 && !capabilities.audioReference) {
    throw new VideoInputValidationError("当前模型未开启参考音频能力");
  }
  if (videos.length > 0 && !capabilities.videoReference) {
    throw new VideoInputValidationError("当前模型未开启参考视频能力");
  }
  const maxReferenceVideos = nonNegativeInteger(input.maxReferenceVideos ?? 0);
  if (videos.length > maxReferenceVideos) {
    throw new VideoInputValidationError(`参考视频最多允许 ${maxReferenceVideos} 条`);
  }
  const maxReferenceAudios = nonNegativeInteger(input.maxReferenceAudios);
  if (audios.length > maxReferenceAudios) {
    throw new VideoInputValidationError(`参考音频最多允许 ${maxReferenceAudios} 条`);
  }

  if (mode === "first") {
    return { mode, modeType: "image2video", images, videos, firstFrame: images[0], audios };
  }
  if (mode === "last") {
    return { mode, modeType: "image2video", images, videos, lastFrame: images[0], audios };
  }
  if (mode === "firstlast") {
    return {
      mode,
      modeType: "frames2video",
      images,
      videos,
      firstFrame: images[0],
      lastFrame: images[1],
      audios,
    };
  }
  return {
    mode,
    modeType: images.length > 0 ? "image2video" : "text2video",
    images,
    videos,
    audios,
  };
}

function cleanValues(values: string[]) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
