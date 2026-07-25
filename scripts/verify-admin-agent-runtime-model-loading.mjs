import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [loader, main] = await Promise.all([
  readFile(new URL("../apps/admin/src/admin-data-loaders.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8"),
]);

assert.match(
  loader,
  /workspaceId === "automation"[\s\S]{0,500}\/api\/admin\/models/,
  "automation workspace must load the model catalog directly",
);
assert.match(
  main,
  /<AdminAgentGovernanceWorkspace[\s\S]{0,300}models=\{models\}/,
  "Agent governance must receive the directly loaded model catalog",
);

console.log("admin Agent runtime model loading contract: ok");
