import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../apps/api/src/comfyui-public-routes.ts", import.meta.url), "utf8");
assert.match(runtime, /outputs\b/, "public route must return named outputs");

const execution = await readFile(new URL("../apps/api/src/comfyui-execution.ts", import.meta.url), "utf8");
assert.match(execution, /inputSchema/, "execution must consume normalized input schema");
assert.match(
  execution,
  /buildNamedComfyuiOutputs|collectComfyuiNamedOutputs/,
  "execution must build named output payloads",
);

console.log("comfyui workflow runtime contract: ok");
