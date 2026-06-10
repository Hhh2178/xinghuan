import {
  getBackendFrameModeOptions,
  resolveBackendVideoInputAssignment,
  resolveVideoPreviewGroups,
  type BackendVideoFrameMode,
} from "../apps/web/src/components/nodes/videoNodeBackendInputs.ts";

const checks: Array<[string, boolean]> = [];

const lastOnlyOptions = getBackendFrameModeOptions({
  prompt: true,
  imageReference: false,
  multiImage: false,
  firstFrame: false,
  lastFrame: true,
});
check("Last-frame-only backend model exposes last mode", lastOnlyOptions.length === 1 && lastOnlyOptions[0]?.value === "last");

const fullOptions = getBackendFrameModeOptions({
  prompt: true,
  imageReference: true,
  multiImage: true,
  firstFrame: true,
  lastFrame: true,
});
check(
  "Backend frame mode options expose auto/first/last/firstlast",
  fullOptions.map((item) => item.value).join(",") === "auto,first,last,firstlast",
);

const lastOnlyAssignment = resolveBackendVideoInputAssignment({
  imageUrls: ["first-image", "second-image"],
  frameMode: "last",
  maxReferenceImages: 1,
  inputCapabilities: {
    prompt: true,
    imageReference: false,
    multiImage: false,
    firstFrame: false,
    lastFrame: true,
  },
});
check(
  "Last-frame-only backend model routes first image to last_frame",
  lastOnlyAssignment.lastFrameUrl === "first-image" &&
    !lastOnlyAssignment.firstFrameUrl &&
    lastOnlyAssignment.refs.length === 0,
);

const firstLastAssignment = resolveBackendVideoInputAssignment({
  imageUrls: ["frame-1", "frame-2", "ref-1", "ref-2", "ref-3"],
  frameMode: "firstlast",
  maxReferenceImages: 2,
  inputCapabilities: {
    prompt: true,
    imageReference: true,
    multiImage: true,
    firstFrame: true,
    lastFrame: true,
  },
});
check(
  "Backend firstlast mode reserves frame images before reference images",
  firstLastAssignment.firstFrameUrl === "frame-1" &&
    firstLastAssignment.lastFrameUrl === "frame-2" &&
    firstLastAssignment.refs.join(",") === "ref-1,ref-2",
);

const previewGroups = resolveVideoPreviewGroups({
  isBackendSelected: true,
  isJimengSeedanceSelected: false,
  localKind: "seedance",
  showImageMaterials: true,
});
check(
  "Backend-selected video node preview groups stay image-only even if local model is seedance",
  previewGroups.join(",") === "text,image",
);

for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

if (checks.some(([, ok]) => !ok)) process.exit(1);

function check(name: string, ok: boolean) {
  checks.push([name, Boolean(ok)]);
}

void (0 as BackendVideoFrameMode | 0);
