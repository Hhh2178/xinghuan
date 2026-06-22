import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");

assert.match(
  node,
  /function normalizeRemoteNodeInfoList\(/,
  "RunningHub node should normalize remote app info before rendering",
);

assert.match(
  node,
  /JSON\.parse\(trimmedFieldData\)/,
  "RunningHub node should parse JSON fieldData strings returned by RunningHub app info",
);

assert.match(
  node,
  /displayLabel: existing\?\.displayLabel \|\| parsedDisplayLabel/,
  "RunningHub node should preserve backend display labels when remote app info is hydrated",
);

console.log("PASS runninghub app info normalization contract");
