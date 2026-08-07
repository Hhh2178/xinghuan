import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./verify-grsai-gpt-image-canary.mjs", import.meta.url), "utf8");

assert.match(source, /XINGHUAN_ALLOW_PAID_IMAGE_TEST[\s\S]*"1"/, "canary must require an explicit paid-test gate");
assert.match(source, /XINGHUAN_GRSAI_CANARY_PREFLIGHT_ONLY/, "canary must expose a non-billable readiness mode");
assert.match(source, /apiCanvasRunsEnabled[\s\S]*workerCanvasRunsEnabled/, "canary must verify both process gates");
assert.match(source, /automaticRecoveryEnabled[\s\S]*false[\s\S]*qualityEvaluationEnabled[\s\S]*false/, "canary must enforce observe-mode controls");
assert.match(source, /XINGHUAN_RECONCILE_OBSERVE_MODE[\s\S]*revision:\s*controls\.revision/, "observe-mode reconciliation must use revision protection");
assert.doesNotMatch(source, /\/api\/proxy\/external\/image/, "canary must not create a second synchronous image request");
assert.equal((source.match(/request\("\/api\/admin\/tasks"/g) || []).length, 1, "canary must create exactly one task");
assert.match(source, /n:\s*1/, "canary must request exactly one image");
assert.match(source, /\/api\/generation-library\/items\?kind=image/, "canary must verify generation-library materialization");
assert.match(source, /GRSAI_CANARY_FILE_NOT_IMAGE/, "canary must verify downloadable image content");

console.log("verify-grsai-gpt-image-canary-contract: ok");
