import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const imageOpFrame = await readFile(new URL("../apps/web/src/components/nodes/ImageOpFrame.tsx", import.meta.url), "utf8");
const resizeNode = await readFile(new URL("../apps/web/src/components/nodes/ResizeNode.tsx", import.meta.url), "utf8");
const upstreamHook = await readFile(new URL("../apps/web/src/components/nodes/useUpstreamMaterials.ts", import.meta.url), "utf8");
const inputDiagnostic = await readFile(new URL("../apps/web/src/components/nodes/imageOpInput.ts", import.meta.url), "utf8");
const apiRoutes = await readFile(new URL("../apps/api/src/image-operation-routes.ts", import.meta.url), "utf8");
const apiServer = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(imageOpFrame, /useUpstreamMaterials/, "ImageOpFrame should consume upstream materials explicitly");
assert.match(imageOpFrame, /explicitInputImages/, "ImageOpFrame should normalize explicit input image arrays");
assert.match(imageOpFrame, /upstream\.images\.map\(\(item\) => item\.url\)/, "ImageOpFrame should resolve the full upstream image list");
assert.match(resizeNode, /runOp=\{async \(img\)/, "ResizeNode should still operate on resolved image input");
assert.match(upstreamHook, /const arrFields = \['imageUrls', 'urls', 'generatedImages'\]/, "upstream hook should preserve image array extraction");
assert.match(imageOpFrame, /missingImageInputMessage\(upstream\)/, "image operations should diagnose incompatible upstream material types");
assert.doesNotMatch(imageOpFrame, /UPSTREAM_IMAGE_NOT_FOUND/, "image operation UI should not expose an internal missing-image code");
assert.match(inputDiagnostic, /首尾帧获取/, "video input guidance should point users to a frame extraction node");
assert.match(apiRoutes, /"resize"/, "the API should expose the resize operation route");
assert.match(apiRoutes, /IMAGE_SOURCE_FORBIDDEN/, "image operations should enforce user-scoped storage roots");
assert.match(apiServer, /handleImageOperationRoutes/, "the main API server should register image operation routes");

console.log("PASS image op upstream material contract present");
