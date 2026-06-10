export interface BackendVideoInputCapabilities {
  prompt: boolean;
  imageReference: boolean;
  multiImage: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
}

export type BackendVideoFrameMode = "auto" | "first" | "last" | "firstlast";

export interface BackendVideoFrameModeOption {
  value: BackendVideoFrameMode;
  label: string;
}

export interface BackendVideoInputAssignment {
  refs: string[];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
}

export function getBackendImageSlotCount(
  inputCapabilities: BackendVideoInputCapabilities,
  maxReferenceImages: number,
): number {
  const referenceSlots = inputCapabilities.imageReference
    ? inputCapabilities.multiImage
      ? Math.max(maxReferenceImages || 1, 1)
      : 1
    : 0;
  return referenceSlots + (inputCapabilities.firstFrame ? 1 : 0) + (inputCapabilities.lastFrame ? 1 : 0);
}

export function getBackendFrameModeOptions(
  inputCapabilities: BackendVideoInputCapabilities,
): BackendVideoFrameModeOption[] {
  const options: BackendVideoFrameModeOption[] = [];
  if (inputCapabilities.imageReference) {
    options.push({ value: "auto", label: "全部作参考图" });
  }
  if (inputCapabilities.firstFrame) {
    options.push({
      value: "first",
      label: inputCapabilities.imageReference ? "首帧 + 其余参考图" : "首帧",
    });
  }
  if (inputCapabilities.lastFrame) {
    options.push({
      value: "last",
      label: inputCapabilities.imageReference ? "尾帧 + 其余参考图" : "尾帧",
    });
  }
  if (inputCapabilities.firstFrame && inputCapabilities.lastFrame) {
    options.push({
      value: "firstlast",
      label: inputCapabilities.imageReference ? "首帧 + 尾帧 + 其余参考图" : "首帧 + 尾帧",
    });
  }
  return options;
}

export function normalizeBackendFrameMode(
  frameMode: string | undefined,
  options: BackendVideoFrameModeOption[],
): BackendVideoFrameMode {
  const requested = frameMode === "first" || frameMode === "last" || frameMode === "firstlast" ? frameMode : "auto";
  return options.some((item) => item.value === requested) ? requested : (options[0]?.value ?? "auto");
}

export function resolveBackendVideoInputAssignment(input: {
  imageUrls: string[];
  frameMode: BackendVideoFrameMode;
  maxReferenceImages: number;
  inputCapabilities: BackendVideoInputCapabilities;
}): BackendVideoInputAssignment {
  const { imageUrls, frameMode, maxReferenceImages, inputCapabilities } = input;
  const incomingImages = imageUrls.slice(0, Math.max(getBackendImageSlotCount(inputCapabilities, maxReferenceImages), 1));
  const assignment: BackendVideoInputAssignment = { refs: [...incomingImages] };

  if (inputCapabilities.firstFrame && (frameMode === "first" || frameMode === "firstlast") && assignment.refs.length > 0) {
    assignment.firstFrameUrl = assignment.refs.shift();
  }
  if (inputCapabilities.lastFrame && (frameMode === "last" || frameMode === "firstlast") && assignment.refs.length > 0) {
    assignment.lastFrameUrl = assignment.refs.shift();
  }

  if (!inputCapabilities.imageReference) {
    assignment.refs = [];
  } else if (!inputCapabilities.multiImage) {
    assignment.refs = assignment.refs.slice(0, 1);
  } else {
    assignment.refs = assignment.refs.slice(0, Math.max(maxReferenceImages || assignment.refs.length, 0));
  }

  return assignment;
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
