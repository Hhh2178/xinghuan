import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const registrySource = await readFile(new URL("../apps/api/src/comfyui-workflow-registry.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../apps/api/src/comfyui-instance-routes.ts", import.meta.url), "utf8");
const nodeRegistrySource = await readFile(new URL("../apps/web/src/config/nodeRegistry.ts", import.meta.url), "utf8");
const canvasSource = await readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8");

assert.match(serverSource, /handleComfyuiInstanceRoutes/, "server should mount ComfyUI instance routes");
assert.match(routeSource, /\/api\/admin\/comfyui\/instances/, "admin should expose a ComfyUI instance API root");
assert.match(routeSource, /push-to-shared/, "routes should expose push-to-shared workflow action");
assert.match(registrySource, /buildComfyuiWorkflowDraft/, "registry should build instance workflow drafts");
assert.match(registrySource, /normalizeComfyuiWorkflowSchema/, "registry should normalize exposed fields and defaults");
assert.match(nodeRegistrySource, /comfyui-app/, "canvas should register a backend-managed comfyui app node");
assert.match(canvasSource, /ComfyUIApplicationNode/, "new canvas node should be wired into the canvas registry");

console.log("comfyui instance pool contract: ok");
