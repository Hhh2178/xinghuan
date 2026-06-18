import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../apps/web/src/utils/runninghubNodeSchema.ts", import.meta.url), "utf8");

assert.match(service, /RhCatalogItem/);
assert.match(service, /fetchRunningHubCatalog/);
assert.match(schema, /buildRunningHubNodeSchema/);
assert.match(node, /text-in/);
assert.match(node, /image-in/);
assert.match(node, /video-in/);
assert.match(node, /audio-in/);
assert.match(node, /json-in/);

console.log("PASS runninghub single node contract");
