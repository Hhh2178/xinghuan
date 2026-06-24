import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const nodeConfigSection = await readFile(
  new URL("../apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx", import.meta.url),
  "utf8",
);
const nodeHelpers = await readFile(new URL("../apps/web/src/components/nodes/runninghubNodeHelpers.ts", import.meta.url), "utf8");

assert.match(
  server,
  /function createBlankRunningHubCatalogEntry\(kind: "app" \| "workflow", titleText: string\): RunningHubAdminCatalogEntry \{[\s\S]*enabled: false,/,
  "Blank RunningHub entries should default to disabled drafts so admin can create empty items first",
);

assert.match(
  nodeHelpers,
  /export function mergeNodeInfoListWithPresetMetadata\(primaryList: unknown, presetList: unknown\)/,
  "RunningHub node should merge runtime nodeInfoList with preset metadata",
);

assert.match(
  node,
  /return mergeNodeInfoListWithPresetMetadata\(appInfo\?\.nodeInfoList, localPresetAppInfo\?\.nodeInfoList\);/,
  "RunningHub node should prefer preset metadata when local catalog fields and runtime fields overlap",
);

assert.match(
  nodeConfigSection,
  /<div className={`mt-1 rounded border \$\{accent\.subBg\} px-2 py-1\.5`}>/,
  "Selected RH preset summary should reuse the stronger parameter-style colored panel",
);

assert.match(
  nodeConfigSection,
  /<span className="text-\[9px\] font-semibold uppercase tracking-\[0\.18em\] text-white\/60">备注<\/span>/,
  "Selected RH preset summary should show a prominent note label",
);

console.log("PASS runninghub draft and summary contract");
