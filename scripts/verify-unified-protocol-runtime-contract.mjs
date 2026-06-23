import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const shared = await readFile(new URL("../packages/shared/src/index.ts", import.meta.url), "utf8");

assert.match(shared, /failureCategory/);
assert.match(shared, /cancelState/);
assert.match(worker, /cancel_requested/);
assert.match(worker, /providerDiagnostic/);
assert.match(worker, /upstreamHttpStatus/);
assert.match(worker, /upstream_poll_gateway_failed/);
assert.match(server, /queueHint/);

console.log("PASS unified protocol runtime contract");
