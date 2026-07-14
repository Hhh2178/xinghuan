import assert from "node:assert/strict";
import {
  getBackendFrameModeOptions,
  normalizeBackendFrameMode,
  resolveBackendVideoInputAssignment,
  resolveVideoPreviewGroups,
  type BackendVideoFrameMode,
} from "../apps/web/src/components/nodes/videoNodeBackendInputs.ts";

const fullCapabilities = {
  prompt: true,
  imageReference: true,
  multiImage: true,
  firstFrame: true,
  lastFrame: true,
  audioReference: true,
};

assert.deepEqual(
  getBackendFrameModeOptions(fullCapabilities).map((item) => item.value),
  ["reference", "first", "firstlast"],
);

assert.deepEqual(
  resolveBackendVideoInputAssignment({
    imageUrls: ["a", "b", "c"],
    frameMode: "first",
    maxReferenceImages: 9,
    inputCapabilities: fullCapabilities,
  }),
  {
    refs: [],
    orderedImages: ["a"],
    firstFrameUrl: "a",
    modeType: "image2video",
    requiredImageCount: 1,
    maxImageCount: 1,
  },
);

assert.deepEqual(
  resolveBackendVideoInputAssignment({
    imageUrls: ["a", "b", "c"],
    frameMode: "firstlast",
    maxReferenceImages: 9,
    inputCapabilities: fullCapabilities,
  }),
  {
    refs: [],
    orderedImages: ["a", "b"],
    firstFrameUrl: "a",
    lastFrameUrl: "b",
    modeType: "frames2video",
    requiredImageCount: 2,
    maxImageCount: 2,
  },
);

assert.deepEqual(
  resolveBackendVideoInputAssignment({
    imageUrls: [],
    frameMode: "reference",
    maxReferenceImages: 9,
    inputCapabilities: fullCapabilities,
  }),
  {
    refs: [],
    orderedImages: [],
    modeType: "text2video",
    requiredImageCount: 0,
    maxImageCount: 9,
  },
);

const referenceAssignment = resolveBackendVideoInputAssignment({
  imageUrls: Array.from({ length: 10 }, (_, index) => `image-${index + 1}`),
  frameMode: "reference",
  maxReferenceImages: 9,
  inputCapabilities: fullCapabilities,
});
assert.equal(referenceAssignment.modeType, "image2video");
assert.equal(referenceAssignment.orderedImages.length, 9);
assert.equal(referenceAssignment.maxImageCount, 9);

const options = getBackendFrameModeOptions(fullCapabilities);
assert.equal(normalizeBackendFrameMode("auto", options), "reference");
assert.equal(normalizeBackendFrameMode("first", options), "first");
assert.equal(normalizeBackendFrameMode("firstlast", options), "firstlast");
assert.equal(normalizeBackendFrameMode("last", options), "firstlast");

const previewGroups = resolveVideoPreviewGroups({
  isBackendSelected: true,
  isJimengSeedanceSelected: false,
  localKind: "seedance",
  showImageMaterials: true,
});
assert.deepEqual(previewGroups, ["text", "image"]);

console.log(JSON.stringify({ ok: true }, null, 2));

void (0 as BackendVideoFrameMode | 0);
