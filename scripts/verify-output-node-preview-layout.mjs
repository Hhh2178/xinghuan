import assert from "node:assert/strict";
import {
  computeOutputGridColumns,
  computeOutputGridLayout,
  computeOutputGridRowHeight,
  computeOutputPreviewFrameHeight,
} from "../apps/web/src/components/nodes/outputPreviewLayout.ts";

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
    450,
    "single portrait image should use its fitted height so the filename row is visible without scrolling",
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

  const tallNodeTwoPortraits = computeOutputGridRowHeight({
    count: 2,
    columns: 2,
    nodeWidth: 260,
    nodeHeight: 1080,
    media: [
      { width: 1024, height: 1536 },
      { width: 1024, height: 1536 },
    ],
  });
  assert.equal(
    tallNodeTwoPortraits,
    174,
    "multi-item portrait grid should follow media ratio instead of stretching to a very tall node",
  );

  const tallNodeTwoLandscapeVideos = computeOutputGridRowHeight({
    count: 2,
    columns: 2,
    nodeWidth: 320,
    nodeHeight: 980,
    media: [
      { width: 1920, height: 1080 },
      { width: 1920, height: 1080 },
    ],
  });
  assert.equal(
    tallNodeTwoLandscapeVideos,
    96,
    "multi-item landscape video grid should stay compact in a tall output node",
  );

  const wideTwoPortraitColumns = computeOutputGridColumns({
    count: 2,
    nodeWidth: 840,
  });
  assert.equal(
    wideTwoPortraitColumns,
    2,
    "two generated items should stay in two balanced columns instead of shrinking into a four-column grid",
  );

  const wideTwoPortraitLayout = computeOutputGridLayout({
    count: 2,
    nodeWidth: 840,
    nodeHeight: 820,
    media: [
      { width: 1024, height: 1536 },
      { width: 1024, height: 1536 },
    ],
  });
  assert.equal(wideTwoPortraitLayout.columns, 2, "wide two-item output should use two columns");
  assert.ok(
    wideTwoPortraitLayout.mediaHeight >= 560,
    "two portrait images should grow with the node width instead of staying as tiny thumbnails",
  );
  assert.ok(
    wideTwoPortraitLayout.gridHeight < 720,
    "two portrait output grid should not create an infinitely tall empty panel",
  );

  const narrowTwoPortraitLayout = computeOutputGridLayout({
    count: 2,
    nodeWidth: 300,
    nodeHeight: 980,
    media: [
      { width: 1024, height: 1536 },
      { width: 1024, height: 1536 },
    ],
  });
  assert.equal(narrowTwoPortraitLayout.columns, 1, "narrow two-item output should stack vertically");

  console.log("PASS output node preview layout uses media-fit heights");
}

run();
