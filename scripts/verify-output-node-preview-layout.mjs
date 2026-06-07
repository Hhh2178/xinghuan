import assert from "node:assert/strict";
import { computeOutputPreviewFrameHeight } from "../apps/web/src/components/nodes/outputPreviewLayout.ts";

function run() {
  const portraitSingle = computeOutputPreviewFrameHeight({
    nodeWidth: 320,
    nodeHeight: 1080,
    mediaWidth: 1024,
    mediaHeight: 1536,
    multiItem: false,
  });
  assert.equal(
    portraitSingle,
    420,
    "single portrait image should use media-fit height instead of inheriting the full node height",
  );

  const landscapeSingle = computeOutputPreviewFrameHeight({
    nodeWidth: 320,
    nodeHeight: 920,
    mediaWidth: 1920,
    mediaHeight: 1080,
    multiItem: false,
  });
  assert.equal(
    landscapeSingle,
    180,
    "single landscape video should shrink to its fitted height instead of leaving a tall empty panel",
  );

  const multiImage = computeOutputPreviewFrameHeight({
    nodeWidth: 320,
    nodeHeight: 920,
    mediaWidth: 1024,
    mediaHeight: 1536,
    multiItem: true,
  });
  assert.equal(multiImage, 140, "multi-item grid cards should keep the compact fixed height");

  console.log("PASS output node preview layout uses media-fit heights");
}

run();
