import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modelCoreSource = readFileSync(join(root, "packages", "model-core", "src", "index.ts"), "utf8");
const videoNodeSource = readFileSync(join(root, "apps", "web", "src", "components", "nodes", "VideoNode.tsx"), "utf8");
const adminModelEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const apiSource = readFileSync(join(root, "apps", "api", "src", "external-proxy.ts"), "utf8");

assert.match(modelCoreSource, /durationMode\?: ModelDurationMode/);
assert.match(modelCoreSource, /durationRange\?: ModelDurationRange/);
assert.match(modelCoreSource, /export function durationOptionsFromRange/);
assert.match(modelCoreSource, /mode\?: "tiers" \| "range"/);

assert.match(videoNodeSource, /durationOptionsFromRange/);
assert.match(videoNodeSource, /backendModel\.ui\.durationMode/);
assert.match(videoNodeSource, /backendModel\.ui\.durationRange/);

assert.match(adminModelEditorSource, /视频时长配置/);
assert.match(adminModelEditorSource, /时长模式/);
assert.match(adminModelEditorSource, /durationOptionsFromRange/);
assert.match(adminModelEditorSource, /syncVideoDurationSchema/);

assert.match(apiSource, /normalizeVideoDurationValue/);

console.log(JSON.stringify({ ok: true }, null, 2));
