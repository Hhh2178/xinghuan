export interface BackendVideoInputCapabilities {
  prompt: boolean;
  imageReference: boolean;
  multiImage: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
  audioReference?: boolean;
}

export type BackendVideoFrameMode = "reference" | "first" | "firstlast";

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
  const referenceSlots = inputCapabilities.imageReference
    ? inputCapabilities.multiImage
      ? Math.max(maxReferenceImages, 0)
      : Math.min(1, Math.max(maxReferenceImages, 0))
    : 0;
  const firstSlots = inputCapabilities.firstFrame ? 1 : 0;
  const firstLastSlots = inputCapabilities.firstFrame && inputCapabilities.lastFrame ? 2 : 0;
  return Math.max(referenceSlots, firstSlots, firstLastSlots);
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
    : frameMode === "firstlast" || frameMode === "last"
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
  const referenceLimit = inputCapabilities.multiImage
    ? Math.max(0, maxReferenceImages)
    : Math.min(1, Math.max(0, maxReferenceImages));

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

export function resolveVideoPreviewGroups(input: {
  isBackendSelected: boolean;
  isJimengSeedanceSelected: boolean;
  localKind: string;
  showImageMaterials: boolean;
}): ReadonlyArray<"text" | "image" | "video" | "audio"> {
  const { isBackendSelected, isJimengSeedanceSelected, localKind, showImageMaterials } = input;
  if (isJimengSeedanceSelected) return ["text", "image", "video", "audio"];
  if (isBackendSelected) return showImageMaterials ? ["text", "image"] : ["text"];
  if (localKind === "seedance") return ["text", "image", "video", "audio"];
  return showImageMaterials ? ["text", "image"] : ["text"];
}
