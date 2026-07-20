export interface BackendVideoInputCapabilities {
  prompt: boolean;
  imageReference: boolean;
  multiImage: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
  audioReference?: boolean;
  videoReference?: boolean;
}

export type BackendVideoFrameMode = "reference" | "first" | "last" | "firstlast";

export interface BackendVideoFrameModeOption {
  value: BackendVideoFrameMode;
  label: string;
}

export interface BackendVideoInputAssignment {
  refs: string[];
  orderedImages: string[];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  modeType: "text2video" | "image2video" | "frames2video";
  requiredImageCount: 0 | 1 | 2;
  maxImageCount: number;
}

export function getBackendImageSlotCount(
  inputCapabilities: BackendVideoInputCapabilities,
  maxReferenceImages: number,
): number {
  const referenceSlots = inputCapabilities.imageReference ? Math.max(maxReferenceImages, 0) : 0;
  const firstSlots = inputCapabilities.firstFrame ? 1 : 0;
  const lastSlots = inputCapabilities.lastFrame ? 1 : 0;
  const firstLastSlots = inputCapabilities.firstFrame && inputCapabilities.lastFrame ? 2 : 0;
  return Math.max(referenceSlots, firstSlots, lastSlots, firstLastSlots);
}

export function getBackendFrameModeOptions(
  inputCapabilities: BackendVideoInputCapabilities,
): BackendVideoFrameModeOption[] {
  const options: BackendVideoFrameModeOption[] = [];
  if (inputCapabilities.imageReference) {
    options.push({ value: "reference", label: "参考图" });
  }
  if (inputCapabilities.firstFrame) {
    options.push({ value: "first", label: "首帧" });
  }
  if (inputCapabilities.lastFrame) {
    options.push({ value: "last", label: "尾帧" });
  }
  if (inputCapabilities.firstFrame && inputCapabilities.lastFrame) {
    options.push({ value: "firstlast", label: "首尾帧" });
  }
  return options;
}

export function normalizeBackendFrameMode(
  frameMode: string | undefined,
  options: BackendVideoFrameModeOption[],
): BackendVideoFrameMode {
  const requested: BackendVideoFrameMode = frameMode === "first"
    ? "first"
    : frameMode === "last"
      ? "last"
      : frameMode === "firstlast"
        ? "firstlast"
        : "reference";
  return options.some((item) => item.value === requested) ? requested : (options[0]?.value ?? "reference");
}

export function resolveBackendVideoInputAssignment(input: {
  imageUrls: string[];
  frameMode: BackendVideoFrameMode;
  maxReferenceImages: number;
  inputCapabilities: BackendVideoInputCapabilities;
}): BackendVideoInputAssignment {
  const { imageUrls, frameMode, maxReferenceImages, inputCapabilities } = input;
  const referenceLimit = Math.max(0, maxReferenceImages);

  if (frameMode === "first") {
    const firstFrameUrl = imageUrls[0];
    return {
      refs: [],
      orderedImages: firstFrameUrl ? [firstFrameUrl] : [],
      ...(firstFrameUrl ? { firstFrameUrl } : {}),
      modeType: "image2video",
      requiredImageCount: 1,
      maxImageCount: 1,
    };
  }
  if (frameMode === "last") {
    const lastFrameUrl = imageUrls[0];
    return {
      refs: [],
      orderedImages: lastFrameUrl ? [lastFrameUrl] : [],
      ...(lastFrameUrl ? { lastFrameUrl } : {}),
      modeType: "image2video",
      requiredImageCount: 1,
      maxImageCount: 1,
    };
  }
  if (frameMode === "firstlast") {
    const firstFrameUrl = imageUrls[0];
    const lastFrameUrl = imageUrls[1];
    return {
      refs: [],
      orderedImages: [firstFrameUrl, lastFrameUrl].filter((value): value is string => Boolean(value)),
      ...(firstFrameUrl ? { firstFrameUrl } : {}),
      ...(lastFrameUrl ? { lastFrameUrl } : {}),
      modeType: "frames2video",
      requiredImageCount: 2,
      maxImageCount: 2,
    };
  }

  const refs = inputCapabilities.imageReference ? imageUrls.slice(0, referenceLimit) : [];
  return {
    refs,
    orderedImages: refs,
    modeType: refs.length > 0 ? "image2video" : "text2video",
    requiredImageCount: 0,
    maxImageCount: referenceLimit,
  };
}

export function getBackendVideoInputValidationError(input: {
  frameMode: BackendVideoFrameMode;
  imageCount: number;
  videoCount: number;
  audioCount: number;
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
  inputCapabilities: BackendVideoInputCapabilities;
}): string {
  const { frameMode, imageCount, videoCount, audioCount, inputCapabilities } = input;
  if (frameMode === "reference" && imageCount > 0 && !inputCapabilities.imageReference) return "当前模型未开启参考图能力";
  if (frameMode === "first" && !inputCapabilities.firstFrame) return "当前模型未开启首帧能力";
  if (frameMode === "last" && !inputCapabilities.lastFrame) return "当前模型未开启尾帧能力";
  if (frameMode === "firstlast" && (!inputCapabilities.firstFrame || !inputCapabilities.lastFrame)) {
    return "当前模型未开启首尾帧能力";
  }
  if (frameMode === "first" && imageCount !== 1) return "首帧模式需要且只能使用 1 张图片";
  if (frameMode === "last" && imageCount !== 1) return "尾帧模式需要且只能使用 1 张图片";
  if (frameMode === "firstlast" && imageCount !== 2) return "首尾帧模式需要且只能使用 2 张图片";
  const referenceLimit = Math.max(0, input.maxReferenceImages);
  if (frameMode === "reference" && imageCount > referenceLimit) return `参考图最多允许 ${referenceLimit} 张`;
  if (videoCount > 0 && !inputCapabilities.videoReference) return "当前模型未开启参考视频能力";
  if (videoCount > Math.max(0, input.maxReferenceVideos)) return `参考视频最多允许 ${Math.max(0, input.maxReferenceVideos)} 条`;
  if (audioCount > 0 && !inputCapabilities.audioReference) return "当前模型未开启参考音频能力";
  if (audioCount > Math.max(0, input.maxReferenceAudios)) return `参考音频最多允许 ${Math.max(0, input.maxReferenceAudios)} 条`;
  return "";
}

export function resolveVideoPreviewGroups(input: {
  isBackendSelected: boolean;
  isJimengSeedanceSelected: boolean;
  localKind: string;
  showImageMaterials: boolean;
  showVideoMaterials?: boolean;
  showAudioMaterials?: boolean;
}): ReadonlyArray<"text" | "image" | "video" | "audio"> {
  const { isBackendSelected, isJimengSeedanceSelected, localKind, showImageMaterials, showVideoMaterials, showAudioMaterials } = input;
  if (isJimengSeedanceSelected) return ["text", "image", "video", "audio"];
  if (isBackendSelected) {
    return ["text", ...(showImageMaterials ? ["image" as const] : []), ...(showVideoMaterials ? ["video" as const] : []), ...(showAudioMaterials ? ["audio" as const] : [])];
  }
  if (localKind === "seedance") return ["text", "image", "video", "audio"];
  return showImageMaterials ? ["text", "image"] : ["text"];
}
