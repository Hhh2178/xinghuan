import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const generationDrawerSource = await readFile(
  new URL("../apps/web/src/components/GenerationLibraryDrawer.tsx", import.meta.url),
  "utf8",
);
const generationOverlaySource = await readFile(
  new URL("../apps/web/src/components/GenerationLibraryPreviewOverlay.tsx", import.meta.url),
  "utf8",
);

assert.match(
  generationDrawerSource,
  /ResourceMediaCard/,
  "generation library should reuse the shared resource media card shell",
);
assert.match(
  `${generationDrawerSource}\n${generationOverlaySource}`,
  /ResourcePreviewOverlay/,
  "generation library preview flow should reuse the shared resource preview overlay",
);
assert.match(generationDrawerSource, /下载/, "generation library should preserve a download action");
assert.match(generationDrawerSource, /查看|预览/, "generation library should preserve a preview action");
assert.doesNotMatch(generationDrawerSource, /object-cover/, "generation library cards should not crop generated media");
assert.match(generationDrawerSource, /object-contain/, "generation library cards should show complete media");
assert.match(generationDrawerSource, /miniActionBase/, "generation library should use resource-library style circular icon actions");

console.log("PASS generation library resource card contract");
