import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const detailSource = await readFile(
  new URL("../apps/admin/src/admin-comfyui-detail.tsx", import.meta.url),
  "utf8",
);
const overviewSource = await readFile(
  new URL("../apps/admin/src/admin-comfyui-overview.tsx", import.meta.url),
  "utf8",
);

assert.match(
  detailSource,
  /后端执行地址/,
  "detail page should label the editable execution address explicitly",
);
assert.match(
  detailSource,
  /机器本地 ComfyUI 地址/,
  "detail page should expose the connector-reported local ComfyUI address separately",
);
assert.match(
  detailSource,
  /reportedBaseUrl/,
  "detail page should read the reported base url field",
);
assert.match(
  overviewSource,
  /reportedBaseUrl/,
  "overview cards should expose the machine-local ComfyUI address when present",
);
assert.match(
  overviewSource,
  /resolveDisplayHealth|effectiveHealth|lastConnectionOk/,
  "overview should derive display health instead of trusting the persisted raw health only",
);

console.log("admin comfyui instance address ui contract: ok");
