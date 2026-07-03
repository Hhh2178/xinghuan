import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const detail = await readFile(new URL("../apps/admin/src/admin-comfyui-detail.tsx", import.meta.url), "utf8");
assert.match(detail, /selectedWorkflowId/, "detail page must keep a selected workflow workspace");
assert.match(detail, /admin-comfyui-governance-layout/, "detail page must expose a governance workspace layout");
assert.match(detail, /解析输入输出映射/, "detail page must guide the upload-to-governance next step");

const card = await readFile(new URL("../apps/admin/src/admin-comfyui-workflow-card.tsx", import.meta.url), "utf8");
assert.match(card, /workflow\.analysis/, "workflow card must render parser analysis");
assert.match(card, /inputSchema/, "workflow card must edit normalized input schema");
assert.match(card, /outputSchema/, "workflow card must edit normalized output schema");
assert.match(card, /<details/, "workflow card must keep advanced JSON in a secondary foldout");
assert.doesNotMatch(card, /exposedFieldsText/, "workflow card should not center raw exposedFields JSON editing anymore");

console.log("admin comfyui governance contract: ok");
