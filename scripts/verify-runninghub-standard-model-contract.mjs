import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [service, worker, adapter, media] = await Promise.all([
  readFile(new URL("../apps/api/src/provider-generation-task-service.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/worker/src/worker-runninghub-standard-adapter.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/worker/src/worker-runninghub-standard-media.ts", import.meta.url), "utf8"),
]);

assert.match(service, /runningHubExecutionMode/);
assert.match(service, /runningHubModelPath/);
assert.match(worker, /executeRunningHubStandardModel/);
assert.match(worker, /runningHubExecutionMode/);
assert.match(worker, /catalog_target/);
assert.match(adapter, /\/openapi\/v2\/query/);
assert.match(adapter, /`runninghub-standard-\$\{input\.capability\}`/);
assert.match(media, /\/openapi\/v2\/media\/upload\/binary/);
assert.doesNotMatch(media, /form\.append\("apiKey"/);

console.log("RunningHub standard model contract: ok");
