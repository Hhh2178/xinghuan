import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const imageOpFrame = await readFile(new URL("../apps/web/src/components/nodes/ImageOpFrame.tsx", import.meta.url), "utf8");
const resizeNode = await readFile(new URL("../apps/web/src/components/nodes/ResizeNode.tsx", import.meta.url), "utf8");
const upstreamHook = await readFile(new URL("../apps/web/src/components/nodes/useUpstreamMaterials.ts", import.meta.url), "utf8");

assert.match(imageOpFrame, /useUpstreamMaterials/, "ImageOpFrame should consume upstream materials explicitly");
assert.match(imageOpFrame, /explicitInputImages/, "ImageOpFrame should normalize explicit input image arrays");
assert.match(imageOpFrame, /upstream\.images\.map\(\(item\) => item\.url\)/, "ImageOpFrame should resolve the full upstream image list");
assert.match(resizeNode, /runOp=\{async \(img\)/, "ResizeNode should still operate on resolved image input");
assert.match(upstreamHook, /const arrFields = \['imageUrls', 'urls', 'generatedImages'\]/, "upstream hook should preserve image array extraction");

console.log("PASS image op upstream material contract present");
