import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

const checks = [
  [
    "RunningHub enabled-entry guard accepts explicit empty nodeInfoList workflows",
    /function hasRunningHubExplicitEmptyNodeInfoList[\s\S]*Array\.isArray\(payload\.nodeInfoList\)[\s\S]*payload\.nodeInfoList\.length <= 0/i.test(server),
  ],
  [
    "Enabled-entry guard no longer hard-blocks all fieldless RunningHub entries",
    /if \(hasRunningHubFieldDefinitions\(entry\.fields\)\) return;[\s\S]*if \(allowsRunningHubEntryWithoutFields\(entry\.testPayload\)\) return;/i.test(server),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
