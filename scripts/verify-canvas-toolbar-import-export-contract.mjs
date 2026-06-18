import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/CanvasToolbar.tsx", import.meta.url), "utf8");

assert.match(source, /onClick=\{onExport\} title="导出画布 JSON"/, "upload-style toolbar button should trigger export");
assert.match(source, /<Upload size=\{16\} \/>/, "export button should keep upload icon");
assert.match(source, /onClick=\{onImport\} title="导入画布 JSON"/, "download-style toolbar button should trigger import");
assert.match(source, /<Download size=\{16\} \/>/, "import button should keep download icon");

console.log("PASS canvas toolbar import/export contract present");
