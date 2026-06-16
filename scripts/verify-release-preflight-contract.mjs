import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const scriptPath = join(root, "scripts", "capture-release-preflight.mjs");
const source = readFileSync(scriptPath, "utf8");

assert.match(source, /inferReleaseCurrentLink\(\)/, "capture-release-preflight should infer current release link");
assert.match(source, /inferServiceName\("api"\)/, "capture-release-preflight should infer api service name");
assert.match(source, /inferServiceName\("worker"\)/, "capture-release-preflight should infer worker service name");
assert.match(source, /new URL\(baseUrl\)/, "capture-release-preflight should parse baseUrl for inference");
assert.match(source, /18100/, "capture-release-preflight should know production port");
assert.match(source, /18200/, "capture-release-preflight should know gray port");
assert.match(source, /\/opt\/apps\/xinghuan-canvas\/current/, "capture-release-preflight should infer production current link");
assert.match(source, /\/opt\/apps\/xinghuan-canvas-next\/current/, "capture-release-preflight should infer gray current link");
assert.match(source, /xinghuan-canvas\.service/, "capture-release-preflight should infer production api service");
assert.match(source, /xinghuan-canvas-worker\.service/, "capture-release-preflight should infer production worker service");
assert.match(source, /xinghuan-canvas-next\.service/, "capture-release-preflight should infer gray api service");
assert.match(source, /xinghuan-canvas-next-worker\.service/, "capture-release-preflight should infer gray worker service");

console.log(JSON.stringify({ ok: true, verifiedFile: scriptPath }, null, 2));
