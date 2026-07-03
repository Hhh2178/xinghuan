import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootPackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const serverSource = await readFile(
  new URL("../apps/api/src/server.ts", import.meta.url),
  "utf8",
);
const registrySource = await readFile(
  new URL("../apps/api/src/comfyui-workflow-registry.ts", import.meta.url),
  "utf8",
);
const routeSource = await readFile(
  new URL("../apps/api/src/comfyui-instance-routes.ts", import.meta.url),
  "utf8",
);
const nodeRegistrySource = await readFile(
  new URL("../apps/web/src/config/nodeRegistry.ts", import.meta.url),
  "utf8",
);
const canvasSource = await readFile(
  new URL("../apps/web/src/components/Canvas.tsx", import.meta.url),
  "utf8",
);
const comfyuiPublicRoutesSource = await readFile(
  new URL("../apps/api/src/comfyui-public-routes.ts", import.meta.url),
  "utf8",
);
const comfyuiWebServiceSource = await readFile(
  new URL("../apps/web/src/services/comfyuiApps.ts", import.meta.url),
  "utf8",
);
const connectorPackage = JSON.parse(
  await readFile(
    new URL("../apps/comfyui-connector/package.json", import.meta.url),
    "utf8",
  ),
);
const providerDoc = await readFile(
  new URL("../docs/systems/providers/protocol-layering.md", import.meta.url),
  "utf8",
);
const adminDoc = await readFile(
  new URL(
    "../docs/systems/admin/protocol-and-capabilities.md",
    import.meta.url,
  ),
  "utf8",
);
const canvasDoc = await readFile(
  new URL("../docs/systems/canvas/node-and-data-model.md", import.meta.url),
  "utf8",
);
const materialFlowDoc = await readFile(
  new URL(
    "../docs/systems/canvas/project-and-material-flow.md",
    import.meta.url,
  ),
  "utf8",
);
const apiDoc = await readFile(
  new URL("../docs/systems/api/interface-map.md", import.meta.url),
  "utf8",
);

assert.match(
  serverSource,
  /handleComfyuiInstanceRoutes/,
  "server should mount ComfyUI instance routes",
);
assert.match(
  routeSource,
  /\/api\/admin\/comfyui\/instances/,
  "admin should expose a ComfyUI instance API root",
);
assert.match(
  routeSource,
  /push-to-shared/,
  "routes should expose push-to-shared workflow action",
);
assert.match(
  registrySource,
  /buildComfyuiWorkflowDraft/,
  "registry should build instance workflow drafts",
);
assert.match(
  registrySource,
  /normalizeComfyuiWorkflowSchema/,
  "registry should normalize exposed fields and defaults",
);
assert.match(
  registrySource,
  /instanceBindings/,
  "registry should persist machine binding data",
);
assert.match(
  routeSource,
  /\/api\/internal\/comfyui\/connectors\/register/,
  "server should expose connector registration",
);
assert.match(
  routeSource,
  /x-comfyui-connector-token/,
  "connector routes should enforce token auth",
);
assert.match(
  nodeRegistrySource,
  /type: 'comfyui', label: 'comfyui'/,
  "canvas should expose the unified backend-managed comfyui node",
);
assert.match(
  canvasSource,
  /comfyui: ComfyUINode/,
  "new canvas node should be wired into the canvas registry",
);
assert.ok(
  rootPackage.workspaces.includes("apps/*"),
  "workspace layout should allow connector apps",
);
assert.equal(connectorPackage.name, "@xinghuan/comfyui-connector");
assert.match(
  providerDoc,
  /ComfyUI Connector/,
  "provider docs should describe the local connector",
);
assert.match(
  providerDoc,
  /实例专属工作流/,
  "provider docs should describe instance-scoped workflows",
);
assert.match(
  providerDoc,
  /推送到共享区/,
  "provider docs should describe push-to-shared publishing",
);
assert.match(
  adminDoc,
  /管理员/,
  "admin docs should describe admin-only governance",
);
assert.match(
  canvasDoc,
  /comfyui-app|comfyui/,
  "canvas docs should describe the backend-managed node",
);
assert.match(
  materialFlowDoc,
  /共享工作流/,
  "material flow docs should describe the shared workflow zone",
);
assert.match(
  apiDoc,
  /\/api\/internal\/comfyui\/connectors\/register/,
  "api map should include the connector route",
);
assert.match(
  apiDoc,
  /\/api\/comfyui\/apps/,
  "api map should include the public comfyui catalog",
);
assert.match(
  comfyuiPublicRoutesSource,
  /runMatch/,
  "public routes should expose a comfyui run endpoint",
);
assert.match(
  comfyuiPublicRoutesSource,
  /instanceBindings/,
  "public catalog should expose workflow machine bindings",
);
assert.match(
  comfyuiPublicRoutesSource,
  /submitComfyuiPrompt/,
  "public comfyui route should submit prompts through the dedicated execution path",
);
assert.match(
  comfyuiWebServiceSource,
  /instanceId/,
  "web comfyui service should submit selected instance id",
);
assert.match(
  comfyuiWebServiceSource,
  /sharedWorkflowId|workflowId/,
  "web comfyui service should call the dedicated comfyui run endpoint",
);

console.log("comfyui instance pool contract: ok");
