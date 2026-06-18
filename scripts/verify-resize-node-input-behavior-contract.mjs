import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const frame = await readFile(new URL("../apps/web/src/components/nodes/ImageOpFrame.tsx", import.meta.url), "utf8");
const resizeNode = await readFile(new URL("../apps/web/src/components/nodes/ResizeNode.tsx", import.meta.url), "utf8");

assert.match(frame, /upstream\.images\.map\(\(item\) => item\.url\)/, "ImageOpFrame should consider the full upstream image list");
assert.match(frame, /const explicitInputImages = Array\.isArray\(inputImages\)/, "ImageOpFrame should normalize explicit upstream images");
assert.match(resizeNode, /const \[widthInput, setWidthInput\]/, "ResizeNode should allow draft width input editing");
assert.match(resizeNode, /const \[heightInput, setHeightInput\]/, "ResizeNode should allow draft height input editing");
assert.match(resizeNode, /onBlur=\{\(\) => commitDimension\('width', widthInput\)\}/, "ResizeNode should commit width on blur");
assert.match(resizeNode, /onBlur=\{\(\) => commitDimension\('height', heightInput\)\}/, "ResizeNode should commit height on blur");

console.log("PASS resize node input behavior contract present");
