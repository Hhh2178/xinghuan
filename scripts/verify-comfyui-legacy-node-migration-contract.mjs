import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationSource = await readFile(
  new URL("../apps/web/src/utils/nodeMigration.ts", import.meta.url),
  "utf8",
);

assert.match(
  migrationSource,
  /type !== 'comfyui-app' && type !== 'comfyui-store' && type !== 'comfyui-app-maker'/,
  "migration must explicitly cover all three legacy comfyui node types",
);
assert.match(
  migrationSource,
  /type: 'comfyui'/,
  "legacy comfyui nodes must migrate into the unified comfyui type",
);
assert.match(
  migrationSource,
  /comfyuiWorkflowId/,
  "migration must hydrate the canonical comfyui workflow id field",
);
assert.match(
  migrationSource,
  /旧 ComfyUI 节点已迁移为统一 comfyui 节点/,
  "migration must leave a visible user-facing note for removed legacy node modes",
);

console.log("comfyui legacy node migration contract: ok");
