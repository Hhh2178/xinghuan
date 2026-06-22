import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");

assert.match(
  node,
  /const shouldHydrateAuthoritativeAppInfo = selectedWorkflowPreset\?\.kind === 'app';/,
  "RunningHub node should explicitly detect app presets for authoritative hydration",
);

assert.match(
  node,
  /if \(!shouldHydrateAuthoritativeAppInfo && presetFieldCount > 0\) return;/,
  "RunningHub node should keep hydrating app presets even when local preset fields already exist",
);

assert.match(
  node,
  /const hydrateKey = `\$\{selectedWorkflowPreset\.catalogId\}:\$\{resolvedRunTargetId\}:\$\{shouldHydrateAuthoritativeAppInfo \? 'app-authoritative' : 'workflow-empty'\}`;/,
  "RunningHub node should separate app authoritative hydration from workflow empty-shell hydration",
);

console.log("PASS runninghub app authoritative hydration contract");
