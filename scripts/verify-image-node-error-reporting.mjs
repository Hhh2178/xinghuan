import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /const imageGenerationErrorMessage = \(error: unknown\) =>/,
  "ImageNode should normalize upstream generation errors before surfacing them",
);

assert.doesNotMatch(
  source,
  /if \(aggregatedImageUrls\.length === 0\) throw new Error\('生成完成但未返回图片'\);/,
  "ImageNode should not replace upstream failures with a generic completed-without-image placeholder",
);

assert.match(
  source,
  /图片生成失败：\$\{reasons\.join\('；'\)\}/,
  "ImageNode should preserve concrete batch failure reasons when every generation fails",
);

console.log("PASS image node preserves upstream failure reasons");
