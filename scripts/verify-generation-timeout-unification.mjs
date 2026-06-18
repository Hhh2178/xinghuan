import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const workerSource = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const proxySource = await readFile(new URL("../apps/api/src/external-proxy.ts", import.meta.url), "utf8");

assert.match(workerSource, /timeoutMs:\s*clampNumber\(task\.payload\.timeoutMs \|\| task\.payload\.maxPollMs \|\| task\.payload\.pollTimeoutMs/, "worker GRSAI adapter should honor task timeout payload");
assert.match(proxySource, /pollTimeoutMs = deps\.clampInteger\(input\.advancedConfig\.pollTimeoutMs/, "external proxy should still honor advancedConfig pollTimeoutMs");

console.log("PASS timeout unification contract present");
